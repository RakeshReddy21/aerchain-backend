/**
 * Seed Data Script
 * Run this to populate the database with sample vendors for testing
 * Usage: node utils/seedData.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Vendor = require('../models/Vendor');

const sampleVendors = [
  {
    name: 'TechPro Solutions',
    email: 'sales@techpro.com',
    company: 'TechPro Solutions Inc.',
    phone: '+1 555-0101',
    categories: ['IT', 'Hardware', 'Software'],
    address: {
      city: 'San Francisco',
      state: 'CA',
      country: 'USA'
    }
  },
  {
    name: 'Global Hardware Distributors',
    email: 'quotes@globalhw.com',
    company: 'Global Hardware Distributors LLC',
    phone: '+1 555-0102',
    categories: ['Hardware', 'Electronics'],
    address: {
      city: 'Austin',
      state: 'TX',
      country: 'USA'
    }
  },
  {
    name: 'Enterprise Systems Corp',
    email: 'procurement@enterprise-sys.com',
    company: 'Enterprise Systems Corporation',
    phone: '+1 555-0103',
    categories: ['IT', 'Infrastructure', 'Cloud'],
    address: {
      city: 'Seattle',
      state: 'WA',
      country: 'USA'
    }
  },
  {
    name: 'Digital Office Supplies',
    email: 'orders@digitaloffice.com',
    company: 'Digital Office Supplies Ltd.',
    phone: '+1 555-0104',
    categories: ['Office Equipment', 'Hardware'],
    address: {
      city: 'New York',
      state: 'NY',
      country: 'USA'
    }
  },
  {
    name: 'CloudTech Partners',
    email: 'hello@cloudtech.io',
    company: 'CloudTech Partners',
    phone: '+1 555-0105',
    categories: ['Cloud', 'Software', 'Services'],
    address: {
      city: 'Denver',
      state: 'CO',
      country: 'USA'
    }
  }
];

async function seedDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rfp_management');
    console.log('Connected to MongoDB');

    // Clear existing vendors
    await Vendor.deleteMany({});
    console.log('Cleared existing vendors');

    // Insert sample vendors
    const vendors = await Vendor.insertMany(sampleVendors);
    console.log(`Inserted ${vendors.length} sample vendors`);

    console.log('\nSample vendors created:');
    vendors.forEach(v => {
      console.log(`  - ${v.name} (${v.email})`);
    });

    console.log('\n✅ Seed data created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase();

