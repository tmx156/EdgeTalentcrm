const { query } = require('./server/config/database-pool');

(async () => {
  try {
    // UK timezone - get today's date
    const ukTz = 'Europe/London';
    const now = new Date();
    const todayUK = now.toISOString().split('T')[0];

    console.log('🔍 Checking bookings for UK date:', todayUK);

    // Get ALL leads booked today (using booked_at timestamp)
    const querySQL = `
      SELECT
        id,
        name,
        status,
        date_booked,
        booked_at,
        ever_booked,
        booker_id,
        created_at,
        updated_at
      FROM leads
      WHERE DATE(booked_at) = $1
      ORDER BY booked_at DESC
    `;

    const result = await query(querySQL, [todayUK]);
    const bookings = result.rows;

    console.log(`\n📊 Found ${bookings.length} bookings made TODAY (${todayUK}):\n`);

    if (bookings.length === 0) {
      console.log('❌ NO BOOKINGS FOUND FOR TODAY');
    } else {
      bookings.forEach((booking, idx) => {
        console.log(`${idx + 1}. ${booking.name}`);
        console.log(`   Status: ${booking.status}`);
        console.log(`   Ever Booked: ${booking.ever_booked}`);
        console.log(`   Booker ID: ${booking.booker_id}`);
        console.log(`   Date Booked: ${booking.date_booked}`);
        console.log(`   Booked At: ${booking.booked_at}`);
        console.log(`   Created: ${booking.created_at}`);
        console.log(`   Updated: ${booking.updated_at}`);
        console.log('');
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
})();
