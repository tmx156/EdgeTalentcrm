const express = require('express');
const { auth, adminAuth } = require('../middleware/auth');
const dbManager = require('../database-connection-manager');

const router = express.Router();

// @route   GET /api/lead-analytics/sources
// @desc    Aggregated source analytics (leads, booked, attended, sales, revenue by source)
// @access  Admin only
router.get('/sources', auth, adminAuth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'startDate and endDate are required' });
    }

    // Fetch leads in date range
    const { data: leads, error: leadsErr } = await dbManager.client
      .from('leads')
      .select('id, lead_source, status, booking_status, ever_booked')
      .is('deleted_at', null)
      .gte('created_at', `${startDate}T00:00:00.000Z`)
      .lte('created_at', `${endDate}T23:59:59.999Z`);

    if (leadsErr) throw leadsErr;

    // Fetch sales with lead source
    const { data: sales, error: salesErr } = await dbManager.client
      .from('sales')
      .select('amount, lead_id')
      .gte('created_at', `${startDate}T00:00:00.000Z`)
      .lte('created_at', `${endDate}T23:59:59.999Z`);

    if (salesErr) throw salesErr;

    // Build a set of lead IDs in our range for filtering sales
    const leadIdSet = new Set((leads || []).map(l => l.id));
    // Map lead_id -> lead_source for sales
    const leadSourceMap = {};
    for (const lead of (leads || [])) {
      leadSourceMap[lead.id] = lead.lead_source || 'Unknown';
    }

    // Fetch cost entries overlapping the period
    const { data: costs, error: costsErr } = await dbManager.client
      .from('lead_source_costs')
      .select('*')
      .lte('period_start', endDate)
      .gte('period_end', startDate);

    // Aggregate per source
    const sourceMap = {};

    for (const lead of (leads || [])) {
      const source = lead.lead_source || 'Unknown';
      if (!sourceMap[source]) {
        sourceMap[source] = {
          source,
          totalLeads: 0,
          booked: 0,
          attended: 0,
          sales: 0,
          revenue: 0,
          costPerLead: null,
          totalSpend: null
        };
      }
      const s = sourceMap[source];
      s.totalLeads++;

      if (lead.ever_booked || lead.booking_status === 'Booked' || lead.status === 'Booked') {
        s.booked++;
      }

      const attendedStatuses = ['Arrived', 'Left', 'No Sale', 'Complete', 'Sale'];
      if (attendedStatuses.includes(lead.booking_status) || attendedStatuses.includes(lead.status)) {
        s.attended++;
      }
    }

    // Add sales data
    for (const sale of (sales || [])) {
      if (!sale.lead_id || !leadIdSet.has(sale.lead_id)) continue;
      const source = leadSourceMap[sale.lead_id] || 'Unknown';
      if (!sourceMap[source]) {
        sourceMap[source] = {
          source,
          totalLeads: 0,
          booked: 0,
          attended: 0,
          sales: 0,
          revenue: 0,
          costPerLead: null,
          totalSpend: null
        };
      }
      sourceMap[source].sales++;
      sourceMap[source].revenue += parseFloat(sale.amount) || 0;
    }

    // Apply cost data
    if (!costsErr && costs) {
      for (const cost of costs) {
        const source = cost.lead_source || 'Unknown';
        if (sourceMap[source]) {
          if (cost.cost_per_lead != null) sourceMap[source].costPerLead = parseFloat(cost.cost_per_lead);
          if (cost.total_spend != null) sourceMap[source].totalSpend = parseFloat(cost.total_spend);
        }
      }
    }

    // Calculate rates and ROI
    const sources = Object.values(sourceMap).map(s => {
      const bookingRate = s.totalLeads > 0 ? ((s.booked / s.totalLeads) * 100) : 0;
      const showUpRate = s.booked > 0 ? ((s.attended / s.booked) * 100) : 0;
      const salesConversion = s.attended > 0 ? ((s.sales / s.attended) * 100) : 0;

      // Calculate effective spend
      let effectiveSpend = s.totalSpend;
      if (effectiveSpend == null && s.costPerLead != null) {
        effectiveSpend = s.costPerLead * s.totalLeads;
      }

      const roi = effectiveSpend && effectiveSpend > 0
        ? ((s.revenue - effectiveSpend) / effectiveSpend) * 100
        : null;

      const costPerSale = s.sales > 0 && effectiveSpend != null
        ? effectiveSpend / s.sales
        : null;

      return {
        ...s,
        totalSpend: effectiveSpend,
        bookingRate: Math.round(bookingRate * 10) / 10,
        showUpRate: Math.round(showUpRate * 10) / 10,
        salesConversion: Math.round(salesConversion * 10) / 10,
        roi: roi != null ? Math.round(roi * 10) / 10 : null,
        costPerSale: costPerSale != null ? Math.round(costPerSale * 100) / 100 : null
      };
    });

    // Sort by totalLeads desc
    sources.sort((a, b) => b.totalLeads - a.totalLeads);

    // Overall totals
    const totals = {
      totalLeads: sources.reduce((sum, s) => sum + s.totalLeads, 0),
      totalRevenue: sources.reduce((sum, s) => sum + s.revenue, 0),
      totalSpend: sources.reduce((sum, s) => sum + (s.totalSpend || 0), 0),
      overallROI: null
    };
    if (totals.totalSpend > 0) {
      totals.overallROI = Math.round(((totals.totalRevenue - totals.totalSpend) / totals.totalSpend) * 100 * 10) / 10;
    }

    res.json({ sources, totals });
  } catch (error) {
    console.error('Lead analytics sources error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/lead-analytics/distinct-sources
// @desc    Distinct lead_source values for autocomplete
// @access  Admin only
router.get('/distinct-sources', auth, adminAuth, async (req, res) => {
  try {
    const { data, error } = await dbManager.client
      .from('leads')
      .select('lead_source')
      .not('lead_source', 'is', null)
      .is('deleted_at', null);

    if (error) throw error;

    const sources = [...new Set((data || []).map(d => d.lead_source).filter(Boolean))].sort();
    res.json({ sources });
  } catch (error) {
    console.error('Distinct sources error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/lead-analytics/costs
// @desc    List cost entries (optional date filter)
// @access  Admin only
router.get('/costs', auth, adminAuth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = dbManager.client
      .from('lead_source_costs')
      .select('*')
      .order('period_start', { ascending: false });

    if (startDate) query = query.gte('period_start', startDate);
    if (endDate) query = query.lte('period_end', endDate);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ costs: data || [] });
  } catch (error) {
    console.error('Get costs error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/lead-analytics/costs
// @desc    Create/upsert cost entry
// @access  Admin only
router.post('/costs', auth, adminAuth, async (req, res) => {
  try {
    const { lead_source, cost_per_lead, total_spend, period_start, period_end, notes } = req.body;
    if (!lead_source || !period_start || !period_end) {
      return res.status(400).json({ message: 'lead_source, period_start, and period_end are required' });
    }

    const { data, error } = await dbManager.client
      .from('lead_source_costs')
      .upsert({
        lead_source,
        cost_per_lead: cost_per_lead || null,
        total_spend: total_spend || null,
        period_start,
        period_end,
        notes: notes || null,
        created_by: req.user.id,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'lead_source,period_start,period_end'
      })
      .select();

    if (error) throw error;

    res.json({ cost: data[0], message: 'Cost entry saved' });
  } catch (error) {
    console.error('Create cost error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/lead-analytics/costs/:id
// @desc    Update cost entry
// @access  Admin only
router.put('/costs/:id', auth, adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { lead_source, cost_per_lead, total_spend, period_start, period_end, notes } = req.body;

    const { data, error } = await dbManager.client
      .from('lead_source_costs')
      .update({
        lead_source,
        cost_per_lead: cost_per_lead || null,
        total_spend: total_spend || null,
        period_start,
        period_end,
        notes: notes || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ message: 'Cost entry not found' });
    }

    res.json({ cost: data[0], message: 'Cost entry updated' });
  } catch (error) {
    console.error('Update cost error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/lead-analytics/costs/:id
// @desc    Delete cost entry
// @access  Admin only
router.delete('/costs/:id', auth, adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await dbManager.client
      .from('lead_source_costs')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ message: 'Cost entry deleted' });
  } catch (error) {
    console.error('Delete cost error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
