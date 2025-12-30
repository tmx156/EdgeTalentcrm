/**
 * Test SMS API with API Key + Secret (generates JWT dynamically)
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

// Load modules from server/node_modules
const path = require('path');
module.paths.unshift(path.join(__dirname, 'server', 'node_modules'));

const axios = require('axios');
const jwt = require('jsonwebtoken');

const apiKey = process.env.SMS_WORKS_API_KEY;
const apiSecret = process.env.SMS_WORKS_API_SECRET;
const senderId = process.env.SMS_WORKS_SENDER_ID || '447786200517';

console.log('═'.repeat(70));
console.log('🧪 SMS Works API Test - API Key + Secret (Dynamic JWT)');
console.log('═'.repeat(70));
console.log('');

// Check configuration
console.log('📋 Configuration Check:');
console.log('   API Key:', apiKey ? '✅ SET (' + apiKey.substring(0, 20) + '...)' : '❌ NOT SET');
console.log('   API Secret:', apiSecret ? '✅ SET (' + apiSecret.length + ' chars)' : '❌ NOT SET');
console.log('   Sender ID:', senderId || '❌ NOT SET');
console.log('');

if (!apiKey || !apiSecret) {
  console.log('❌ ERROR: SMS_WORKS_API_KEY and SMS_WORKS_API_SECRET are required!');
  process.exit(1);
}

// Generate JWT from API Key + Secret
console.log('🔐 Generating JWT token from API Key + Secret...');
const now = Math.floor(Date.now() / 1000);
const payload = {
  iss: apiKey,      // API Key as issuer
  iat: now,         // Issued at
  exp: now + 3600   // Expires in 1 hour
};

let generatedJwt;
try {
  generatedJwt = jwt.sign(payload, apiSecret, { algorithm: 'HS256' });
  console.log('   ✅ JWT generated successfully');
  console.log('   Token (first 30 chars):', generatedJwt.substring(0, 30) + '...');
} catch (error) {
  console.log('   ❌ Failed to generate JWT:', error.message);
  process.exit(1);
}

console.log('');

// Test phone number
const testPhone = '07480682158';
const destination = testPhone.startsWith('0') ? '44' + testPhone.substring(1) : testPhone.replace(/^\+/, '');

console.log('📱 Test Details:');
console.log('   Destination:', destination);
console.log('   Sender ID:', senderId);
console.log('');

// Try different auth formats
const authFormats = [
  { name: 'Direct JWT (no prefix)', value: generatedJwt },
  { name: 'Bearer JWT', value: `Bearer ${generatedJwt}` },
  { name: 'JWT prefix', value: `JWT ${generatedJwt}` }
];

let success = false;

(async () => {
  for (const format of authFormats) {
    console.log(`🔍 Trying: ${format.name}...`);
    
    try {
      const response = await axios.post('https://api.thesmsworks.co.uk/v1/message/send', {
        sender: senderId,
        destination: destination,
        content: `Test SMS from Edge Talent CRM - ${new Date().toLocaleTimeString()}`
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': format.value
        },
        timeout: 10000
      });
      
      console.log('');
      console.log('✅ SUCCESS! SMS sent successfully!');
      console.log('');
      console.log('📊 Response:');
      console.log(JSON.stringify(response.data, null, 2));
      console.log('');
      console.log(`✅ Working auth format: ${format.name}`);
      console.log('');
      console.log('🎉 Your API credentials are valid and working!');
      console.log('   The system will automatically generate JWT tokens like this.');
      success = true;
      break;
      
    } catch (error) {
      if (error.response?.status === 401) {
        console.log(`   ❌ 401 Unauthorized - trying next format...`);
        continue;
      } else {
        console.log('');
        console.log('❌ Error:', error.response?.status);
        console.log('   Response:', JSON.stringify(error.response?.data, null, 2) || error.message);
        if (format === authFormats[authFormats.length - 1]) {
          console.log('');
          console.log('⚠️  All auth formats failed.');
          console.log('');
          console.log('Possible issues:');
          console.log('   1. API Key or Secret is incorrect');
          console.log('   2. Account not activated (contact The SMS Works support)');
          console.log('   3. API access not enabled (check dashboard settings)');
          console.log('   4. Account has no credits');
        }
      }
    }
  }

  if (!success) {
    console.log('');
    console.log('❌ SMS test failed. Please check your API credentials.');
    process.exit(1);
  }
})();
