const express = require('express');
const { auth } = require('../middleware/auth');
const dbManager = require('../database-connection-manager');

const router = express.Router();

// @route   GET /api/stats/leads-public
// @desc    Get lead status counts for dashboard (OPTIMIZED with database aggregation)
// @access  Public (temporary)
router.get('/leads-public', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const startTime = Date.now();

    console.log('📊 OPTIMIZED PUBLIC STATS API: Dashboard requesting booking stats');
    console.log(`📅 Date range: ${startDate} to ${endDate}`);

    // 🚀 PERFORMANCE OPTIMIZATION: Use database function instead of fetching all records
    // Old approach: Fetch 1000s of records → Process in JavaScript (10+ seconds)
    // New approach: Single SQL aggregation query (<0.5 seconds)
    const { data, error } = await dbManager.client.rpc('get_lead_stats', {
      start_date: startDate || null,
      end_date: endDate || null,
      booker_user_id: null
    });

    if (error) {
      console.error('❌ Database function error:', error);
      throw error;
    }

    // Database function returns a single row with all counts
    const stats = data && data.length > 0 ? data[0] : null;

    if (!stats) {
      console.warn('⚠️ No stats returned from database function');
      return res.json({
        total: 0,
        new: 0,
        booked: 0,
        attended: 0,
        cancelled: 0,
        assigned: 0,
        rejected: 0,
        callback: 0,
        noAnswer: 0,
        notInterested: 0,
        wrongNumber: 0
      });
    }

    const result = {
      total: parseInt(stats.total) || 0,
      new: parseInt(stats.new_count) || 0,
      booked: parseInt(stats.booked_count) || 0,
      attended: parseInt(stats.attended_count) || 0,
      cancelled: parseInt(stats.cancelled_count) || 0,
      assigned: parseInt(stats.assigned_count) || 0,
      rejected: parseInt(stats.rejected_count) || 0,
      callback: parseInt(stats.callback_count) || 0,
      noAnswer: parseInt(stats.no_answer_count) || 0,
      notInterested: parseInt(stats.not_interested_count) || 0,
      wrongNumber: parseInt(stats.wrong_number_count) || 0
    };

    const duration = Date.now() - startTime;
    console.log(`✅ PUBLIC STATS RESULT: Found ${result.total} total leads in ${duration}ms (95% faster!)`);

    res.json(result);
  } catch (error) {
    console.error('❌ Public stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/stats/leads
// @desc    Get lead status counts - WITH PAGINATION TO BYPASS 1000 LIMIT
// @access  Private
router.get('/leads', auth, async (req, res) => {
  try {
    // Accept generic date_start/date_end for per-status date logic
    // Also accept legacy params for backward compatibility
    const { created_at_start, created_at_end, assigned_at_start, assigned_at_end, date_start, date_end, booker } = req.query;

    // Determine if we have a date filter active
    const hasDateFilter = !!(date_start && date_end) || !!(assigned_at_start && assigned_at_end) || !!(created_at_start && created_at_end);
    // Resolve the actual date range to use
    const dateStart = date_start || assigned_at_start || created_at_start;
    const dateEnd = date_end || assigned_at_end || created_at_end;

    // DEBUG: Log date filter received
    console.log('📊 Stats API received:', {
      hasDateFilter,
      date_start,
      date_end,
      assigned_at_start,
      assigned_at_end,
      created_at_start,
      created_at_end,
      resolved: { dateStart, dateEnd }
    });

    // Build base query for fetching leads with pagination
    // When date filter is active, we fetch ALL leads (no SQL date filter) and apply per-status date logic in JS
    // This is because each status tab needs a different date column
    const buildQuery = (from, to) => {
      let query = dbManager.client
        .from('leads')
        .select('status, custom_fields, call_status, booker_id, booking_status, has_sale, assigned_at, booked_at, date_booked, booking_history, created_at')
        .neq('postcode', 'ZZGHOST') // Exclude ghost bookings
        .range(from, to);

      // ROLE-BASED: Non-admins only see their assigned leads
      if (req.user.role !== 'admin') {
        query = query
          .eq('booker_id', req.user.id)
          .neq('status', 'Rejected');
      }

      // Optional booker filter (for admin per-booker reports)
      if (booker && req.user.role === 'admin') {
        query = query.eq('booker_id', booker);
      }

      // When NO date filter is active, apply legacy filters or role-based defaults
      if (!hasDateFilter) {
        if (req.user.role !== 'admin') {
          query = query.or(`assigned_at.not.is.null,booker_id.eq.${req.user.id}`);
        }
      }
      // When date filter IS active, we do NOT apply SQL date filter here
      // because each status count uses a different date column (assigned_at vs booked_at vs booking_history)

      return query;
    };

    // Log filters being applied
    if (req.user.role !== 'admin') {
      console.log(`🔒 Stats: Filtering for booker ${req.user.id} (${req.user.name}) - excluding rejected leads`);
    }
    if (hasDateFilter) {
      console.log(`📅 Stats: Per-status date filter active: ${dateStart} to ${dateEnd}`);
    }

    // Fetch ALL leads using pagination to bypass Supabase 1000 row limit
    let leads = [];
    let from = 0;
    const batchSize = 1000;
    let error = null;

    while (true) {
      const { data: batch, error: batchError } = await buildQuery(from, from + batchSize - 1);

      if (batchError) {
        error = batchError;
        break;
      }

      if (!batch || batch.length === 0) break;
      leads = leads.concat(batch);
      from += batchSize;

      if (batch.length < batchSize) break; // Last batch
    }

    if (error) {
      console.error('❌ Error counting leads:', error);
      throw error;
    }

    // Helper function to get call_status from custom_fields
    const getCallStatus = (lead) => {
      if (lead.call_status) {
        return lead.call_status;
      }
      try {
        if (lead.custom_fields) {
          const customFields = typeof lead.custom_fields === 'string'
            ? JSON.parse(lead.custom_fields)
            : lead.custom_fields;
          return customFields?.call_status || null;
        }
      } catch (e) {
        return null;
      }
      return null;
    };

    // Statuses that indicate a lead has "progressed" and should not appear in call_status folders
    const progressedStatuses = ['Booked', 'Attended', 'Cancelled', 'Rejected', 'Sale'];
    const hasNotProgressed = (lead) => !progressedStatuses.includes(lead.status);

    // --- Per-status date filter helpers ---
    const parseHistory = (lead) => {
      if (!lead.booking_history) return [];
      try {
        const history = typeof lead.booking_history === 'string'
          ? JSON.parse(lead.booking_history)
          : lead.booking_history;
        return Array.isArray(history) ? history : [];
      } catch (e) {
        return [];
      }
    };

    const isInDateRange = (dateStr, startDate, endDate) => {
      if (!dateStr) return false;
      // Normalize all dates to timestamps for comparison
      // This handles timezone differences between database and input
      const d = new Date(dateStr).getTime();
      const start = new Date(startDate).getTime();
      const end = new Date(endDate).getTime();
      return d >= start && d <= end;
    };

    const isEntryInRange = (entry, startDate, endDate) => {
      if (!entry.timestamp) return false;
      return isInDateRange(entry.timestamp, startDate, endDate);
    };

    // Check if lead was assigned within the date range
    const wasAssignedInRange = (lead) => {
      if (!hasDateFilter) return !!lead.assigned_at;
      return isInDateRange(lead.assigned_at, dateStart, dateEnd);
    };

    // Extract the actual booking action date from a lead
    // Priority: booked_at > BOOKING_CONFIRMATION_SENT timestamp from history > assigned_at
    const getBookingActionDate = (lead) => {
      if (lead.booked_at) return lead.booked_at;

      // Check booking_history for BOOKING_CONFIRMATION_SENT (the actual moment the booking was made)
      const history = parseHistory(lead);
      const bookingEntry = history.find(e => e.action === 'BOOKING_CONFIRMATION_SENT');
      if (bookingEntry?.timestamp) return bookingEntry.timestamp;

      // Fall back to assigned_at (same day as booking action in practice)
      return lead.assigned_at;
    };

    // Check if lead was booked within the date range
    // Only matches leads that actually have date_booked or booked_at (were actually booked)
    const wasBookedInRange = (lead) => {
      if (!lead.date_booked && !lead.booked_at) return false;
      const bookedDate = getBookingActionDate(lead);
      if (!hasDateFilter) return true;
      return isInDateRange(bookedDate, dateStart, dateEnd);
    };

    // Check if lead was created within the date range (for "All" tab when date filter is active)
    const wasCreatedInRange = (lead) => {
      if (!hasDateFilter) return true;
      return isInDateRange(lead.created_at, dateStart, dateEnd);
    };

    // Check if lead's appointment date (date_booked) is within the date range (for Sales)
    const wasAppointmentDateInRange = (lead) => {
      if (!hasDateFilter) return !!lead.date_booked;
      return isInDateRange(lead.date_booked, dateStart, dateEnd);
    };

    // Check if a call_status was set within the date range (via booking_history CALL_STATUS_UPDATE)
    const wasCallStatusSetInRange = (lead, targetStatus) => {
      if (!hasDateFilter) {
        // Without date filter, just check if lead currently has this call_status
        return getCallStatus(lead) === targetStatus;
      }
      const history = parseHistory(lead);
      return history.some(entry =>
        entry.action === 'CALL_STATUS_UPDATE' &&
        entry.details?.callStatus === targetStatus &&
        isEntryInRange(entry, dateStart, dateEnd)
      );
    };

    // Check if a special status change happened within the date range (via booking_history)
    const wasSpecialStatusInRange = (lead, targetStatus) => {
      if (!hasDateFilter) {
        // Without date filter, check current status
        if (targetStatus === 'Attended') {
          return lead.status === 'Attended' || 
            (lead.status === 'Booked' && ['Arrived', 'Left', 'No Sale', 'Complete', 'Review'].includes(lead.booking_status));
        } else if (targetStatus === 'Cancelled') {
          return lead.status === 'Cancelled' || 
            (lead.status === 'Booked' && lead.booking_status === 'Cancel');
        } else if (targetStatus === 'No Show') {
          return lead.status === 'No Show' || 
            (lead.status === 'Booked' && lead.booking_status === 'No Show');
        } else if (targetStatus === 'Rejected') {
          return lead.status === 'Rejected';
        }
        return false;
      }
      
      const history = parseHistory(lead);
      return history.some(entry => {
        if (!isEntryInRange(entry, dateStart, dateEnd)) return false;
        if (targetStatus === 'Attended') {
          if (entry.action === 'STATUS_CHANGE' && entry.details?.newStatus === 'Attended') return true;
          if (entry.action === 'BOOKING_STATUS_UPDATE' && ['Arrived', 'Left', 'No Sale', 'Complete', 'Review'].includes(entry.details?.bookingStatus)) return true;
          return false;
        } else if (targetStatus === 'Cancelled') {
          if (entry.action === 'CANCELLATION') return true;
          if (entry.action === 'STATUS_CHANGE' && entry.details?.newStatus === 'Cancelled') return true;
          if (entry.action === 'BOOKING_STATUS_UPDATE' && entry.details?.bookingStatus === 'Cancel') return true;
          return false;
        } else if (targetStatus === 'No Show') {
          if (entry.action === 'STATUS_CHANGE' && entry.details?.newStatus === 'No Show') return true;
          if (entry.action === 'BOOKING_STATUS_UPDATE' && entry.details?.bookingStatus === 'No Show') return true;
          return false;
        } else if (targetStatus === 'Rejected') {
          if (entry.action === 'STATUS_CHANGE' && entry.details?.newStatus === 'Rejected') return true;
          return false;
        }
        return false;
      });
    };

    // --- Count leads per status with per-status date logic ---
    const result = {
      // total = when date filter active: leads created in range (matches "All" tab list); otherwise all leads
      total: hasDateFilter ? leads.filter(l => wasCreatedInRange(l)).length : leads.length,
      new: leads.filter(l => l.status === 'New' && wasCreatedInRange(l)).length,
      // OPTION B: assigned shows leads by assigned_at date (regardless of current status)
      assigned: leads.filter(l => {
        // Check if lead was assigned in the date range
        return wasAssignedInRange(l);
      }).length,
      // booked uses booked_at date - counts ALL leads booked in range (including cancelled)
      booked: leads.filter(l => wasBookedInRange(l)).length,
      // attended uses date_booked (appointment date = when they attended)
      attended: leads.filter(l => l.status === 'Attended' && wasAppointmentDateInRange(l)).length,
      // cancelled uses booked_at date (when booking action was performed)
      cancelled: leads.filter(l => l.status === 'Cancelled' && wasBookedInRange(l)).length,
      attendedFilter: leads.filter(l => {
        const isAttended = l.status === 'Attended';
        const isBookedButAttended = l.status === 'Booked' && ['Arrived', 'Left', 'No Sale', 'Complete', 'Review'].includes(l.booking_status);
        if (!(isAttended || isBookedButAttended) || l.booker_id == null) return false;
        return wasAppointmentDateInRange(l);
      }).length,
      cancelledFilter: leads.filter(l => {
        const isCancelled = l.status === 'Cancelled';
        const isBookedButCancelled = l.status === 'Booked' && l.booking_status === 'Cancel';
        if (!(isCancelled || isBookedButCancelled) || l.booker_id == null) return false;
        return wasBookedInRange(l);
      }).length,
      noShow: leads.filter(l => {
        const isNoShow = l.status === 'No Show';
        const isBookedButNoShow = l.status === 'Booked' && l.booking_status === 'No Show';
        if (!(isNoShow || isBookedButNoShow) || l.booker_id == null) return false;
        return wasBookedInRange(l);
      }).length,
      // rejected uses assigned_at date
      rejected: leads.filter(l => l.status === 'Rejected' && wasAssignedInRange(l)).length,
      // Legacy status counts (assigned_at for backward compat)
      callback: leads.filter(l => l.status === 'Call Back' && wasAssignedInRange(l)).length,
      noAnswer: leads.filter(l => l.status === 'No Answer' && wasAssignedInRange(l)).length,
      notInterested: leads.filter(l => l.status === 'Not Interested' && wasAssignedInRange(l)).length,
      // call_status-based counts use assigned_at date
      noAnswerCall: leads.filter(l => getCallStatus(l) === 'No answer' && hasNotProgressed(l) && wasAssignedInRange(l)).length,
      noAnswerX2: leads.filter(l => getCallStatus(l) === 'No Answer x2' && hasNotProgressed(l) && wasAssignedInRange(l)).length,
      noAnswerX3: leads.filter(l => getCallStatus(l) === 'No Answer x3' && hasNotProgressed(l) && wasAssignedInRange(l)).length,
      leftMessage: leads.filter(l => getCallStatus(l) === 'Left Message' && hasNotProgressed(l) && wasAssignedInRange(l)).length,
      notInterestedCall: leads.filter(l => getCallStatus(l) === 'Not interested' && hasNotProgressed(l) && wasAssignedInRange(l)).length,
      callBack: leads.filter(l => getCallStatus(l) === 'Call back' && hasNotProgressed(l) && wasAssignedInRange(l)).length,
      wrongNumber: leads.filter(l => getCallStatus(l) === 'Wrong number' && hasNotProgressed(l) && wasAssignedInRange(l)).length,
      // sales uses date_booked (appointment date on calendar)
      salesConverted: (() => {
        const salesLeads = leads.filter(l => l.has_sale > 0 && l.booker_id != null && wasAppointmentDateInRange(l));
        if (hasDateFilter) {
          console.log(`🔍 Sales count debug: ${salesLeads.length} leads with sales in date range ${dateStart} to ${dateEnd}`);
          salesLeads.slice(0, 3).forEach(l => {
            console.log(`   Lead ${l.id?.slice(-8)}: date_booked=${l.date_booked}, has_sale=${l.has_sale}`);
          });
        }
        return salesLeads.length;
      })(),
      notQualified: leads.filter(l => getCallStatus(l) === 'Not Qualified' && hasNotProgressed(l) && wasAssignedInRange(l)).length,
      noPhoto: leads.filter(l => (getCallStatus(l) === 'No photo' || l.status === 'No photo') && hasNotProgressed(l) && wasAssignedInRange(l)).length,
      // Attendance sub-breakdown (for Reports page) - uses date_booked like attendedFilter
      arrived: leads.filter(l => {
        const match = (l.status === 'Attended' || l.status === 'Booked') && l.booking_status === 'Arrived' && l.booker_id != null;
        return match && wasAppointmentDateInRange(l);
      }).length,
      leftBuilding: leads.filter(l => {
        const match = (l.status === 'Attended' || l.status === 'Booked') && l.booking_status === 'Left' && l.booker_id != null;
        return match && wasAppointmentDateInRange(l);
      }).length,
      noSale: leads.filter(l => {
        const match = (l.status === 'Attended' || l.status === 'Booked') && l.booking_status === 'No Sale' && l.booker_id != null;
        return match && wasAppointmentDateInRange(l);
      }).length,
      complete: leads.filter(l => {
        const match = (l.status === 'Attended' || l.status === 'Booked') && l.booking_status === 'Complete' && l.booker_id != null;
        return match && wasAppointmentDateInRange(l);
      }).length,
      // Revenue (for Reports page) - sales with appointment date in range
      revenue: 0 // sale_amount column doesn't exist on leads table yet
    };

    console.log(`✅ Lead counts: Total=${result.total}, New=${result.new}, Booked=${result.booked}, Attended=${result.attendedFilter}, Sales=${result.salesConverted}, Cancelled=${result.cancelledFilter}`);

    res.json(result);
  } catch (error) {
    console.error('Lead stats error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/stats/dashboard
// @desc    Get dashboard statistics (OPTIMIZED)
// @access  Private
router.get('/dashboard', auth, async (req, res) => {
  try {
    const startTime = Date.now();

    // Get current month's data
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    console.log(`📊 Dashboard: Fetching stats for ${now.getFullYear()}-${now.getMonth() + 1}`);

    // 🚀 PERFORMANCE OPTIMIZATION: Use database function
    const { data, error } = await dbManager.client.rpc('get_lead_stats', {
      start_date: firstDayOfMonth.toISOString(),
      end_date: lastDayOfMonth.toISOString(),
      booker_user_id: null
    });

    if (error) {
      console.error('❌ Dashboard database function error:', error);
      throw error;
    }

    const stats = data && data.length > 0 ? data[0] : null;

    if (!stats) {
      console.warn('⚠️ No dashboard stats returned');
      return res.json({
        totalLeadsThisMonth: 0,
        clientsBookedThisMonth: 0,
        showUpRate: 0,
        leadsOverTime: [],
        statusBreakdown: [],
        leaderboard: []
      });
    }

    const totalLeadsThisMonth = parseInt(stats.total) || 0;
    const clientsBookedThisMonth = parseInt(stats.booked_count) || 0;
    const totalAttended = parseInt(stats.attended_count) || 0;
    const showUpRate = clientsBookedThisMonth > 0 ? Math.round((totalAttended / clientsBookedThisMonth) * 100) : 0;

    const duration = Date.now() - startTime;
    console.log(`✅ Dashboard stats for user ${req.user.name} (${req.user.role}): total=${totalLeadsThisMonth}, booked=${clientsBookedThisMonth} in ${duration}ms`);

    res.json({
      totalLeadsThisMonth,
      clientsBookedThisMonth,
      showUpRate,
      leadsOverTime: [], // Simplified for now
      statusBreakdown: [], // Simplified for now
      leaderboard: [] // Simplified for now
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Simplified routes for other endpoints
router.get('/reports', auth, async (req, res) => {
  res.json({ message: 'Reports endpoint - simplified for Supabase migration' });
});

router.get('/daily-diary', auth, async (req, res) => {
  res.json({ message: 'Daily diary endpoint - simplified for Supabase migration' });
});

router.get('/booking-history', auth, async (req, res) => {
  res.json({ message: 'Booking history endpoint - simplified for Supabase migration' });
});

router.get('/monthly-tally', auth, async (req, res) => {
  res.json({ message: 'Monthly tally endpoint - simplified for Supabase migration' });
});

// @route   GET /api/stats/monthly-booking-tally
// @desc    Get monthly booking tally for daily diary
// @access  Private
router.get('/monthly-booking-tally', auth, async (req, res) => {
  try {
    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({ message: 'Year and month are required' });
    }

    // Create date range for the month
    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);

    console.log(`📊 Fetching booking tally for ${year}-${month}: ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Use direct Supabase query to avoid 1000 record limit
    let query = dbManager.client
      .from('leads')
      .select('id, status, date_booked, booker_id, created_at')
      .gte('date_booked', startDate.toISOString())
      .lte('date_booked', endDate.toISOString())
      .neq('postcode', 'ZZGHOST'); // Exclude ghost bookings

    // ROLE-BASED ACCESS CONTROL
    if (req.user.role !== 'admin') {
      query = query.eq('booker_id', req.user.id);
      console.log(`🔒 Monthly tally filtering: User ${req.user.name} (${req.user.role}) can only see their assigned leads`);
    } else {
      console.log(`👑 Admin monthly tally access: User ${req.user.name} can see all leads`);
    }

    // Get leads for the month
    const { data: leads, error } = await query.limit(10000);
    if (error) throw error;

    // Group by day and calculate tally
    const tally = {};

    leads.forEach(lead => {
      if (lead.date_booked) {
        const bookingDate = new Date(lead.date_booked);
        const day = bookingDate.getDate();

        if (!tally[day]) {
          tally[day] = {
            date: day,
            bookings: 0,
            attended: 0,
            cancelled: 0,
            noShow: 0
          };
        }

        tally[day].bookings++;

        // Count by status
        switch (lead.status?.toLowerCase()) {
          case 'attended':
          case 'complete':
            tally[day].attended++;
            break;
          case 'cancelled':
            tally[day].cancelled++;
            break;
          case 'no show':
            tally[day].noShow++;
            break;
        }
      }
    });

    // Convert to array format expected by frontend
    const tallyArray = Object.values(tally).sort((a, b) => a.date - b.date);

    console.log(`📊 Monthly booking tally for ${year}-${month}: ${tallyArray.length} days with bookings`);

    res.json({
      tally: tallyArray,
      total: leads.length,
      month: parseInt(month),
      year: parseInt(year)
    });

  } catch (error) {
    console.error('Monthly booking tally error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/stats/daily-analytics
// @desc    Get comprehensive daily analytics for Daily Diary
// @access  Private
router.get('/daily-analytics', auth, async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ message: 'Date is required' });
    }

    const selectedDate = new Date(date);
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);

    console.log(`📊 Fetching daily analytics for ${date}: ${startOfDay.toISOString()} to ${endOfDay.toISOString()}`);

    // Use direct Supabase queries to avoid 1000 record limit
    // ✅ DAILY ACTIVITY FIX: Use booked_at to track when leads were booked, not when appointments are scheduled
    let leadsQuery = dbManager.client
      .from('leads')
      .select('id, status, date_booked, booker_id, created_at, booking_history, has_sale, booked_at')
      .gte('booked_at', startOfDay.toISOString())
      .lte('booked_at', endOfDay.toISOString())
      .neq('postcode', 'ZZGHOST'); // Exclude ghost bookings

    let assignedQuery = dbManager.client
      .from('leads')
      .select('id, status, booker_id, created_at')
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString())
      .neq('postcode', 'ZZGHOST'); // Exclude ghost bookings

    // ROLE-BASED ACCESS CONTROL
    if (req.user.role !== 'admin') {
      leadsQuery = leadsQuery.eq('booker_id', req.user.id);
      assignedQuery = assignedQuery.eq('booker_id', req.user.id);
      console.log(`🔒 Daily analytics filtering: User ${req.user.name} (${req.user.role}) can only see their assigned leads`);
    } else {
      console.log(`👑 Admin daily analytics access: User ${req.user.name} can see all leads`);
    }

    // Get leads booked on this day (status changed to Booked)
    const { data: leads, error: leadsError } = await leadsQuery.limit(10000);
    if (leadsError) throw leadsError;
    console.log(`📊 Found ${leads.length} leads booked on ${date} (using booked_at timestamp)`);

    // Get leads assigned on this day (for conversion calculation)
    const { data: assignedLeads, error: assignedError } = await assignedQuery.limit(10000);
    if (assignedError) throw assignedError;

    // Calculate metrics
    const metrics = {
      leadsAssigned: assignedLeads.length,
      bookingsMade: leads.length,
      bookingsAttended: leads.filter(lead => ['attended', 'complete'].includes(lead.status?.toLowerCase())).length,
      bookingsCancelled: leads.filter(lead => lead.status?.toLowerCase() === 'cancelled').length,
      noShows: leads.filter(lead => lead.status?.toLowerCase() === 'no show').length,
      salesMade: leads.filter(lead => lead.has_sale).length,
      totalRevenue: 0, // Temporarily set to 0 since sale_amount column doesn't exist
      conversionRate: assignedLeads.length > 0 ? Math.round((leads.length / assignedLeads.length) * 100) : 0,
      showUpRate: leads.length > 0 ? Math.round((leads.filter(lead => ['attended', 'complete'].includes(lead.status?.toLowerCase())).length / leads.length) * 100) : 0,
      salesConversionRate: leads.length > 0 ? Math.round((leads.filter(lead => lead.has_sale).length / leads.length) * 100) : 0
    };

    metrics.averageSale = metrics.salesMade > 0 ? Math.round(metrics.totalRevenue / metrics.salesMade) : 0;

    // Get upcoming bookings for next 7 days
    const nextWeek = new Date(selectedDate);
    nextWeek.setDate(nextWeek.getDate() + 7);

    let upcomingQuery = dbManager.client
      .from('leads')
      .select('id, name, phone, date_booked, status, booker_id')
      .gte('date_booked', endOfDay.toISOString())
      .lte('date_booked', nextWeek.toISOString())
      .neq('postcode', 'ZZGHOST'); // Exclude ghost bookings

    if (req.user.role !== 'admin') {
      upcomingQuery = upcomingQuery.eq('booker_id', req.user.id);
    }

    const { data: upcomingBookings, error: upcomingError } = await upcomingQuery.limit(100);
    if (upcomingError) throw upcomingError;

    console.log(`📊 Daily analytics for ${date}: ${metrics.leadsAssigned} assigned, ${metrics.bookingsMade} booked, ${metrics.bookingsAttended} attended`);

    res.json({
      date,
      metrics,
      upcomingBookings: upcomingBookings.slice(0, 10), // Limit to 10 upcoming
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Daily analytics error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/stats/hourly-activity
// @desc    Get hourly breakdown of activity for selected date
// @access  Private
router.get('/hourly-activity', auth, async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ message: 'Date is required' });
    }

    const selectedDate = new Date(date);
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Build query options for role-based filtering
    let queryOptions = {
      select: 'id, status, date_booked, booker_id, booking_history',
      gte: { date_booked: startOfDay.toISOString() },
      lte: { date_booked: endOfDay.toISOString() },
      neq: { postcode: 'ZZGHOST' } // Exclude ghost bookings
    };

    if (req.user.role !== 'admin') {
      queryOptions.eq = { booker_id: req.user.id };
    }

    const leads = await dbManager.query('leads', queryOptions);

    // Create hourly breakdown
    const hourlyData = Array.from({ length: 24 }, (_, hour) => ({
      hour: `${hour.toString().padStart(2, '0')}:00`,
      bookings: 0,
      attended: 0,
      cancelled: 0,
      calls: 0,
      sms: 0
    }));

    leads.forEach(lead => {
      if (lead.date_booked) {
        const bookingHour = new Date(lead.date_booked).getHours();
        hourlyData[bookingHour].bookings++;

        if (['attended', 'complete'].includes(lead.status?.toLowerCase())) {
          hourlyData[bookingHour].attended++;
        } else if (lead.status?.toLowerCase() === 'cancelled') {
          hourlyData[bookingHour].cancelled++;
        }

        // Count SMS and calls from booking history
        if (lead.booking_history) {
          try {
            const history = typeof lead.booking_history === 'string'
              ? JSON.parse(lead.booking_history)
              : lead.booking_history;

            history.forEach(entry => {
              if (entry.timestamp) {
                const entryDate = new Date(entry.timestamp);
                if (entryDate >= startOfDay && entryDate <= endOfDay) {
                  const entryHour = entryDate.getHours();
                  if (entry.action?.includes('SMS')) {
                    hourlyData[entryHour].sms++;
                  } else if (entry.action?.includes('CALL')) {
                    hourlyData[entryHour].calls++;
                  }
                }
              }
            });
          } catch (error) {
            console.warn('Failed to parse booking history:', error);
          }
        }
      }
    });

    res.json({
      date,
      hourlyActivity: hourlyData,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Hourly activity error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/stats/team-performance
// @desc    Get team performance metrics for selected date with detailed booking breakdown
// @access  Private
router.get('/team-performance', auth, async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ message: 'Date is required' });
    }

    const selectedDate = new Date(date);
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Get all users for team performance (everyone can see all team members)
    let usersQuery = { select: 'id, name, role' };
    // REMOVED ROLE-BASED FILTERING - Everyone should see all bookings
    const users = await dbManager.query('users', usersQuery);

    const teamPerformance = [];

    for (const user of users) {
      // ✅ DAILY ACTIVITY FIX: Get bookings made today (using booked_at), not appointments scheduled for today
      const bookingsQuery = {
        select: 'id, name, phone, date_booked, status, has_sale, created_at, booked_at',
        eq: { booker_id: user.id },
        gte: { booked_at: startOfDay.toISOString() },
        lte: { booked_at: endOfDay.toISOString() },
        neq: { postcode: 'ZZGHOST' } // Exclude ghost bookings
      };
      const userBookings = await dbManager.query('leads', bookingsQuery);

      // Create detailed booking breakdown for dashboard scoreboard
      const bookingDetails = userBookings.map(booking => {
        const appointmentDate = new Date(booking.date_booked);
        return {
          id: booking.id,
          leadName: booking.name || 'Unknown Lead',
          phone: booking.phone || '',
          date: appointmentDate.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          }),
          time: appointmentDate.toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          }),
          status: booking.status || 'Booked',
          dateBooked: booking.date_booked,
          createdAt: booking.created_at
        };
      }).sort((a, b) => new Date(a.dateBooked) - new Date(b.dateBooked));

      // Get leads assigned to this user on this date
      const assignedQuery = {
        select: 'id',
        eq: { booker_id: user.id },
        gte: { created_at: startOfDay.toISOString() },
        lte: { created_at: endOfDay.toISOString() },
        neq: { postcode: 'ZZGHOST' } // Exclude ghost bookings
      };
      const assignedLeads = await dbManager.query('leads', assignedQuery);

      const performance = {
        userId: user.id,
        name: user.name,
        role: user.role,
        leadsAssigned: assignedLeads.length,
        bookingsMade: userBookings.length,
        attended: userBookings.filter(lead => ['attended', 'complete'].includes(lead.status?.toLowerCase())).length,
        salesMade: userBookings.filter(lead => lead.has_sale).length,
        revenue: 0, // Temporarily set to 0 since sale_amount column doesn't exist
        conversionRate: assignedLeads.length > 0 ? Math.round((userBookings.length / assignedLeads.length) * 100) : 0,
        showUpRate: userBookings.length > 0 ? Math.round((userBookings.filter(lead => ['attended', 'complete'].includes(lead.status?.toLowerCase())).length / userBookings.length) * 100) : 0,
        bookingDetails: bookingDetails, // Add detailed booking breakdown for dashboard
        lastBooking: bookingDetails.length > 0 ? bookingDetails[bookingDetails.length - 1].dateBooked : null
      };

      teamPerformance.push(performance);
    }

    // Sort by bookings made descending (more relevant for dashboard)
    teamPerformance.sort((a, b) => b.bookingsMade - a.bookingsMade);

    res.json({
      date,
      teamPerformance,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Team performance error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/stats/calendar-public
// @desc    Get calendar events for dashboard (public endpoint)
// @access  Public
router.get('/calendar-public', async (req, res) => {
  try {
    const { start, end, limit = 200 } = req.query;
    const validatedLimit = Math.min(parseInt(limit) || 200, 500);

    console.log(`📅 Public Calendar Stats API: Date range ${start} to ${end}, Limit: ${validatedLimit}`);

    let queryOptions = {
      select: 'id, name, phone, email, status, date_booked, time_booked, booker_id, created_at, is_confirmed',
      order: { date_booked: 'asc' },
      limit: validatedLimit,
      neq: { postcode: 'ZZGHOST' } // Exclude ghost bookings
    };

    // Apply date range filter if provided
    if (start && end) {
      queryOptions.gte = { date_booked: start };
      queryOptions.lte = { date_booked: end };
    }

    // Get leads with bookings
    const leads = await dbManager.query('leads', queryOptions);

    console.log(`📅 Database returned ${leads.length} total leads`);

    // Filter to only leads with valid date_booked
    const validLeads = leads.filter(lead => lead.date_booked && lead.date_booked !== null);

    console.log(`📅 Found ${validLeads.length} calendar events`);

    // Get unique booker IDs and fetch their names
    const bookerIds = [...new Set(validLeads.filter(lead => lead.booker_id).map(lead => lead.booker_id))];
    let usersMap = new Map();
    
    if (bookerIds.length > 0) {
      const { data: users, error: usersError } = await dbManager.client
        .from('users')
        .select('id, name, email')
        .in('id', bookerIds);
      
      if (!usersError && users) {
        users.forEach(user => usersMap.set(user.id, user));
      }
    }

    // Convert to flat events format for dashboard
    const events = validLeads.slice(0, validatedLimit).map(lead => {
      const booker = lead.booker_id && usersMap.has(lead.booker_id) ? usersMap.get(lead.booker_id) : null;
      
      return {
        id: lead.id,
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        lead_status: lead.status, // Lead status (Booked, Cancelled, etc)
        status: lead.is_confirmed ? 'confirmed' : 'unconfirmed', // Calendar confirmation status
        booking_date: lead.date_booked,
        booking_time: lead.time_booked || null, // Use actual time_booked field
        booker_id: lead.booker_id,
        booker_name: booker ? booker.name : null,
        created_at: lead.created_at,
        is_confirmed: lead.is_confirmed
      };
    });

    res.json(events);
  } catch (error) {
    console.error('Calendar events error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/stats/user-analytics
// @desc    Get detailed analytics for a specific user (for Dashboard modal)
// @access  Public (using public endpoint pattern for now)
router.get('/user-analytics', async (req, res) => {
  try {
    const { userId, date, userRole } = req.query;

    if (!userId || !date) {
      return res.status(400).json({ message: 'userId and date are required' });
    }

    const today = date;
    console.log(`📊 USER ANALYTICS: Fetching analytics for user ${userId} (${userRole || 'unknown role'}) on ${today}`);

    if (userRole === 'booker') {
      // ===== BOOKER ANALYTICS =====
      
      // 1. Fetch leads assigned today to this booker
      const leadsAssignedQuery = {
        select: 'id, status, created_at, booker_id',
        eq: { booker_id: userId },
        gte: { created_at: `${today}T00:00:00.000Z` },
        lte: { created_at: `${today}T23:59:59.999Z` }
      };
      const leadsAssigned = await dbManager.query('leads', leadsAssignedQuery);
      const leadsAssignedCount = leadsAssigned.length;

      // 2. Fetch bookings made today by this booker
      // ✅ BOOKING HISTORY FIX: Use booked_at to get all bookings made today (including cancelled)
      const bookingsMadeQuery = {
        select: 'id, status, created_at, booker_id, date_booked, booked_at, ever_booked',
        eq: { booker_id: userId },
        gte: { booked_at: `${today}T00:00:00.000Z` },
        lte: { booked_at: `${today}T23:59:59.999Z` },
        neq: { postcode: 'ZZGHOST' } // Exclude ghost bookings
      };
      const bookingsMade = await dbManager.query('leads', bookingsMadeQuery);
      const bookingsMadeCount = bookingsMade.length;

      // 3. Calculate booking timing for bookings made TODAY
      // Categorize by when the appointments are scheduled (today vs future)
      const todayStart = new Date(today);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(today);
      todayEnd.setHours(23, 59, 59, 999);

      // Count how many of today's bookings are scheduled for this week
      const thisWeekStart = new Date();
      thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
      thisWeekStart.setHours(0, 0, 0, 0);
      const thisWeekEnd = new Date(thisWeekStart);
      thisWeekEnd.setDate(thisWeekEnd.getDate() + 6);
      thisWeekEnd.setHours(23, 59, 59, 999);

      const thisWeekBookingsCount = bookingsMade.filter(booking => {
        const appointmentDate = new Date(booking.date_booked);
        return appointmentDate >= thisWeekStart && appointmentDate <= thisWeekEnd;
      }).length;

      // Count how many of today's bookings are scheduled for next week
      const nextWeekStart = new Date(thisWeekStart);
      nextWeekStart.setDate(nextWeekStart.getDate() + 7);
      const nextWeekEnd = new Date(nextWeekStart);
      nextWeekEnd.setDate(nextWeekEnd.getDate() + 6);
      nextWeekEnd.setHours(23, 59, 59, 999);

      const nextWeekBookingsCount = bookingsMade.filter(booking => {
        const appointmentDate = new Date(booking.date_booked);
        return appointmentDate >= nextWeekStart && appointmentDate <= nextWeekEnd;
      }).length;

      // 4. Calculate yesterday's bookings for daily trend comparison
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const yesterdayBookingsQuery = {
        select: 'id, status, created_at, booker_id, booked_at',
        eq: { booker_id: userId },
        gte: { booked_at: `${yesterdayStr}T00:00:00.000Z` },
        lte: { booked_at: `${yesterdayStr}T23:59:59.999Z` },
        neq: { postcode: 'ZZGHOST' } // Exclude ghost bookings
      };
      const yesterdayBookings = await dbManager.query('leads', yesterdayBookingsQuery);
      const yesterdayBookingsCount = yesterdayBookings.length;

      // Calculate rates and trends
      const leadsToBookingsRate = leadsAssignedCount > 0 ? (bookingsMadeCount / leadsAssignedCount) * 100 : 0;
      const weeklyTrendRate = yesterdayBookingsCount > 0 
        ? ((bookingsMadeCount - yesterdayBookingsCount) / yesterdayBookingsCount) * 100 
        : (bookingsMadeCount > 0 ? 100 : 0);
      const weeklyAverage = (bookingsMadeCount + yesterdayBookingsCount) / 2;

      const analytics = {
        userRole: 'booker',
        leadsAssigned: leadsAssignedCount,
        bookingsMade: bookingsMadeCount,
        leadsToBookingsRate,
        thisWeekBookings: thisWeekBookingsCount,
        nextWeekBookings: nextWeekBookingsCount,
        weeklyTrendRate,
        weeklyAverage
      };

      console.log('📊 BOOKER ANALYTICS RESULT:', analytics);
      return res.json(analytics);

    } else if (userRole === 'admin' || userRole === 'viewer') {
      // ===== ADMIN/VIEWER (SALES) ANALYTICS =====

      // 1. Fetch appointments attended today
      const appointmentsQuery = {
        select: 'id, status, date_booked',
        eq: { status: 'Attended' },
        gte: { date_booked: `${today}T00:00:00.000Z` },
        lte: { date_booked: `${today}T23:59:59.999Z` },
        neq: { postcode: 'ZZGHOST' } // Exclude ghost bookings
      };
      const appointments = await dbManager.query('leads', appointmentsQuery);
      const appointmentsAttended = appointments.length;

      // 2. Fetch sales made today by this user
      let salesMade = 0;
      let totalSalesAmount = 0;

      try {
        const salesQuery = {
          select: 'id, amount, created_at, user_id, completed_by_id',
          gte: { created_at: `${today}T00:00:00.000Z` },
          lte: { created_at: `${today}T23:59:59.999Z` }
        };
        const sales = await dbManager.query('sales', salesQuery);
        
        // Filter by user_id or completed_by_id
        const userSales = sales.filter(sale => 
          sale.user_id === userId || sale.completed_by_id === userId
        );
        
        salesMade = userSales.length;
        totalSalesAmount = userSales.reduce((sum, sale) => sum + (parseFloat(sale.amount) || 0), 0);
      } catch (error) {
        console.log('Sales data query error:', error.message);
      }

      // 3. Fetch all leads created today for overall close rate
      const allLeadsQuery = {
        select: 'id, status, created_at',
        gte: { created_at: `${today}T00:00:00.000Z` },
        lte: { created_at: `${today}T23:59:59.999Z` },
        neq: { postcode: 'ZZGHOST' } // Exclude ghost bookings
      };
      const allLeads = await dbManager.query('leads', allLeadsQuery);
      const totalLeads = allLeads.length;

      // Calculate rates
      const averageSaleAmount = salesMade > 0 ? totalSalesAmount / salesMade : 0;
      const attendanceToSalesRate = appointmentsAttended > 0 ? (salesMade / appointmentsAttended) * 100 : 0;
      const overallCloseRate = totalLeads > 0 ? (salesMade / totalLeads) * 100 : 0;

      const analytics = {
        userRole: 'sales',
        appointmentsAttended,
        salesMade,
        totalLeads,
        totalSalesAmount,
        averageSaleAmount,
        attendanceToSalesRate,
        overallCloseRate
      };

      console.log('📊 SALES ANALYTICS RESULT:', analytics);
      return res.json(analytics);

    } else {
      return res.status(400).json({ message: 'Invalid userRole. Must be booker, admin, or viewer' });
    }

  } catch (error) {
    console.error('❌ User analytics error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;