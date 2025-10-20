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
  console.log('COMPREHENSIVE TIM WILSON CANCELLATION CHECK - OCTOBER 16, 2025');
  console.log('='.repeat(80));
  console.log('Date:', targetDate);
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

  // METHOD 1: Bookings MADE on Oct 16 (using booked_at)
  console.log('METHOD 1: Bookings MADE on October 16 (by booked_at timestamp)');
  console.log('-'.repeat(80));

  const { data: bookedOnOct16, error: bookedError } = await supabase
    .from('leads')
    .select('id, name, status, booked_at, created_at, date_booked, booking_history')
    .eq('booker_id', timWilson.id)
    .gte('booked_at', startOfDay.toISOString())
    .lte('booked_at', endOfDay.toISOString())
    .order('booked_at', { ascending: true });

  if (bookedError) {
    console.error('Error:', bookedError);
  } else {
    const total = bookedOnOct16?.length || 0;
    const cancelled = bookedOnOct16?.filter(b => b.status?.toLowerCase() === 'cancelled') || [];

    console.log(`Total bookings made: ${total}`);
    console.log(`Currently Cancelled: ${cancelled.length}`);
    console.log('');
  }

  // METHOD 2: Check booking_history for cancellations that happened on Oct 16
  console.log('METHOD 2: Checking booking_history for cancellations on October 16');
  console.log('-'.repeat(80));

  // Get all leads for Tim Wilson
  const { data: allTimLeads, error: allLeadsError } = await supabase
    .from('leads')
    .select('id, name, status, booked_at, created_at, booking_history')
    .eq('booker_id', timWilson.id);

  if (allLeadsError) {
    console.error('Error:', allLeadsError);
  } else {
    let cancellationsOnOct16 = [];

    allTimLeads.forEach(lead => {
      if (lead.booking_history && Array.isArray(lead.booking_history)) {
        lead.booking_history.forEach(entry => {
          const entryDate = new Date(entry.timestamp);
          const isOct16 = entryDate >= startOfDay && entryDate <= endOfDay;

          if (isOct16 && (
            entry.action === 'CANCELLED' ||
            entry.action === 'STATUS_CHANGED' && entry.details?.new_status?.toLowerCase() === 'cancelled'
          )) {
            cancellationsOnOct16.push({
              leadId: lead.id,
              leadName: lead.name,
              currentStatus: lead.status,
              cancelledAt: entry.timestamp,
              action: entry.action,
              details: entry.details
            });
          }
        });
      }
    });

    console.log(`Cancellations that occurred on Oct 16: ${cancellationsOnOct16.length}`);

    if (cancellationsOnOct16.length > 0) {
      console.log('');
      console.log('CANCELLATION DETAILS:');
      cancellationsOnOct16.forEach((cancel, index) => {
        console.log(`${index + 1}. ${cancel.leadName}`);
        console.log(`   - Lead ID: ${cancel.leadId}`);
        console.log(`   - Cancelled at: ${new Date(cancel.cancelledAt).toLocaleString()}`);
        console.log(`   - Current status: ${cancel.currentStatus}`);
        console.log('');
      });
    }
  }

  // METHOD 3: Get ALL leads assigned to Tim on Oct 16 and check their current status
  console.log('METHOD 3: All leads created/assigned on Oct 16 (by created_at)');
  console.log('-'.repeat(80));

  const { data: createdOnOct16, error: createdError } = await supabase
    .from('leads')
    .select('id, name, status, created_at, booked_at, date_booked')
    .eq('booker_id', timWilson.id)
    .gte('created_at', startOfDay.toISOString())
    .lte('created_at', endOfDay.toISOString());

  if (createdError) {
    console.error('Error:', createdError);
  } else {
    const total = createdOnOct16?.length || 0;
    const cancelled = createdOnOct16?.filter(l => l.status?.toLowerCase() === 'cancelled') || [];
    const booked = createdOnOct16?.filter(l => l.status?.toLowerCase() === 'booked') || [];

    console.log(`Total leads assigned: ${total}`);
    console.log(`Currently Cancelled: ${cancelled.length}`);
    console.log(`Currently Booked: ${booked.length}`);
    console.log(`Other statuses: ${total - cancelled.length - booked.length}`);
  }

  // METHOD 4: Check for any Tim Wilson leads with status = Cancelled (regardless of date)
  console.log('');
  console.log('METHOD 4: Total cancelled leads for Tim Wilson (all time)');
  console.log('-'.repeat(80));

  const { data: allCancelled, error: allCancelledError } = await supabase
    .from('leads')
    .select('id, name, status, created_at, booked_at')
    .eq('booker_id', timWilson.id)
    .eq('status', 'Cancelled');

  if (!allCancelledError) {
    console.log(`Total cancelled leads (all time): ${allCancelled?.length || 0}`);

    // Filter to Oct 16
    const oct16Cancelled = allCancelled?.filter(l => {
      const createdDate = new Date(l.created_at);
      return createdDate >= startOfDay && createdDate <= endOfDay;
    }) || [];

    console.log(`Cancelled leads created on Oct 16: ${oct16Cancelled.length}`);
  }

  console.log('');
  console.log('='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log('If the answer is 19, it might be measuring:');
  console.log('- Cancellations that HAPPENED on Oct 16 (booking_history)');
  console.log('- OR leads created on Oct 16 that are now cancelled');
  console.log('- OR bookings made on Oct 16 that are now cancelled + some other criteria');
  console.log('='.repeat(80));
})();
