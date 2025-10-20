const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function checkMondayOct13() {
  try {
    console.log('🔍 Checking Monday October 13, 2025 bookings...\n');

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

    const mondayDate = '2025-10-13';
    const startUTC = `${mondayDate}T00:00:00.000Z`;
    const endUTC = `${mondayDate}T23:59:59.999Z`;

    console.log(`📅 Checking Monday ${mondayDate}\n`);

    // Method 1: Get leads with booked_at on Monday
    const { data: bookedAtLeads, error: e1 } = await supabase
      .from('leads')
      .select('*')
      .eq('booker_id', timWilson.id)
      .eq('ever_booked', true)
      .is('deleted_at', null)
      .gte('booked_at', startUTC)
      .lte('booked_at', endUTC)
      .order('booked_at', { ascending: true });

    console.log(`📊 METHOD 1 (booked_at): ${bookedAtLeads?.length || 0} bookings\n`);

    if (bookedAtLeads && bookedAtLeads.length > 0) {
      console.log('Bookings made on Monday (by booked_at):');
      bookedAtLeads.forEach((lead, i) => {
        const time = new Date(lead.booked_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        console.log(`  ${i + 1}. ${lead.name} - Status: ${lead.status} - Time: ${time}`);
      });
      console.log('');
    }

    // Method 2: Get leads created on Monday
    const { data: createdLeads, error: e2 } = await supabase
      .from('leads')
      .select('*')
      .eq('booker_id', timWilson.id)
      .is('deleted_at', null)
      .gte('created_at', startUTC)
      .lte('created_at', endUTC)
      .order('created_at', { ascending: true });

    console.log(`📊 METHOD 2 (created_at): ${createdLeads?.length || 0} leads created\n`);

    // Method 3: Check for leads with status='Booked' but no booked_at
    const { data: allTimLeads } = await supabase
      .from('leads')
      .select('*')
      .eq('booker_id', timWilson.id)
      .is('deleted_at', null);

    // Check which ones were created on Monday but don't have booked_at
    const createdMondayNoBookedAt = allTimLeads?.filter(lead => {
      if (!lead.created_at) return false;
      const createdDate = new Date(lead.created_at).toISOString().split('T')[0];
      return createdDate === mondayDate && lead.ever_booked === true && !lead.booked_at;
    });

    console.log(`⚠️  Leads created Monday with ever_booked but NO booked_at: ${createdMondayNoBookedAt?.length || 0}\n`);
    
    if (createdMondayNoBookedAt && createdMondayNoBookedAt.length > 0) {
      console.log('Leads missing booked_at timestamp:');
      createdMondayNoBookedAt.forEach((lead, i) => {
        console.log(`  ${i + 1}. ${lead.name} - Status: ${lead.status} - Created: ${new Date(lead.created_at).toLocaleTimeString('en-GB')}`);
      });
      console.log('');
    }

    // Method 4: Check for leads updated on Monday (status changed to Booked)
    const updatedMonday = allTimLeads?.filter(lead => {
      if (!lead.updated_at) return false;
      const updatedDate = new Date(lead.updated_at).toISOString().split('T')[0];
      return updatedDate === mondayDate && lead.ever_booked === true;
    });

    console.log(`📊 METHOD 4 (updated_at): ${updatedMonday?.length || 0} leads updated on Monday\n`);

    // Find the difference
    const uniqueLeads = new Set();
    [bookedAtLeads, createdMondayNoBookedAt, updatedMonday].forEach(leads => {
      if (leads) {
        leads.forEach(lead => uniqueLeads.add(lead.id));
      }
    });

    console.log('='.repeat(70));
    console.log('SUMMARY:');
    console.log('='.repeat(70));
    console.log(`Dashboard query (booked_at): ${bookedAtLeads?.length || 0} bookings`);
    console.log(`Total unique leads involved on Monday: ${uniqueLeads.size}`);
    console.log(`Expected by user: 20 bookings`);
    console.log(`Difference: ${20 - (bookedAtLeads?.length || 0)}`);
    
    if ((bookedAtLeads?.length || 0) < 20) {
      console.log(`\n⚠️  Missing ${20 - (bookedAtLeads?.length || 0)} bookings!`);
      console.log(`\nPossible causes:`);
      console.log(`  1. Leads created with status='Booked' but booked_at not set`);
      console.log(`  2. Leads updated to status='Booked' but booked_at not set`);
      console.log(`  3. Timezone issues with booked_at timestamps`);
      console.log(`\n💡 SOLUTION: Run migration to set booked_at for leads missing it`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkMondayOct13();

