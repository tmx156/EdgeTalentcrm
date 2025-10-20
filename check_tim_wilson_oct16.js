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
  console.log('TIM WILSON - OCTOBER 16, 2025 - CANCELLATIONS');
  console.log('='.repeat(80));
  console.log('Date:', targetDate);
  console.log('Range:', startOfDay.toISOString(), 'to', endOfDay.toISOString());
  console.log('');

  // Find Tim Wilson
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, name')
    .ilike('name', '%tim%wilson%');

  if (userError || !users || users.length === 0) {
    console.log('❌ No user found matching Tim Wilson');
    return;
  }

  const timWilson = users[0];
  console.log('Found user:', timWilson.name, '(ID:', timWilson.id + ')');
  console.log('');

  // Get all bookings that were BOOKED on Oct 16 (using booked_at)
  const { data: bookedOnOct16, error: bookedError } = await supabase
    .from('leads')
    .select('id, name, status, booked_at, created_at, date_booked')
    .eq('booker_id', timWilson.id)
    .gte('booked_at', startOfDay.toISOString())
    .lte('booked_at', endOfDay.toISOString());

  if (bookedError) {
    console.error('Error getting bookings:', bookedError);
    return;
  }

  console.log('='.repeat(80));
  console.log('BOOKINGS MADE ON OCTOBER 16, 2025 (by booked_at timestamp)');
  console.log('='.repeat(80));
  console.log(`Total bookings made: ${bookedOnOct16?.length || 0}`);
  console.log('');

  if (bookedOnOct16 && bookedOnOct16.length > 0) {
    const cancelled = bookedOnOct16.filter(b => b.status?.toLowerCase() === 'cancelled');
    const booked = bookedOnOct16.filter(b => b.status?.toLowerCase() === 'booked');
    const other = bookedOnOct16.filter(b => !['cancelled', 'booked'].includes(b.status?.toLowerCase()));

    console.log('BREAKDOWN BY STATUS:');
    console.log(`  Cancelled: ${cancelled.length}`);
    console.log(`  Booked: ${booked.length}`);
    console.log(`  Other: ${other.length}`);
    console.log('');

    if (cancelled.length > 0) {
      console.log('CANCELLED BOOKINGS:');
      cancelled.forEach((booking, index) => {
        console.log(`${index + 1}. ${booking.name}`);
        console.log(`   - ID: ${booking.id}`);
        console.log(`   - Booked at: ${new Date(booking.booked_at).toLocaleString()}`);
        console.log(`   - Appointment was for: ${booking.date_booked ? new Date(booking.date_booked).toLocaleString() : 'N/A'}`);
        console.log('');
      });
    }

    if (booked.length > 0) {
      console.log('CURRENTLY BOOKED (not cancelled):');
      booked.forEach((booking, index) => {
        console.log(`${index + 1}. ${booking.name}`);
        console.log(`   - ID: ${booking.id}`);
        console.log(`   - Booked at: ${new Date(booking.booked_at).toLocaleString()}`);
        console.log(`   - Appointment for: ${booking.date_booked ? new Date(booking.date_booked).toLocaleString() : 'N/A'}`);
        console.log('');
      });
    }
  } else {
    console.log('No bookings found for Tim Wilson on October 16, 2025');
  }

  // Also check for leads created on Oct 16 (not necessarily booked)
  const { data: createdOnOct16, error: createdError } = await supabase
    .from('leads')
    .select('id, name, status, created_at, booked_at, date_booked')
    .eq('booker_id', timWilson.id)
    .gte('created_at', startOfDay.toISOString())
    .lte('created_at', endOfDay.toISOString());

  if (!createdError && createdOnOct16 && createdOnOct16.length > 0) {
    console.log('='.repeat(80));
    console.log('LEADS CREATED/ASSIGNED ON OCTOBER 16, 2025');
    console.log('='.repeat(80));
    console.log(`Total leads: ${createdOnOct16.length}`);

    const cancelledCreated = createdOnOct16.filter(l => l.status?.toLowerCase() === 'cancelled');
    console.log(`Cancelled: ${cancelledCreated.length}`);
    console.log('');

    if (cancelledCreated.length > 0) {
      console.log('CANCELLED LEADS:');
      cancelledCreated.forEach((lead, index) => {
        console.log(`${index + 1}. ${lead.name}`);
        console.log(`   - ID: ${lead.id}`);
        console.log(`   - Created: ${new Date(lead.created_at).toLocaleString()}`);
        console.log(`   - Booked at: ${lead.booked_at ? new Date(lead.booked_at).toLocaleString() : '❌ Never booked'}`);
        console.log('');
      });
    }
  }

  console.log('='.repeat(80));
})();
