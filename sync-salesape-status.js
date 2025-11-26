/**
 * Manual SalesApe Status Sync
 *
 * This script syncs lead status from SalesApe's Airtable to your CRM database.
 * Run this periodically until SalesApe webhook integration is configured.
 *
 * Usage: node sync-salesape-status.js
 */

require('dotenv').config();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const SALESAPE_CONFIG = {
  AIRTABLE_URL: 'https://api.airtable.com/v0/appoT1TexUksGanE8/tblTJGg187Ub84aXf',
  PAT_CODE: process.env.SALESAPE_PAT_CODE || process.env.SALESAPE_PAT
};

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

async function syncSalesApeStatus() {
  console.log('========================================');
  console.log('  SALESAPE STATUS SYNC');
  console.log('========================================\n');

  try {
    // 1. Get all leads from CRM that have been sent to SalesApe
    console.log('📋 Step 1: Fetching leads from CRM...');
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, name, salesape_record_id, salesape_status, salesape_initial_message_sent, salesape_user_engaged, salesape_goal_hit')
      .not('salesape_record_id', 'is', null);

    if (leadsError) {
      throw new Error(`Error fetching leads: ${leadsError.message}`);
    }

    console.log(`   Found ${leads.length} leads sent to SalesApe\n`);

    // 2. For each lead, fetch status from Airtable and update CRM
    let updatedCount = 0;
    let unchangedCount = 0;
    let errorCount = 0;

    for (const lead of leads) {
      try {
        console.log(`🔄 Syncing: ${lead.name} (${lead.salesape_record_id})`);

        // Fetch from Airtable
        const response = await axios.get(
          `${SALESAPE_CONFIG.AIRTABLE_URL}/${lead.salesape_record_id}`,
          {
            headers: {
              'Authorization': `Bearer ${SALESAPE_CONFIG.PAT_CODE}`
            }
          }
        );

        const fields = response.data.fields;

        // Check if any fields need updating
        const needsUpdate =
          (fields['SalesAPE Initial Message Sent'] !== lead.salesape_initial_message_sent) ||
          (fields['SalesAPE User Engaged'] !== lead.salesape_user_engaged) ||
          (fields['SalesAPE Goal Hit'] !== lead.salesape_goal_hit) ||
          (fields['SalesAPE Status'] && fields['SalesAPE Status'] !== lead.salesape_status);

        if (needsUpdate) {
          // Update CRM with latest status
          const updateData = {
            salesape_status: fields['SalesAPE Status'] || lead.salesape_status,
            salesape_initial_message_sent: fields['SalesAPE Initial Message Sent'] || false,
            salesape_user_engaged: fields['SalesAPE User Engaged'] || false,
            salesape_goal_presented: fields['SalesAPE Goal Presented'] || false,
            salesape_goal_hit: fields['SalesAPE Goal Hit'] || false,
            salesape_opted_out: fields['Not Interested / Opted Out'] || false,
            salesape_follow_ups_ended: fields['Follow Ups Ended'] || false,
            salesape_last_updated: new Date().toISOString()
          };

          // If conversation data exists, update that too
          if (fields['Conversation Summary']) {
            updateData.salesape_conversation_summary = fields['Conversation Summary'];
          }
          if (fields['Full Conversation']) {
            updateData.salesape_full_transcript = fields['Full Conversation'];
          }
          if (fields['Portal Link']) {
            updateData.salesape_portal_link = fields['Portal Link'];
          }

          // If goal was hit, update lead status
          if (fields['SalesAPE Goal Hit'] && !lead.salesape_goal_hit) {
            updateData.status = 'Booked';
            console.log(`   🎯 Goal Hit! Setting status to "Booked"`);
          }

          const { error: updateError } = await supabase
            .from('leads')
            .update(updateData)
            .eq('id', lead.id);

          if (updateError) {
            throw updateError;
          }

          console.log(`   ✅ Updated: ${lead.name}`);
          console.log(`      - Initial Message: ${updateData.salesape_initial_message_sent}`);
          console.log(`      - User Engaged: ${updateData.salesape_user_engaged}`);
          console.log(`      - Goal Hit: ${updateData.salesape_goal_hit}`);
          updatedCount++;
        } else {
          console.log(`   ⏭️  No changes needed`);
          unchangedCount++;
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`   ❌ Error syncing ${lead.name}:`, error.response?.data || error.message);
        errorCount++;
      }
    }

    console.log('\n========================================');
    console.log('  SYNC COMPLETE');
    console.log('========================================');
    console.log(`✅ Updated: ${updatedCount} leads`);
    console.log(`⏭️  Unchanged: ${unchangedCount} leads`);
    if (errorCount > 0) {
      console.log(`❌ Errors: ${errorCount} leads`);
    }
    console.log('');

  } catch (error) {
    console.error('\n❌ SYNC FAILED:', error.message);
    process.exit(1);
  }
}

// Run the sync
syncSalesApeStatus();
