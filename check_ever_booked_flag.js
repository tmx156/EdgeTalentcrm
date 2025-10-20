const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://tnltvfzltdeilanxhlvy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRubHR2ZnpsdGRlaWxhbnhobHZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxOTk4MzUsImV4cCI6MjA3Mjc3NTgzNX0.T_HaALQeSiCjLkpVuwQZUFnJbuSyRy2wf2kWiqJ99Lc'
);

const friday = '2025-10-17';
const startOfDay = new Date(friday);
startOfDay.setHours(0, 0, 0, 0);
const endOfDay = new Date(friday);
endOfDay.setHours(23, 59, 59, 999);

(async () => {
  console.log('='.repeat(80));
  console.log('CHECKING EVER_BOOKED FLAG - CHICKO FRIDAY BOOKINGS');
  console.log('='.repeat(80));
  console.log('');

  // Find Chicko
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, name')
    .ilike('name', '%chicko%');

  if (userError || !users || users.length === 0) {
    console.log('❌ No user found');
    return;
  }

  const chicko = users[0];
  console.log('User:', chicko.name, '(ID:', chicko.id + ')');
  console.log('');

  // Get Chicko's bookings from Friday with ever_booked flag
  const { data: bookings, error: bookingsError } = await supabase
    .from('leads')
    .select('id, name, status, booked_at, ever_booked, booker_id')
    .eq('booker_id', chicko.id)
    .gte('booked_at', startOfDay.toISOString())
    .lte('booked_at', endOfDay.toISOString())
    .order('booked_at', { ascending: true });

  if (bookingsError) {
    console.error('Error:', bookingsError);
    return;
  }

  console.log(`Total bookings: ${bookings.length}`);
  console.log('');

  const withEverBooked = bookings.filter(b => b.ever_booked === true);
  const withoutEverBooked = bookings.filter(b => !b.ever_booked);

  console.log('BREAKDOWN:');
  console.log(`  With ever_booked = true: ${withEverBooked.length}`);
  console.log(`  With ever_booked = false/null: ${withoutEverBooked.length}`);
  console.log('');

  if (withoutEverBooked.length > 0) {
    console.log('❌ PROBLEM: These bookings are MISSING ever_booked flag:');
    console.log('');
    withoutEverBooked.forEach((booking, index) => {
      console.log(`${index + 1}. ${booking.name}`);
      console.log(`   - ID: ${booking.id}`);
      console.log(`   - Status: ${booking.status}`);
      console.log(`   - ever_booked: ${booking.ever_booked}`);
      console.log(`   - Booked at: ${new Date(booking.booked_at).toLocaleString()}`);
      console.log('');
    });

    console.log('='.repeat(80));
    console.log('ISSUE IDENTIFIED');
    console.log('='.repeat(80));
    console.log('The Dashboard filters leads by ever_booked = true');
    console.log(`${withoutEverBooked.length} of Chicko's bookings have ever_booked = false/null`);
    console.log('This is why they don\'t show in Daily Activities!');
    console.log('');
    console.log('FIX: Set ever_booked = true for all these bookings');
    console.log('='.repeat(80));
  } else {
    console.log('✅ All bookings have ever_booked = true');
    console.log('The issue must be elsewhere');
  }
})();
