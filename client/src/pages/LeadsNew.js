import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FiPlus, FiSearch, FiFilter, FiChevronRight, FiUserPlus,
  FiCalendar, FiWifi, FiUpload, FiTrash2, FiX, FiFileText,
  FiCheck, FiPhone, FiMail, FiMapPin, FiActivity, FiUser,
  FiMessageSquare, FiClock, FiEye
} from 'react-icons/fi';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import LeadAnalysisModal from '../components/LeadAnalysisModal';
import LazyImage from '../components/LazyImage';
import ImageLightbox from '../components/ImageLightbox';
import BulkCommunicationModal from '../components/BulkCommunicationModal';
import { getOptimizedImageUrl } from '../utils/imageUtils';

const LeadsNew = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { subscribeToLeadUpdates, isConnected } = useSocket();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [leadCounts, setLeadCounts] = useState({
    total: 0,
    new: 0,
    booked: 0,
    attended: 0,
    cancelled: 0,
    assigned: 0,
    rejected: 0,
    noAnswerCall: 0,
    leftMessage: 0,
    notInterestedCall: 0,
    callBack: 0,
    wrongNumber: 0,
    salesConverted: 0,
    notQualified: 0
  });

  const [searchTerm, setSearchTerm] = useState('');
  // Read statusFilter from URL query params first, then navigation state, then default to 'all'
  const [statusFilter, setStatusFilter] = useState(() => {
    const urlParams = new URLSearchParams(location.search);
    return urlParams.get('status') || location.state?.statusFilter || 'all';
  });
  const [dateFilter, setDateFilter] = useState('all'); // New: Date filter
  const [customDateStart, setCustomDateStart] = useState(''); // New: Custom date range start
  const [customDateEnd, setCustomDateEnd] = useState(''); // New: Custom date range end
  // Read currentPage from URL query params
  const [currentPage, setCurrentPage] = useState(() => {
    const urlParams = new URLSearchParams(location.search);
    return parseInt(urlParams.get('page')) || 1;
  });
  
  // Track the last URL we wrote to prevent loops
  const lastWrittenUrlRef = useRef('');
  const [totalPages, setTotalPages] = useState(1);
  const [totalLeads, setTotalLeads] = useState(0);
  const [leadsPerPage] = useState(30); // Optimized: Reduced from 50 to 30 for better performance
  const [selectedLeads, setSelectedLeads] = useState([]);
  const [viewMode, setViewMode] = useState('table'); // Default to table view

  // Lightbox
  const [lightboxUrl, setLightboxUrl] = useState(null);
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showBulkCommunicationModal, setShowBulkCommunicationModal] = useState(false);
  const [showSalesApeModal, setShowSalesApeModal] = useState(false);
  const [sendingToSalesApe, setSendingToSalesApe] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [salesTeam, setSalesTeam] = useState([]);
  const [selectedBooker, setSelectedBooker] = useState('');

  // Upload related state
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateAnalysis, setDuplicateAnalysis] = useState(null);
  const [showLeadAnalysisModal, setShowLeadAnalysisModal] = useState(false);
  const [analysisReport, setAnalysisReport] = useState(null);
  const [distanceStats, setDistanceStats] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  
  const [newLead, setNewLead] = useState({
    name: '',
    phone: '',
    email: '',
    postcode: '',
    status: 'New',
    image_url: ''
  });

  // Reset page to 1 when filters change (except for pagination clicks)
  // Note: statusFilter changes reset page immediately in the onClick handler, not here
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, dateFilter, customDateStart, customDateEnd]);

  // Helper function to calculate date range in GMT/London timezone
  // Memoized to prevent recreating Date objects on every render
  const getDateRange = useCallback(() => {
    // Get current time in London timezone - use proper Date object
    const now = new Date();
    
    // Get today's date string in London timezone (YYYY-MM-DD format)
    const todayLondonStr = now.toLocaleDateString('en-CA', { timeZone: 'Europe/London' }); // YYYY-MM-DD format
    
    // Create Date objects for calculations
    const todayMidnightLondon = new Date(todayLondonStr + 'T00:00:00.000Z');

    if (process.env.NODE_ENV === 'development') {
      console.log('🕐 Current time:', now.toLocaleString('en-GB', { timeZone: 'Europe/London' }));
      console.log('📅 Today (London midnight):', todayLondonStr, todayMidnightLondon.toISOString());
    }

    switch (dateFilter) {
      case 'today':
        // Today: from midnight to midnight+24h in London time
        const startOfToday = todayLondonStr + 'T00:00:00.000Z';
        const startOfTomorrow = new Date(todayMidnightLondon.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] + 'T00:00:00.000Z';
        return {
          start: startOfToday,
          end: startOfTomorrow
        };
      case 'yesterday':
        // Yesterday: from yesterday midnight to today midnight in London time
        const yesterdayDate = new Date(todayMidnightLondon.getTime() - 24 * 60 * 60 * 1000);
        const startOfYesterday = yesterdayDate.toISOString().split('T')[0] + 'T00:00:00.000Z';
        return {
          start: startOfYesterday,
          end: todayLondonStr + 'T00:00:00.000Z'
        };
      case 'week':
        // Last 7 days: from 7 days ago midnight to now
        const weekAgo = new Date(todayMidnightLondon.getTime() - 7 * 24 * 60 * 60 * 1000);
        const startOfWeek = weekAgo.toISOString().split('T')[0] + 'T00:00:00.000Z';
        return {
          start: startOfWeek,
          end: new Date().toISOString() // Current moment
        };
      case 'month':
        // Last 30 days: from 30 days ago midnight to now
        const monthAgo = new Date(todayMidnightLondon.getTime() - 30 * 24 * 60 * 60 * 1000);
        const startOfMonth = monthAgo.toISOString().split('T')[0] + 'T00:00:00.000Z';
        return {
          start: startOfMonth,
          end: new Date().toISOString() // Current moment
        };
      case 'custom':
        if (customDateStart && customDateEnd) {
          // Custom range: use the dates as-is at midnight
          return {
            start: customDateStart + 'T00:00:00.000Z',
            end: customDateEnd + 'T23:59:59.999Z'
          };
        }
        return null;
      default:
        return null;
    }
  }, [dateFilter, customDateStart, customDateEnd]);

  // Memoized fetchLeads to prevent unnecessary recreations
  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');

      // Build params object
      const params = {
        page: currentPage,
        limit: leadsPerPage,
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: searchTerm
      };

      // Add date filter if applicable
      const dateRange = getDateRange();
      if (dateRange) {
        // Use assigned_at for Assigned status, created_at for all others
        if (statusFilter === 'Assigned') {
          params.assigned_at_start = dateRange.start;
          params.assigned_at_end = dateRange.end;
          if (process.env.NODE_ENV === 'development') {
            console.log('📅 Assigned date filter active:', dateFilter, 'Range:', dateRange);
          }
        } else {
          params.created_at_start = dateRange.start;
          params.created_at_end = dateRange.end;
          if (process.env.NODE_ENV === 'development') {
            console.log('📅 Created date filter active:', dateFilter, 'Range:', dateRange);
          }
        }
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.log('📅 Date filter: All time (no filter applied)');
        }
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 Fetching leads with params:', params);
      }

      const response = await axios.get('/api/leads', {
        params,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        timeout: 10000
      });
      
      setLeads(response.data.leads || []);
      setTotalPages(response.data.totalPages || 1);
      setTotalLeads(response.data.total || 0);
    } catch (error) {
      console.error('Error fetching leads:', error);
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, leadsPerPage, statusFilter, searchTerm, getDateRange, dateFilter]);

  // Memoized fetchLeadCounts to prevent unnecessary recreations
  const fetchLeadCounts = useCallback(async () => {
    try {
      // Build params for stats API with date filter if applicable
      const params = {};
      const dateRange = getDateRange();
      
      if (dateRange) {
        // Always use created_at for stats counters
        // (assigned_at is only used for the actual leads list when viewing Assigned status)
        params.created_at_start = dateRange.start;
        params.created_at_end = dateRange.end;
        if (process.env.NODE_ENV === 'development') {
          console.log('📊 Fetching counts with date filter:', dateRange);
        }
      }

      const response = await axios.get('/api/stats/leads', { params });
      if (process.env.NODE_ENV === 'development') {
        console.log('📊 Fetched lead counts with date filter:', response.data);
      }
      setLeadCounts(response.data);
    } catch (error) {
      console.error('Error fetching lead counts:', error);
    }
  }, [getDateRange]);

  // Combined useEffect for fetching leads
  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Smooth scroll to top when page changes
  useEffect(() => {
    const scrollToTop = () => {
      const startPosition = window.pageYOffset;
      const duration = 600; // ms
      let startTime = null;

      const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

      const animate = (currentTime) => {
        if (!startTime) startTime = currentTime;
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = easeOutCubic(progress);

        window.scrollTo(0, startPosition * (1 - easeProgress));

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);
    };

    if (window.pageYOffset > 0) {
      scrollToTop();
    }
  }, [currentPage]);

  // Combined useEffect for initial load and date filter changes
  useEffect(() => {
    if (user) {
      fetchLeadCounts();
      fetchSalesTeam();
    }
  }, [user, dateFilter, customDateStart, customDateEnd, fetchLeadCounts]);

  // Memoize status filter buttons array to prevent recreations
  const statusFilterButtons = useMemo(() => [
    { value: 'all', label: 'All', count: leadCounts.total },
    { value: 'Assigned', label: '👤 Assigned', count: leadCounts.assigned },
    { value: 'Booked', label: '📅 Booked', count: leadCounts.booked },
    { value: 'No answer', label: '📵 No answer', count: leadCounts.noAnswerCall },
    { value: 'No Answer x2', label: '📵 No Answer x2', count: leadCounts.noAnswerX2 },
    { value: 'No Answer x3', label: '📵 No Answer x3', count: leadCounts.noAnswerX3 },
    { value: 'Left Message', label: '💬 Left Message', count: leadCounts.leftMessage },
    { value: 'Not interested', label: '🚫 Not interested', count: leadCounts.notInterestedCall },
    { value: 'Call back', label: '📞 Call back', count: leadCounts.callBack },
    { value: 'Wrong number', label: '📞 Wrong number', count: leadCounts.wrongNumber },
    { value: 'Sales/converted - purchased', label: '💰 Sales', count: leadCounts.salesConverted },
    { value: 'Not Qualified', label: '❌ Not Qualified', count: leadCounts.notQualified }
  ], [leadCounts.total, leadCounts.assigned, leadCounts.booked, leadCounts.noAnswerCall, leadCounts.noAnswerX2, leadCounts.noAnswerX3, leadCounts.leftMessage, leadCounts.notInterestedCall, leadCounts.callBack, leadCounts.wrongNumber, leadCounts.salesConverted, leadCounts.notQualified]);

  // Handle navigation state from sidebar
  useEffect(() => {
    if (location.state?.statusFilter !== undefined) {
      const navStatus = location.state.statusFilter;
      const urlParams = new URLSearchParams(location.search);
      const urlStatus = urlParams.get('status');
      
      console.log('🔵 [NavState] Effect triggered:', { navStatus, urlStatus, currentStatusFilter: statusFilter });
      
      // Only apply if URL doesn't already have this status
      if (!urlStatus) {
        console.log('🔵 [NavState] Applying navigation state:', navStatus);
        setStatusFilter(navStatus);
        setCurrentPage(1);
        const newParams = new URLSearchParams();
        if (navStatus !== 'all') {
          newParams.set('status', navStatus);
        }
        const newUrl = newParams.toString() ? `${location.pathname}?${newParams.toString()}` : location.pathname;
        lastWrittenUrlRef.current = newUrl;
        navigate(newUrl, { replace: true });
      } else {
        console.log('🔵 [NavState] Skipping - URL already has status');
      }
    }
  }, [location.state?.statusFilter, navigate, location.pathname]);

  // Sync URL when state changes (write direction)
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const urlStatus = urlParams.get('status') || 'all';
    const urlPage = parseInt(urlParams.get('page')) || 1;
    
    // Check if state differs from URL
    const statusDiffers = statusFilter !== urlStatus;
    const pageDiffers = currentPage !== urlPage;
    
    console.log('🟢 [URLSync-Write] Effect triggered:', {
      statusFilter,
      urlStatus,
      currentPage,
      urlPage,
      statusDiffers,
      pageDiffers,
      locationSearch: location.search
    });
    
    if (statusDiffers || pageDiffers) {
      const newParams = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') {
        newParams.set('status', statusFilter);
      }
      if (currentPage > 1) {
        newParams.set('page', currentPage.toString());
      }
      
      const newUrl = newParams.toString() ? `${location.pathname}?${newParams.toString()}` : location.pathname;
      console.log('🟢 [URLSync-Write] Updating URL:', { from: location.pathname + location.search, to: newUrl });
      lastWrittenUrlRef.current = newUrl;
      navigate(newUrl, { replace: true });
    } else {
      console.log('🟢 [URLSync-Write] No change needed - state matches URL');
    }
  }, [statusFilter, currentPage, navigate, location.pathname]);
  
  // Read from URL when URL changes (browser back/forward - read direction)
  useEffect(() => {
    const currentUrl = location.pathname + location.search;
    // Skip if we just wrote this URL
    if (currentUrl === lastWrittenUrlRef.current) {
      console.log('🟡 [URLSync-Read] Skipping - we just wrote this URL:', currentUrl);
      lastWrittenUrlRef.current = ''; // Reset so next external change is detected
      return;
    }
    
    const urlParams = new URLSearchParams(location.search);
    const urlStatus = urlParams.get('status') || 'all';
    const urlPage = parseInt(urlParams.get('page')) || 1;
    
    console.log('🟡 [URLSync-Read] Effect triggered:', {
      currentUrl,
      urlStatus,
      urlPage,
      currentStatusFilter: statusFilter,
      currentPage,
      lastWritten: lastWrittenUrlRef.current
    });
    
    // Only update state if URL differs
    if (urlStatus !== statusFilter) {
      console.log('🟡 [URLSync-Read] Updating statusFilter:', { from: statusFilter, to: urlStatus });
      setStatusFilter(urlStatus);
    }
    if (urlPage !== currentPage) {
      console.log('🟡 [URLSync-Read] Updating currentPage:', { from: currentPage, to: urlPage });
      setCurrentPage(urlPage);
    }
  }, [location.search]);

  // Memoized handleRowClick - removed filteredLeads to reduce memory usage
  const handleRowClick = useCallback((lead) => {
    // Pass filter context to LeadDetail for navigation (removed filteredLeads to save memory)
    navigate(`/leads/${lead.id}`, {
      state: {
        statusFilter,
        searchTerm,
        dateFilter,
        customDateStart,
        customDateEnd
        // Removed: filteredLeads: leads - this was causing memory bloat
      }
    });
  }, [navigate, statusFilter, searchTerm, dateFilter, customDateStart, customDateEnd]);

  // Memoized handleBookLead to prevent unnecessary re-renders
  const handleBookLead = useCallback((lead, e) => {
    e.stopPropagation();
    localStorage.setItem('bookingLead', JSON.stringify({
      id: lead.id,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      postcode: lead.postcode,
      notes: lead.notes,
      image_url: lead.image_url,
      currentStatus: lead.status,
      isReschedule: lead.status === 'Booked' || lead.status === 'Rescheduled'
    }));
    navigate('/calendar');
  }, [navigate]);

  // Memoized helper functions to prevent recreations on every render
  const getStatusColor = useCallback((status) => {
    const colors = {
      'New': 'bg-amber-100 text-amber-800 border-amber-300',
      'Booked': 'bg-blue-100 text-blue-800 border-blue-300',
      'Attended': 'bg-green-100 text-green-800 border-green-300',
      'Cancelled': 'bg-red-100 text-red-800 border-red-300',
      'Assigned': 'bg-purple-100 text-purple-800 border-purple-300',
      'Rejected': 'bg-gray-100 text-gray-800 border-gray-300',
      // Call status colors
      'No answer': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'No Answer x2': 'bg-orange-100 text-orange-800 border-orange-300',
      'No Answer x3': 'bg-red-100 text-red-800 border-red-300',
      'Left Message': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'Not interested': 'bg-red-100 text-red-800 border-red-300',
      'Call back': 'bg-purple-100 text-purple-800 border-purple-300',
      'Wrong number': 'bg-teal-100 text-teal-800 border-teal-300',
      'No photo': 'bg-purple-100 text-purple-800 border-purple-300',
      'Sales/converted - purchased': 'bg-green-100 text-green-800 border-green-300',
      'Not Qualified': 'bg-red-100 text-red-800 border-red-300'
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-300';
  }, []);

  // Get the display status - show main status for progressed leads, otherwise prefer call_status
  const getDisplayStatus = useCallback((lead) => {
    // If lead has progressed (Booked, Attended, Cancelled, Rejected, Sale), show main status
    const progressedStatuses = ['Booked', 'Attended', 'Cancelled', 'Rejected', 'Sale'];
    if (progressedStatuses.includes(lead.status)) {
      return lead.status;
    }

    // For non-progressed leads, prefer call_status if available
    if (lead.call_status) {
      return lead.call_status;
    }
    // Check custom_fields for backward compatibility
    if (lead.custom_fields?.call_status) {
      return lead.custom_fields.call_status;
    }
    // Fall back to main status
    return lead.status;
  }, []);

  const formatDate = useCallback((date) => {
    if (!date) return 'Not set';
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) return 'Invalid date';
    return dateObj.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }, []);

  // Memoized handlers to prevent unnecessary re-renders
  const handleSelectLead = useCallback((leadId) => {
    setSelectedLeads(prev => 
      prev.includes(leadId) 
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedLeads(prev => {
      if (prev.length === leads.length && leads.length > 0) {
        return [];
      } else {
        return leads.map(lead => lead.id);
      }
    });
  }, [leads]);

  // Handle adding new lead
  const handleAddLead = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/leads', newLead, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setShowAddModal(false);
      setNewLead({
        name: '',
        phone: '',
        email: '',
        postcode: '',
        status: 'New',
        image_url: ''
      });
      fetchLeads();
      fetchLeadCounts();
    } catch (error) {
      console.error('Error adding lead:', error);
    }
  };

  // Handle file upload for CSV
  const handleFileUpload = (event) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('📁 File input changed!');
    }
    const file = event.target.files[0];
    if (process.env.NODE_ENV === 'development') {
      console.log('📁 Selected file:', file);
    }

    if (file) {
      if (process.env.NODE_ENV === 'development') {
        console.log('📁 File type:', file.type);
        console.log('📁 File name:', file.name);
      }

      const validTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
      if (!validTypes.includes(file.type) && !file.name.endsWith('.csv')) {
        if (process.env.NODE_ENV === 'development') {
          console.log('❌ Invalid file type');
        }
        alert('Please select a CSV or Excel file');
        return;
      }
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ File accepted, setting upload file');
      }
      setUploadFile(file);
      setUploadStatus('');
    }
  };

  // Handle upload submission - Original simple flow
  const handleUploadSubmit = async () => {
    console.log('🚀 Upload button clicked!');
    console.log('📁 File selected:', uploadFile);

    if (!uploadFile) {
      console.log('❌ No file selected');
      alert('Please select a file first');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      if (process.env.NODE_ENV === 'development') {
        console.log('❌ No authentication token available');
      }
      alert('Please login again to upload files');
      return;
    }

    const formData = new FormData();
    formData.append('file', uploadFile);

    try {
      setUploadStatus('Analyzing file...');
      setUploadProgress(10);

      const response = await axios.post('/api/leads/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`,
        },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(progress);
        },
      });

      setUploadProgress(100);

      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 Upload response received:', response.data);
        console.log('🔍 Analysis data:', response.data.analysis);
        console.log('🔍 Report length:', response.data.analysis?.report?.length);
      }

      // Always show analysis modal for review before importing
      if (response.data.analysis) {
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ Showing analysis modal with analysis data');
        }
        setDuplicateAnalysis(response.data);
        setAnalysisReport(response.data.analysis.report || []);
        setDistanceStats(response.data.analysis.distanceStats || null);
        setShowUploadModal(false); // Close upload modal
        setShowLeadAnalysisModal(true);
        setUploadStatus('');
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.log('❌ No analysis data received');
        }
        setUploadStatus('Analysis failed');
        setTimeout(() => setUploadStatus(''), 3000);
      }
      
    } catch (error) {
      console.error('Error uploading file:', error);
      
      // Handle specific error cases
      if (error.response?.status === 401) {
        setUploadStatus('Authentication failed - please login again');
        alert('Your session has expired. Please login again to upload files.');
      } else if (error.response?.status === 403) {
        setUploadStatus('Access denied - admin privileges required');
        alert('You need admin privileges to upload files.');
      } else if (error.response?.status === 400) {
        setUploadStatus('Invalid file format');
        alert('Please select a valid CSV or Excel file.');
      } else {
        setUploadStatus('Upload failed');
        alert('Upload failed. Please try again.');
      }
      
      setTimeout(() => setUploadStatus(''), 3000);
    }
  };


  // Import leads to database
  const importLeads = async (leadsToImport) => {
    if (isImporting) {
      console.log('⚠️ Import already in progress, skipping duplicate request');
      return;
    }
    
    try {
      setIsImporting(true);
      setUploadStatus('Importing leads...');
      
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/leads/bulk-create', {
        leads: leadsToImport
      }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      console.log('📊 Import response:', response.data);
      
      // Show detailed results
      const { imported, duplicates, errors } = response.data;
      let statusMessage = `Import Complete! ${imported} leads imported`;
      if (duplicates > 0) {
        statusMessage += `, ${duplicates} duplicates skipped`;
      }
      if (errors && errors.length > 0) {
        statusMessage += `, ${errors.length} errors`;
        console.warn('Import errors:', errors);
      }
      
      setUploadStatus(statusMessage);
      
      // Close all modals
      setShowUploadModal(false);
      setShowDuplicateModal(false);
      setShowLeadAnalysisModal(false);
      setUploadFile(null);
      setDuplicateAnalysis(null);
      setAnalysisReport(null);
      setDistanceStats(null);
      setUploadProgress(0);
      
      setTimeout(() => {
        setUploadStatus('');
        fetchLeads();
        fetchLeadCounts();
      }, 3000);
      
    } catch (error) {
      console.error('Error importing leads:', error);
      setUploadStatus('Import failed: ' + (error.response?.data?.message || error.message));
      setTimeout(() => setUploadStatus(''), 3000);
    } finally {
      setIsImporting(false);
    }
  };

  // Handle duplicate modal actions
  const handleDuplicateAction = async (action) => {
    if (!duplicateAnalysis) return;

    if (action === 'import_all') {
      await importLeads(duplicateAnalysis.processedLeads);
    } else if (action === 'import_unique') {
      // Filter out duplicates
      const uniqueLeads = duplicateAnalysis.processedLeads.filter((lead, index) => {
        const duplicate = duplicateAnalysis.analysis.report.find(d => d.row === index + 1);
        return !duplicate || !duplicate.duplicateOf; // Keep non-duplicate leads
      });
      await importLeads(uniqueLeads);
    }
  };

  // Handle LeadAnalysisModal actions
  const handleAcceptAll = async () => {
    if (!duplicateAnalysis || isImporting) return;
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 Accepting all leads:', duplicateAnalysis.processedLeads.length);
    }
    await importLeads(duplicateAnalysis.processedLeads);
    setShowLeadAnalysisModal(false);
  };

  const handleDiscardDuplicates = async () => {
    if (!duplicateAnalysis || !analysisReport || isImporting) return;

    // Filter out leads that are marked as duplicates
    const uniqueLeads = duplicateAnalysis.processedLeads.filter((lead, index) => {
      const reportItem = analysisReport.find(item => item.row === index + 1);
      return !reportItem || !reportItem.duplicateOf;
    });

    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 Discarding duplicates - importing unique leads:', uniqueLeads.length);
    }
    await importLeads(uniqueLeads);
    setShowLeadAnalysisModal(false);
  };

  const handleSaveValidLeads = async () => {
    if (!duplicateAnalysis || !analysisReport || isImporting) return;

    // Filter out leads that have any issues (duplicates or far flags)
    const validLeads = duplicateAnalysis.processedLeads.filter((lead, index) => {
      const reportItem = analysisReport.find(item => item.row === index + 1);
      return !reportItem;
    });

    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 Saving valid leads only:', validLeads.length);
    }
    await importLeads(validLeads);
    setShowLeadAnalysisModal(false);
  };

  const handleExportCSV = () => {
    if (!duplicateAnalysis || !analysisReport) return;

    // Create CSV content with analysis results
    const headers = ['Row', 'Name', 'Phone', 'Email', 'Postcode', 'Issues', 'Distance (mi)'];
    const csvContent = [
      headers.join(','),
      ...analysisReport.map(item => [
        item.row,
        `"${item.lead.name || ''}"`,
        `"${item.lead.phone || ''}"`,
        `"${item.lead.email || ''}"`,
        `"${item.lead.postcode || ''}"`,
        `"${item.duplicateOf ? 'Duplicate' : ''}${item.farFlag ? 'Far' : ''}"`,
        item.distanceMiles ? item.distanceMiles.toFixed(1) : ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lead_analysis_report.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleCloseAnalysisModal = () => {
    setShowLeadAnalysisModal(false);
    setAnalysisReport(null);
    setDistanceStats(null);
    setDuplicateAnalysis(null);
    setUploadFile(null);
    setUploadProgress(0);
    setUploadStatus('');
  };

  // Memoized fetchSalesTeam to prevent unnecessary recreations
  const fetchSalesTeam = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/users/bookers', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setSalesTeam(response.data || []);
    } catch (error) {
      console.error('Error fetching sales team:', error);
      setSalesTeam([]);
    }
  }, []);

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (selectedLeads.length === 0) {
      alert('Please select leads to delete');
      return;
    }

    if (user?.role !== 'admin') {
      alert('Only administrators can delete leads');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.delete('/api/leads/bulk', {
        data: { leadIds: selectedLeads },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      setShowBulkDeleteModal(false);
      setSelectedLeads([]);
      fetchLeads();
      fetchLeadCounts();
      alert(`Successfully deleted ${response.data.deletedCount || selectedLeads.length} leads`);
    } catch (error) {
      console.error('Error deleting leads:', error);
      if (error.response?.data?.message) {
        alert(`Delete failed: ${error.response.data.message}`);
      } else {
        alert('Failed to delete leads. Please try again.');
      }
    }
  };

  // Handle bulk assign
  const handleBulkAssign = async () => {
    if (selectedLeads.length === 0) {
      alert('Please select leads to assign');
      return;
    }

    if (!selectedBooker) {
      alert('Please select a team member to assign leads to');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.put('/api/leads/bulk-assign', {
        leadIds: selectedLeads,
        bookerId: selectedBooker
      }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      setShowBulkAssignModal(false);
      setSelectedLeads([]);
      setSelectedBooker('');
      fetchLeads();
      fetchLeadCounts();
      
      const bookerName = salesTeam.find(member => member.id === selectedBooker)?.name || 'Unknown';
      alert(`Successfully assigned ${selectedLeads.length} leads to ${bookerName}`);
    } catch (error) {
      console.error('Error assigning leads:', error);
      alert('Failed to assign leads');
    }
  };

  // Handle send to Sales Ape queue
  const handleSendToSalesApe = async () => {
    if (selectedLeads.length === 0) {
      alert('Please select leads to send to Sales Ape');
      return;
    }

    setSendingToSalesApe(true);
    try {
      const token = localStorage.getItem('token');
      let successCount = 0;
      let failCount = 0;
      const errors = [];

      // Send each lead to Sales Ape queue using the proper endpoint
      for (const leadId of selectedLeads) {
        try {
          await axios.post('/api/salesape-dashboard/queue/add',
            { leadId },
            { headers: { 'x-auth-token': token } }
          );
          successCount++;
        } catch (error) {
          failCount++;
          const errorMsg = error.response?.data?.message || error.message;
          errors.push(errorMsg);
          console.error(`Failed to send lead ${leadId} to Sales Ape:`, errorMsg);
        }
      }

      setShowSalesApeModal(false);
      setSelectedLeads([]);
      fetchLeads();
      fetchLeadCounts();

      if (failCount === 0) {
        alert(`Successfully sent ${successCount} leads to Sales Ape queue`);
      } else {
        alert(`Sent ${successCount} leads to Sales Ape queue.\n${failCount} failed: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}`);
      }
    } catch (error) {
      console.error('Error sending leads to Sales Ape:', error);
      alert('Failed to send leads to Sales Ape');
    } finally {
      setSendingToSalesApe(false);
    }
  };

  if (loading && leads.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto"></div>
          <div className="text-xl text-gray-700 font-medium">Loading leads...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Modern Header */}
      <div className="backdrop-blur-xl bg-white/80 border-b border-gray-200/50 shadow-sm">
        <div className="px-6 py-4">
          {/* Top Row - Responsive for mobile */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                Leads Management
              </h1>
              <div className="flex items-center space-x-2">
                <FiWifi className={`h-4 w-4 ${isConnected ? 'text-green-500' : 'text-red-500'}`} />
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  isConnected
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {isConnected ? 'Live' : 'Offline'}
                </span>
              </div>
              <div className="px-3 py-1 bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 rounded-full text-sm font-semibold">
                {totalLeads} Total Leads
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {selectedLeads.length > 0 && (
                <>
                  <div className="flex items-center space-x-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-xl">
                    <FiCheck className="h-4 w-4" />
                    <span className="font-medium">{selectedLeads.length} Selected</span>
                  </div>
                  
                  <button
                    onClick={() => setShowBulkCommunicationModal(true)}
                    className="group px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center space-x-2 hover:scale-105 transform"
                    style={{
                      pointerEvents: 'auto',
                      cursor: 'pointer'
                    }}
                  >
                    <FiMessageSquare className="h-5 w-5 group-hover:animate-pulse" />
                    <span className="font-medium">Send Email/SMS</span>
                  </button>
                  
                  {user?.role === 'admin' && (
                    <>
                      <button
                        onClick={() => setShowBulkAssignModal(true)}
                        className="group px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center space-x-2 hover:scale-105 transform"
                        style={{
                          pointerEvents: 'auto',
                          cursor: 'pointer'
                        }}
                      >
                        <FiUserPlus className="h-5 w-5 group-hover:animate-pulse" />
                        <span className="font-medium">Assign Leads</span>
                      </button>

                      <button
                        onClick={() => setShowSalesApeModal(true)}
                        className="group px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center space-x-2 hover:scale-105 transform"
                        style={{
                          pointerEvents: 'auto',
                          cursor: 'pointer'
                        }}
                      >
                        <span className="text-lg group-hover:animate-bounce">🦍</span>
                        <span className="font-medium">Sales Ape</span>
                      </button>

                      <button
                        onClick={() => setShowBulkDeleteModal(true)}
                        className="group px-4 py-2 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-xl hover:from-red-700 hover:to-pink-700 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center space-x-2 hover:scale-105 transform"
                        style={{
                          pointerEvents: 'auto',
                          cursor: 'pointer'
                        }}
                      >
                        <FiTrash2 className="h-5 w-5 group-hover:animate-bounce" />
                        <span className="font-medium">Delete Leads</span>
                      </button>
                    </>
                  )}
                  
                  {user?.role !== 'admin' && (
                    <button
                      onClick={() => setSelectedLeads([])}
                      className="group px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center space-x-2 hover:scale-105 transform"
                      style={{
                        pointerEvents: 'auto',
                        cursor: 'pointer'
                      }}
                    >
                      <FiX className="h-5 w-5" />
                      <span className="font-medium">Clear Selection</span>
                    </button>
                  )}
                </>
              )}
              
              <button
                onClick={() => setShowUploadModal(true)}
                className="group px-4 py-2 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-xl hover:from-emerald-700 hover:to-green-700 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center space-x-2 hover:scale-105 transform"
                style={{
                  pointerEvents: 'auto',
                  cursor: 'pointer'
                }}
              >
                <FiUpload className="h-5 w-5 group-hover:animate-bounce" />
                <span className="font-medium">Upload CSV</span>
              </button>

              <button
                onClick={() => setShowAddModal(true)}
                className="group px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center space-x-2 hover:scale-105 transform"
                style={{
                  pointerEvents: 'auto',
                  cursor: 'pointer'
                }}
              >
                <FiPlus className="h-5 w-5 group-hover:rotate-90 transition-transform" />
                <span className="font-medium">Add Lead</span>
              </button>
            </div>
          </div>

          {/* Search and Filter Row */}
          <div className="flex items-center space-x-4">
            {/* Search Bar */}
            <div className="flex-1 relative">
              <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search by name, phone, email, or postcode..."
                className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-800 placeholder-gray-400"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-white border border-gray-200 rounded-xl p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-2 rounded-lg transition-all duration-200 ${
                  viewMode === 'grid' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-2 rounded-lg transition-all duration-200 ${
                  viewMode === 'table' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Table
              </button>
            </div>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="px-6 pb-3">
          <div className="flex items-center space-x-2 overflow-x-auto pb-2">
            {statusFilterButtons.map(filter => {
              const getFilterStyle = () => {
                if (statusFilter !== filter.value) {
                  return 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50';
                }
                switch(filter.value) {
                  case 'all': return 'bg-gray-600 text-white shadow-lg transform scale-105';
                  case 'Assigned': return 'bg-orange-600 text-white shadow-lg transform scale-105';
                  case 'Booked': return 'bg-blue-600 text-white shadow-lg transform scale-105';
                  case 'No answer': return 'bg-yellow-600 text-white shadow-lg transform scale-105';
                  case 'No Answer x2': return 'bg-orange-600 text-white shadow-lg transform scale-105';
                  case 'No Answer x3': return 'bg-red-600 text-white shadow-lg transform scale-105';
                  case 'Left Message': return 'bg-yellow-600 text-white shadow-lg transform scale-105';
                  case 'Not interested': return 'bg-red-600 text-white shadow-lg transform scale-105';
                  case 'Call back': return 'bg-purple-600 text-white shadow-lg transform scale-105';
                  case 'Wrong Number': return 'bg-teal-600 text-white shadow-lg transform scale-105';
                  case 'Sales/converted - purchased': return 'bg-green-600 text-white shadow-lg transform scale-105';
                  case 'Not Qualified': return 'bg-red-600 text-white shadow-lg transform scale-105';
                  default: return 'bg-gray-600 text-white shadow-lg transform scale-105';
                }
              };
              
              return (
                <button
                  key={filter.value}
                  onClick={() => {
                    console.log('🔴 [FilterClick] Button clicked:', { filter: filter.value, currentFilter: statusFilter, currentPage });
                    setStatusFilter(filter.value);
                    setCurrentPage(1); // Reset to page 1 immediately when filter changes
                    console.log('🔴 [FilterClick] State updated:', { newFilter: filter.value, newPage: 1 });
                  }}
                  className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 whitespace-nowrap ${getFilterStyle()}`}
                >
                  {filter.label}
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                    statusFilter === filter.value
                      ? 'bg-white/20 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {filter.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Date Filter - Scrollable Section */}
      <div className="px-3 sm:px-6 pt-4 pb-4 bg-gradient-to-br from-gray-50 via-white to-gray-100">
        <div className="flex flex-col gap-3 bg-gradient-to-r from-blue-50 to-purple-50 p-3 sm:p-4 rounded-xl border-[0.3px] border-blue-200">
          {/* Label Section */}
          <div className="flex items-center space-x-2 flex-shrink-0">
            <FiCalendar className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
            <span className="text-xs sm:text-sm font-semibold text-gray-800 whitespace-nowrap">
              {statusFilter === 'Assigned' ? 'Date Assigned:' : 'Date Added:'}
            </span>
          </div>

          {/* Quick Filter Buttons and Custom Date Range - All in One Row */}
          <div className="flex flex-wrap items-center gap-2 w-full">
            <button
              onClick={() => setDateFilter('today')}
              className={`px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-lg font-medium transition-all duration-200 whitespace-nowrap ${
                dateFilter === 'today'
                  ? 'bg-blue-600 text-white shadow-md transform scale-105'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setDateFilter('yesterday')}
              className={`px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-lg font-medium transition-all duration-200 whitespace-nowrap ${
                dateFilter === 'yesterday'
                  ? 'bg-blue-600 text-white shadow-md transform scale-105'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Yesterday
            </button>
            <button
              onClick={() => setDateFilter('week')}
              className={`px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-lg font-medium transition-all duration-200 whitespace-nowrap ${
                dateFilter === 'week'
                  ? 'bg-blue-600 text-white shadow-md transform scale-105'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Last 7 Days
            </button>
            <button
              onClick={() => setDateFilter('month')}
              className={`px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-lg font-medium transition-all duration-200 whitespace-nowrap ${
                dateFilter === 'month'
                  ? 'bg-blue-600 text-white shadow-md transform scale-105'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Last 30 Days
            </button>
            <button
              onClick={() => setDateFilter('all')}
              className={`px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-lg font-medium transition-all duration-200 whitespace-nowrap ${
                dateFilter === 'all'
                  ? 'bg-blue-600 text-white shadow-md transform scale-105'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              All Time
            </button>

            {/* Custom Date Range - Inline with buttons */}
            <div className="flex items-center gap-2 ml-auto">
              <input
                type="date"
                value={customDateStart}
                onChange={(e) => {
                  setCustomDateStart(e.target.value);
                  if (e.target.value) setDateFilter('custom');
                }}
                className="border border-gray-300 rounded-lg px-2 sm:px-3 py-1.5 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[140px]"
                placeholder="Start date"
              />
              <span className="text-gray-500 text-xs sm:text-sm whitespace-nowrap">to</span>
              <input
                type="date"
                value={customDateEnd}
                onChange={(e) => {
                  setCustomDateEnd(e.target.value);
                  if (e.target.value) setDateFilter('custom');
                }}
                className="border border-gray-300 rounded-lg px-2 sm:px-3 py-1.5 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[140px]"
                placeholder="End date"
              />
              {(customDateStart || customDateEnd) && (
                <button
                  onClick={() => {
                    setCustomDateStart('');
                    setCustomDateEnd('');
                    setDateFilter('all');
                  }}
                  className="text-gray-500 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                  title="Clear custom dates"
                >
                  <FiX className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="px-6 py-6">
        {viewMode === 'grid' ? (
          /* Modern Card Grid View */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
            {leads.map((lead) => (
              <div
                key={lead.id}
                onClick={() => handleRowClick(lead)}
                className="group bg-white rounded-2xl shadow-md hover:shadow-2xl transition-all duration-300 cursor-pointer overflow-hidden border border-gray-100 hover:border-blue-200 transform hover:scale-105"
              >
                {/* Card Header with Image */}
                <div className="relative h-32 bg-gradient-to-br from-blue-400 via-indigo-500 to-purple-600">
                  {lead.image_url && (
                    <LazyImage
                      src={getOptimizedImageUrl(lead.image_url, 'thumbnail')}
                      alt={lead.name}
                      className="absolute inset-0 w-full h-full object-cover opacity-30 cursor-zoom-in"
                      onClick={(e) => {
                        e.stopPropagation();
                        const full = getOptimizedImageUrl(lead.image_url, 'original') || lead.image_url;
                        if (full) setLightboxUrl(full);
                      }}
                    />
                  )}
                  <div className="absolute top-3 right-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(getDisplayStatus(lead))}`}>
                      {getDisplayStatus(lead)}
                    </span>
                  </div>
                  <div className="absolute bottom-3 left-3 flex items-center space-x-3">
                    {lead.image_url ? (
                      <LazyImage
                        src={getOptimizedImageUrl(lead.image_url, 'thumbnail')}
                        alt={lead.name}
                        className="w-12 h-12 rounded-full border-2 border-white shadow-lg object-cover cursor-zoom-in"
                        onClick={(e) => {
                          e.stopPropagation();
                          const full = getOptimizedImageUrl(lead.image_url, 'original') || lead.image_url;
                          if (full) setLightboxUrl(full);
                        }}
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center border-2 border-white shadow-lg">
                        <FiUser className="h-6 w-6 text-gray-600" />
                      </div>
                    )}
                    <div className="text-white">
                      <h3 className="font-bold text-lg">{lead.name}</h3>
                    </div>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 space-y-3">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center text-gray-600">
                      <FiPhone className="h-4 w-4 mr-2 text-gray-400" />
                      <span>{lead.phone || 'No phone'}</span>
                    </div>
                    {lead.email && (
                      <div className="flex items-center text-gray-600">
                        <FiMail className="h-4 w-4 mr-2 text-gray-400" />
                        <span className="truncate">{lead.email}</span>
                      </div>
                    )}
                    <div className="flex items-center text-gray-600">
                      <FiMapPin className="h-4 w-4 mr-2 text-gray-400" />
                      <span>{lead.postcode || 'No postcode'}</span>
                    </div>
                    {lead.date_booked && (
                      <div className="flex items-center text-gray-600">
                        <FiCalendar className="h-4 w-4 mr-2 text-gray-400" />
                        <span>{formatDate(lead.date_booked)}</span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={(e) => handleBookLead(lead, e)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Book Appointment"
                      >
                        <FiCalendar className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectLead(lead.id);
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <FiCheck className="h-4 w-4" />
                      </button>
                    </div>
                    <button className="text-gray-400 hover:text-blue-600 transition-colors">
                      <FiChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Modern Table View */
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            {/* Mobile-responsive scroll container */}
            <div className="overflow-x-auto">
              <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                <tr>
                  <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-4 text-left">
                    <input
                      type="checkbox"
                      checked={selectedLeads.length === leads.length && leads.length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4 sm:w-5 sm:h-5 rounded text-blue-600 cursor-pointer"
                    />
                  </th>
                  <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">Lead</th>
                  <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider hidden sm:table-cell">Contact</th>
                  <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider hidden lg:table-cell">Assigned</th>
                  <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                  <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider hidden md:table-cell">Date Booked</th>
                  <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-4 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leads.map((lead) => (
                  <tr
                    key={lead.id}
                    onClick={() => handleRowClick(lead)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-4">
                      <input
                        type="checkbox"
                        checked={selectedLeads.includes(lead.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleSelectLead(lead.id);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 sm:w-5 sm:h-5 rounded text-blue-600 cursor-pointer"
                      />
                    </td>
                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-4">
                      <div className="flex items-center space-x-2 sm:space-x-3">
                        {lead.image_url ? (
                          <LazyImage
                            src={getOptimizedImageUrl(lead.image_url, 'thumbnail')}
                            alt={lead.name}
                            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover cursor-zoom-in flex-shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              const full = getOptimizedImageUrl(lead.image_url, 'original') || lead.image_url;
                              if (full) setLightboxUrl(full);
                            }}
                          />
                        ) : (
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                            <FiUser className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 text-xs sm:text-sm truncate max-w-[80px] sm:max-w-[120px] lg:max-w-none">{lead.name}</div>
                          <div className="text-[10px] sm:text-sm text-gray-500">{lead.postcode}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-4 hidden sm:table-cell">
                      <div className="text-xs sm:text-sm">
                        <div className="text-gray-900">{lead.phone}</div>
                        {lead.email && (
                          <div className="text-gray-500 truncate max-w-[120px] lg:max-w-none">{lead.email}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-4 hidden lg:table-cell">
                      <div className="text-xs sm:text-sm text-purple-600 font-medium">
                        {lead.booker ? `${lead.booker.name}` : 'Not assigned'}
                      </div>
                    </td>
                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-4">
                      <span className={`px-1.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold border whitespace-nowrap ${getStatusColor(getDisplayStatus(lead))}`}>
                        {getDisplayStatus(lead)}
                      </span>
                    </td>
                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-4 text-xs sm:text-sm text-gray-900 hidden md:table-cell">
                      {formatDate(lead.date_booked)}
                    </td>
                    <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-4">
                      <div className="flex items-center space-x-0.5 sm:space-x-2">
                        <button
                          onClick={(e) => handleBookLead(lead, e)}
                          className="p-1.5 sm:p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Book Appointment"
                        >
                          <FiCalendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowClick(lead);
                          }}
                          className="p-1.5 sm:p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <FiEye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {/* Empty State */}
        {leads.length === 0 && !loading && (
          <div className="text-center py-20">
            <div className="text-gray-400 mb-4">
              <FiUser className="h-16 w-16 mx-auto" />
            </div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No leads found</h3>
            <p className="text-gray-500">Try adjusting your search or filters</p>
          </div>
        )}

        {/* Modern Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center space-x-2">
            <button
              onClick={() => {
                const newPage = Math.max(1, currentPage - 1);
                console.log('🔵 [Pagination] Previous clicked:', { currentPage, newPage, statusFilter });
                setCurrentPage(newPage);
              }}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              Previous
            </button>
            
            <div className="flex items-center space-x-1">
              {[...Array(Math.min(5, totalPages))].map((_, idx) => {
                const pageNum = currentPage <= 3 
                  ? idx + 1 
                  : currentPage >= totalPages - 2 
                    ? totalPages - 4 + idx 
                    : currentPage - 2 + idx;
                    
                if (pageNum < 1 || pageNum > totalPages) return null;
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => {
                      console.log('🔵 [Pagination] Page number clicked:', { pageNum, currentPage, statusFilter });
                      setCurrentPage(pageNum);
                    }}
                    className={`w-10 h-10 rounded-xl font-medium transition-all duration-200 ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            
            <button
              onClick={() => {
                const newPage = Math.min(totalPages, currentPage + 1);
                console.log('🔵 [Pagination] Next clicked:', { currentPage, newPage, totalPages, statusFilter });
                setCurrentPage(newPage);
              }}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Add Lead Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" style={{ pointerEvents: 'auto' }}>
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Add New Lead</h3>
              <form onSubmit={handleAddLead} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={newLead.name}
                    onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={newLead.phone}
                    onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={newLead.email}
                    onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Postcode
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={newLead.postcode}
                    onChange={(e) => setNewLead({ ...newLead, postcode: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={newLead.status}
                    onChange={(e) => setNewLead({ ...newLead, status: e.target.value })}
                  >
                    <option value="New">New</option>
                    <option value="Booked">Booked</option>
                    <option value="Attended">Attended</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Image URL
                  </label>
                  <input
                    type="text"
                    placeholder="https://example.com/image.jpg"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={newLead.image_url}
                    onChange={(e) => setNewLead({ ...newLead, image_url: e.target.value })}
                  />
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Add Lead
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Upload CSV Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" style={{ pointerEvents: 'auto' }}>
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Upload Leads</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select CSV or Excel file
                  </label>
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileUpload}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {uploadFile && (
                    <p className="text-sm text-gray-600 mt-1">
                      Selected: {uploadFile.name}
                    </p>
                  )}
                </div>

                <div className="bg-blue-50 p-3 rounded-md">
                  <h4 className="text-sm font-medium text-blue-900 mb-2">Smart Upload Features:</h4>
                  <div className="text-xs text-blue-800">
                    <p>🚀 <strong>Auto-processing:</strong> Well-labeled files go straight to analysis</p>
                    <p>🎯 <strong>Smart mapping:</strong> Columns auto-detected based on names</p>
                    <p>🚫 <strong>Skip unwanted:</strong> Empty columns auto-skipped, others can be skipped manually</p>
                    <p className="mt-2 text-green-700">
                      ✅ <strong>Any format works!</strong> Upload and we'll help you map the columns.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUploadModal(false);
                      setUploadFile(null);
                      setUploadProgress(0);
                      setUploadStatus('');
                    }}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUploadSubmit}
                    disabled={!uploadFile || uploadStatus === 'Uploading...'}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploadStatus === 'Uploading...' ? 'Uploading...' : 'Upload'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Beautiful Loading Modal */}
      {uploadStatus && uploadStatus.trim() !== '' && (uploadStatus.includes('Analyzing') || uploadStatus.includes('Processing') || uploadStatus.includes('Uploading') || uploadStatus.includes('Auto-processing') || uploadStatus.includes('Complete')) && (
        <div className="fixed inset-0 bg-black bg-opacity-75 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative mx-auto p-8 border w-full max-w-md shadow-2xl rounded-2xl bg-white transform transition-all duration-300">
            <div className="text-center">
              {/* Animated Icon */}
              <div className="mb-6">
                {uploadStatus.includes('Complete') ? (
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full">
                    <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : (
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full animate-pulse">
                    <svg className="w-8 h-8 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Title */}
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {uploadStatus.includes('Complete') ? 'Upload Complete!' :
                 uploadStatus.includes('Analyzing') ? 'Analyzing File' :
                 uploadStatus.includes('Processing') ? 'Processing Leads' :
                 uploadStatus.includes('Auto-processing') ? 'Auto-Processing' : 'Uploading File'}
              </h3>

              {/* Description */}
              <p className="text-gray-600 mb-6">
                {uploadStatus.includes('Complete') ? 'Your leads have been successfully processed and are ready for review.' :
                 uploadStatus.includes('Analyzing') ? 'Detecting columns and mapping data...' :
                 uploadStatus.includes('Processing') ? 'Importing leads and checking for duplicates...' :
                 uploadStatus.includes('Auto-processing') ? 'Smart processing in progress...' : 'Please wait while we upload your file...'}
              </p>

              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                <div
                  className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-300"
                  style={{
                    width: `${uploadProgress}%`,
                    animation: uploadProgress > 0 ? 'shimmer 2s ease-in-out infinite' : 'none'
                  }}
                >
                  <div className="h-full bg-white opacity-30 rounded-full animate-pulse"></div>
                </div>
              </div>

              {/* Progress Text */}
              <div className="text-sm text-gray-500 mb-4">
                <span>{uploadProgress}%</span>
              </div>

              {/* Additional Info */}
              {uploadStatus.includes('Analyzing') && (
                <div className="bg-blue-50 p-3 rounded-lg mb-4">
                  <p className="text-sm text-blue-800">🔍 Detecting column headers and data types...</p>
                </div>
              )}
              {uploadStatus.includes('Processing') && (
                <div className="bg-green-50 p-3 rounded-lg mb-4">
                  <p className="text-sm text-green-800">⚡ Importing leads and checking for duplicates...</p>
                </div>
              )}
              {uploadStatus.includes('Auto-processing') && (
                <div className="bg-purple-50 p-3 rounded-lg mb-4">
                  <p className="text-sm text-purple-800">🤖 Smart processing with AI assistance...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" style={{ pointerEvents: 'auto' }}>
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
                <FiTrash2 className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 text-center mb-2">Delete Selected Leads</h3>
              <p className="text-sm text-gray-500 text-center mb-6">
                Are you sure you want to delete <strong>{selectedLeads.length}</strong> selected leads? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowBulkDeleteModal(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                >
                  Delete {selectedLeads.length} Leads
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sales Ape Queue Modal */}
      {showSalesApeModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" style={{ pointerEvents: 'auto' }}>
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-center w-16 h-16 mx-auto bg-orange-100 rounded-full mb-4">
                <span className="text-3xl">🦍</span>
              </div>
              <h3 className="text-lg font-medium text-gray-900 text-center mb-2">Send to Sales Ape</h3>
              <p className="text-sm text-gray-500 text-center mb-6">
                Send <strong>{selectedLeads.length}</strong> selected leads to the Sales Ape AI queue for automated outreach.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowSalesApeModal(false)}
                  disabled={sendingToSalesApe}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendToSalesApe}
                  disabled={sendingToSalesApe}
                  className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-md hover:from-orange-600 hover:to-amber-600 transition-colors disabled:opacity-50 flex items-center space-x-2"
                >
                  {sendingToSalesApe ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <span>🦍</span>
                      <span>Send {selectedLeads.length} Leads</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Assign Modal */}
      {showBulkAssignModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" style={{ pointerEvents: 'auto' }}>
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-purple-100 rounded-full mb-4">
                <FiUserPlus className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 text-center mb-2">Assign Selected Leads</h3>
              <p className="text-sm text-gray-500 text-center mb-6">
                Assign <strong>{selectedLeads.length}</strong> selected leads to a team member.
              </p>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Team Member
                </label>
                <select
                  value={selectedBooker}
                  onChange={(e) => setSelectedBooker(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="">Choose a team member...</option>
                  {salesTeam.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} ({member.leads_assigned || 0} leads assigned)
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowBulkAssignModal(false);
                    setSelectedBooker('');
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkAssign}
                  disabled={!selectedBooker}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Assign {selectedLeads.length} Leads
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Duplicate Checking Modal */}
      {showDuplicateModal && duplicateAnalysis && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" style={{ pointerEvents: 'auto' }}>
          <div className="relative top-10 mx-auto p-5 border w-4/5 max-w-6xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-yellow-100 rounded-full mb-4">
                <FiActivity className="h-6 w-6 text-yellow-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 text-center mb-2">Duplicate Check Results</h3>
              <p className="text-sm text-gray-500 text-center mb-6">
                Found {duplicateAnalysis.analysis.report.length} potential issues with your leads.
              </p>
              
              <div className="max-h-96 overflow-y-auto mb-6">
                <div className="space-y-2">
                  {duplicateAnalysis.analysis.report.map((item, index) => (
                    <div key={index} className={`p-3 rounded-lg border ${
                      item.duplicateOf ? 'bg-red-50 border-red-200' : 
                      item.farFlag ? 'bg-yellow-50 border-yellow-200' : 
                      'bg-gray-50 border-gray-200'
                    }`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-sm">
                            Row {item.row}: {item.lead?.name || 'Unknown'}
                          </div>
                          <div className="text-xs text-gray-600 mt-1">
                            {item.duplicateOf && `Duplicate of: ${item.duplicateOf}`}
                            {item.farFlag && `Distance: ${item.distanceMiles?.toFixed(1)} miles`}
                            {item.reason && ` (${item.reason})`}
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          item.duplicateOf ? 'bg-red-100 text-red-800' :
                          item.farFlag ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {item.duplicateOf ? 'Duplicate' : 
                           item.farFlag ? 'Far Away' : 'Issue'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowDuplicateModal(false);
                    setDuplicateAnalysis(null);
                    setUploadFile(null);
                    setUploadStatus('');
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                >
                  Cancel Import
                </button>
                <button
                  onClick={() => handleDuplicateAction('import_unique')}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors"
                >
                  Import Unique Only ({duplicateAnalysis.processedLeads.length - duplicateAnalysis.analysis.report.filter(a => a.duplicateOf).length} leads)
                </button>
                <button
                  onClick={() => handleDuplicateAction('import_all')}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                  Import All ({duplicateAnalysis.processedLeads.length} leads)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lead Analysis Modal */}
      <LeadAnalysisModal
        isOpen={showLeadAnalysisModal}
        onClose={handleCloseAnalysisModal}
        report={analysisReport}
        distanceStats={distanceStats}
        processedLeads={duplicateAnalysis?.processedLeads}
        onAcceptAll={handleAcceptAll}
        onDiscardDuplicates={handleDiscardDuplicates}
        onExportCSV={handleExportCSV}
        onSaveValidLeads={handleSaveValidLeads}
        isImporting={isImporting}
      />

      {/* Bulk Communication Modal */}
      <BulkCommunicationModal
        isOpen={showBulkCommunicationModal}
        onClose={() => setShowBulkCommunicationModal(false)}
        selectedLeads={selectedLeads}
        onSuccess={() => {
          setSelectedLeads([]);
          fetchLeads();
        }}
      />

      {/* Image Lightbox */}
      <ImageLightbox src={lightboxUrl} onClose={() => setLightboxUrl(null)} />
    </div>
  );
};

export default LeadsNew;
