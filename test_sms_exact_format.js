/**
 * Test with exact format from The SMS Works documentation
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

const axios = require('axios');

const jwtToken = process.env.SMS_WORKS_JWT_TOKEN;

console.log('\n=== Testing Exact Format from Documentation ===\n');

if (!jwtToken || jwtToken === 'your_pre_generated_jwt_token_here') {
  console.error('❌ SMS_WORKS_JWT_TOKEN not set or still placeholder!');
  console.error('Please add your JWT token to .env file');
  process.exit(1);
}

console.log('JWT Token (first 50 chars):', jwtToken.substring(0, 50) + '...');
console.log('');

// Test 1: With sender field
console.log('Test 1: With sender field (as in docs)');
const payload1 = {
  sender: "447786200517",
  destination: "447480682158",
  content: "Test message - exact format from docs"
};

console.log('Payload:', JSON.stringify(payload1, null, 2));
console.log('');

axios.post('https://api.thesmsworks.co.uk/v1/message/send', payload1, {
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${jwtToken}`
  },
  timeout: 10000,
  validateStatus: () => true // Don't throw on any status
})
.then(response => {
  console.log('Response Status:', response.status);
  console.log('Response Data:', response.data);
  console.log('Response Headers:', JSON.stringify(response.headers, null, 2));
  
  if (response.status === 200 || response.status === 201) {
    console.log('\n✅ SUCCESS!');
  } else if (response.status === 401) {
    console.log('\n❌ Still 401 Unauthorized');
    console.log('\nPossible issues:');
    console.log('1. JWT token might be expired');
    console.log('2. JWT token might be incorrect');
    console.log('3. Account might need activation');
    console.log('4. API access might not be enabled for your account');
  } else {
    console.log(`\n⚠️  Status: ${response.status}`);
  }
  
  // Test 2: Without sender field (optional)
  if (response.status === 401) {
    console.log('\n\nTest 2: Without sender field (using account default)');
    const payload2 = {
      destination: "447480682158",
      content: "Test message - no sender field"
    };
    
    console.log('Payload:', JSON.stringify(payload2, null, 2));
    
    return axios.post('https://api.thesmsworks.co.uk/v1/message/send', payload2, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`
      },
      timeout: 10000,
      validateStatus: () => true
    });
  }
})
.then(response2 => {
  if (response2) {
    console.log('\nResponse Status:', response2.status);
    console.log('Response Data:', response2.data);
  }
})
.catch(error => {
  console.error('\n❌ Error:', error.message);
  if (error.response) {
    console.error('Status:', error.response.status);
    console.error('Data:', error.response.data);
  }
});
