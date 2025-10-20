const axios = require('axios');

(async () => {
  try {
    console.log('🔧 Fixing ever_booked for all existing bookings...\n');

    // Get all leads with booked_at but ever_booked = false
    const response = await axios.get('http://localhost:5000/api/leads/public?limit=5000');
    const allLeads = response.data.leads;

    const brokenBookings = allLeads.filter(l =>
      l.booked_at && !l.ever_booked
    );

    console.log(`Found ${brokenBookings.length} bookings with ever_booked=false:\n`);

    if (brokenBookings.length === 0) {
      console.log('✅ No bookings need fixing!');
      process.exit(0);
    }

    brokenBookings.forEach((b, i) => {
      console.log(`${i + 1}. ${b.name} (ID: ${b.id})`);
      console.log(`   Booked at: ${b.booked_at}`);
      console.log(`   Status: ${b.status}`);
    });

    console.log('\n⚠️  TO FIX THESE BOOKINGS:');
    console.log('Run this SQL in Supabase SQL Editor:\n');
    console.log('UPDATE leads SET ever_booked = true');
    console.log('WHERE booked_at IS NOT NULL');
    console.log('  AND (ever_booked = false OR ever_booked IS NULL);');
    console.log('\nOR copy the IDs below and update via admin panel\n');

    brokenBookings.forEach(b => {
      console.log(`ID: ${b.id}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
