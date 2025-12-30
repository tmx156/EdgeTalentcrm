/**
 * Debug script to test JWT generation and API call for The SMS Works
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const jwt = require('jsonwebtoken');
const axios = require('axios');

const apiKey = process.env.SMS_WORKS_API_KEY;
const apiSecret = process.env.SMS_WORKS_API_SECRET;

console.log('\n=== The SMS Works JWT Debug ===\n');
console.log('API Key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'NOT SET');
console.log('API Secret:', apiSecret ? `${apiSecret.substring(0, 10)}...` : 'NOT SET\n');

if (!apiKey || !apiSecret) {
  console.error('❌ API Key or Secret not set!');
  process.exit(1);
}

// Generate JWT
const now = Math.floor(Date.now() / 1000);
const payload = {
  iss: apiKey,
  iat: now,
  exp: now + 3600
};

console.log('JWT Payload:', JSON.stringify(payload, null, 2));
console.log('');

const token = jwt.sign(payload, apiSecret, { algorithm: 'HS256' });
console.log('Generated JWT Token:', token);
console.log('Token Length:', token.length);
console.log('');

// Decode to verify
const decoded = jwt.decode(token, { complete: true });
console.log('Decoded JWT Header:', JSON.stringify(decoded.header, null, 2));
console.log('Decoded JWT Payload:', JSON.stringify(decoded.payload, null, 2));
console.log('');

// Test API call
const testPayload = {
  sender: '447786200517',
  destination: '447480682158',
  content: 'Test message'
};

console.log('Testing API call...');
console.log('Endpoint: https://api.thesmsworks.co.uk/v1/message/send');
console.log('Payload:', JSON.stringify(testPayload, null, 2));
console.log('Authorization Header: Bearer [JWT_TOKEN]');
console.log('');

axios.post('https://api.thesmsworks.co.uk/v1/message/send', testPayload, {
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  timeout: 10000
})
.then(response => {
  console.log('✅ SUCCESS!');
  console.log('Response Status:', response.status);
  console.log('Response Data:', JSON.stringify(response.data, null, 2));
})
.catch(error => {
  console.log('❌ ERROR');
  console.log('Status:', error.response?.status);
  console.log('Status Text:', error.response?.statusText);
  console.log('Response Data:', error.response?.data);
  console.log('Error Message:', error.message);
  
  if (error.response?.status === 401) {
    console.log('\n⚠️  401 Unauthorized - Possible issues:');
    console.log('1. API Key or Secret might be incorrect');
    console.log('2. JWT format might not match their requirements');
    console.log('3. Check The SMS Works dashboard for correct credentials');
  }
});
