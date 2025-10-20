const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function checkMondayTimezone() {
  try {
    console.log('🔍 Checking for timezone boundary issues...\n');

    const supabase = createClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
    );

    // Get Tim Wilson
    const { data: users } = await supabase.from('users').select('*');
    const timWilson = users.find(u => u.name && u.name.toLowerCase().includes('tim'));
    
    if (!timWilson) {
      console.log('❌ Could not find Tim Wilson');
      return;
    }

    console.log(`👤 User: ${timWilson.name} (ID: ${timWilson.id})\n`);

    // EXPANDED range to catch timezone edge cases
    // UK is currently BST (UTC+1), so Monday in UK could span from Sunday 23:00 UTC to Monday 23:00 UTC
    const expandedStart = '2025-10-12T22:00:00.000Z'; // 11pm Sunday UTC = midnight Monday BST
    const expandedEnd = '2025-10-14T01:00:00.000Z';   // 1am Tuesday UTC = 2am Tuesday BST

    console.log(`📅 Using EXPANDED range to catch timezone edges:`);
    console.log(`   ${expandedStart} to ${expandedEnd}\n`);

    // Get leads with booked_at in expanded range
    const { data: expandedLeads } = await supabase
      .from('leads')
      .select('id, name, status, booked_at, created_at, ever_booked')
      .eq('booker_id', timWilson.id)
      .eq('ever_booked', true)
      .is('deleted_at', null)
      .gte('booked_at', expandedStart)
      .lte('booked_at', expandedEnd)
      .order('booked_at', { ascending: true });

    console.log(`📊 Leads in EXPANDED range: ${expandedLeads?.length || 0}\n`);

    if (expandedLeads) {
      console.log('All bookings in expanded range:');
      expandedLeads.forEach((lead, i) => {
        const bookedUTC = new Date(lead.booked_at);
        const bookedUK = new Date(bookedUTC.toLocaleString('en-US', { timeZone: 'Europe/London' }));
        const ukDate = bookedUTC.toLocaleDateString('en-GB', { timeZone: 'Europe/London', day: '2-digit', month: '2-digit', year: 'numeric' });
        const ukTime = bookedUTC.toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' });
        
        console.log(`  ${i + 1}. ${lead.name}`);
        console.log(`      UTC: ${lead.booked_at}`);
        console.log(`      UK:  ${ukDate} ${ukTime}`);
        console.log(`      Status: ${lead.status}`);
      });
      console.log('');
    }

    // Now use the same expanded range that the Dashboard SHOULD be using
    const mondayDateUK = '2025-10-13';
    const startOfDayUK = new Date(mondayDateUK + 'T00:00:00');
    const endOfDayUK = new Date(mondayDateUK + 'T23:59:59.999');
    
    const offsetMinutes = -startOfDayUK.getTimezoneOffset();
    const startUTC = new Date(startOfDayUK.getTime() + (offsetMinutes * 60000)).toISOString();
    const endUTC = new Date(endOfDayUK.getTime() + (offsetMinutes * 60000)).toISOString();

    console.log(`📅 Dashboard query range (what it SHOULD use):`);
    console.log(`   ${startUTC} to ${endUTC}\n`);

    const { data: dashboardLeads } = await supabase
      .from('leads')
      .select('id, name, status, booked_at')
      .eq('booker_id', timWilson.id)
      .eq('ever_booked', true)
      .is('deleted_at', null)
      .gte('booked_at', startUTC)
      .lte('booked_at', endUTC)
      .order('booked_at', { ascending: true });

    console.log(`📊 Dashboard query result: ${dashboardLeads?.length || 0} bookings\n`);

    console.log('='.repeat(70));
    console.log('RESULT:');
    console.log('='.repeat(70));
    console.log(`Using proper UK timezone conversion: ${dashboardLeads?.length || 0} bookings`);
    console.log(`Expected: 20 bookings`);
    console.log(`Still missing: ${20 - (dashboardLeads?.length || 0)}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

checkMondayTimezone();

