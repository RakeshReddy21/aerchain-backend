const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendorController');

// Create vendor
router.post('/', vendorController.createVendor);

// Bulk create vendors
router.post('/bulk', vendorController.bulkCreateVendors);

// Get all vendors
router.get('/', vendorController.getAllVendors);

// Get single vendor
router.get('/:id', vendorController.getVendorById);

// Update vendor
router.put('/:id', vendorController.updateVendor);

// Delete vendor
router.delete('/:id', vendorController.deleteVendor);

module.exports = router;

