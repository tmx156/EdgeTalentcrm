/**
 * SalesApe Status Sync Service
 *
 * Automatically syncs lead status from SalesApe's Airtable to CRM database.
 * This service runs periodically to fetch updated status from SalesApe.
 *
 * WHY THIS IS NEEDED:
 * SalesApe's webhook integration is not yet configured to send updates
 * to the CRM automatically. This service polls SalesApe's Airtable API
 * to check for status updates and syncs them to the CRM.
 *
 * WHEN WEBHOOKS ARE CONFIGURED:
 * Once SalesApe is configured to send webhooks to:
 * https://edgetalentcrm-production.up.railway.app/api/salesape-webhook/update
 * This service can be disabled or used as a backup sync mechanism.
 */

const axios = require('axios');
const dbManager = require('../database-connection-manager');

const SALESAPE_CONFIG = {
  AIRTABLE_URL: 'https://api.airtable.com/v0/appoT1TexUksGanE8/tblTJGg187Ub84aXf',
  PAT_CODE: process.env.SALESAPE_PAT_CODE || process.env.SALESAPE_PAT,
  SYNC_INTERVAL: parseInt(process.env.SALESAPE_SYNC_INTERVAL) || 120000, // 2 minutes default
  ENABLED: process.env.SALESAPE_SYNC_ENABLED !== 'false' // Enabled by default
};

class SalesApeSyncService {
  constructor() {
    this.syncInterval = null;
    this.isSyncing = false;
    this.lastSyncTime = null;
    this.syncCount = 0;
  }

  /**
   * Start the sync service
   */
  start() {
    if (!SALESAPE_CONFIG.ENABLED) {
      console.log('⏸️  SalesApe sync service is disabled');
      return;
    }

    if (!SALESAPE_CONFIG.PAT_CODE) {
      console.error('❌ SalesApe sync service cannot start: SALESAPE_PAT not configured');
      return;
    }

    console.log(`🔄 Starting SalesApe sync service (interval: ${SALESAPE_CONFIG.SYNC_INTERVAL / 1000}s)`);

    // Run first sync immediately
    this.syncNow();

    // Then run on interval
    this.syncInterval = setInterval(() => {
      this.syncNow();
    }, SALESAPE_CONFIG.SYNC_INTERVAL);
  }

  /**
   * Stop the sync service
   */
  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('⏹️  SalesApe sync service stopped');
    }
  }

  /**
   * Trigger a sync immediately
   */
  async syncNow() {
    if (this.isSyncing) {
      console.log('⏳ Sync already in progress, skipping...');
      return;
    }

    this.isSyncing = true;
    const startTime = Date.now();

    try {
      console.log(`🔄 [SalesApe Sync #${this.syncCount + 1}] Starting...`);

      // Get all leads that have been sent to SalesApe
      const leads = await dbManager.query('leads', {
        select: 'id, name, salesape_record_id, salesape_status, salesape_initial_message_sent, salesape_user_engaged, salesape_goal_hit, salesape_goal_presented',
        not: { salesape_record_id: null }
      });

      if (!leads || leads.length === 0) {
        console.log('   No leads to sync');
        return;
      }

      let updatedCount = 0;
      let unchangedCount = 0;
      let errorCount = 0;

      // Sync each lead
      for (const lead of leads) {
        try {
          // Fetch from Airtable
          const response = await axios.get(
            `${SALESAPE_CONFIG.AIRTABLE_URL}/${lead.salesape_record_id}`,
            {
              headers: {
                'Authorization': `Bearer ${SALESAPE_CONFIG.PAT_CODE}`
              },
              timeout: 10000
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
            // Build update data
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

            // Add conversation data if available
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
              console.log(`   🎯 Goal Hit for ${lead.name}! Setting status to "Booked"`);
            }

            // Update in database
            await dbManager.update('leads', updateData, { id: lead.id });

            console.log(`   ✅ Updated: ${lead.name} (${fields['SalesAPE Status'] || 'status updated'})`);
            updatedCount++;

            // Emit socket event for real-time updates
            if (global.io) {
              global.io.emit('salesape_status_update', {
                leadId: lead.id,
                leadName: lead.name,
                status: updateData.salesape_status,
                initialMessageSent: updateData.salesape_initial_message_sent,
                userEngaged: updateData.salesape_user_engaged,
                goalHit: updateData.salesape_goal_hit
              });
            }
          } else {
            unchangedCount++;
          }

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 300));

        } catch (error) {
          // Only log errors if they're not 404s (which means record doesn't exist in Airtable)
          if (error.response?.status !== 404) {
            console.error(`   ❌ Error syncing ${lead.name}:`, error.response?.status || error.message);
          }
          errorCount++;
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      this.syncCount++;
      this.lastSyncTime = new Date();

      console.log(`✅ [SalesApe Sync #${this.syncCount}] Complete in ${duration}s`);
      console.log(`   Updated: ${updatedCount} | Unchanged: ${unchangedCount} | Errors: ${errorCount}`);

    } catch (error) {
      console.error('❌ SalesApe sync error:', error.message);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Get sync service status
   */
  getStatus() {
    return {
      enabled: SALESAPE_CONFIG.ENABLED,
      running: this.syncInterval !== null,
      syncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      syncCount: this.syncCount,
      syncInterval: SALESAPE_CONFIG.SYNC_INTERVAL
    };
  }
}

// Export singleton instance
const syncService = new SalesApeSyncService();
module.exports = syncService;
