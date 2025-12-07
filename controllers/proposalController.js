const Proposal = require('../models/Proposal');
const RFP = require('../models/RFP');
const Vendor = require('../models/Vendor');
const aiService = require('../services/aiService');
const emailService = require('../services/emailService');

/**
 * Create a proposal manually (for testing or manual entry)
 * POST /api/proposals
 */
exports.createProposal = async (req, res) => {
  try {
    const { rfpId, vendorId, emailSubject, emailBody } = req.body;

    if (!rfpId || !vendorId) {
      return res.status(400).json({
        success: false,
        message: 'rfpId and vendorId are required'
      });
    }

    // Verify RFP exists
    const rfp = await RFP.findById(rfpId);
    if (!rfp) {
      return res.status(404).json({
        success: false,
        message: 'RFP not found'
      });
    }

    // Verify vendor exists
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    // Check if proposal already exists for this RFP-Vendor combination
    const existingProposal = await Proposal.findOne({ rfpId, vendorId });
    if (existingProposal) {
      return res.status(400).json({
        success: false,
        message: 'A proposal from this vendor already exists for this RFP'
      });
    }

    const proposal = new Proposal({
      rfpId,
      vendorId,
      emailSubject,
      emailBody,
      emailFrom: vendor.email,
      status: 'received'
    });

    await proposal.save();

    // Update RFP status if needed
    if (rfp.status === 'sent') {
      rfp.status = 'responses_received';
      await rfp.save();
    }

    res.status(201).json({
      success: true,
      message: 'Proposal created successfully',
      data: proposal
    });
  } catch (error) {
    console.error('Error creating proposal:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating proposal',
      error: error.message
    });
  }
};

/**
 * Get all proposals
 * GET /api/proposals
 */
exports.getAllProposals = async (req, res) => {
  try {
    const { rfpId, vendorId, status } = req.query;
    
    let query = {};
    if (rfpId) query.rfpId = rfpId;
    if (vendorId) query.vendorId = vendorId;
    if (status) query.status = status;

    const proposals = await Proposal.find(query)
      .populate('rfpId', 'title status')
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
 * Get single proposal by ID
 * GET /api/proposals/:id
 */
exports.getProposalById = async (req, res) => {
  try {
    const proposal = await Proposal.findById(req.params.id)
      .populate('rfpId', 'title description budget items requirements')
      .populate('vendorId', 'name email company phone');

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }

    res.json({
      success: true,
      data: proposal
    });
  } catch (error) {
    console.error('Error fetching proposal:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching proposal',
      error: error.message
    });
  }
};

/**
 * Parse proposal with AI
 * POST /api/proposals/:id/parse
 */
exports.parseProposal = async (req, res) => {
  try {
    const proposal = await Proposal.findById(req.params.id)
      .populate('rfpId', 'title description items');

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }

    if (!proposal.emailBody) {
      return res.status(400).json({
        success: false,
        message: 'No email body to parse'
      });
    }

    // Use AI to parse the proposal
    const rfpContext = proposal.rfpId ? 
      `${proposal.rfpId.title}: ${proposal.rfpId.description || ''}` : 
      'Unknown RFP';

    const parseResult = await aiService.parseVendorProposal(
      proposal.emailBody,
      proposal.emailSubject || '',
      rfpContext
    );

    if (!parseResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to parse proposal',
        error: parseResult.error
      });
    }

    // Update proposal with parsed data
    proposal.parsedData = parseResult.data;
    proposal.isParsingComplete = true;
    proposal.status = 'parsed';
    await proposal.save();

    res.json({
      success: true,
      message: 'Proposal parsed successfully',
      data: proposal
    });
  } catch (error) {
    console.error('Error parsing proposal:', error);
    res.status(500).json({
      success: false,
      message: 'Error parsing proposal',
      error: error.message
    });
  }
};

/**
 * Update proposal
 * PUT /api/proposals/:id
 */
exports.updateProposal = async (req, res) => {
  try {
    const proposal = await Proposal.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true, runValidators: true }
    )
    .populate('vendorId', 'name email company');

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }

    res.json({
      success: true,
      message: 'Proposal updated successfully',
      data: proposal
    });
  } catch (error) {
    console.error('Error updating proposal:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating proposal',
      error: error.message
    });
  }
};

/**
 * Delete proposal
 * DELETE /api/proposals/:id
 */
