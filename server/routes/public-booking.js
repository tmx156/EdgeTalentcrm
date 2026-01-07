/**
 * Public Booking Routes
 * 
 * These endpoints allow clients to book appointments without authentication
 * Used for SalesAPE calendar link integration
 * 
 * Supports both UUID-based and short booking code URLs:
 * - /book/{uuid} - Original format
 * - /book/{booking_code} - Short code format (e.g., /book/TAN7X4K)
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const config = require('../config');
const MessagingService = require('../utils/messagingService');
const salesapeService = require('../utils/salesapeService');
const axios = require('axios');

// Initialize Supabase with service role for public access
const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey || config.supabase.anonKey
);

// SalesApe Configuration
const SALESAPE_CONFIG = {
  AIRTABLE_URL: 'https://api.airtable.com/v0/appoT1TexUksGanE8/tblTJGg187Ub84aXf',
  PAT_CODE: process.env.SALESAPE_PAT_CODE || process.env.SALESAPE_PAT
};

// Default booker for SalesApe/public bookings (Sally)
let DEFAULT_SALESAPE_BOOKER_ID = null;

// Look up Sally's user ID on startup
async function initDefaultBooker() {
  try {
    const { data: sally, error } = await supabase
      .from('users')
      .select('id, name')
      .ilike('name', '%sally%')
      .limit(1)
      .single();

    if (sally && !error) {
      DEFAULT_SALESAPE_BOOKER_ID = sally.id;
      console.log(`✅ SalesApe bookings will be assigned to: ${sally.name} (${sally.id})`);
    } else {
      console.warn('⚠️ Could not find Sally user for SalesApe bookings');
    }
  } catch (err) {
    console.error('Error looking up default booker:', err.message);
  }
}

// Initialize on module load
initDefaultBooker();

/**
 * Helper function to find a lead by ID or booking code
 * @param {string} identifier - UUID or booking code
 * @returns {Promise<{lead: object|null, error: string|null}>}
 */
async function findLeadByIdentifier(identifier, selectFields = '*') {
  // Check if it's a UUID (36 chars with dashes)
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
  
  let query = supabase.from('leads').select(selectFields);
  
  if (isUUID) {
    query = query.eq('id', identifier);
  } else {
    // It's a booking code - make it case-insensitive
    query = query.ilike('booking_code', identifier);
  }
  
  const { data: lead, error } = await query.single();
  
  return { lead, error };
}

/**
 * @route   GET /api/public/booking/lead/:identifier
 * @desc    Get lead information for booking (public, no auth required)
 * @param   identifier - Either UUID or short booking code
 * @access  Public
 */
