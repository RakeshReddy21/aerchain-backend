const express = require('express');
const router = express.Router();
const rfpController = require('../controllers/rfpController');

// Create RFP from natural language
router.post('/', rfpController.createRFP);

// Get all RFPs
router.get('/', rfpController.getAllRFPs);

// Get single RFP
router.get('/:id', rfpController.getRFPById);

// Update RFP
router.put('/:id', rfpController.updateRFP);

// Delete RFP
router.delete('/:id', rfpController.deleteRFP);

// Select vendors for an RFP
router.post('/:id/vendors', rfpController.selectVendors);

// Send RFP to selected vendors
router.post('/:id/send', rfpController.sendRFPToVendors);

// Get proposals for an RFP
router.get('/:id/proposals', rfpController.getRFPProposals);

// Compare proposals and get recommendation
router.get('/:id/compare', rfpController.compareProposals);

module.exports = router;

