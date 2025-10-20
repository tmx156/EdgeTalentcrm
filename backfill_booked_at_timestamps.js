const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function backfillBookedAtTimestamps() {
  try {
    console.log('🔧 Backfilling missing booked_at timestamps...\n');

    const supabase = createClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
    );

    // Get ALL leads with ever_booked=true but no booked_at
    const { data: leadsNeedingFix, error } = await supabase
      .from('leads')
      .select('*')
      .eq('ever_booked', true)
      .is('booked_at', null)
      .is('deleted_at', null);

    if (error) {
      console.error('❌ Error fetching leads:', error);
      return;
    }

    console.log(`Found ${leadsNeedingFix?.length || 0} leads with ever_booked=true but no booked_at\n`);

    if (!leadsNeedingFix || leadsNeedingFix.length === 0) {
      console.log('✅ No leads need fixing!');
      return;
    }

    console.log('📋 Leads that will be updated:\n');
    leadsNeedingFix.forEach((lead, i) => {
      console.log(`${i + 1}. ${lead.name} (Booker: ${lead.booker_id})`);
      console.log(`   Status: ${lead.status}`);
      console.log(`   Created: ${lead.created_at}`);
      console.log(`   Updated: ${lead.updated_at}`);
      console.log(`   → Will set booked_at to: ${lead.updated_at || lead.created_at}`);
      console.log('');
    });

    console.log('\n⚠️  DRY RUN - No changes will be made yet.');
    console.log('Review the above list. If it looks correct, run with --apply flag\n');

    // Check if we should apply the changes
    const shouldApply = process.argv.includes('--apply');

    if (!shouldApply) {
      console.log('To apply these changes, run:');
      console.log('  node backfill_booked_at_timestamps.js --apply');
      return;
    }

    console.log('\n🚀 Applying changes...\n');

    let successCount = 0;
    let errorCount = 0;

    for (const lead of leadsNeedingFix) {
      try {
        // Set booked_at to updated_at (when status was changed to Booked) or created_at as fallback
        const bookedAtValue = lead.updated_at || lead.created_at;
        
        const { error: updateError } = await supabase
          .from('leads')
          .update({ booked_at: bookedAtValue })
          .eq('id', lead.id);

        if (updateError) {
          console.error(`❌ Failed to update ${lead.name}:`, updateError.message);
          errorCount++;
        } else {
          console.log(`✅ Updated ${lead.name} - booked_at set to ${bookedAtValue}`);
          successCount++;
        }
      } catch (err) {
        console.error(`❌ Error updating ${lead.name}:`, err.message);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('MIGRATION COMPLETE');
    console.log('='.repeat(70));
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📊 Total: ${leadsNeedingFix.length}`);

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    console.error(error);
  }
}

backfillBookedAtTimestamps();

