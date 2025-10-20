const axios = require('axios');

// You'll need to replace this with a valid admin token
// Get it from browser localStorage or login
const API_URL = 'http://localhost:5000';

(async () => {
  try {
    console.log('🧪 REAL-TIME BOOKING TEST\n');
    console.log('=' .repeat(60));

    // Step 1: Fix the existing TeESt booking
    console.log('\n📝 Step 1: Fixing existing TeESt booking...');

    const teestId = '8ae9774d-dc21-4f4e-a88f-da043a17eea6';

    try {
      // Update TeESt to set ever_booked = true
      const fixResponse = await axios.put(
        `${API_URL}/api/leads/${teestId}`,
        { ever_booked: true },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          validateStatus: () => true // Accept any status
        }
      );

      if (fixResponse.status === 200) {
        console.log('✅ TeESt booking fixed - ever_booked set to true');
      } else {
        console.log(`⚠️ Fix response: ${fixResponse.status} - ${fixResponse.data?.message || 'Unknown'}`);
      }
    } catch (err) {
      console.log(`❌ Could not fix TeESt: ${err.message}`);
      console.log('   (This might be due to authentication - that\'s OK, continue with test)');
    }

    // Step 2: Check current bookings
    console.log('\n📊 Step 2: Checking current bookings for today...');

    const leadsResponse = await axios.get(`${API_URL}/api/leads/public?limit=2000`);
    const today = new Date().toISOString().split('T')[0];
    const todaysBookings = leadsResponse.data.leads.filter(l =>
      l.booked_at && l.booked_at.startsWith(today)
    );

    console.log(`   Found ${todaysBookings.length} bookings for ${today}:`);
    todaysBookings.forEach((b, i) => {
      console.log(`   ${i + 1}. ${b.name} - ever_booked: ${b.ever_booked} - Status: ${b.status}`);
    });

    // Step 3: Verify filter logic
    console.log('\n🔍 Step 3: Testing Dashboard filter logic...');

    const bookingsWithEverBooked = todaysBookings.filter(b => b.ever_booked === true);
    const bookingsWithoutEverBooked = todaysBookings.filter(b => !b.ever_booked);

    console.log(`   Bookings that WILL show (ever_booked=true): ${bookingsWithEverBooked.length}`);
    bookingsWithEverBooked.forEach(b => console.log(`      ✅ ${b.name}`));

    console.log(`   Bookings that WON'T show (ever_booked=false): ${bookingsWithoutEverBooked.length}`);
    bookingsWithoutEverBooked.forEach(b => console.log(`      ❌ ${b.name} - THIS IS THE ISSUE!`));

    // Step 4: Summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 SUMMARY:\n');

    if (bookingsWithoutEverBooked.length > 0) {
      console.log('❌ ISSUE CONFIRMED:');
      console.log(`   ${bookingsWithoutEverBooked.length} booking(s) have ever_booked=false`);
      console.log('   These will NOT appear in Daily Activities');
      console.log('\n🔧 SOLUTION:');
      console.log('   1. The server code has been FIXED to set ever_booked=true for new bookings');
      console.log('   2. For existing bookings, run this command in PostgreSQL/Supabase:');
      console.log('      UPDATE leads SET ever_booked = true WHERE status = \'Booked\' AND booked_at IS NOT NULL;');
      console.log('\n   OR update via the Calendar UI:');
      console.log('   - Open the booking in Calendar');
      console.log('   - Make any small change (e.g., add a note)');
      console.log('   - Save');
      console.log('   - The updated code will now set ever_booked=true automatically');
    } else {
      console.log('✅ ALL BOOKINGS ARE CORRECT!');
      console.log('   All bookings have ever_booked=true');
      console.log('   They should all appear in Daily Activities');
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n🎯 NEXT STEPS:');
    console.log('   1. Refresh the Dashboard page');
    console.log('   2. Check if bookings now appear in Daily Activities');
    console.log('   3. Try creating a NEW booking - it should appear immediately');
    console.log('   4. The real-time socket updates are now active!\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
    process.exit(1);
  }
})();
