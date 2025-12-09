#!/usr/bin/env node

/**
 * Test Gravity Forms Webhook with Gender: Female
 * This script tests the /api/gravity-forms-webhook/submit endpoint
 */

const axios = require('axios');

// Configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:5000';
const WEBHOOK_ENDPOINT = `${API_BASE_URL}/api/gravity-forms-webhook/submit`;

async function testGravityFormsWebhook() {
  console.log('🧪 TESTING GRAVITY FORMS WEBHOOK WITH GENDER: FEMALE\n');
  console.log('='.repeat(70));

  // Test payload with Gender: Female
  const testPayload = {
    '1': 'Jane Doe',                    // Field ID 1 = Name
    'Name': 'Jane Doe',                 // Alternative field name
    '7': 'jane.doe@example.com',       // Field ID 7 = Email
    'Email': 'jane.doe@example.com',
    '15': '07700900123',               // Field ID 15 = Phone
    'Telephone Number': '07700900123',
    '11': '28',                        // Field ID 11 = Age
    'Age': '28',
    '5': 'SW1A 1AA',                   // Field ID 5 = Postcode
    'Postcode': 'SW1A 1AA',
    'Gender': 'Female',                 // Gender field - testing with Female
    '12': 'Female',                    // Field ID 12 = Gender (if applicable)
    'source_url': 'https://edgetalent.co.uk/test-form/',
    'id': 'test-' + Date.now()
  };

  console.log('\n📤 Sending webhook request...');
  console.log('   Endpoint:', WEBHOOK_ENDPOINT);
  console.log('\n📋 Payload:');
  console.log(JSON.stringify(testPayload, null, 2));

  try {
    const response = await axios.post(WEBHOOK_ENDPOINT, testPayload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    });

    console.log('\n✅ SUCCESS! Webhook responded successfully');
    console.log('   Status:', response.status);
    console.log('\n📥 Response:');
    console.log(JSON.stringify(response.data, null, 2));

    if (response.data.lead) {
      console.log('\n📊 Lead Details:');
      console.log('   ID:', response.data.lead.id);
      console.log('   Name:', response.data.lead.name);
      console.log('   Email:', response.data.lead.email);
      console.log('   Phone:', response.data.lead.phone);
      console.log('   Gender:', response.data.lead.gender || '❌ NOT SET');
      console.log('   Status:', response.data.lead.status);
      
      if (response.data.lead.gender) {
        console.log('\n✅ Gender field is present in response:', response.data.lead.gender);
      } else {
        console.log('\n⚠️ Gender field is missing from response');
        console.log('   This might mean:');
        console.log('   1. The migration hasn\'t been run yet');
        console.log('   2. The gender column doesn\'t exist in the database');
        console.log('   3. Check server logs for any errors');
      }
    }

    console.log('\n✅ Test completed successfully!');
    console.log('   Check your database to verify the lead was created with Gender: Female');

  } catch (error) {
    console.error('\n❌ ERROR: Webhook test failed');
    
    if (error.response) {
      // Server responded with error status
      console.error('   Status:', error.response.status);
      console.error('   Response:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      // Request was made but no response received
      console.error('   No response received from server');
      console.error('   Make sure the server is running on', API_BASE_URL);
    } else {
      // Error setting up request
      console.error('   Error:', error.message);
    }
    
    process.exit(1);
  }
}

// Run the test
testGravityFormsWebhook();

