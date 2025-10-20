const axios = require('axios');

(async () => {
  try {
    console.log('🔍 AUDIT: Fetching today\'s bookings via API...\n');

    const today = '2025-10-20';

    // Fetch all leads
    const response = await axios.get('http://localhost:5000/api/leads/public?limit=2000');
    const allLeads = response.data.leads;

    // Filter to today's bookings
    const todaysBookings = allLeads.filter(l =>
      l.booked_at && l.booked_at.startsWith(today)
    );

    console.log(`📊 Found ${todaysBookings.length} bookings made today:\n`);

    if (todaysBookings.length === 0) {
      console.log('❌ NO BOOKINGS FOUND FOR TODAY');
      process.exit(0);
    }

    // Analyze each booking
    todaysBookings.forEach((booking, idx) => {
      console.log(`\n${idx + 1}. ${booking.name}:`);
      console.log(`   ID: ${booking.id}`);
      console.log(`   Status: ${booking.status}`);
      console.log(`   Booked At: ${booking.booked_at}`);
      console.log(`   Date Booked: ${booking.date_booked}`);
      console.log(`   Ever Booked: ${booking.ever_booked}`);
      console.log(`   Booker ID: ${booking.booker_id}`);

      if (booking.status === 'Booked' && !booking.ever_booked) {
        console.log('   ⚠️ ISSUE: ever_booked is FALSE - THIS IS WHY IT\'S NOT SHOWING IN DAILY ACTIVITIES!');
      } else if (booking.ever_booked) {
        console.log('   ✅ OK - Should show in daily activities');
      }
    });

    console.log('\n\n=== SUMMARY ===');
    console.log(`Total bookings today: ${todaysBookings.length}`);
    const broken = todaysBookings.filter(b => b.status === 'Booked' && !b.ever_booked);
    console.log(`Bookings with ever_booked=false: ${broken.length}`);
    console.log(`Working bookings: ${todaysBookings.length - broken.length}`);

    if (broken.length > 0) {
      console.log('\n🔧 ISSUE FOUND: Bookings exist but ever_booked is not set correctly');
      console.log('📝 Root cause: The ever_booked field mapping was missing in the PUT route');
      console.log('✅ Fix applied: Added everBooked → ever_booked mapping in server code');
      console.log('⚡ Next step: Restart server for fixes to take effect');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
