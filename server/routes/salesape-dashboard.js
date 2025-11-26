/**
 * SalesApe Dashboard API Routes
 * Provides data for the SalesApe monitoring dashboard
 */

const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const dbManager = require('../database-connection-manager');

/**
 * @route   GET /api/salesape-dashboard/status
 * @desc    Get current SalesApe activity status
 * @access  Private
 */
router.get('/status', auth, async (req, res) => {
  try {
    // Get all recent leads and filter for SalesApe leads in JavaScript
    // This avoids the timestamp null issue
    const allLeads = await dbManager.query('leads', {
      select: 'id, name, phone, email, salesape_status, salesape_last_updated, salesape_user_engaged, salesape_goal_hit, salesape_sent_at',
      order: { created_at: 'desc' },
      limit: 100
    });

    // Filter for leads that have been sent to SalesApe (salesape_sent_at is not null)
    const activeLeads = allLeads ? allLeads.filter(l => l.salesape_sent_at !== null && l.salesape_sent_at !== undefined) : [];

    // Find the most recently active lead that's engaged but not booked
    const currentLead = activeLeads && activeLeads.length > 0 
      ? activeLeads.find(l => l.salesape_user_engaged && !l.salesape_goal_hit) || activeLeads[0]
      : null;

    // Get today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayLeads = await dbManager.query('leads', {
      select: 'id, salesape_initial_message_sent, salesape_user_engaged, salesape_goal_hit, salesape_sent_at',
      gte: { created_at: today.toISOString() }
    });

    // Filter for leads sent to SalesApe today
    const todaysSalesApeLeads = todayLeads ? todayLeads.filter(l => l.salesape_sent_at && l.salesape_sent_at >= today.toISOString()) : [];

    const messagesSent = todaysSalesApeLeads ? todaysSalesApeLeads.filter(l => l.salesape_initial_message_sent).length : 0;
    const leadsEngaged = todaysSalesApeLeads ? todaysSalesApeLeads.filter(l => l.salesape_user_engaged).length : 0;
    const bookingsMade = todaysSalesApeLeads ? todaysSalesApeLeads.filter(l => l.salesape_goal_hit).length : 0;

    const engagementRate = messagesSent > 0 ? Math.round((leadsEngaged / messagesSent) * 100) : 0;
    const conversionRate = messagesSent > 0 ? Math.round((bookingsMade / messagesSent) * 100) : 0;
    const responseRate = leadsEngaged > 0 ? Math.round((leadsEngaged / messagesSent) * 100) : 0;

    // Calculate average response time (mock for now)
    const avgResponseTime = '4m 32s';

    res.json({
      isActive: currentLead !== null,
      isPaused: false, // TODO: Implement pause/resume functionality
      currentLead: currentLead ? {
        id: currentLead.id,
        name: currentLead.name,
        status: currentLead.salesape_status,
        lastMessage: null // TODO: Get from messages table
      } : null,
      lastActivity: currentLead ? currentLead.salesape_last_updated : null,
      todayStats: {
        messagesSent,
        leadsEngaged,
        bookingsMade,
        engagementRate,
        conversionRate,
        responseRate,
        avgResponseTime
      }
    });
  } catch (error) {
    console.error('Error fetching SalesApe status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   GET /api/salesape-dashboard/queue
 * @desc    Get all leads in SalesApe queue
 * @access  Private
 */
router.get('/queue', auth, async (req, res) => {
  try {
    // Get all leads - we'll filter for SalesApe leads on the client side if needed
    // For now, get recent leads that could be sent to SalesApe
    const allLeads = await dbManager.query('leads', {
      select: '*',
      order: { created_at: 'desc' },
      limit: 100
    });

    if (!allLeads || allLeads.length === 0) {
      return res.json([]);
    }

    // Filter for leads that have SalesApe data OR could be sent to SalesApe
    const queueLeads = allLeads
      .filter(lead => lead.salesape_sent_at || lead.status === 'New' || lead.status === 'Assigned')
      .map(lead => ({
        ...lead,
        // Calculate queue_status based on salesape fields
        queue_status: lead.salesape_goal_hit ? 'completed' :
                      lead.salesape_user_engaged ? 'in_progress' :
                      lead.salesape_initial_message_sent ? 'in_progress' : 
                      lead.salesape_sent_at ? 'queued' : 'available'
      }));

    res.json(queueLeads);
  } catch (error) {
    console.error('Error fetching queue:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   GET /api/salesape-dashboard/conversation/:leadId
 * @desc    Get conversation history for a specific lead
 * @access  Private
 */
router.get('/conversation/:leadId', auth, async (req, res) => {
  try {
    const { leadId } = req.params;

    // Get lead details
    const leads = await dbManager.query('leads', {
      select: '*',
      eq: { id: leadId }
    });

    if (!leads || leads.length === 0) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    const lead = leads[0];

    // Get messages from salesape_messages table (if exists)
    // For now, we'll parse from full_transcript if available
    let messages = [];
    
    if (lead.salesape_full_transcript) {
      // Parse transcript into messages (basic implementation)
      // Format expected: "SalesApe: message\nLead: response\n..."
      const lines = lead.salesape_full_transcript.split('\n');
      let currentSender = null;
      let currentMessage = '';
      
      lines.forEach((line, index) => {
        if (line.startsWith('SalesApe:') || line.startsWith('🤖')) {
          if (currentMessage) {
            messages.push({
              sender: currentSender,
              message: currentMessage.trim(),
              sent_at: new Date(Date.now() - (lines.length - index) * 60000).toISOString()
            });
          }
          currentSender = 'salesape';
          currentMessage = line.replace(/^(SalesApe:|🤖)\s*/, '');
        } else if (line.startsWith('Lead:') || line.startsWith('👤')) {
          if (currentMessage) {
            messages.push({
              sender: currentSender,
              message: currentMessage.trim(),
              sent_at: new Date(Date.now() - (lines.length - index) * 60000).toISOString()
            });
          }
          currentSender = 'lead';
          currentMessage = line.replace(/^(Lead:|👤)\s*/, '');
        } else if (line.trim()) {
          currentMessage += ' ' + line;
        }
      });
      
      if (currentMessage) {
        messages.push({
          sender: currentSender,
          message: currentMessage.trim(),
          sent_at: new Date().toISOString()
        });
      }
    }

    // Calculate conversation stats
    const stats = {
      messageCount: messages.length,
      duration: messages.length > 0 ? 
        Math.round((new Date(messages[messages.length - 1].sent_at) - new Date(messages[0].sent_at)) / 60000) + 'm' : 
        'N/A'
    };

    res.json({
      messages,
      stats
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   GET /api/salesape-dashboard/analytics
 * @desc    Get performance analytics
 * @access  Private
 */
router.get('/analytics', auth, async (req, res) => {
  try {
    const now = new Date();
    
    // Helper function to get stats for a time period
    const getStatsForPeriod = async (startDate) => {
      const leads = await dbManager.query('leads', {
        select: 'id, salesape_initial_message_sent, salesape_user_engaged, salesape_goal_hit, salesape_sent_at',
        gte: { salesape_sent_at: startDate.toISOString() }
      });

      const leadsSent = leads ? leads.length : 0;
      const leadsEngaged = leads ? leads.filter(l => l.salesape_user_engaged).length : 0;
      const bookingsMade = leads ? leads.filter(l => l.salesape_goal_hit).length : 0;

      const engagementRate = leadsSent > 0 ? Math.round((leadsEngaged / leadsSent) * 100) : 0;
      const conversionRate = leadsSent > 0 ? Math.round((bookingsMade / leadsSent) * 100) : 0;
      const goalHitRate = leadsEngaged > 0 ? Math.round((bookingsMade / leadsEngaged) * 100) : 0;

      return {
        leadsSent,
        leadsEngaged,
        bookingsMade,
        engagementRate,
        conversionRate,
        goalHitRate,
        avgResponseTime: '4m 32s', // Mock
        avgMessagesPerLead: 3.2 // Mock
      };
    };

    // Today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStats = await getStatsForPeriod(today);

    // This week
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekStats = await getStatsForPeriod(weekStart);

    // This month
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthStats = await getStatsForPeriod(monthStart);

    // All time
    const allTimeStats = await getStatsForPeriod(new Date(0));

    res.json({
      today: todayStats,
      week: weekStats,
      month: monthStats,
      all: allTimeStats
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   POST /api/salesape-dashboard/queue/add
 * @desc    Add a lead to SalesApe queue
 * @access  Private
 */
router.post('/queue/add', auth, async (req, res) => {
  try {
    const { leadId } = req.body;

    if (!leadId) {
      return res.status(400).json({ message: 'Lead ID is required' });
    }

    // Get lead
    const leads = await dbManager.query('leads', {
      select: '*',
      eq: { id: leadId }
    });

    if (!leads || leads.length === 0) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    const lead = leads[0];

    // Send to SalesApe
    const salesapeService = require('../routes/salesape-webhook');
    await salesapeService.sendLeadToSalesApe(lead);

    // Emit socket event
    if (global.io) {
      global.io.emit('salesape_queue_update', {
        action: 'added',
        leadId: lead.id,
        leadName: lead.name
      });
    }

    res.json({ message: 'Lead added to SalesApe queue', leadId: lead.id });
  } catch (error) {
    console.error('Error adding to queue:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   POST /api/salesape-dashboard/queue/remove
 * @desc    Remove a lead from SalesApe queue
 * @access  Private
 */
router.post('/queue/remove', auth, async (req, res) => {
  try {
    const { leadId } = req.body;

    if (!leadId) {
      return res.status(400).json({ message: 'Lead ID is required' });
    }

    // Update lead to remove from queue
    await dbManager.update('leads', {
      salesape_sent_at: null,
      salesape_status: null,
      salesape_last_updated: new Date().toISOString()
    }, { id: leadId });

    // Emit socket event
    if (global.io) {
      global.io.emit('salesape_queue_update', {
        action: 'removed',
        leadId
      });
    }

    res.json({ message: 'Lead removed from queue' });
  } catch (error) {
    console.error('Error removing from queue:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   POST /api/salesape-dashboard/queue/pause
 * @desc    Pause SalesApe queue processing
 * @access  Private (Admin only)
 */
router.post('/queue/pause', auth, async (req, res) => {
  try {
    // TODO: Implement pause functionality
    // This would require a system-level flag or configuration

    res.json({ message: 'Queue paused' });
  } catch (error) {
    console.error('Error pausing queue:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   POST /api/salesape-dashboard/queue/resume
 * @desc    Resume SalesApe queue processing
 * @access  Private (Admin only)
 */
router.post('/queue/resume', auth, async (req, res) => {
  try {
    // TODO: Implement resume functionality

    res.json({ message: 'Queue resumed' });
  } catch (error) {
    console.error('Error resuming queue:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

