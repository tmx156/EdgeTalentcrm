const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://tnltvfzltdeilanxhlvy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRubHR2ZnpsdGRlaWxhbnhobHZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxOTk4MzUsImV4cCI6MjA3Mjc3NTgzNX0.T_HaALQeSiCjLkpVuwQZUFnJbuSyRy2wf2kWiqJ99Lc'
);

const targetDate = '2025-10-16';
const startOfDay = new Date(targetDate);
startOfDay.setHours(0, 0, 0, 0);
const endOfDay = new Date(targetDate);
endOfDay.setHours(23, 59, 59, 999);

(async () => {
  console.log('='.repeat(80));
  console.log('TIM WILSON - APPOINTMENTS SCHEDULED FOR OCTOBER 16, 2025');
  console.log('='.repeat(80));
  console.log('');

  // Find Tim Wilson
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, name')
    .ilike('name', '%tim%wilson%');

  if (userError || !users || users.length === 0) {
    console.log('❌ No user found');
    return;
  }

  const timWilson = users[0];
  console.log('User:', timWilson.name);
  console.log('');

  // Check appointments SCHEDULED FOR Oct 16 (using date_booked)
  console.log('APPOINTMENTS SCHEDULED FOR OCTOBER 16, 2025 (by date_booked)');
  console.log('-'.repeat(80));

  const { data: appointmentsForOct16, error: apptError } = await supabase
    .from('leads')
    .select('id, name, status, date_booked, booked_at, created_at')
    .eq('booker_id', timWilson.id)
    .gte('date_booked', startOfDay.toISOString())
    .lte('date_booked', endOfDay.toISOString())
    .order('date_booked', { ascending: true });

  if (apptError) {
    console.error('Error:', apptError);
  } else {
    const total = appointmentsForOct16?.length || 0;
    const cancelled = appointmentsForOct16?.filter(a => a.status?.toLowerCase() === 'cancelled') || [];
    const booked = appointmentsForOct16?.filter(a => a.status?.toLowerCase() === 'booked') || [];
    const other = appointmentsForOct16?.filter(a => !['cancelled', 'booked'].includes(a.status?.toLowerCase())) || [];

    console.log(`Total appointments scheduled for Oct 16: ${total}`);
    console.log(`  Cancelled: ${cancelled.length}`);
    console.log(`  Booked: ${booked.length}`);
    console.log(`  Other: ${other.length}`);
    console.log('');

    if (cancelled.length > 0) {
      console.log('CANCELLED APPOINTMENTS:');
      cancelled.forEach((appt, index) => {
        console.log(`${index + 1}. ${appt.name}`);
        console.log(`   - Appointment time: ${new Date(appt.date_booked).toLocaleString()}`);
        console.log(`   - Booked at: ${appt.booked_at ? new Date(appt.booked_at).toLocaleString() : 'N/A'}`);
        console.log(`   - Lead ID: ${appt.id}`);
        console.log('');
      });
    }

    if (booked.length > 0) {
      console.log('ACTIVE APPOINTMENTS:');
      booked.forEach((appt, index) => {
        console.log(`${index + 1}. ${appt.name}`);
        console.log(`   - Appointment time: ${new Date(appt.date_booked).toLocaleString()}`);
        console.log('');
      });
    }
  }

  console.log('='.repeat(80));
})();
