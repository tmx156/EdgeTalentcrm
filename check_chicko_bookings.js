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

  // Get today's bookings
  const { data: bookings, error: bookingsError } = await supabase
    .from('leads')
    .select('id, name, date_booked, created_at, status, booker_id')
    .gte('created_at', today + 'T00:00:00')
    .lte('created_at', today + 'T23:59:59')
    .eq('booker_id', chickoUser.id)
    .order('created_at', { ascending: false });

  if (bookingsError) {
    console.error('Error:', bookingsError);
    return;
  }

  console.log('\nTotal bookings by', chickoUser.name, 'today:', bookings.length);

  if (bookings.length > 0) {
    console.log('\nBookings:');
    bookings.forEach(lead => {
      console.log('- ID:', lead.id, '| Name:', lead.name, '| Status:', lead.status, '| Created:', new Date(lead.created_at).toLocaleString());
    });
  }
})();
