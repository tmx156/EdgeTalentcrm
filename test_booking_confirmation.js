const path = require('path');
const fs = require('fs');

// Add server/node_modules to module paths
module.paths.push(path.join(__dirname, 'server', 'node_modules'));

// Load environment variables manually
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Import SMS service
const { sendBookingConfirmation } = require('./server/utils/smsService');

async function testBookingConfirmation() {
  console.log('══════════════════════════════════════════════════════════════════════');
  console.log('🧪 Booking Confirmation SMS Test');
  console.log('══════════════════════════════════════════════════════════════════════\n');

  // Test lead data
  const testLead = {
    name: 'Test User',
    phone: '447480682158', // Test number
    time_booked: '14:30', // 2:30 PM
    email: 'test@example.com'
  };

  // Test appointment date (tomorrow at 2:30 PM)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(14, 30, 0, 0);
  const appointmentDate = tomorrow.toISOString();

  console.log('📋 Test Details:');
  console.log(`   Name: ${testLead.name}`);
  console.log(`   Phone: ${testLead.phone}`);
  console.log(`   Time: ${testLead.time_booked} (should format to 2:30 pm)`);
  console.log(`   Appointment Date: ${appointmentDate}\n`);

  try {
    console.log('📤 Sending booking confirmation SMS...\n');
    
    const result = await sendBookingConfirmation(testLead, appointmentDate);
    
    console.log('\n✅ SUCCESS! Booking confirmation SMS sent!');
    console.log('\n📊 Response:');
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testBookingConfirmation();
