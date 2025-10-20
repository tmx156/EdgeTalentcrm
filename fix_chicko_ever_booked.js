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
  console.log('FIXING EVER_BOOKED FLAG FOR CHICKO\'S FRIDAY BOOKINGS');
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
  console.log('User:', chicko.name);
  console.log('');

  // Get Chicko's Friday bookings that need fixing
  const { data: bookings, error: bookingsError } = await supabase
    .from('leads')
    .select('id, name, status, booked_at, ever_booked')
    .eq('booker_id', chicko.id)
    .gte('booked_at', startOfDay.toISOString())
    .lte('booked_at', endOfDay.toISOString())
    .eq('ever_booked', false);

  if (bookingsError) {
    console.error('Error fetching bookings:', bookingsError);
    return;
  }

  console.log(`Found ${bookings.length} bookings with ever_booked = false`);
  console.log('');

  if (bookings.length === 0) {
    console.log('✅ No bookings need fixing!');
    return;
  }

  console.log('Updating ever_booked = true for these bookings...');
  console.log('');

  let successCount = 0;
  let errorCount = 0;

  for (const booking of bookings) {
    const { error: updateError } = await supabase
      .from('leads')
      .update({ ever_booked: true })
      .eq('id', booking.id);

    if (updateError) {
      console.error(`❌ Failed to update ${booking.name}:`, updateError.message);
      errorCount++;
    } else {
      console.log(`✅ Updated ${booking.name} (${booking.id})`);
      successCount++;
    }
  }

  console.log('');
  console.log('='.repeat(80));
  console.log('UPDATE COMPLETE');
  console.log('='.repeat(80));
  console.log(`Success: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log('');
  console.log('✅ Chicko\'s 17 bookings should now appear in Daily Activities!');
  console.log('='.repeat(80));
})();
