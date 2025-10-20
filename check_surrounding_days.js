const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function checkSurroundingDays() {
  try {
    console.log('🔍 Checking Sunday, Monday, Tuesday for Tim Wilson...\n');

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

    const days = [
      { name: 'Sunday Oct 12', date: '2025-10-12' },
      { name: 'Monday Oct 13', date: '2025-10-13' },
      { name: 'Tuesday Oct 14', date: '2025-10-14' }
    ];

    console.log('📊 Bookings by day:\n');

    for (const day of days) {
      const startUTC = `${day.date}T00:00:00.000Z`;
      const endUTC = `${day.date}T23:59:59.999Z`;

      const { data: bookings } = await supabase
        .from('leads')
        .select('id, name, status, booked_at')
        .eq('booker_id', timWilson.id)
        .eq('ever_booked', true)
        .is('deleted_at', null)
        .gte('booked_at', startUTC)
        .lte('booked_at', endUTC)
        .order('booked_at', { ascending: true });

      console.log(`${day.name}: ${bookings?.length || 0} bookings`);
      
      if (bookings && bookings.length > 0) {
        bookings.forEach((lead, i) => {
          const time = new Date(lead.booked_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
          const statusIcon = lead.status === 'Booked' ? '✅' : lead.status === 'Cancelled' ? '❌' : '📍';
          console.log(`  ${statusIcon} ${lead.name} - ${time}`);
        });
      }
      console.log('');
    }

    console.log('='.repeat(70));
    console.log('💡 INSIGHT:');
    console.log('='.repeat(70));
    console.log(`If the 3 missing bookings were on Sunday or Tuesday,`);
    console.log(`they might have been counted together with Monday in your memory.`);
    console.log(`\nAlternatively, the database might be missing some records.`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkSurroundingDays();

