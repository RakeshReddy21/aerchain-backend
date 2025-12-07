const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  quantity: { type: Number, default: 1 },
  specifications: { type: String },
  estimatedUnitPrice: { type: Number }
});

const rfpSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true,
    trim: true
  },
  description: { 
    type: String,
    trim: true
  },
  originalInput: {
    type: String,
    required: true
  },
  budget: { 
    type: Number,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD'
  },
  deadline: { 
    type: Date 
  },
  deliveryDays: {
    type: Number
  },
  items: [itemSchema],
  requirements: {
    paymentTerms: { type: String },
    warranty: { type: String },
    deliveryLocation: { type: String },
    additionalTerms: [String]
  },
  status: { 
    type: String, 
    enum: ['draft', 'sent', 'responses_received', 'evaluated', 'awarded', 'closed'],
    default: 'draft' 
  },
  selectedVendors: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor'
  }],
  sentAt: {
    type: Date
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
rfpSchema.pre('save', function() {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model('RFP', rfpSchema);

