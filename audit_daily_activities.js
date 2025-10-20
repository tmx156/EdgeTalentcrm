const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://tnltvfzltdeilanxhlvy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRubHR2ZnpsdGRlaWxhbnhobHZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxOTk4MzUsImV4cCI6MjA3Mjc3NTgzNX0.T_HaALQeSiCjLkpVuwQZUFnJbuSyRy2wf2kWiqJ99Lc'
);

const today = new Date();
const startOfDay = new Date(today);
startOfDay.setHours(0, 0, 0, 0);
const endOfDay = new Date(today);
endOfDay.setHours(23, 59, 59, 999);

(async () => {
  console.log('='.repeat(80));
  console.log('DAILY ACTIVITIES AUDIT - 100% COMPREHENSIVE');
  console.log('='.repeat(80));
  console.log('Date:', today.toLocaleDateString());
  console.log('Range:', startOfDay.toISOString(), 'to', endOfDay.toISOString());
  console.log('');

  // Step 1: Get all users
  console.log('STEP 1: Getting all users...');
  const { data: allUsers, error: usersError } = await supabase
    .from('users')
    .select('id, name, role')
    .order('name');

  if (usersError) {
    console.error('Error getting users:', usersError);
    return;
  }

  console.log(`Found ${allUsers.length} users in the system`);
  console.log('');

  // Find Chicko and Tanya
  const chicko = allUsers.find(u => u.name.toLowerCase().includes('chicko'));
  const tanya = allUsers.find(u => u.name.toLowerCase().includes('tanya'));

  console.log('Target Users:');
  console.log('- Chicko:', chicko ? `${chicko.name} (${chicko.id})` : '❌ NOT FOUND');
  console.log('- Tanya:', tanya ? `${tanya.name} (${tanya.id})` : '❌ NOT FOUND');
  console.log('');

  // Step 2: Query ALL bookings made today (NO FILTERS - admin view)
  console.log('STEP 2: Getting ALL bookings made today (admin view - no filters)...');
  const { data: allBookings, error: allBookingsError } = await supabase
    .from('leads')
    .select('id, name, status, booker_id, booked_at, created_at')
    .gte('booked_at', startOfDay.toISOString())
    .lte('booked_at', endOfDay.toISOString())
    .order('booked_at', { ascending: true });

  if (allBookingsError) {
    console.error('Error getting all bookings:', allBookingsError);
    return;
  }

  console.log(`Total bookings made today (using booked_at): ${allBookings.length}`);
  console.log('');

  // Step 3: Group by booker
  console.log('STEP 3: Grouping bookings by booker...');
  const bookingsByBooker = {};

  allBookings.forEach(booking => {
    if (!booking.booker_id) {
      if (!bookingsByBooker['NO_BOOKER']) {
        bookingsByBooker['NO_BOOKER'] = { count: 0, bookings: [] };
      }
      bookingsByBooker['NO_BOOKER'].count++;
      bookingsByBooker['NO_BOOKER'].bookings.push(booking);
    } else {
      if (!bookingsByBooker[booking.booker_id]) {
        bookingsByBooker[booking.booker_id] = { count: 0, bookings: [] };
      }
      bookingsByBooker[booking.booker_id].count++;
      bookingsByBooker[booking.booker_id].bookings.push(booking);
    }
  });

  console.log('Bookings by Booker:');
  for (const [bookerId, data] of Object.entries(bookingsByBooker)) {
    if (bookerId === 'NO_BOOKER') {
      console.log(`  NO_BOOKER: ${data.count} bookings`);
    } else {
      const user = allUsers.find(u => u.id === bookerId);
      const userName = user ? user.name : 'Unknown User';
      console.log(`  ${userName} (${bookerId}): ${data.count} bookings`);
    }
  }
  console.log('');

  // Step 4: Chicko's bookings specifically
  if (chicko) {
    console.log('STEP 4: CHICKO\'S BOOKINGS DETAIL');
    console.log('-'.repeat(80));
    const chickoBookings = bookingsByBooker[chicko.id];

    if (chickoBookings) {
      console.log(`Chicko has ${chickoBookings.count} bookings today`);
      console.log('');
      chickoBookings.bookings.forEach((booking, index) => {
        console.log(`${index + 1}. ${booking.name}`);
        console.log(`   - Status: ${booking.status}`);
        console.log(`   - Booked at: ${new Date(booking.booked_at).toLocaleString()}`);
        console.log(`   - Lead ID: ${booking.id}`);
      });
    } else {
      console.log('❌ NO BOOKINGS FOUND FOR CHICKO');
    }
    console.log('');
  }

  // Step 5: Tanya's bookings specifically
  if (tanya) {
    console.log('STEP 5: TANYA\'S BOOKINGS DETAIL');
    console.log('-'.repeat(80));
    const tanyaBookings = bookingsByBooker[tanya.id];

    if (tanyaBookings) {
      console.log(`Tanya has ${tanyaBookings.count} bookings today`);
      console.log('');
      tanyaBookings.bookings.forEach((booking, index) => {
        console.log(`${index + 1}. ${booking.name}`);
        console.log(`   - Status: ${booking.status}`);
        console.log(`   - Booked at: ${new Date(booking.booked_at).toLocaleString()}`);
        console.log(`   - Lead ID: ${booking.id}`);
      });
    } else {
      console.log('❌ NO BOOKINGS FOUND FOR TANYA');
    }
    console.log('');
  }

  // Step 6: Test the exact query used by daily-analytics endpoint
  console.log('STEP 6: Testing DAILY-ANALYTICS endpoint query (admin view)');
  console.log('-'.repeat(80));

  // This mimics what the backend does WITHOUT role filtering (admin view)
  const { data: analyticsBookings, error: analyticsError } = await supabase
    .from('leads')
    .select('id, status, date_booked, booker_id, created_at, booking_history, has_sale, booked_at')
    .gte('booked_at', startOfDay.toISOString())
    .lte('booked_at', endOfDay.toISOString())
    .limit(10000);

  if (analyticsError) {
    console.error('Error:', analyticsError);
  } else {
    console.log(`Total leads returned by analytics query: ${analyticsBookings.length}`);

    // Count by booker
    const analyticsByBooker = {};
    analyticsBookings.forEach(lead => {
      const bookerId = lead.booker_id || 'NO_BOOKER';
      analyticsByBooker[bookerId] = (analyticsByBooker[bookerId] || 0) + 1;
    });

    console.log('Breakdown by booker:');
    for (const [bookerId, count] of Object.entries(analyticsByBooker)) {
      if (bookerId === 'NO_BOOKER') {
        console.log(`  NO_BOOKER: ${count}`);
      } else {
        const user = allUsers.find(u => u.id === bookerId);
        const userName = user ? user.name : 'Unknown';
        console.log(`  ${userName}: ${count}`);
      }
    }
  }
  console.log('');

  // Step 7: Summary
  console.log('='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total bookings today: ${allBookings.length}`);
  console.log(`Chicko's bookings: ${chicko && bookingsByBooker[chicko.id] ? bookingsByBooker[chicko.id].count : 0}`);
  console.log(`Tanya's bookings: ${tanya && bookingsByBooker[tanya.id] ? bookingsByBooker[tanya.id].count : 0}`);
  console.log('');
  console.log('✅ If Chicko has bookings but they\'re not showing on the frontend,');
  console.log('   the issue is either:');
  console.log('   1. Frontend filtering/display logic');
  console.log('   2. API endpoint has role-based filtering even for admins');
  console.log('   3. Frontend is calling the wrong endpoint');
  console.log('='.repeat(80));
})();
