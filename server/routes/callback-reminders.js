const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { createClient } = require('@supabase/supabase-js');
const config = require('../config');
const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);

// @route   GET /api/callback-reminders/test
// @desc    Test endpoint to manually trigger callback reminder check
// @access  Private (Admin only)
router.get('/test', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const CallbackReminderService = require('../services/callbackReminderService');
    const service = new CallbackReminderService();
    
    // Manually trigger the check
    await service.checkDueCallbacks();
    
    res.json({ 
      success: true, 
      message: 'Callback reminder check executed manually',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in test endpoint:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/callback-reminders/debug
// @desc    Debug endpoint to see pending callbacks
// @access  Private
router.get('/debug', auth, async (req, res) => {
  try {
    const now = new Date();
    const futureDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Next 24 hours

    const { data: reminders, error } = await supabase
      .from('callback_reminders')
      .select(`
        *,
        leads:lead_id (
          id,
          name,
          phone
        )
      `)
      .eq('user_id', req.user.id)
      .eq('status', 'pending')
      .gte('callback_time', now.toISOString())
      .lte('callback_time', futureDate.toISOString())
      .order('callback_time', { ascending: true });

    if (error) {
      return res.status(500).json({ message: 'Database error', error: error.message });
    }

    // Format for display
    const formatted = (reminders || []).map(r => ({
      id: r.id,
      leadName: r.leads?.name || 'Unknown',
      callbackTimeUTC: r.callback_time,
      callbackTimeUK: new Date(r.callback_time).toLocaleString('en-GB', {
        timeZone: 'Europe/London',
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: 'short'
      }),
      note: r.callback_note,
      status: r.status,
      created: r.created_at
    }));

    res.json({
      success: true,
      count: formatted.length,
      reminders: formatted,
      currentTimeUTC: now.toISOString(),
      currentTimeUK: now.toLocaleString('en-GB', { timeZone: 'Europe/London' })
    });
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

