/**
 * Lead Filter Configuration
 * 
 * This file defines the filter logic for the frontend.
 * It should match the backend's STATUS_FILTER_CONFIG in server/utils/leadFilters.js
 */

/**
 * Status Filter Configuration
 */
export const STATUS_FILTER_CONFIG = {
  // Simple status filters
  'all': {
    type: 'all',
    dateColumn: 'created_at',
    label: 'All',
    description: 'All leads by creation date'
  },
  
  'New': {
    type: 'simple',
    statusMatch: ['New'],
    dateColumn: 'created_at',
    label: 'New'
  },
  
  'Assigned': {
    type: 'simple',
    statusMatch: ['Assigned'],
    dateColumn: 'assigned_at',
    label: '👤 Assigned',
    checkCallStatus: false
  },
  
  'Booked': {
    type: 'simple',
    statusMatch: ['Booked'],
    dateColumn: 'booked_at',
    label: '📅 Booked'
  },
  
  // Special statuses - use booking_history for date filtering
  'Attended': {
    type: 'special',
    statusMatch: ['Attended'],
    bookingStatusMatch: ['Arrived', 'Left', 'No Sale', 'Complete'],
    dateColumn: 'booking_history',
    label: '✅ Attended',
    description: 'When marked as attended'
  },
  
  'Cancelled': {
    type: 'special',
    statusMatch: ['Cancelled'],
    bookingStatusMatch: ['Cancel'],
    dateColumn: 'booking_history',
    label: '❌ Cancelled',
    description: 'When cancelled'
  },
  
  'No Show': {
    type: 'special',
    statusMatch: ['No Show'],
    bookingStatusMatch: ['No Show'],
    dateColumn: 'booking_history',
    label: '🚫 No Show',
    description: 'When marked no-show'
  },
  
  'Rejected': {
    type: 'simple',
    statusMatch: ['Rejected'],
    dateColumn: 'booking_history',
    label: 'Rejected',
    description: 'When rejected'
  },
  
  // Call statuses
  'No answer': {
    type: 'call_status',
    callStatusMatch: 'No answer',
    dateColumn: 'booking_history',
    label: '📵 No answer',
    description: 'When no answer recorded'
  },
  
  'No Answer x2': {
    type: 'call_status',
    callStatusMatch: 'No Answer x2',
    dateColumn: 'booking_history',
    label: '📵 No Answer x2',
    description: 'When no answer x2 recorded'
  },
  
  'No Answer x3': {
    type: 'call_status',
    callStatusMatch: 'No Answer x3',
    dateColumn: 'booking_history',
    label: '📵 No Answer x3',
    description: 'When no answer x3 recorded'
  },
  
  'Left Message': {
    type: 'call_status',
    callStatusMatch: 'Left Message',
    dateColumn: 'booking_history',
    label: '💬 Left Message',
    description: 'When left message recorded'
  },
  
  'Not interested': {
    type: 'call_status',
    callStatusMatch: 'Not interested',
    dateColumn: 'booking_history',
    label: '🚫 Not interested',
    description: 'When not interested recorded'
  },
  
  'Call back': {
    type: 'call_status',
    callStatusMatch: 'Call back',
    dateColumn: 'booking_history',
    label: '📞 Call back',
    description: 'When call back scheduled'
  },
  
  'Wrong number': {
    type: 'call_status',
    callStatusMatch: 'Wrong number',
    dateColumn: 'booking_history',
    label: '📞 Wrong number',
    description: 'When wrong number recorded'
  },
  
  'Not Qualified': {
    type: 'call_status',
    callStatusMatch: 'Not Qualified',
    dateColumn: 'booking_history',
    label: '❌ Not Qualified',
    description: 'When not qualified recorded'
  },
  
  // Sales
  'Sales': {
    type: 'has_sale',
    hasSale: true,
    dateColumn: 'booked_at',
    label: '💰 Sales',
    description: 'When sale booking made'
  }
};

/**
 * Get the date column for a status
 */
export function getDateColumnForStatus(status) {
  const config = STATUS_FILTER_CONFIG[status];
  return config?.dateColumn || 'assigned_at';
}

/**
 * Get the date filter label for a status
 */
export function getDateFilterLabel(status) {
  const config = STATUS_FILTER_CONFIG[status];
  const dateColumn = config?.dateColumn || 'assigned_at';
  
  switch (dateColumn) {
    case 'created_at':
      return 'Date Created:';
    case 'assigned_at':
      return 'Date Assigned:';
    case 'booked_at':
      return 'Date Booked:';
    case 'booking_history':
      return 'Date Changed:';
    default:
      return 'Date Filter:';
  }
}

/**
 * Build API parameters for a status and date range
 */
export function buildFilterParams(status, dateRange) {
  const params = {};
  
  if (!dateRange) {
    return params;
  }
  
  const config = STATUS_FILTER_CONFIG[status];
  const dateColumn = config?.dateColumn || 'assigned_at';
  
  switch (dateColumn) {
    case 'created_at':
      params.created_at_start = dateRange.start;
      params.created_at_end = dateRange.end;
      break;
    case 'assigned_at':
      params.assigned_at_start = dateRange.start;
      params.assigned_at_end = dateRange.end;
      break;
    case 'booked_at':
      params.booked_at_start = dateRange.start;
      params.booked_at_end = dateRange.end;
      break;
    case 'booking_history':
      // For booking_history, we send status_changed_at for JS filtering
      // No SQL date filter is applied
      params.status_changed_at_start = dateRange.start;
      params.status_changed_at_end = dateRange.end;
      break;
  }
  
  return params;
}

/**
 * Get all status options for the filter UI
 */
export function getStatusOptions(userRole) {
  const options = [
    { value: 'all', label: 'All', count: 'total' },
    { value: 'Assigned', label: '👤 Assigned', count: 'assigned' },
    { value: 'Booked', label: '📅 Booked', count: 'booked' },
    { value: 'Attended', label: '✅ Attended', count: 'attendedFilter' },
    { value: 'Cancelled', label: '❌ Cancelled', count: 'cancelledFilter' },
    { value: 'No Show', label: '🚫 No Show', count: 'noShow' },
    { value: 'No answer', label: '📵 No answer', count: 'noAnswerCall' },
    { value: 'No Answer x2', label: '📵 No Answer x2', count: 'noAnswerX2' },
    { value: 'No Answer x3', label: '📵 No Answer x3', count: 'noAnswerX3' },
    { value: 'Left Message', label: '💬 Left Message', count: 'leftMessage' },
    { value: 'Not interested', label: '🚫 Not interested', count: 'notInterestedCall' },
    { value: 'Call back', label: '📞 Call back', count: 'callBack' },
    { value: 'Wrong number', label: '📞 Wrong number', count: 'wrongNumber' },
    { value: 'Sales', label: '💰 Sales', count: 'salesConverted' },
    { value: 'Not Qualified', label: '❌ Not Qualified', count: 'notQualified' }
  ];
  
  // Add Rejected for admin users
  if (userRole === 'admin') {
    options.push({ value: 'Rejected', label: 'Rejected', count: 'rejected' });
  }
  
  return options;
}
