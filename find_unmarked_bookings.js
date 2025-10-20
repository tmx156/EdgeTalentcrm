const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function findUnmarkedBookings() {
  try {
    console.log('🔍 Finding bookings not marked with ever_booked...\n');

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

    // Get ALL leads for Tim created/updated on Monday
    const { data: allMonday } = await supabase
      .from('leads')
      .select('*')
      .eq('booker_id', timWilson.id)
      .is('deleted_at', null);

    const createdOrUpdatedMonday = allMonday?.filter(lead => {
      const createdDate = lead.created_at ? new Date(lead.created_at).toISOString().split('T')[0] : null;
      const updatedDate = lead.updated_at ? new Date(lead.updated_at).toISOString().split('T')[0] : null;
      return createdDate === mondayDate || updatedDate === mondayDate;
    });

    console.log(`Leads created OR updated on Monday: ${createdOrUpdatedMonday?.length || 0}\n`);

    // Check for bookings NOT marked with ever_booked
    const notMarkedEverBooked = createdOrUpdatedMonday?.filter(lead => {
      return (lead.status === 'Booked' || lead.status === 'Cancelled' || lead.status === 'Attended') 
        && lead.ever_booked !== true;
    });

    console.log(`⚠️  Leads with booking status but ever_booked != true: ${notMarkedEverBooked?.length || 0}\n`);

    if (notMarkedEverBooked && notMarkedEverBooked.length > 0) {
      console.log('📋 Unmarked bookings:\n');
      notMarkedEverBooked.forEach((lead, i) => {
        console.log(`${i + 1}. ${lead.name}`);
        console.log(`   ID: ${lead.id}`);
        console.log(`   Status: ${lead.status}`);
        console.log(`   ever_booked: ${lead.ever_booked}`);
        console.log(`   booked_at: ${lead.booked_at || 'NULL'}`);
        console.log(`   date_booked: ${lead.date_booked || 'NULL'}`);
        console.log(`   Created: ${new Date(lead.created_at).toLocaleString('en-GB')}`);
        console.log(`   Updated: ${lead.updated_at ? new Date(lead.updated_at).toLocaleString('en-GB') : 'N/A'}`);
        console.log('');
      });
    }

    // Also check for leads with date_booked on Monday
    const dateBookedMonday = allMonday?.filter(lead => {
      if (!lead.date_booked) return false;
      const appointmentDate = new Date(lead.date_booked).toISOString().split('T')[0];
      return appointmentDate === mondayDate;
    });

    console.log(`Leads with APPOINTMENT on Monday (date_booked): ${dateBookedMonday?.length || 0}\n`);

    console.log('='.repeat(70));
    console.log('DETAILED ANALYSIS:');
    console.log('='.repeat(70));
    console.log(`Bookings MADE on Monday (booked_at): 17`);
    console.log(`Leads with booking status but not marked: ${notMarkedEverBooked?.length || 0}`);
    console.log(`POTENTIAL TOTAL: ${17 + (notMarkedEverBooked?.length || 0)}`);
    console.log(`Expected: 20`);
    console.log(`\nStill missing: ${20 - (17 + (notMarkedEverBooked?.length || 0))}`);

    if (notMarkedEverBooked && notMarkedEverBooked.length >= 3) {
      console.log(`\n💡 FOUND IT: ${notMarkedEverBooked.length} bookings need ever_booked=true and booked_at set!`);
      console.log(`\nTo fix these, we need to:`);
      console.log(`  1. Set ever_booked = true`);
      console.log(`  2. Set booked_at = updated_at or created_at`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

findUnmarkedBookings();

