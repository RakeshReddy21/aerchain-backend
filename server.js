const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000' || 'https://aerchain-frontend-puce.vercel.app/',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// API Routes
app.use('/api/rfps', require('./routes/rfpRoutes'));
app.use('/api/vendors', require('./routes/vendorRoutes'));
app.use('/api/proposals', require('./routes/proposalRoutes'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'RFP Management API is running',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'AI-Powered RFP Management System API',
    version: '1.0.0',
    endpoints: {
      rfps: '/api/rfps',
      vendors: '/api/vendors',
      proposals: '/api/proposals',
      health: '/api/health'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║     AI-Powered RFP Management System - Backend Server        ║
╠══════════════════════════════════════════════════════════════╣
║  Server running on port: ${PORT}                                 ║
║  API Base URL: http://localhost:${PORT}/api                      ║
║  Environment: ${process.env.NODE_ENV || 'development'}                               ║
╚══════════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;

