/**
 * Test SMS API with JWT Token
 * Run this to test your SMS_WORKS_JWT_TOKEN locally
 */

// Load dotenv
try {
  require('dotenv').config();
} catch (e) {
  // Fallback: load manually
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

const jwtToken = process.env.SMS_WORKS_JWT_TOKEN;
const apiKey = process.env.SMS_WORKS_API_KEY;
const apiSecret = process.env.SMS_WORKS_API_SECRET;
const senderId = process.env.SMS_WORKS_SENDER_ID || '447786200517';

console.log('═'.repeat(70));
console.log('🧪 SMS Works API Test - JWT Token');
console.log('═'.repeat(70));
console.log('');

// Check configuration
console.log('📋 Configuration Check:');
console.log('   JWT Token:', jwtToken ? (jwtToken === 'YOUR_PRE_GENERATED_JWT_TOKEN_HERE' ? '❌ NOT SET (placeholder found)' : '✅ SET (' + jwtToken.substring(0, 30) + '...)') : '❌ NOT SET');
console.log('   API Key:', apiKey ? '✅ SET' : '❌ NOT SET');
console.log('   API Secret:', apiSecret ? '✅ SET' : '❌ NOT SET');
console.log('   Sender ID:', senderId || '❌ NOT SET');
console.log('');

if (!jwtToken || jwtToken === 'YOUR_PRE_GENERATED_JWT_TOKEN_HERE') {
  console.log('❌ ERROR: SMS_WORKS_JWT_TOKEN is not set!');
  console.log('');
  console.log('📝 To fix this:');
  console.log('   1. Go to The SMS Works dashboard: https://thesmsworks.co.uk/');
  console.log('   2. Log in to your account');
  console.log('   3. Navigate to "API" or "Developers" section');
  console.log('   4. Click "Generate JWT Token"');
  console.log('   5. Copy the token');
  console.log('   6. Open your .env file and replace:');
  console.log('      SMS_WORKS_JWT_TOKEN=YOUR_PRE_GENERATED_JWT_TOKEN_HERE');
  console.log('      with:');
  console.log('      SMS_WORKS_JWT_TOKEN=your_actual_token_here');
  console.log('');
  process.exit(1);
}

// Clean up token (remove any prefixes)
let cleanToken = jwtToken.trim();
if (cleanToken.startsWith('JWT ')) {
  cleanToken = cleanToken.substring(4);
}
if (cleanToken.startsWith('Bearer ')) {
  cleanToken = cleanToken.substring(7);
}

console.log('🔐 Testing JWT Token Authentication...');
console.log('   Token (first 30 chars):', cleanToken.substring(0, 30) + '...');
console.log('');

// Test phone number (you can change this)
const testPhone = '07480682158';
const destination = testPhone.startsWith('0') ? '44' + testPhone.substring(1) : testPhone.replace(/^\+/, '');

console.log('📱 Test Details:');
console.log('   Destination:', destination);
console.log('   Sender ID:', senderId);
console.log('');

// Try different auth formats
const authFormats = [
  { name: 'Direct JWT (no prefix)', value: cleanToken },
  { name: 'Bearer JWT', value: `Bearer ${cleanToken}` },
  { name: 'JWT prefix', value: `JWT ${cleanToken}` }
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
      console.log('🎉 Your JWT token is valid and working!');
      success = true;
      break;
      
    } catch (error) {
      if (error.response?.status === 401) {
        console.log(`   ❌ 401 Unauthorized - trying next format...`);
        continue;
      } else {
        console.log('');
        console.log('❌ Error:', error.response?.status, error.response?.data || error.message);
        if (format === authFormats[authFormats.length - 1]) {
          console.log('');
          console.log('⚠️  All auth formats failed.');
          console.log('');
          console.log('Possible issues:');
          console.log('   1. JWT token is expired (generate a new one)');
          console.log('   2. JWT token is incorrect (check for typos)');
          console.log('   3. Account not activated (contact The SMS Works support)');
          console.log('   4. API access not enabled (check dashboard settings)');
        }
      }
    }
  }

  if (!success) {
    console.log('');
    console.log('❌ SMS test failed. Please check your JWT token.');
    process.exit(1);
  }
})();
