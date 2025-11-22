require('dotenv').config();
const axios = require('axios');

async function testCalendarExport() {
  try {
    console.log('🧪 Testing calendar export endpoint...');

    // You'll need to replace this with a valid token from your login
    const token = process.env.TEST_TOKEN || 'your-test-token-here';

    const testDate = '2025-10-25';

    const response = await axios.get(`http://localhost:5001/api/leads/calendar/export-csv?date=${testDate}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('✅ Export successful!');
    console.log('📊 Response length:', response.data.length, 'characters');
    console.log('\n--- First 500 characters of CSV ---');
    console.log(response.data.substring(0, 500));

  } catch (error) {
    console.error('❌ Export failed:', error.response?.data || error.message);
  }
}

testCalendarExport();
