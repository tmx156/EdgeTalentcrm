const axios = require('axios');

(async () => {
  try {
    console.log('🧪 TESTING CHICKO BOOKING FLOW\n');
    console.log('='.repeat(70));

    // Step 1: Login as Chicko
    console.log('\n📝 Step 1: Logging in as Chicko...');

    const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'chicko@crm.com',
      password: 'password123' // You may need to adjust this
    });

    if (loginResponse.status !== 200) {
      console.log('❌ Login failed. Please check Chicko\'s password.');
      process.exit(1);
    }

    const token = loginResponse.data.token;
    const chickoUser = loginResponse.data.user;

    console.log('✅ Logged in as:', chickoUser.name);
    console.log('   User ID:', chickoUser.id);
    console.log('   Role:', chickoUser.role);

    // Step 2: Create a new lead (simulating booking from UI)
    console.log('\n📝 Step 2: Creating a NEW booking (like from Calendar UI)...');

    const bookingData = {
      name: 'TEST CHICKO BOOKING',
      phone: '07700900000',
      email: 'test@test.com',
      postcode: 'TEST1',
      status: 'Booked',
      date_booked: '2025-10-25T14:00:00',
      time_booked: '14:00',
      notes: 'Test booking created by Chicko via automated test',
      booker_id: chickoUser.id
    };

    console.log('   Booking data:');
    console.log('   - Name:', bookingData.name);
    console.log('   - Date:', bookingData.date_booked);
    console.log('   - Status:', bookingData.status);

    const createResponse = await axios.post(
      'http://localhost:5000/api/leads',
      bookingData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('\n✅ Booking created!');
    console.log('   Response status:', createResponse.status);

    const createdLead = createResponse.data.lead || createResponse.data;
    console.log('   Lead ID:', createdLead.id);

    // Step 3: Fetch the booking back to verify
    console.log('\n📝 Step 3: Fetching the booking back to verify fields...');

    const fetchResponse = await axios.get(
      `http://localhost:5000/api/leads/${createdLead.id}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    const fetchedLead = fetchResponse.data;

    console.log('\n📊 BOOKING VERIFICATION:');
    console.log('   Name:', fetchedLead.name);
    console.log('   Status:', fetchedLead.status);
    console.log('   Booker ID:', fetchedLead.booker_id);
    console.log('   Date Booked:', fetchedLead.date_booked);
    console.log('   Booked At:', fetchedLead.booked_at);
    console.log('   ⭐ ever_booked:', fetchedLead.ever_booked);

    // Step 4: Check if it would show in Dashboard
    console.log('\n📝 Step 4: Dashboard Filter Check...');

    const hasBookerId = !!fetchedLead.booker_id;
    const hasEverBooked = fetchedLead.ever_booked === true;
    const passesFilter = hasBookerId && hasEverBooked;

    console.log('   Has booker_id:', hasBookerId ? '✅' : '❌');
    console.log('   Has ever_booked=true:', hasEverBooked ? '✅' : '❌');
    console.log('   Passes Dashboard filter:', passesFilter ? '✅ YES' : '❌ NO');

    // Step 5: Check if booked_at is today
    console.log('\n📝 Step 5: Date Filter Check...');

    if (fetchedLead.booked_at) {
      const bookedDate = fetchedLead.booked_at.split('T')[0];
      const today = new Date().toISOString().split('T')[0];

      console.log('   Booked date:', bookedDate);
      console.log('   Today:', today);
      console.log('   Shows in TODAY\'s activities:', bookedDate === today ? '✅ YES' : '❌ NO');
    } else {
      console.log('   ❌ No booked_at timestamp!');
    }

    // Final verdict
    console.log('\n' + '='.repeat(70));
    console.log('🎯 FINAL VERDICT:\n');

    if (passesFilter) {
      console.log('✅ SUCCESS! This booking WILL appear in Daily Activities');
      console.log('   The fix is working correctly for Chicko.');
    } else {
      console.log('❌ FAILURE! This booking will NOT appear in Daily Activities');
      console.log('   Issue found:');
      if (!hasEverBooked) {
        console.log('   - ever_booked is false (should be true)');
        console.log('   - The field mapping fix may not be deployed');
      }
      if (!hasBookerId) {
        console.log('   - booker_id is missing');
      }
    }

    console.log('\n📋 To clean up this test booking, run:');
    console.log(`   DELETE FROM leads WHERE id = '${createdLead.id}';`);

    process.exit(0);

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
})();
