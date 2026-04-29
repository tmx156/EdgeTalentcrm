const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey || config.supabase.anonKey
);

/**
 * GET /api/replydesk-dashboard/status
 */
router.get('/status', auth, async (req, res) => {
  try {
    const { data: queueLeads, error } = await supabase
      .from('leads')
      .select('id, name, phone, email, replydesk_status, replydesk_last_updated, replydesk_sent_at, replydesk_lead_id, status')
      .not('replydesk_sent_at', 'is', null)
      .limit(500);

    if (error) {
      console.error('Error fetching ReplyDesk queue:', error);
      return res.status(500).json({ message: 'Server error' });
    }

    const allLeads = queueLeads || [];
    const messagesSent = allLeads.length;
    const leadsEngaged = allLeads.filter(l => l.replydesk_status && !['New', 'failed'].includes(l.replydesk_status)).length;
    const bookingsMade = allLeads.filter(l => l.replydesk_status === 'Booked' || l.status === 'Booked').length;
    const humanRequired = allLeads.filter(l => l.replydesk_status === 'Human_Required').length;

    const engagementRate = messagesSent > 0 ? Math.round((leadsEngaged / messagesSent) * 100) : 0;
    const conversionRate = messagesSent > 0 ? Math.round((bookingsMade / messagesSent) * 100) : 0;

    const currentLead = allLeads.find(l => l.replydesk_status && !['Booked', 'failed', 'cancelled'].includes(l.replydesk_status));

    res.json({
      isActive: !!currentLead,
      currentLead: currentLead ? {
        id: currentLead.id,
        name: currentLead.name,
        status: currentLead.replydesk_status
      } : null,
      lastActivity: currentLead?.replydesk_last_updated || null,
      overallStats: {
        messagesSent,
        leadsEngaged,
        bookingsMade,
        humanRequired,
        engagementRate,
        conversionRate
      }
    });
  } catch (error) {
    console.error('Error fetching ReplyDesk status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /api/replydesk-dashboard/queue
 */
router.get('/queue', auth, async (req, res) => {
  try {
    const { data: allLeads, error } = await supabase
      .from('leads')
      .select('*')
      .not('replydesk_sent_at', 'is', null)
      .order('replydesk_sent_at', { ascending: false })
      .limit(200);

    if (error) {
      if (error.message?.includes('column') && error.message?.includes('does not exist')) {
        return res.status(500).json({
          message: 'Database schema missing ReplyDesk columns',
          error: 'Please run: server/migrations/add_replydesk_tracking_columns.sql'
        });
      }
      return res.status(500).json({ message: 'Server error' });
    }

    if (!allLeads || allLeads.length === 0) {
      return res.json([]);
    }

    const queueLeads = allLeads.map(lead => ({
      ...lead,
      queue_status: lead.replydesk_status === 'failed' ? 'failed' :
                    lead.replydesk_status === 'cancelled' ? 'cancelled' :
                    lead.replydesk_status === 'Booked' ? 'completed' :
                    lead.replydesk_status === 'Human_Required' ? 'needs_attention' :
                    ['Qualifying', 'Objection_Distance', 'Booking_Offered'].includes(lead.replydesk_status) ? 'in_progress' :
                    lead.replydesk_status === 'New' ? 'queued' : 'queued'
    }));

    res.json(queueLeads);
  } catch (error) {
    console.error('Error fetching queue:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /api/replydesk-dashboard/conversation/:leadId
 */
router.get('/conversation/:leadId', auth, async (req, res) => {
  try {
    const { leadId } = req.params;

    const { data: lead, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (error || !lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    res.json({
      summary: lead.replydesk_conversation_summary || null,
      status: lead.replydesk_status,
      sentAt: lead.replydesk_sent_at,
      lastUpdated: lead.replydesk_last_updated,
      leadId: lead.replydesk_lead_id,
      leadCode: lead.replydesk_lead_code,
      error: lead.replydesk_error
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /api/replydesk-dashboard/analytics
 */
router.get('/analytics', auth, async (req, res) => {
  try {
    const getStatsForPeriod = async (startDate) => {
      const { data: leads } = await supabase
        .from('leads')
        .select('id, replydesk_status, replydesk_sent_at, status')
        .not('replydesk_sent_at', 'is', null)
        .gte('replydesk_sent_at', startDate.toISOString());

      const leadsSent = leads ? leads.length : 0;
      const leadsEngaged = leads ? leads.filter(l => l.replydesk_status && !['New', 'failed'].includes(l.replydesk_status)).length : 0;
      const bookingsMade = leads ? leads.filter(l => l.replydesk_status === 'Booked' || l.status === 'Booked').length : 0;
      const humanRequired = leads ? leads.filter(l => l.replydesk_status === 'Human_Required').length : 0;

      return {
        leadsSent,
        leadsEngaged,
        bookingsMade,
        humanRequired,
        engagementRate: leadsSent > 0 ? Math.round((leadsEngaged / leadsSent) * 100) : 0,
        conversionRate: leadsSent > 0 ? Math.round((bookingsMade / leadsSent) * 100) : 0,
        goalHitRate: leadsEngaged > 0 ? Math.round((bookingsMade / leadsEngaged) * 100) : 0
      };
    };

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay()); weekStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

    const [todayStats, weekStats, monthStats, allStats] = await Promise.all([
      getStatsForPeriod(today),
      getStatsForPeriod(weekStart),
      getStatsForPeriod(monthStart),
      getStatsForPeriod(new Date(0))
    ]);

    res.json({ today: todayStats, week: weekStats, month: monthStats, all: allStats });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * POST /api/replydesk-dashboard/queue/add
 */
router.post('/queue/add', auth, async (req, res) => {
  try {
    const { leadId } = req.body;
    if (!leadId) return res.status(400).json({ message: 'Lead ID is required' });

    const { data: lead, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (error || !lead) return res.status(404).json({ message: 'Lead not found' });

    const { sendLeadToReplyDesk } = require('./replydesk-webhook');
    await sendLeadToReplyDesk(lead);

    if (global.io) {
      global.io.emit('replydesk_queue_update', {
        action: 'added', leadId: lead.id, leadName: lead.name
      });
    }

    res.json({ message: 'Lead added to Alex AI queue', leadId: lead.id });
  } catch (error) {
    console.error('Error adding to queue:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * POST /api/replydesk-dashboard/queue/remove
 */
router.post('/queue/remove', auth, async (req, res) => {
  try {
    const { leadId } = req.body;
    if (!leadId) return res.status(400).json({ message: 'Lead ID is required' });

    const { data: lead, error } = await supabase
      .from('leads')
      .select('id, name')
      .eq('id', leadId)
      .single();

    if (error || !lead) return res.status(404).json({ message: 'Lead not found' });

    await supabase
      .from('leads')
      .update({
        replydesk_sent_at: null,
        replydesk_status: 'cancelled',
        replydesk_last_updated: new Date().toISOString()
      })
      .eq('id', leadId);

    if (global.io) {
      global.io.emit('replydesk_queue_update', {
        action: 'removed', leadId, leadName: lead.name
      });
    }

    res.json({ success: true, message: 'Lead removed from queue', leadId });
  } catch (error) {
    console.error('Error removing from queue:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
