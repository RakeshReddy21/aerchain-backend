const express = require('express');
const router = express.Router();
const proposalController = require('../controllers/proposalController');

// Create proposal manually
router.post('/', proposalController.createProposal);

// Simulate receiving a proposal (for demo)
router.post('/simulate', proposalController.simulateProposal);

// Check emails for new proposals
router.post('/check-emails', proposalController.checkEmails);

// Get all proposals
router.get('/', proposalController.getAllProposals);

// Get single proposal
router.get('/:id', proposalController.getProposalById);

// Parse proposal with AI
router.post('/:id/parse', proposalController.parseProposal);

// Update proposal
router.put('/:id', proposalController.updateProposal);

// Delete proposal
router.delete('/:id', proposalController.deleteProposal);

module.exports = router;

