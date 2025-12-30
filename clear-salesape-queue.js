c/**
 * Emergency Script: Clear ALL leads from SalesApe queue
 * This will reset all SalesApe data for all leads
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function clearSalesApeQueue() {
  console.log('🧹 Starting SalesApe queue cleanup...\n');

  try {
    // Get all leads in SalesApe queue
    const { data: leadsInQueue, error: fetchError } = await supabase
      .from('leads')
      .select('id, name, salesape_sent_at, salesape_status')
      .not('salesape_sent_at', 'is', null);

    if (fetchError) {
      console.error('❌ Error fetching leads:', fetchError);
      return;
    }

    console.log(`📋 Found ${leadsInQueue.length} leads in SalesApe queue:\n`);
    leadsInQueue.forEach((lead, i) => {
      console.log(`   ${i + 1}. ${lead.name} (ID: ${lead.id}) - Status: ${lead.salesape_status || 'queued'}`);
    });

    if (leadsInQueue.length === 0) {
      console.log('\n✅ Queue is already empty!');
      return;
    }

    console.log('\n🔄 Clearing SalesApe data for all leads...\n');

    // Clear all SalesApe fields
    const { data: updatedLeads, error: updateError } = await supabase
      .from('leads')
      .update({
        salesape_sent_at: null,
        salesape_status: null,
        salesape_record_id: null,
        salesape_initial_message_sent: false,
        salesape_user_engaged: false,
        salesape_goal_presented: false,
        salesape_goal_hit: false,
        salesape_follow_ups_ended: false,
        salesape_opted_out: false,
        salesape_last_updated: null,
        salesape_conversation_summary: null,
        salesape_full_transcript: null,
        salesape_portal_link: null,
        salesape_error: null
      })
      .not('salesape_sent_at', 'is', null)
      .select('id, name');

    if (updateError) {
      console.error('❌ Error clearing queue:', updateError);
      return;
    }

    console.log(`✅ Successfully cleared ${updatedLeads.length} leads from SalesApe queue!\n`);
    console.log('Cleared leads:');
    updatedLeads.forEach((lead, i) => {
      console.log(`   ${i + 1}. ${lead.name} (ID: ${lead.id})`);
    });

    console.log('\n🎉 SalesApe queue is now completely empty!');
    console.log('✅ All SalesApe data has been reset.\n');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the cleanup
clearSalesApeQueue()
  .then(() => {
    console.log('\n✅ Cleanup completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Cleanup failed:', error);
    process.exit(1);
  });