exports.deleteProposal = async (req, res) => {
  try {
    const proposal = await Proposal.findByIdAndDelete(req.params.id);

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }

    res.json({
      success: true,
      message: 'Proposal deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting proposal:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting proposal',
      error: error.message
    });
  }
};

/**
 * Check for new vendor responses via email
 * POST /api/proposals/check-emails
 */
exports.checkEmails = async (req, res) => {
  try {
    const { rfpId } = req.body;

    // Get the RFP and its selected vendors
    const rfp = await RFP.findById(rfpId).populate('selectedVendors', 'email name');
    
    if (!rfp) {
      return res.status(404).json({
        success: false,
        message: 'RFP not found'
      });
    }

    const vendorEmails = rfp.selectedVendors.map(v => v.email);
    
    // Check for emails since the RFP was sent
    const sinceDate = rfp.sentAt || rfp.createdAt;
    const result = await emailService.checkForVendorResponses(
      rfpId, 
      vendorEmails, 
      sinceDate
    );

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to check emails',
        error: result.error
      });
    }

    // Create proposals for each vendor response found
    const newProposals = [];
    for (const email of result.responses) {
      // Find the vendor by email
      const vendor = rfp.selectedVendors.find(
        v => v.email.toLowerCase() === email.fromAddress.toLowerCase()
      );

      if (vendor) {
        // Check if proposal already exists
        const existingProposal = await Proposal.findOne({ 
          rfpId: rfp._id, 
          vendorId: vendor._id 
        });

        if (!existingProposal) {
          const proposal = new Proposal({
            rfpId: rfp._id,
            vendorId: vendor._id,
            emailSubject: email.subject,
            emailBody: email.text || email.html,
            emailFrom: email.fromAddress,
            emailDate: email.date,
            attachments: email.attachments,
            status: 'received'
          });

          await proposal.save();
          newProposals.push(proposal);
        }
      }
    }

    // Update RFP status if we received any proposals
    if (newProposals.length > 0 && rfp.status === 'sent') {
      rfp.status = 'responses_received';
      await rfp.save();
    }

    res.json({
      success: true,
      message: `Found ${result.responses.length} emails, created ${newProposals.length} new proposals`,
      data: {
        emailsFound: result.responses.length,
        proposalsCreated: newProposals.length,
        proposals: newProposals
      }
    });
  } catch (error) {
    console.error('Error checking emails:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking emails',
      error: error.message
    });
  }
};

/**
 * Simulate receiving a vendor response (for demo/testing)
 * POST /api/proposals/simulate
 */
exports.simulateProposal = async (req, res) => {
  try {
    const { rfpId, vendorId, proposalText } = req.body;

    if (!rfpId || !vendorId || !proposalText) {
      return res.status(400).json({
        success: false,
        message: 'rfpId, vendorId, and proposalText are required'
      });
    }

    // Verify RFP and vendor exist
    const rfp = await RFP.findById(rfpId);
    const vendor = await Vendor.findById(vendorId);

    if (!rfp || !vendor) {
      return res.status(404).json({
        success: false,
        message: 'RFP or Vendor not found'
      });
    }

    // Create the proposal
    const proposal = new Proposal({
      rfpId,
      vendorId,
      emailSubject: `RE: RFP - ${rfp.title}`,
      emailBody: proposalText,
      emailFrom: vendor.email,
      emailDate: new Date(),
      status: 'received'
    });

    await proposal.save();

    // Parse the proposal with AI
    const rfpContext = `${rfp.title}: ${rfp.description || ''}`;
    const parseResult = await aiService.parseVendorProposal(
      proposalText,
      proposal.emailSubject,
      rfpContext
    );

    if (parseResult.success) {
      proposal.parsedData = parseResult.data;
      proposal.isParsingComplete = true;
      proposal.status = 'parsed';
      await proposal.save();
    }

    // Update RFP status
    if (rfp.status === 'sent') {
      rfp.status = 'responses_received';
      await rfp.save();
    }

    const populatedProposal = await Proposal.findById(proposal._id)
      .populate('vendorId', 'name email company');

    res.status(201).json({
      success: true,
      message: 'Proposal simulated and parsed successfully',
      data: populatedProposal
    });
  } catch (error) {
    console.error('Error simulating proposal:', error);
    res.status(500).json({
      success: false,
      message: 'Error simulating proposal',
      error: error.message
    });
  }
};

