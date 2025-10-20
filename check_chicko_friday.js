const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://tnltvfzltdeilanxhlvy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRubHR2ZnpsdGRlaWxhbnhobHZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxOTk4MzUsImV4cCI6MjA3Mjc3NTgzNX0.T_HaALQeSiCjLkpVuwQZUFnJbuSyRy2wf2kWiqJ99Lc'
);

// Friday = October 17, 2025 (today)
const friday = '2025-10-17';
const startOfDay = new Date(friday);
startOfDay.setHours(0, 0, 0, 0);
const endOfDay = new Date(friday);
endOfDay.setHours(23, 59, 59, 999);

(async () => {
  console.log('='.repeat(80));
  console.log('CHICKO - FRIDAY, OCTOBER 17, 2025');
  console.log('='.repeat(80));
  console.log('Date:', friday);
  console.log('Day: Friday');
  console.log('Range:', startOfDay.toISOString(), 'to', endOfDay.toISOString());
  console.log('');

  // Find Chicko
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, name')
    .ilike('name', '%chicko%');

  if (userError || !users || users.length === 0) {
    console.log('❌ No user found matching Chicko');
    return;
  }

  const chicko = users[0];
  console.log('Found user:', chicko.name, '(ID:', chicko.id + ')');
  console.log('');

  // Get bookings MADE on Friday (using booked_at timestamp)
  console.log('BOOKINGS MADE ON FRIDAY (by booked_at timestamp)');
  console.log('-'.repeat(80));

  const { data: bookings, error: bookingsError } = await supabase
    .from('leads')
    .select('id, name, status, booked_at, date_booked, created_at, has_sale')
    .eq('booker_id', chicko.id)
    .gte('booked_at', startOfDay.toISOString())
    .lte('booked_at', endOfDay.toISOString())
    .order('booked_at', { ascending: true });

  if (bookingsError) {
    console.error('Error:', bookingsError);
    return;
  }

  const total = bookings?.length || 0;
  const cancelled = bookings?.filter(b => b.status?.toLowerCase() === 'cancelled') || [];
  const booked = bookings?.filter(b => b.status?.toLowerCase() === 'booked') || [];
  const sales = bookings?.filter(b => b.has_sale) || [];

  console.log(`Total bookings made: ${total}`);
  console.log(`  Status - Booked: ${booked.length}`);
  console.log(`  Status - Cancelled: ${cancelled.length}`);
  console.log(`  With Sales: ${sales.length}`);
  console.log('');

  if (bookings && bookings.length > 0) {
    console.log('ALL BOOKINGS:');
    console.log('');
    bookings.forEach((booking, index) => {
      const bookedTime = new Date(booking.booked_at);
      const apptTime = booking.date_booked ? new Date(booking.date_booked) : null;

      console.log(`${index + 1}. ${booking.name}`);
      console.log(`   - Status: ${booking.status}`);
      console.log(`   - Booked at: ${bookedTime.toLocaleTimeString('en-GB')} on ${bookedTime.toLocaleDateString('en-GB')}`);
      console.log(`   - Appointment for: ${apptTime ? apptTime.toLocaleString('en-GB') : 'N/A'}`);
      console.log(`   - Has Sale: ${booking.has_sale ? 'Yes' : 'No'}`);
      console.log(`   - Lead ID: ${booking.id}`);
      console.log('');
    });
  } else {
    console.log('No bookings found for Chicko on Friday');
  }

  console.log('='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Chicko made ${total} bookings on Friday, October 17, 2025`);
  console.log('='.repeat(80));
})();
