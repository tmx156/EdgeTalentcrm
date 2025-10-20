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
  console.log('\n=== Daily Activities Query (mimicking the API) ===');
  console.log('Date range:', startOfDay.toISOString(), 'to', endOfDay.toISOString());
  console.log('');

  // Mimic the exact query from stats.js line 457-461
  const { data: leads, error: leadsError } = await supabase
    .from('leads')
    .select('id, status, date_booked, booker_id, created_at, booking_history, has_sale, booked_at, name')
    .gte('booked_at', startOfDay.toISOString())
    .lte('booked_at', endOfDay.toISOString())
    .eq('booker_id', chickoUser.id)
    .limit(10000);

  if (leadsError) {
    console.error('Error:', leadsError);
    return;
  }

  console.log('📊 Results from daily activities query:');
  console.log(`Total leads returned: ${leads.length}`);
  console.log('');

  if (leads.length > 0) {
    console.log('Booked leads:');
    leads.forEach((lead, index) => {
      console.log(`${index + 1}. ${lead.name} - Status: ${lead.status} - Booked at: ${new Date(lead.booked_at).toLocaleString()}`);
    });
  } else {
    console.log('⚠️ NO LEADS FOUND in daily activities query!');
  }

  console.log('\n=== Now checking all "Booked" status leads for comparison ===');

  const { data: bookedLeads, error: bookedError } = await supabase
    .from('leads')
    .select('id, name, status, booked_at, created_at')
    .eq('booker_id', chickoUser.id)
    .eq('status', 'Booked')
    .gte('created_at', startOfDay.toISOString())
    .lte('created_at', endOfDay.toISOString());

  if (bookedError) {
    console.error('Error:', bookedError);
    return;
  }

  console.log(`Total "Booked" leads created today: ${bookedLeads.length}`);
  bookedLeads.forEach((lead, index) => {
    const bookedAtDisplay = lead.booked_at ? new Date(lead.booked_at).toLocaleString() : '❌ NULL';
    console.log(`${index + 1}. ${lead.name} - booked_at: ${bookedAtDisplay}`);
  });
})();
