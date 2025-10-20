const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://tnltvfzltdeilanxhlvy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRubHR2ZnpsdGRlaWxhbnhobHZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxOTk4MzUsImV4cCI6MjA3Mjc3NTgzNX0.T_HaALQeSiCjLkpVuwQZUFnJbuSyRy2wf2kWiqJ99Lc'
);

const today = new Date().toISOString().split('T')[0];

(async () => {
  // Find Chicko user
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, name')
    .ilike('name', '%chicko%');

  if (userError || !users || users.length === 0) {
    console.log('No user found matching Chicko');
    return;
  }

  const chickoUser = users[0];
  console.log('Found user:', chickoUser.name, '(ID:', chickoUser.id + ')');
  console.log('\n=== Checking booked_at column for today\'s bookings ===\n');

  // Get today's bookings with booked_at column
  const { data: bookings, error: bookingsError } = await supabase
    .from('leads')
    .select('id, name, status, created_at, booked_at, booker_id')
    .gte('created_at', today + 'T00:00:00')
    .lte('created_at', today + 'T23:59:59')
    .eq('booker_id', chickoUser.id)
    .order('created_at', { ascending: false });

  if (bookingsError) {
    console.error('Error:', bookingsError);
    return;
  }

  console.log('Total bookings by', chickoUser.name, 'today:', bookings.length);
  console.log('\nChecking booked_at values:\n');

  let withBookedAt = 0;
  let withoutBookedAt = 0;

  bookings.forEach((lead, index) => {
    if (lead.booked_at) {
      withBookedAt++;
      console.log(`✅ ${index + 1}. ${lead.name} - HAS booked_at: ${new Date(lead.booked_at).toLocaleString()}`);
    } else {
      withoutBookedAt++;
      console.log(`❌ ${index + 1}. ${lead.name} - NO booked_at (Status: ${lead.status})`);
    }
  });

  console.log('\n=== SUMMARY ===');
  console.log(`Total bookings: ${bookings.length}`);
  console.log(`With booked_at: ${withBookedAt}`);
  console.log(`Without booked_at: ${withoutBookedAt}`);

  if (withoutBookedAt > 0) {
    console.log('\n⚠️ ISSUE: Some bookings are missing the booked_at timestamp!');
    console.log('This is why they don\'t show up in daily activities.');
  }
})();
