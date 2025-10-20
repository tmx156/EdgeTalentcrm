const { query } = require('./server/config/database-pool');

(async () => {
  try {
    console.log('🔧 Fixing TeESt booking...\n');

    // Update the TeESt lead to set ever_booked = true
    const updateQuery = `
      UPDATE leads
      SET ever_booked = true
      WHERE name = 'TeESt' AND status = 'Booked'
      RETURNING *
    `;

    const result = await query(updateQuery, []);

    if (result.rows.length > 0) {
      console.log('✅ Successfully updated TeESt booking:');
      console.log('   Name:', result.rows[0].name);
      console.log('   Status:', result.rows[0].status);
      console.log('   Ever Booked:', result.rows[0].ever_booked);
      console.log('   Booked At:', result.rows[0].booked_at);
      console.log('   Date Booked:', result.rows[0].date_booked);
    } else {
      console.log('❌ No TeESt booking found to update');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
