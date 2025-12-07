const mongoose = require('mongoose');

const itemPricingSchema = new mongoose.Schema({
  itemName: String,
  quantity: Number,
  unitPrice: Number,
  totalPrice: Number,
  notes: String
});

const proposalSchema = new mongoose.Schema({
  rfpId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'RFP', 
    required: true,
    index: true
  },
  vendorId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Vendor', 
    required: true,
    index: true
  },
  // Original email data
  emailSubject: {
    type: String
  },
  emailBody: {
    type: String
  },
  emailFrom: {
    type: String
  },
  emailDate: {
    type: Date
  },
  // AI-parsed structured data
  parsedData: {
    totalPrice: { type: Number },
    itemPricing: [itemPricingSchema],
    deliveryTimeline: { type: String },
    deliveryDays: { type: Number },
    paymentTerms: { type: String },
    warranty: { type: String },
    validityPeriod: { type: String },
    conditions: [String],
    notes: { type: String }
  },
  // AI-generated scores and analysis
  scores: {
    priceScore: { type: Number, min: 0, max: 100 },
    deliveryScore: { type: Number, min: 0, max: 100 },
    termsScore: { type: Number, min: 0, max: 100 },
    overallScore: { type: Number, min: 0, max: 100 },
    aiSummary: { type: String },
    pros: [String],
    cons: [String]
  },
  attachments: [{
    filename: String,
    originalName: String,
    mimeType: String,
    size: Number,
    path: String,
    parsedContent: String
  }],
  status: {
    type: String,
    enum: ['received', 'parsed', 'evaluated', 'selected', 'rejected'],
    default: 'received'
  },
  isParsingComplete: {
    type: Boolean,
    default: false
  },
  receivedAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

proposalSchema.pre('save', function() {
  this.updatedAt = Date.now();
});

// Compound index for efficient queries
proposalSchema.index({ rfpId: 1, vendorId: 1 });

module.exports = mongoose.model('Proposal', proposalSchema);

