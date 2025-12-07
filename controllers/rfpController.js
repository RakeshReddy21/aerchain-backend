const RFP = require('../models/RFP');
const Vendor = require('../models/Vendor');
const Proposal = require('../models/Proposal');
const aiService = require('../services/aiService');
const emailService = require('../services/emailService');

/**
 * Create a new RFP from natural language input
 * POST /api/rfps
 */
exports.createRFP = async (req, res) => {
  try {
    const { naturalLanguageInput } = req.body;

    if (!naturalLanguageInput) {
      return res.status(400).json({
        success: false,
        message: 'Natural language input is required'
      });
    }

    // Parse natural language to structured RFP using AI
    const parseResult = await aiService.parseRFPFromNaturalLanguage(naturalLanguageInput);

    if (!parseResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to parse RFP',
        error: parseResult.error
      });
    }

    const parsedData = parseResult.data;

    // Create RFP document
    const rfp = new RFP({
      title: parsedData.title,
      description: parsedData.description,
      originalInput: naturalLanguageInput,
      budget: parsedData.budget,
      currency: parsedData.currency || 'USD',
      deliveryDays: parsedData.deliveryDays,
      items: parsedData.items || [],
      requirements: parsedData.requirements || {},
      status: 'draft'
    });

    // Calculate deadline if delivery days specified
    if (parsedData.deliveryDays) {
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + parsedData.deliveryDays);
      rfp.deadline = deadline;
    }

    await rfp.save();

    res.status(201).json({
      success: true,
      message: 'RFP created successfully',
      data: rfp
    });
  } catch (error) {
    console.error('Error creating RFP:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating RFP',
      error: error.message
    });
  }
};

/**
 * Get all RFPs
 * GET /api/rfps
 */
exports.getAllRFPs = async (req, res) => {
  try {
    const rfps = await RFP.find()
      .populate('selectedVendors', 'name email company')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: rfps.length,
      data: rfps
    });
  } catch (error) {
    console.error('Error fetching RFPs:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching RFPs',
      error: error.message
    });
  }
};

/**
 * Get single RFP by ID
 * GET /api/rfps/:id
 */
exports.getRFPById = async (req, res) => {
  try {
    const rfp = await RFP.findById(req.params.id)
      .populate('selectedVendors', 'name email company');

    if (!rfp) {
      return res.status(404).json({
        success: false,
        message: 'RFP not found'
      });
    }

    res.json({
      success: true,
      data: rfp
    });
  } catch (error) {
    console.error('Error fetching RFP:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching RFP',
      error: error.message
    });
  }
};

/**
 * Update RFP
 * PUT /api/rfps/:id
 */
exports.updateRFP = async (req, res) => {
  try {
    const rfp = await RFP.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    if (!rfp) {
      return res.status(404).json({
        success: false,
        message: 'RFP not found'
      });
    }

    res.json({
      success: true,
      message: 'RFP updated successfully',
      data: rfp
    });
  } catch (error) {
    console.error('Error updating RFP:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating RFP',
      error: error.message
    });
  }
};

/**
 * Delete RFP
 * DELETE /api/rfps/:id
 */
exports.deleteRFP = async (req, res) => {
  try {
    const rfp = await RFP.findByIdAndDelete(req.params.id);

    if (!rfp) {
      return res.status(404).json({
        success: false,
        message: 'RFP not found'
      });
    }

    // Also delete associated proposals
    await Proposal.deleteMany({ rfpId: req.params.id });

    res.json({
      success: true,
      message: 'RFP deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting RFP:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting RFP',
      error: error.message
    });
  }
};

/**
 * Select vendors for an RFP
 * POST /api/rfps/:id/vendors
 */
exports.selectVendors = async (req, res) => {
  try {
    const { vendorIds } = req.body;

    if (!vendorIds || !Array.isArray(vendorIds)) {
      return res.status(400).json({
        success: false,
        message: 'vendorIds array is required'
      });
    }

    const rfp = await RFP.findById(req.params.id);
    if (!rfp) {
      return res.status(404).json({
        success: false,
        message: 'RFP not found'
      });
    }

    // Verify all vendors exist
    const vendors = await Vendor.find({ _id: { $in: vendorIds } });
    if (vendors.length !== vendorIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more vendor IDs are invalid'
      });
    }

    rfp.selectedVendors = vendorIds;
    await rfp.save();

    const updatedRFP = await RFP.findById(req.params.id)
      .populate('selectedVendors', 'name email company');

    res.json({
      success: true,
      message: 'Vendors selected successfully',
      data: updatedRFP
    });
  } catch (error) {
    console.error('Error selecting vendors:', error);
    res.status(500).json({
      success: false,
      message: 'Error selecting vendors',
      error: error.message
    });
  }
};

