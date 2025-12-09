#!/usr/bin/env node

/**
 * Verify that the gender field was saved correctly
 * This script queries the lead we just created to check if gender is stored
 */

const axios = require('axios');

// Configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:5000';
const LEAD_ID = 'b0be02ae-d70b-4a73-90a9-22e63556ce42'; // From the test we just ran

async function verifyGenderField() {
  console.log('🔍 VERIFYING GENDER FIELD IN DATABASE\n');
  console.log('='.repeat(70));

  try {
    // First, we need to login to get auth token
    console.log('\n📝 Step 1: Logging in...');
    const loginResponse = await axios.post(`${API_BASE_URL}/api/auth/login`, {
      email: 'admin@crm.com', // Adjust if needed
      password: 'password123' // Adjust if needed
    });

    if (loginResponse.status !== 200) {
      console.error('❌ Login failed. Please check credentials.');
      process.exit(1);
    }

    const token = loginResponse.data.token;
    console.log('✅ Logged in successfully');

    // Now fetch the lead
    console.log(`\n📥 Step 2: Fetching lead ${LEAD_ID}...`);
    const leadResponse = await axios.get(`${API_BASE_URL}/api/leads/${LEAD_ID}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const lead = leadResponse.data;
    console.log('\n✅ Lead fetched successfully!');
    console.log('\n📊 Lead Details:');
    console.log('   ID:', lead.id);
    console.log('   Name:', lead.name);
    console.log('   Email:', lead.email);
    console.log('   Phone:', lead.phone);
    console.log('   Age:', lead.age);
    console.log('   Gender:', lead.gender || '❌ NOT SET');
    console.log('   Postcode:', lead.postcode);
    console.log('   Status:', lead.status);

    if (lead.gender) {
      console.log('\n✅ SUCCESS! Gender field is present:', lead.gender);
    } else {
      console.log('\n⚠️ WARNING: Gender field is missing or null');
      console.log('   This could mean:');
      console.log('   1. The migration hasn\'t been run yet');
      console.log('   2. The gender column doesn\'t exist in the database');
      console.log('   3. The value wasn\'t saved correctly');
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Response:', JSON.stringify(error.response.data, null, 2));
    }
    
    process.exit(1);
  }
}

// Run the verification
verifyGenderField();

