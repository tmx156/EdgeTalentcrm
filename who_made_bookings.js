const axios = require('axios');

(async () => {
  try {
    console.log('👥 WHO MADE THE BROKEN BOOKINGS?\n');
    console.log('='.repeat(70));

    // Get all leads and users
    const [leadsRes, usersRes] = await Promise.all([
      axios.get('http://localhost:5000/api/leads/public?limit=5000'),
      axios.get('http://localhost:5000/api/users')
    ]);

    const allLeads = leadsRes.data.leads;
    const users = usersRes.data;

    // Find broken bookings
    const brokenBookings = allLeads.filter(l => l.booked_at && !l.ever_booked);

    console.log(`\nFound ${brokenBookings.length} bookings with ever_booked=false:\n`);

    brokenBookings.forEach((booking, i) => {
      const booker = users.find(u => u.id === booking.booker_id);
      const bookerName = booker ? booker.name : 'Unknown';

      console.log(`${i + 1}. ${booking.name}`);
      console.log(`   Booked by: ${bookerName} (ID: ${booking.booker_id})`);
      console.log(`   Booked at: ${booking.booked_at}`);
      console.log(`   Date/Time: ${booking.date_booked} ${booking.time_booked || ''}`);
      console.log(`   Status: ${booking.status}`);
      console.log('');
    });

    console.log('='.repeat(70));
    console.log('\n❓ WHY ARE THESE NOT SHOWING IN DAILY ACTIVITIES?\n');
    console.log('The Dashboard filters bookings like this:');
    console.log('   if (bookerId && lead.ever_booked) { ... }');
    console.log('\nSince ever_booked = false, these bookings are FILTERED OUT.\n');

    console.log('❓ WHY IS ever_booked = false?\n');
    console.log('These bookings were made BEFORE we fixed the server code.');
    console.log('The old code tried to set ever_booked=true, but the field');
    console.log('mapping was missing (everBooked → ever_booked), so it');
    console.log('was never actually saved to the database.\n');

    console.log('✅ THE CODE IS NOW FIXED. NEW bookings will work correctly.\n');
    console.log('🔧 TO FIX THESE OLD BOOKINGS, RUN THIS SQL:\n');
    console.log('   UPDATE leads SET ever_booked = true');
    console.log('   WHERE booked_at IS NOT NULL');
    console.log('     AND (ever_booked = false OR ever_booked IS NULL);\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