/**
 * Send RFP to selected vendors via email
 * POST /api/rfps/:id/send
 */
exports.sendRFPToVendors = async (req, res) => {
  try {
    const rfp = await RFP.findById(req.params.id)
      .populate('selectedVendors', 'name email company');

    if (!rfp) {
      return res.status(404).json({
        success: false,
        message: 'RFP not found'
      });
    }

    if (!rfp.selectedVendors || rfp.selectedVendors.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No vendors selected for this RFP'
      });
    }

    // Send emails to all selected vendors
    const sendResults = [];
    for (const vendor of rfp.selectedVendors) {
      // Generate personalized email content using AI
      const emailResult = await aiService.generateRFPEmail(rfp, vendor.name);
      
      if (emailResult.success) {
        const sendResult = await emailService.sendEmail(
          vendor.email,
          emailResult.data.subject,
          emailResult.data.body
        );
        
        sendResults.push({
          vendorId: vendor._id,
          vendorName: vendor.name,
          email: vendor.email,
          sent: sendResult.success,
          error: sendResult.error
        });
      } else {
        sendResults.push({
          vendorId: vendor._id,
          vendorName: vendor.name,
          email: vendor.email,
          sent: false,
          error: 'Failed to generate email content'
        });
      }
    }

    // Update RFP status
    rfp.status = 'sent';
    rfp.sentAt = new Date();
    await rfp.save();

    res.json({
      success: true,
      message: 'RFP sent to vendors',
      data: {
        rfpId: rfp._id,
        sentAt: rfp.sentAt,
        results: sendResults
      }
    });
  } catch (error) {
    console.error('Error sending RFP:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending RFP',
      error: error.message
    });
  }
};

/**
 * Get proposals for an RFP
 * GET /api/rfps/:id/proposals
 */
exports.getRFPProposals = async (req, res) => {
  try {
    const proposals = await Proposal.find({ rfpId: req.params.id })
      .populate('vendorId', 'name email company')
      .sort({ receivedAt: -1 });

    res.json({
      success: true,
      count: proposals.length,
      data: proposals
    });
  } catch (error) {
    console.error('Error fetching proposals:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching proposals',
      error: error.message
    });
  }
};

/**
 * Compare proposals and get AI recommendation
 * GET /api/rfps/:id/compare
 */
exports.compareProposals = async (req, res) => {
  try {
    const rfp = await RFP.findById(req.params.id);
    if (!rfp) {
      return res.status(404).json({
        success: false,
        message: 'RFP not found'
      });
    }

    const proposals = await Proposal.find({ 
      rfpId: req.params.id,
      isParsingComplete: true 
    }).populate('vendorId', 'name email company');

    if (proposals.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No parsed proposals available for comparison'
      });
    }

    if (proposals.length === 1) {
      return res.json({
        success: true,
        message: 'Only one proposal available',
        data: {
          comparison: null,
          recommendation: {
            recommendedVendorId: proposals[0].vendorId._id,
            recommendedVendorName: proposals[0].vendorId.name,
            reasoning: 'Only one proposal received',
            risks: ['Single vendor option - no competitive comparison possible']
          },
          proposals: proposals
        }
      });
    }

    // Use AI to compare proposals
    const comparisonResult = await aiService.compareProposals(rfp, proposals);

    if (!comparisonResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to compare proposals',
        error: comparisonResult.error
      });
    }

    // Update proposal scores based on AI analysis
    for (const vendorScore of comparisonResult.data.vendorScores) {
      await Proposal.findOneAndUpdate(
        { rfpId: req.params.id, vendorId: vendorScore.vendorId },
        {
          'scores.priceScore': vendorScore.priceScore,
          'scores.deliveryScore': vendorScore.deliveryScore,
          'scores.termsScore': vendorScore.termsScore,
          'scores.overallScore': vendorScore.overallScore,
          'scores.pros': vendorScore.pros,
          'scores.cons': vendorScore.cons,
          'scores.aiSummary': vendorScore.summary,
          status: 'evaluated'
        }
      );
    }

    // Update RFP status
    rfp.status = 'evaluated';
    await rfp.save();

    res.json({
      success: true,
      data: comparisonResult.data
    });
  } catch (error) {
    console.error('Error comparing proposals:', error);
    res.status(500).json({
      success: false,
      message: 'Error comparing proposals',
      error: error.message
    });
  }
};