router.get('/lead/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;

    const { lead, error } = await findLeadByIdentifier(identifier, 'id, name, email, phone, booking_code');

    if (error || !lead) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found. Please check your link and try again.'
      });
    }

    res.json(lead);
  } catch (error) {
    console.error('Error fetching lead:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   GET /api/public/booking/availability
 * @desc    Get available booking slots (public, no auth required)
 * @access  Public
 */
router.get('/availability', async (req, res) => {
  try {
    const { start, end } = req.query;
    
    // Default to next 30 days if not specified
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = start || today.toISOString().split('T')[0];
    const endDate = end || new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Get all booked appointments in date range
    const { data: bookedLeads, error: bookedError } = await supabase
      .from('leads')
      .select('date_booked, time_booked, status')
      .gte('date_booked', startDate)
      .lte('date_booked', endDate)
      .in('status', ['Booked', 'Confirmed'])
      .neq('postcode', 'ZZGHOST'); // Exclude ghost bookings

    if (bookedError) {
      console.error('Error fetching booked leads:', bookedError);
    }

    // Get blocked slots
    const { data: blockedSlots, error: blockedError } = await supabase
      .from('blocked_slots')
      .select('date, time_slot')
      .gte('date', startDate)
      .lte('date', endDate);

    if (blockedError) {
      console.error('Error fetching blocked slots:', blockedError);
    }

    // Group bookings by date
    const bookingsByDate = {};
    (bookedLeads || []).forEach(lead => {
      if (lead.date_booked && lead.time_booked) {
        const dateStr = lead.date_booked.split('T')[0];
        if (!bookingsByDate[dateStr]) {
          bookingsByDate[dateStr] = [];
        }
        bookingsByDate[dateStr].push(lead.time_booked);
      }
    });

    // Group blocked slots by date and track full day blocks
    const blockedByDate = {};
    const fullDayBlocks = new Set();
    
    (blockedSlots || []).forEach(block => {
      const dateStr = block.date.split('T')[0];
      if (!blockedByDate[dateStr]) {
        blockedByDate[dateStr] = [];
      }
      if (block.time_slot) {
        blockedByDate[dateStr].push(block.time_slot);
      } else {
        // No time_slot means full day block
        fullDayBlocks.add(dateStr);
      }
    });

    // Generate availability for each date
    const availability = [];
    const currentDate = new Date(startDate);
    const endDateObj = new Date(endDate);

    while (currentDate <= endDateObj) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayOfWeek = currentDate.getDay();

      // Skip weekends
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        const bookedTimes = bookingsByDate[dateStr] || [];
        const blockedTimes = blockedByDate[dateStr] || [];
        const isFullyBlocked = fullDayBlocks.has(dateStr);

        availability.push({
          date: dateStr,
          available: !isFullyBlocked,
          bookedTimes: [...bookedTimes, ...blockedTimes]
        });
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    res.json(availability);
  } catch (error) {
    console.error('Error fetching availability:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   POST /api/public/booking/book/:identifier
 * @desc    Book an appointment (public, no auth required)
 * @param   identifier - Either UUID or short booking code
 * @access  Public
 */
router.post('/book/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const { date, time, datetime, name, email, paymentMethodId, stripeCustomerId } = req.body;

    if (!date || !time) {
      return res.status(400).json({
        success: false,
        message: 'Date and time are required'
      });
    }

    // Get the lead by ID or booking code
    const { lead, error: leadError } = await findLeadByIdentifier(identifier);

    if (leadError || !lead) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found. Please check your link and try again.'
      });
    }
    
    // Use the actual lead ID for all subsequent operations
    const leadId = lead.id;

    // Check if slot is still available
    const { data: conflicts, error: conflictError } = await supabase
      .from('leads')
      .select('id, name, date_booked, time_booked')
      .eq('date_booked', date)
      .eq('time_booked', time)
      .in('status', ['Booked', 'Confirmed'])
      .neq('id', leadId);

    if (conflictError) {
      console.error('Error checking conflicts:', conflictError);
    }

    if (conflicts && conflicts.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'This time slot is no longer available. Please select another time.'
      });
    }

    // Check blocked slots
    const { data: blockedSlots, error: blockedError } = await supabase
      .from('blocked_slots')
      .select('*')
      .eq('date', date);

    if (!blockedError && blockedSlots && blockedSlots.length > 0) {
      const isBlocked = blockedSlots.some(block => {
        if (!block.time_slot) return true; // Full day block
        return block.time_slot === time;
      });

      if (isBlocked) {
        return res.status(409).json({
          success: false,
          message: 'This time slot is not available. Please select another time.'
        });
      }
    }

    // Create booking datetime
    const bookingDateTime = datetime ? new Date(datetime) : new Date(`${date}T${time}:00`);

    // Update lead with booking (including any name/email changes from client)
    const updateData = {
      status: 'Booked',
      date_booked: date,
      time_booked: time,
      booked_at: new Date().toISOString(),
      ever_booked: true,
      is_confirmed: true,
      updated_at: new Date().toISOString(),
      // Assign to Sally for SalesApe/public bookings
      booker_id: DEFAULT_SALESAPE_BOOKER_ID
    };

    // Add Stripe payment info if provided
    if (paymentMethodId) {
      updateData.stripe_payment_method_id = paymentMethodId;
      console.log(`💳 Stripe payment method saved: ${paymentMethodId}`);
    }
    if (stripeCustomerId) {
      updateData.stripe_customer_id = stripeCustomerId;
      console.log(`💳 Stripe customer ID saved: ${stripeCustomerId}`);
    }

    if (DEFAULT_SALESAPE_BOOKER_ID) {
      console.log('📋 Booking assigned to Sally (SalesApe default booker)');
    }

    // If client updated their name or email, save it
    if (name && name !== lead.name) {
      updateData.name = name;
      console.log(`📝 Client updated name: "${lead.name}" → "${name}"`);
    }
    if (email && email !== lead.email) {
      updateData.email = email;
      console.log(`📝 Client updated email: "${lead.email}" → "${email}"`);
    }

    const { data: updatedLead, error: updateError } = await supabase
      .from('leads')
      .update(updateData)
      .eq('id', leadId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating lead:', updateError);
      return res.status(500).json({
        success: false,
        message: 'Failed to create booking'
      });
    }

    // Add booking history entry
    try {
      // Get current booking history
      const { data: currentLead, error: fetchError } = await supabase
        .from('leads')
        .select('booking_history')
        .eq('id', leadId)
        .single();

      if (!fetchError && currentLead) {
        // Parse booking_history - it may be stored as JSON string or array
        let currentHistory = [];
        if (currentLead.booking_history) {
          try {
            if (typeof currentLead.booking_history === 'string') {
              currentHistory = JSON.parse(currentLead.booking_history);
            } else if (Array.isArray(currentLead.booking_history)) {
              currentHistory = currentLead.booking_history;
            }
          } catch (parseError) {
            console.warn('⚠️ Failed to parse booking_history, using empty array:', parseError.message);
            currentHistory = [];
          }
        }
        if (!Array.isArray(currentHistory)) {
          currentHistory = [];
        }
        
        const historyEntry = {
          action: 'BOOKING_CREATED',
          timestamp: new Date().toISOString(),
          performedBy: null,
          performedByName: 'Client (Self-Service)',
          details: {
            date: date,
            time: time,
            source: 'public_booking_page',
            clientUpdatedName: name && name !== lead.name ? { from: lead.name, to: name } : null,
            clientUpdatedEmail: email && email !== lead.email ? { from: lead.email, to: email } : null
          },
          leadSnapshot: updatedLead
        };
        const updatedHistory = [...currentHistory, historyEntry];

        await supabase
          .from('leads')
          .update({ booking_history: updatedHistory })
          .eq('id', leadId);
      }
    } catch (historyError) {
      console.error('Error adding booking history:', historyError);
      // Don't fail the booking if history fails
    }

    // Send booking confirmation
    try {
      const bookingDate = new Date(bookingDateTime);
      await MessagingService.sendBookingConfirmation(
        leadId,
        DEFAULT_SALESAPE_BOOKER_ID, // Use Sally for SalesApe bookings
        bookingDate.toISOString(),
        { sendEmail: true, sendSms: true }
      );
    } catch (confirmationError) {
      console.error('Error sending booking confirmation:', confirmationError);
      // Don't fail the booking if confirmation fails
    }

    // Update SalesAPE - notify that meeting was booked
    // Note: SalesApe Airtable doesn't have "Event Type" field, just log the booking
    if (lead.salesape_record_id || lead.airtable_record_id) {
      try {
        // Just log the booking - SalesApe will get updated via their webhook monitoring
        console.log('📅 Meeting booked for SalesApe lead:', {
          leadId: leadId,
          leadName: lead.name,
          salesapeRecordId: lead.salesape_record_id
        });

        // Skip Airtable POST - SalesApe doesn't have "Event Type" field
        // SalesApe will detect the booking via their own monitoring

        // Update our local database to track goal hit
        await supabase
          .from('leads')
          .update({
            salesape_goal_hit: true,
            salesape_status: 'Goal Hit',
            salesape_last_updated: new Date().toISOString()
          })
          .eq('id', leadId);
      } catch (salesapeError) {
        console.error('Error notifying SalesAPE:', salesapeError.response?.data || salesapeError.message);
        // Don't fail the booking if SalesAPE notification fails
      }
    }

    // Emit socket event for real-time updates
    if (global.io) {
      global.io.emit('lead_updated', {
        leadId: leadId,
        type: 'booking_created',
        booking: {
          date: date,
          time: time
        }
      });
    }

    console.log(`✅ Public booking created: ${lead.name} on ${date} at ${time}`);

    res.json({
      success: true,
      message: 'Booking confirmed successfully',
      booking: {
        date: date,
        time: time,
        leadId: leadId
      }
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;

