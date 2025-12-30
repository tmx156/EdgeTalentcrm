/**
 * Comprehensive SMS API Diagnostic Test
 * Tests multiple endpoints and auth methods
 */

// Load dotenv
try {
  require('dotenv').config();
} catch (e) {
  const fs = require('fs');
  const path = require('path');
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  }
}

const path = require('path');
module.paths.unshift(path.join(__dirname, 'server', 'node_modules'));

const axios = require('axios');
const jwt = require('jsonwebtoken');

const apiKey = process.env.SMS_WORKS_API_KEY;
const apiSecret = process.env.SMS_WORKS_API_SECRET;

console.log('═'.repeat(70));
console.log('🔍 SMS Works API - Comprehensive Diagnostic');
console.log('═'.repeat(70));
console.log('');

if (!apiKey || !apiSecret) {
  console.log('❌ API Key or Secret not set');
  process.exit(1);
}

// Generate JWT
const now = Math.floor(Date.now() / 1000);
const payload = { iss: apiKey, iat: now, exp: now + 3600 };
const generatedJwt = jwt.sign(payload, apiSecret, { algorithm: 'HS256' });

console.log('📋 Credentials:');
console.log('   API Key:', apiKey);
console.log('   API Secret:', apiSecret.substring(0, 10) + '...' + apiSecret.substring(apiSecret.length - 5));
console.log('   Generated JWT:', generatedJwt.substring(0, 50) + '...');
console.log('');

// Test different endpoints
const endpoints = [
  { name: 'Send Message', url: 'https://api.thesmsworks.co.uk/v1/message/send', method: 'POST', data: { sender: '447786200517', destination: '447480682158', content: 'Test' } },
  { name: 'Get Credits', url: 'https://api.thesmsworks.co.uk/v1/credits/balance', method: 'GET' },
  { name: 'Get Account Info', url: 'https://api.thesmsworks.co.uk/v1/account', method: 'GET' },
];

const authFormats = [
  { name: 'Direct JWT', value: generatedJwt },
  { name: 'Bearer JWT', value: `Bearer ${generatedJwt}` },
  { name: 'JWT prefix', value: `JWT ${generatedJwt}` },
  { name: 'API Key as Bearer', value: `Bearer ${apiKey}` },
  { name: 'X-API-Key header', value: null, header: 'X-API-Key', headerValue: apiKey }
];

(async () => {
  for (const endpoint of endpoints) {
    console.log(`\n📍 Testing: ${endpoint.name}`);
    console.log('   URL:', endpoint.url);
    
    for (const auth of authFormats) {
      try {
        const headers = { 'Content-Type': 'application/json' };
        
        if (auth.header) {
          headers[auth.header] = auth.headerValue;
        } else {
          headers['Authorization'] = auth.value;
        }
        
        console.log(`   🔍 Trying: ${auth.name}...`);
        
        const config = {
          method: endpoint.method,
          url: endpoint.url,
          headers,
          timeout: 5000
        };
        
        if (endpoint.data && endpoint.method === 'POST') {
          config.data = endpoint.data;
        }
        
        const response = await axios(config);
        
        console.log(`   ✅ SUCCESS with ${auth.name}!`);
        console.log('   Response:', JSON.stringify(response.data, null, 2));
        console.log('');
        console.log('🎉 FOUND WORKING AUTH METHOD!');
        console.log(`   Endpoint: ${endpoint.name}`);
        console.log(`   Auth Format: ${auth.name}`);
        process.exit(0);
        
      } catch (error) {
        if (error.response?.status === 401) {
          // Continue to next format
          continue;
        } else if (error.response?.status) {
          console.log(`   ⚠️  ${error.response.status}: ${JSON.stringify(error.response.data)}`);
          break; // Try next endpoint
        }
      }
    }
  }
  
  console.log('\n❌ All tests failed - 401 Unauthorized on all endpoints');
  console.log('');
  console.log('🔧 This indicates an account-side issue:');
  console.log('   1. Contact The SMS Works support');
  console.log('   2. Verify your API Key and Secret are correct');
  console.log('   3. Check if your account is fully activated');
  console.log('   4. Verify API access is enabled in dashboard');
  console.log('   5. Check if there are IP restrictions');
  console.log('');
  console.log('Your API Key:', apiKey);
  
})();
