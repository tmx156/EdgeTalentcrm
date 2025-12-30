/**
 * Detailed debug script to see exact API request/response
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const path = require('path');
const serverNodeModules = path.join(__dirname, 'server', 'node_modules');
require('module')._resolveFilename = (function(originalResolveFilename) {
  return function(request, parent) {
    try {
      return originalResolveFilename(request, parent);
    } catch (err) {
      if (err.code === 'MODULE_NOT_FOUND') {
        try {
          return originalResolveFilename(request, { paths: [serverNodeModules] });
        } catch (e) {
          throw err;
        }
      }
      throw err;
    }
  };
})(require('module')._resolveFilename);

const jwt = require('jsonwebtoken');
const axios = require('axios');

const apiKey = process.env.SMS_WORKS_API_KEY;
const apiSecret = process.env.SMS_WORKS_API_SECRET;

console.log('\n=== Detailed SMS Works API Debug ===\n');

// Generate JWT
const now = Math.floor(Date.now() / 1000);
const payload = {
  iss: apiKey,
  iat: now,
  exp: now + 3600
};

const token = jwt.sign(payload, apiSecret, { algorithm: 'HS256' });

console.log('JWT Token (first 100 chars):', token.substring(0, 100) + '...');
console.log('JWT Payload:', JSON.stringify(payload, null, 2));
console.log('');

// Test payload
const testPayload = {
  sender: '447786200517',
  destination: '447480682158',
  content: 'Test message from debug script'
};

console.log('Request Details:');
console.log('  URL: https://api.thesmsworks.co.uk/v1/message/send');
console.log('  Method: POST');
console.log('  Headers:');
console.log('    Content-Type: application/json');
console.log('    Authorization: Bearer [JWT_TOKEN]');
console.log('  Payload:', JSON.stringify(testPayload, null, 2));
console.log('');

// Make request with detailed logging
axios.post('https://api.thesmsworks.co.uk/v1/message/send', testPayload, {
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  timeout: 10000,
  validateStatus: function (status) {
    return true; // Don't throw on any status
  }
})
.then(response => {
  console.log('\n=== Response Details ===');
  console.log('Status:', response.status);
  console.log('Status Text:', response.statusText);
  console.log('Headers:', JSON.stringify(response.headers, null, 2));
  console.log('');
  console.log('Response Data Type:', typeof response.data);
  console.log('Response Data:', response.data);
  console.log('');
  
  if (response.status === 401) {
    console.log('⚠️  401 Unauthorized Error Analysis:');
    console.log('  - This typically means authentication failed');
    console.log('  - Possible causes:');
    console.log('    1. API Key or Secret is incorrect');
    console.log('    2. JWT token format is not accepted');
    console.log('    3. Token has expired (unlikely, just generated)');
    console.log('    4. Account might be suspended or inactive');
    console.log('');
    console.log('  Note: If account has no credits, you might get:');
    console.log('    - 402 Payment Required, or');
    console.log('    - 403 Forbidden, or');
    console.log('    - A specific error message about credits');
    console.log('  A 401 usually means authentication, not credits.');
  } else if (response.status === 200 || response.status === 201) {
    console.log('✅ SUCCESS!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } else {
    console.log(`⚠️  Unexpected status: ${response.status}`);
    console.log('Response:', JSON.stringify(response.data, null, 2));
  }
})
.catch(error => {
  console.log('\n=== Error Details ===');
  console.log('Error Type:', error.constructor.name);
  console.log('Error Message:', error.message);
  
  if (error.response) {
    console.log('\nResponse Status:', error.response.status);
    console.log('Response Headers:', JSON.stringify(error.response.headers, null, 2));
    console.log('Response Data:', error.response.data);
    console.log('Response Data Type:', typeof error.response.data);
    
    // Try to parse if it's a string
    if (typeof error.response.data === 'string') {
      try {
        const parsed = JSON.parse(error.response.data);
        console.log('Parsed Response:', JSON.stringify(parsed, null, 2));
      } catch (e) {
        console.log('Response is plain text:', error.response.data);
      }
    }
  } else if (error.request) {
    console.log('Request made but no response received');
    console.log('Request:', error.request);
  } else {
    console.log('Error setting up request:', error.message);
  }
  
  console.log('\nFull Error:', error);
});
