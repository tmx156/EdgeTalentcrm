const { createClient } = require('@supabase/supabase-js');
const dbManager = require('./server/database-connection-manager');

const today = new Date().toISOString().split('T')[0];
const selectedDate = new Date(today);
const startOfDay = new Date(selectedDate);
startOfDay.setHours(0, 0, 0, 0);
const endOfDay = new Date(selectedDate);
endOfDay.setHours(23, 59, 59, 999);

(async () => {
  console.log('='.repeat(80));
  console.log('TESTING TEAM PERFORMANCE ENDPOINT LOGIC');
  console.log('='.repeat(80));
  console.log('Date:', today);
  console.log('Start:', startOfDay.toISOString());
  console.log('End:', endOfDay.toISOString());
  console.log('');

  try {
    // Get all users (admin view - no filtering)
    console.log('STEP 1: Getting all users...');
    const usersQuery = { select: 'id, name, role' };
    const users = await dbManager.query('users', usersQuery);

    console.log(`Found ${users.length} users`);
    console.log('');

    const teamPerformance = [];

    for (const user of users) {
      console.log(`\nProcessing user: ${user.name} (${user.id})`);

      // Get bookings made today (using booked_at)
      const bookingsQuery = {
        select: 'id, name, phone, date_booked, status, has_sale, created_at, booked_at',
        eq: { booker_id: user.id },
        gte: { booked_at: startOfDay.toISOString() },
        lte: { booked_at: endOfDay.toISOString() }
      };

      console.log(`  Querying bookings with:`, JSON.stringify(bookingsQuery, null, 2));
      const userBookings = await dbManager.query('leads', bookingsQuery);

      console.log(`  Found ${userBookings.length} bookings`);

      // Get leads assigned today
      const assignedQuery = {
        select: 'id',
        eq: { booker_id: user.id },
        gte: { created_at: startOfDay.toISOString() },
        lte: { created_at: endOfDay.toISOString() }
      };
      const assignedLeads = await dbManager.query('leads', assignedQuery);

      const performance = {
        userId: user.id,
        name: user.name,
        role: user.role,
        leadsAssigned: assignedLeads.length,
        bookingsMade: userBookings.length,
        attended: userBookings.filter(lead => ['attended', 'complete'].includes(lead.status?.toLowerCase())).length,
        salesMade: userBookings.filter(lead => lead.has_sale).length
      };

      teamPerformance.push(performance);

      if (userBookings.length > 0) {
        console.log(`  Bookings:`);
        userBookings.forEach(b => {
          console.log(`    - ${b.name} (booked_at: ${b.booked_at})`);
        });
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('TEAM PERFORMANCE SUMMARY');
    console.log('='.repeat(80));

    teamPerformance.sort((a, b) => b.bookingsMade - a.bookingsMade);

    teamPerformance.forEach(member => {
      console.log(`${member.name}: ${member.bookingsMade} bookings, ${member.leadsAssigned} leads assigned`);
    });

    console.log('\n✅ Test complete');

  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  }
})();
