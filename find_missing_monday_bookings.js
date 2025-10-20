const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function findMissingMondayBookings() {
  try {
    console.log('🔍 Finding the 3 missing Monday bookings...\n');

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

    // Get ALL leads for Tim Wilson
    const { data: allLeads } = await supabase
      .from('leads')
      .select('*')
      .eq('booker_id', timWilson.id)
      .is('deleted_at', null);

    console.log(`Total leads for Tim Wilson: ${allLeads?.length || 0}\n`);

    // Filter for leads created on Monday
    const createdMonday = allLeads?.filter(lead => {
      if (!lead.created_at) return false;
      const createdDate = new Date(lead.created_at).toISOString().split('T')[0];
      return createdDate === mondayDate;
    });

    console.log(`Leads CREATED on Monday: ${createdMonday?.length || 0}\n`);

    // Check which of these have ever_booked
    const bookedCreatedMonday = createdMonday?.filter(lead => lead.ever_booked === true);
    console.log(`Leads created Monday with ever_booked=true: ${bookedCreatedMonday?.length || 0}`);

    // Check which have booked_at set
    const withBookedAt = bookedCreatedMonday?.filter(lead => lead.booked_at);
    const withoutBookedAt = bookedCreatedMonday?.filter(lead => !lead.booked_at);
    
    console.log(`  - WITH booked_at: ${withBookedAt?.length || 0}`);
    console.log(`  - WITHOUT booked_at: ${withoutBookedAt?.length || 0}\n`);

    // Check for leads with booked_at on Monday but created on a different day
    const bookedAtMonday = allLeads?.filter(lead => {
      if (!lead.booked_at) return false;
      const bookedDate = new Date(lead.booked_at).toISOString().split('T')[0];
      return bookedDate === mondayDate;
    });

    console.log(`Leads with booked_at on Monday: ${bookedAtMonday?.length || 0}`);

    // Check if any were created before Monday
    const bookedMondayCreatedEarlier = bookedAtMonday?.filter(lead => {
      if (!lead.created_at) return false;
      const createdDate = new Date(lead.created_at).toISOString().split('T')[0];
      return createdDate !== mondayDate;
    });
    
    console.log(`  - Created BEFORE Monday: ${bookedMondayCreatedEarlier?.length || 0}\n`);

    // Now check: Are there leads created Monday with status='Booked' but no booked_at?
    const suspiciousLeads = createdMonday?.filter(lead => {
      return (lead.status === 'Booked' || lead.status === 'Cancelled' || lead.ever_booked === true) && !lead.booked_at;
    });

    console.log('🔍 SUSPICIOUS LEADS (created Monday, should have booked_at):');
    console.log(`Found ${suspiciousLeads?.length || 0} leads:\n`);

    if (suspiciousLeads && suspiciousLeads.length > 0) {
      suspiciousLeads.forEach((lead, i) => {
        console.log(`${i + 1}. ${lead.name}`);
        console.log(`   ID: ${lead.id}`);
        console.log(`   Status: ${lead.status}`);
        console.log(`   ever_booked: ${lead.ever_booked}`);
        console.log(`   Created: ${new Date(lead.created_at).toLocaleString('en-GB')}`);
        console.log(`   Updated: ${lead.updated_at ? new Date(lead.updated_at).toLocaleString('en-GB') : 'N/A'}`);
        console.log(`   booked_at: ${lead.booked_at || 'MISSING'}`);
        console.log(`   date_booked: ${lead.date_booked || 'N/A'}`);
        console.log('');
      });
    }

    // Also check if there are leads assigned to Tim on Monday that might be counted
    const assignedMonday = allLeads?.filter(lead => {
      if (!lead.assigned_at) return false;
      const assignedDate = new Date(lead.assigned_at).toISOString().split('T')[0];
      return assignedDate === mondayDate && lead.ever_booked === true;
    });

    console.log(`Leads ASSIGNED to Tim on Monday: ${assignedMonday?.length || 0}\n`);

    console.log('='.repeat(70));
    console.log('ANALYSIS:');
    console.log('='.repeat(70));
    console.log(`Leads with booked_at on Monday: ${bookedAtMonday?.length || 0}`);
    console.log(`Leads created Monday with ever_booked: ${bookedCreatedMonday?.length || 0}`);
    console.log(`Suspicious leads (missing booked_at): ${suspiciousLeads?.length || 0}`);
    console.log(`\nExpected total: 20`);
    console.log(`Current showing: ${bookedAtMonday?.length || 0}`);
    console.log(`Missing: ${20 - (bookedAtMonday?.length || 0)}`);

    if (suspiciousLeads && suspiciousLeads.length >= 3) {
      console.log(`\n💡 FOUND THE ISSUE: ${suspiciousLeads.length} leads need booked_at migration`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

findMissingMondayBookings();

