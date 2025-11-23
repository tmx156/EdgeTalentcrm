/**
 * SalesApe Webhook Integration
 * 
 * This handles:
 * 1. Sending leads TO SalesApe's Airtable
 * 2. Receiving updates FROM SalesApe about lead interactions
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

// Initialize Supabase
const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey || config.supabase.anonKey
);

// SalesApe Configuration
const SALESAPE_CONFIG = {
  // Their Airtable endpoint
  AIRTABLE_URL: 'https://api.airtable.com/v0/appoT1TexUksGanE8/tblTJGg187Ub84aXf',
  // PAT code will be stored in environment variable (support both variable names)
  PAT_CODE: process.env.SALESAPE_PAT_CODE || process.env.SALESAPE_PAT,
  // Base Details record ID (from their requirements)
  BASE_DETAILS_ID: process.env.SALESAPE_BASE_DETAILS_ID || 'recThsoXqOHJCdgZY'
};

/**
 * Send a lead to SalesApe's Airtable (Trigger their AI)
 * This should be called when you want SalesApe to contact a lead
 */
async function sendLeadToSalesApe(lead) {
  try {
    // Format lead data for SalesApe's requirements
    const payload = {
      fields: {
        "First Name": lead.name?.split(' ')[0] || '',
        "Last Name": lead.name?.split(' ').slice(1).join(' ') || '',
        "Email": lead.email || '',
        "Phone Number": lead.phone || '',
        "CRM ID": String(lead.id), // Must be a string
        "Context": lead.notes || `Lead from ${lead.source || 'CRM'}`,
        "Base Details": [SALESAPE_CONFIG.BASE_DETAILS_ID]
      }
    };

    console.log('📤 Sending lead to SalesApe:', {
      name: lead.name,
      id: lead.id,
      email: lead.email
    });

    const response = await axios.post(SALESAPE_CONFIG.AIRTABLE_URL, payload, {
      headers: {
        'Authorization': `Bearer ${SALESAPE_CONFIG.PAT_CODE}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Lead sent to SalesApe successfully:', response.data.id);
    
    // Update lead in our database with SalesApe record ID
    await supabase
      .from('leads')
      .update({
        salesape_record_id: response.data.id,
        salesape_sent_at: new Date().toISOString(),
        salesape_status: 'sent'
      })
      .eq('id', lead.id);

    return response.data;
  } catch (error) {
    console.error('❌ Error sending lead to SalesApe:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Update SalesApe when a meeting is booked
 * Call this when a meeting is booked in your CRM
 */
async function notifySalesApeOfBooking(leadId, eventType = 'Meeting Booked') {
  try {
    const payload = {
      fields: {
        "CRM ID": String(leadId),
        "Event Type": eventType // "Meeting Booked" or "Human Intervention"
      }
    };

    console.log('📅 Notifying SalesApe of booking:', { leadId, eventType });

    const response = await axios.post(SALESAPE_CONFIG.AIRTABLE_URL, payload, {
      headers: {
        'Authorization': `Bearer ${SALESAPE_CONFIG.PAT_CODE}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ SalesApe notified of booking');
    return response.data;
  } catch (error) {
    console.error('❌ Error notifying SalesApe:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Webhook endpoint to receive updates FROM SalesApe
 * POST /api/salesape-webhook/update
 */
router.post('/update', async (req, res) => {
  try {
    console.log('📥 Received update from SalesApe:', JSON.stringify(req.body, null, 2));

    const {
      Airtable_Record_ID,
      CRM_ID,
      SalesAPE_Status,
      SalesAPE_Initial_Message_Sent,
      SalesAPE_User_Engaged,
      SalesAPE_Goal_Presented,
      SalesAPE_Goal_Hit,
      Follow_Ups_Ended,
      Not_Interested_Opted_Out,
      Post_Conversation_Summary,
      Conversation_Summary,
      Full_Conversation,
      Portal_Link
    } = req.body;

    // Validate CRM_ID
    if (!CRM_ID) {
      return res.status(400).json({ error: 'CRM_ID is required' });
    }

    // Prepare update data for our database
    const updateData = {
      salesape_record_id: Airtable_Record_ID,
      salesape_status: SalesAPE_Status,
      salesape_initial_message_sent: SalesAPE_Initial_Message_Sent,
      salesape_user_engaged: SalesAPE_User_Engaged,
      salesape_goal_presented: SalesAPE_Goal_Presented,
      salesape_goal_hit: SalesAPE_Goal_Hit,
      salesape_follow_ups_ended: Follow_Ups_Ended,
      salesape_opted_out: Not_Interested_Opted_Out,
      salesape_last_updated: new Date().toISOString()
    };

    // If conversation summary is being posted, add those fields
    if (Post_Conversation_Summary) {
      updateData.salesape_conversation_summary = Conversation_Summary;
      updateData.salesape_full_transcript = Full_Conversation;
      updateData.salesape_portal_link = Portal_Link;
    }

    // Update the lead in our database
    const { data: lead, error } = await supabase
      .from('leads')
      .update(updateData)
      .eq('id', CRM_ID)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating lead:', error);
      return res.status(500).json({ error: 'Failed to update lead' });
    }

    console.log('✅ Lead updated with SalesApe data:', {
      id: CRM_ID,
      status: SalesAPE_Status,
      engaged: SalesAPE_User_Engaged,
      goalHit: SalesAPE_Goal_Hit
    });

    // If goal was hit, you might want to trigger additional actions
    if (SalesAPE_Goal_Hit && !lead.salesape_goal_hit) {
      console.log('🎯 SalesApe achieved goal for lead:', CRM_ID);
      // You could trigger notifications, update stats, etc.
    }

    res.json({ 
      success: true, 
      message: 'Lead updated successfully',
      leadId: CRM_ID 
    });

  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

/**
 * Endpoint to manually trigger SalesApe for a lead
 * POST /api/salesape-webhook/trigger/:leadId
 */
router.post('/trigger/:leadId', async (req, res) => {
  try {
    // Check if SalesApe is configured
    if (!SALESAPE_CONFIG.PAT_CODE) {
      return res.status(503).json({
        error: 'SalesApe not configured',
        message: 'SALESAPE_PAT_CODE environment variable is not set'
      });
    }

    // Get the lead from database
    const { data: lead, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', req.params.leadId)
      .single();

    if (error || !lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Send to SalesApe
    const result = await sendLeadToSalesApe(lead);

    res.json({
      success: true,
      message: 'Lead sent to SalesApe',
      airtableId: result.id
    });

  } catch (error) {
    console.error('Error triggering SalesApe:', error);
    res.status(500).json({
      error: 'Failed to trigger SalesApe',
      message: error.message
    });
  }
});

/**
 * Notify SalesApe when a meeting is booked
 * POST /api/salesape-webhook/meeting-booked/:leadId
 */
router.post('/meeting-booked/:leadId', async (req, res) => {
  try {
    if (!SALESAPE_CONFIG.PAT_CODE) {
      return res.status(503).json({
        error: 'SalesApe not configured'
      });
    }

    const result = await notifySalesApeOfBooking(
      req.params.leadId,
      req.body.eventType || 'Meeting Booked'
    );

    res.json({
      success: true,
      message: 'SalesApe notified of booking'
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to notify SalesApe',
      message: error.message
    });
  }
});

/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    configured: !!SALESAPE_CONFIG.PAT_CODE,
    endpoints: {
      webhook: '/api/salesape-webhook/update',
      trigger: '/api/salesape-webhook/trigger/:leadId',
      meetingBooked: '/api/salesape-webhook/meeting-booked/:leadId'
    }
  });
});

module.exports = {
  router,
  sendLeadToSalesApe,
  notifySalesApeOfBooking
};
