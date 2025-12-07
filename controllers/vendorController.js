const Vendor = require('../models/Vendor');

/**
 * Create a new vendor
 * POST /api/vendors
 */
exports.createVendor = async (req, res) => {
  try {
    const { name, email, company, phone, address, categories, notes } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: 'Name and email are required'
      });
    }

    // Check if vendor with email already exists
    const existingVendor = await Vendor.findOne({ email: email.toLowerCase() });
    if (existingVendor) {
      return res.status(400).json({
        success: false,
        message: 'A vendor with this email already exists'
      });
    }

    const vendor = new Vendor({
      name,
      email,
      company,
      phone,
      address,
      categories,
      notes
    });

    await vendor.save();

    res.status(201).json({
      success: true,
      message: 'Vendor created successfully',
      data: vendor
    });
  } catch (error) {
    console.error('Error creating vendor:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating vendor',
      error: error.message
    });
  }
};

/**
 * Get all vendors
 * GET /api/vendors
 */
exports.getAllVendors = async (req, res) => {
  try {
    const { search, category, isActive } = req.query;
    
    let query = {};
    
    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Category filter
    if (category) {
      query.categories = category;
    }
    
    // Active filter
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const vendors = await Vendor.find(query).sort({ name: 1 });

    res.json({
      success: true,
      count: vendors.length,
      data: vendors
    });
  } catch (error) {
    console.error('Error fetching vendors:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching vendors',
      error: error.message
    });
  }
};

/**
 * Get single vendor by ID
 * GET /api/vendors/:id
 */
exports.getVendorById = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    res.json({
      success: true,
      data: vendor
    });
  } catch (error) {
    console.error('Error fetching vendor:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching vendor',
      error: error.message
    });
  }
};

/**
 * Update vendor
 * PUT /api/vendors/:id
 */
exports.updateVendor = async (req, res) => {
  try {
    // Don't allow changing email to an existing one
    if (req.body.email) {
      const existingVendor = await Vendor.findOne({ 
        email: req.body.email.toLowerCase(),
        _id: { $ne: req.params.id }
      });
      if (existingVendor) {
        return res.status(400).json({
          success: false,
          message: 'A vendor with this email already exists'
        });
      }
    }

    const vendor = await Vendor.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    res.json({
      success: true,
      message: 'Vendor updated successfully',
      data: vendor
    });
  } catch (error) {
    console.error('Error updating vendor:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating vendor',
      error: error.message
    });
  }
};

/**
 * Delete vendor
 * DELETE /api/vendors/:id
 */
exports.deleteVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findByIdAndDelete(req.params.id);

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    res.json({
      success: true,
      message: 'Vendor deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting vendor:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting vendor',
      error: error.message
    });
  }
};

/**
 * Bulk create vendors
 * POST /api/vendors/bulk
 */
exports.bulkCreateVendors = async (req, res) => {
  try {
    const { vendors } = req.body;

    if (!vendors || !Array.isArray(vendors)) {
      return res.status(400).json({
        success: false,
        message: 'Vendors array is required'
      });
    }

    const results = {
      created: [],
      failed: []
    };

    for (const vendorData of vendors) {
      try {
        if (!vendorData.name || !vendorData.email) {
          results.failed.push({
            data: vendorData,
            error: 'Name and email are required'
          });
          continue;
        }

        const existingVendor = await Vendor.findOne({ 
          email: vendorData.email.toLowerCase() 
        });
        
        if (existingVendor) {
          results.failed.push({
            data: vendorData,
            error: 'Email already exists'
          });
          continue;
        }

        const vendor = new Vendor(vendorData);
        await vendor.save();
        results.created.push(vendor);
      } catch (err) {
        results.failed.push({
          data: vendorData,
          error: err.message
        });
      }
    }

    res.status(201).json({
      success: true,
      message: `Created ${results.created.length} vendors, ${results.failed.length} failed`,
      data: results
    });
  } catch (error) {
    console.error('Error bulk creating vendors:', error);
    res.status(500).json({
      success: false,
      message: 'Error bulk creating vendors',
      error: error.message
    });
  }
};

