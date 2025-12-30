/**
 * Test Script for The SMS Works API Integration
 * 
 * This script tests your SMS Works API configuration by:
 * 1. Checking if credentials are set
 * 2. Testing JWT token generation (if using API Key + Secret)
 * 3. Sending a test SMS message
 * 
 * Usage:
 *   node test_sms_works.js [phone_number]
 * 
 * Example:
 *   node test_sms_works.js +447123456789
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

// Add server node_modules to path
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

const { sendSMS, getSMSStatus } = require('./server/utils/smsService');
const jwt = require('jsonwebtoken');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testSMSWorks() {
  log('\n=== The SMS Works API Test ===\n', 'cyan');

  // Step 1: Check Configuration
  log('Step 1: Checking Configuration...', 'blue');
  const config = {
    jwtToken: process.env.SMS_WORKS_JWT_TOKEN,
    apiKey: process.env.SMS_WORKS_API_KEY,
    apiSecret: process.env.SMS_WORKS_API_SECRET,
    senderId: process.env.SMS_WORKS_SENDER_ID
  };

  log(`  JWT Token: ${config.jwtToken ? '✅ Set' : '❌ NOT SET'}`, config.jwtToken ? 'green' : 'red');
  log(`  API Key: ${config.apiKey ? '✅ Set' : '❌ NOT SET'}`, config.apiKey ? 'green' : 'red');
  log(`  API Secret: ${config.apiSecret ? '✅ Set' : '❌ NOT SET'}`, config.apiSecret ? 'green' : 'red');
  log(`  Sender ID: ${config.senderId || '❌ NOT SET (will use account default)'}`, config.senderId ? 'green' : 'yellow');

  if (!config.jwtToken && (!config.apiKey || !config.apiSecret)) {
    log('\n❌ ERROR: No valid credentials found!', 'red');
    log('Please set either:', 'yellow');
    log('  - SMS_WORKS_JWT_TOKEN (pre-generated JWT), OR', 'yellow');
    log('  - SMS_WORKS_API_KEY + SMS_WORKS_API_SECRET (recommended)', 'yellow');
    process.exit(1);
  }

  // Step 2: Test JWT Generation (if using API Key + Secret)
  if (config.apiKey && config.apiSecret) {
    log('\nStep 2: Testing JWT Token Generation...', 'blue');
    try {
      const now = Math.floor(Date.now() / 1000);
      const payload = {
        iss: config.apiKey,
        iat: now,
        exp: now + 3600
      };
      const token = jwt.sign(payload, config.apiSecret, { algorithm: 'HS256' });
      log(`  ✅ JWT Token Generated Successfully`, 'green');
      log(`  Token Preview: ${token.substring(0, 50)}...`, 'cyan');
    } catch (error) {
      log(`  ❌ Failed to generate JWT: ${error.message}`, 'red');
      process.exit(1);
    }
  }

  // Step 3: Check SMS Service Status
  log('\nStep 3: Checking SMS Service Status...', 'blue');
  try {
    const status = await getSMSStatus();
    log(`  Provider: ${status.configuredProvider}`, 'cyan');
    if (status.thesmsworks) {
      log(`  Configured: ${status.thesmsworks.configured ? '✅ Yes' : '❌ No'}`, 
          status.thesmsworks.configured ? 'green' : 'red');
    }
  } catch (error) {
    log(`  ⚠️  Could not check status: ${error.message}`, 'yellow');
  }

  // Step 4: Get Phone Number
  const phoneNumber = process.argv[2];
  if (!phoneNumber) {
    log('\n⚠️  No phone number provided!', 'yellow');
    log('Usage: node test_sms_works.js [phone_number]', 'yellow');
    log('Example: node test_sms_works.js +447123456789', 'yellow');
    log('\n✅ Configuration check passed! Add a phone number to test sending.', 'green');
    process.exit(0);
  }

  // Step 5: Send Test SMS
  log(`\nStep 4: Sending Test SMS to ${phoneNumber}...`, 'blue');
  log('  This may take a few seconds...', 'cyan');

  try {
    const testMessage = `Test message from CRM - The SMS Works integration test at ${new Date().toLocaleTimeString()}`;
    
    log(`  Message: "${testMessage}"`, 'cyan');
    log(`  Length: ${testMessage.length} characters`, 'cyan');

    const result = await sendSMS(phoneNumber, testMessage);

    if (result.success) {
      log('\n✅ SUCCESS! SMS Sent Successfully!', 'green');
      log(`  Provider: ${result.provider}`, 'cyan');
      log(`  Message ID: ${result.messageId || 'N/A'}`, 'cyan');
      log(`  Status: ${result.status || 'N/A'}`, 'cyan');
      if (result.credits) {
        log(`  Credits Used: ${result.credits}`, 'cyan');
      }
      log('\n📱 Check your phone for the test message!', 'green');
    } else {
      log('\n❌ FAILED to send SMS', 'red');
      log(`  Error: ${result.error || 'Unknown error'}`, 'red');
      if (result.fullError?.response?.data) {
        log(`  API Response: ${JSON.stringify(result.fullError.response.data, null, 2)}`, 'red');
      }
      process.exit(1);
    }
  } catch (error) {
    log('\n❌ ERROR during SMS send:', 'red');
    log(`  ${error.message}`, 'red');
    if (error.response) {
      log(`  Status: ${error.response.status}`, 'red');
      log(`  Response: ${JSON.stringify(error.response.data, null, 2)}`, 'red');
    }
    process.exit(1);
  }

  log('\n=== Test Complete ===\n', 'cyan');
}

// Run the test
testSMSWorks().catch(error => {
  log(`\n❌ Unexpected Error: ${error.message}`, 'red');
  if (error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});
