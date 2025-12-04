import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import LiveActivityMonitor from '../components/SalesApe/LiveActivityMonitor';
import QueueManager from '../components/SalesApe/QueueManager';
import ConversationViewer from '../components/SalesApe/ConversationViewer';
import PerformanceAnalytics from '../components/SalesApe/PerformanceAnalytics';
import LeadStatusCards from '../components/SalesApe/LeadStatusCards';
import axios from 'axios';
import io from 'socket.io-client';

const SalesApe = () => {
  const [activeView, setActiveView] = useState('dashboard'); // 'dashboard' or 'cards'
  const [selectedLead, setSelectedLead] = useState(null);
  const [queueData, setQueueData] = useState([]);
  const [activityData, setActivityData] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [conversationData, setConversationData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);

  // Initialize WebSocket connection
  useEffect(() => {
    const newSocket = io(process.env.REACT_APP_API_URL || 'http://localhost:5000', {
      auth: {
        token: localStorage.getItem('token')
      }
    });

    newSocket.on('connect', () => {
      console.log('🔌 Connected to SalesApe real-time updates');
    });

    // Listen for SalesApe updates
    newSocket.on('salesape_status_update', (data) => {
      console.log('📥 SalesApe status update:', data);
      // Refresh everything to show latest progress
      fetchActivityData();
      fetchQueueData();
      // If this is the selected lead, refresh conversation
      if (selectedLead && data.leadId === selectedLead.id) {
        fetchConversation(selectedLead.id);
      }
    });

    newSocket.on('salesape_message', (data) => {
      console.log('💬 New SalesApe message:', data);
      // Refresh queue to show progress updates
      fetchQueueData();
      // Refresh activity stats
      fetchActivityData();
      // If this is the selected lead, refresh conversation
      if (selectedLead && data.leadId === selectedLead.id) {
        fetchConversation(selectedLead.id);
      }
    });

    newSocket.on('salesape_queue_update', (data) => {
      console.log('📋 Queue update received:', data);
      // Immediately refresh queue when a lead is added/removed/updated
      fetchQueueData();
      // Also refresh activity data to update stats
      fetchActivityData();
      
      // If this is a status update for the selected lead, refresh conversation
      if (selectedLead && data.leadId === selectedLead.id && data.action === 'updated') {
        fetchConversation(selectedLead.id);
      }
      
      // Also refresh after a short delay to ensure database has updated
      setTimeout(() => {
        console.log('🔄 Refreshing queue again after delay...');
        fetchQueueData();
        fetchActivityData();
      }, 500);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [selectedLead]);

  // Fetch initial data
  useEffect(() => {
    fetchAllData();
    
    // Auto-refresh every 5 seconds to catch real-time progress updates
    const interval = setInterval(() => {
      fetchQueueData();
      fetchActivityData();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const fetchAllData = async () => {
    try {
      await Promise.all([
        fetchActivityData(),
        fetchQueueData(),
        fetchAnalyticsData()
      ]);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching SalesApe data:', error);
      setLoading(false);
    }
  };

  const fetchActivityData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/salesape-dashboard/status', {
        headers: { 'x-auth-token': token }
      });
      setActivityData(response.data);
    } catch (error) {
      console.error('Error fetching activity data:', error);
    }
  };

  const fetchQueueData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/salesape-dashboard/queue', {
        headers: { 'x-auth-token': token }
      });
      console.log(`📋 Queue data fetched: ${response.data?.length || 0} leads`);
      setQueueData(response.data || []);
    } catch (error) {
      console.error('Error fetching queue data:', error);
      setQueueData([]);
    }
  };

  const fetchAnalyticsData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/salesape-dashboard/analytics', {
        headers: { 'x-auth-token': token }
      });
      setAnalyticsData(response.data);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    }
  };

  const fetchConversation = async (leadId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/salesape-dashboard/conversation/${leadId}`, {
        headers: { 'x-auth-token': token }
      });
      setConversationData(response.data);
    } catch (error) {
      console.error('Error fetching conversation:', error);
    }
  };

  const handleLeadSelect = (lead) => {
    setSelectedLead(lead);
    fetchConversation(lead.id);
  };

  const handleAddToQueue = async (leadId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/salesape-dashboard/queue/add', 
        { leadId },
        { headers: { 'x-auth-token': token } }
      );
      fetchQueueData();
    } catch (error) {
      console.error('Error adding to queue:', error);
      alert('Failed to add lead to queue');
    }
  };

  const handleRemoveFromQueue = async (leadId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/salesape-dashboard/queue/remove',
        { leadId },
        { headers: { 'x-auth-token': token } }
      );

      console.log('✅ Remove response:', response.data);

      // ✅ FIX: Force refresh and show success
      await fetchQueueData();
      alert('✅ Lead removed from queue successfully');

      // If this was the selected lead, clear selection
      if (selectedLead?.id === leadId) {
        setSelectedLead(null);
        setConversationData(null);
      }
    } catch (error) {
      console.error('❌ Error removing from queue:', error);
      alert(`Failed to remove lead: ${error.response?.data?.message || error.message}`);
    }
  };

  // ✅ NEW: Bulk remove all from queue
  const handleRemoveAllFromQueue = async () => {
    if (!window.confirm(`Remove ALL ${queueData.length} leads from queue? This will stop all SalesApe conversations.`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      let successCount = 0;
      let failCount = 0;

      // Remove all leads one by one
      for (const lead of queueData) {
        try {
          await axios.post('/api/salesape-dashboard/queue/remove',
            { leadId: lead.id },
            { headers: { 'x-auth-token': token } }
          );
          successCount++;
        } catch (error) {
          console.error(`Failed to remove lead ${lead.id}:`, error);
          failCount++;
        }
      }

      // Refresh queue
      await fetchQueueData();
      setSelectedLead(null);
      setConversationData(null);

      alert(`✅ Removed ${successCount} leads from queue${failCount > 0 ? `\n⚠️ ${failCount} failed to remove` : ''}`);
    } catch (error) {
      console.error('Error bulk removing from queue:', error);
      alert('Failed to remove all leads from queue');
    }
  };

  const handlePauseQueue = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/salesape-dashboard/queue/pause', 
        {},
        { headers: { 'x-auth-token': token } }
      );
      fetchActivityData();
    } catch (error) {
      console.error('Error pausing queue:', error);
      alert('Failed to pause queue');
    }
  };

  const handleResumeQueue = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/salesape-dashboard/queue/resume', 
        {},
        { headers: { 'x-auth-token': token } }
      );
      fetchActivityData();
    } catch (error) {
      console.error('Error resuming queue:', error);
      alert('Failed to resume queue');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading SalesApe Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <span className="text-4xl mr-3">🤖</span>
              SalesApe AI Dashboard
            </h1>
            <p className="text-gray-600 mt-1">
              Monitor AI engagement, conversations, and performance in real-time
            </p>
          </div>
          
          {/* View Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveView('dashboard')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeView === 'dashboard'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              📊 Dashboard View
            </button>
            <button
              onClick={() => setActiveView('cards')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeView === 'cards'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              🎴 Card View
            </button>
          </div>
        </div>
      </div>

      {/* Dashboard View */}
      {activeView === 'dashboard' ? (
        <div className="space-y-6">
          {/* Live Activity Monitor */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <LiveActivityMonitor 
              data={activityData}
              onPause={handlePauseQueue}
              onResume={handleResumeQueue}
            />
          </motion.div>

          {/* Main Content: Queue + Conversation */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Queue Manager */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="lg:col-span-1"
            >
              <QueueManager
                queue={queueData}
                onLeadSelect={handleLeadSelect}
                selectedLead={selectedLead}
                onAddToQueue={handleAddToQueue}
                onRemoveFromQueue={handleRemoveFromQueue}
                onRemoveAll={handleRemoveAllFromQueue}
                onRefresh={fetchQueueData}
              />
            </motion.div>

            {/* Conversation Viewer */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="lg:col-span-2"
            >
              <ConversationViewer
                lead={selectedLead}
                conversation={conversationData}
                onRefresh={() => selectedLead && fetchConversation(selectedLead.id)}
              />
            </motion.div>
          </div>

          {/* Performance Analytics */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
          >
            <PerformanceAnalytics data={analyticsData} />
          </motion.div>
        </div>
      ) : (
        /* Card View */
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <LeadStatusCards
            leads={queueData}
            onLeadSelect={handleLeadSelect}
            onRemoveFromQueue={handleRemoveFromQueue}
            onRemoveAll={handleRemoveAllFromQueue}
          />
        </motion.div>
      )}
    </div>
  );
};

export default SalesApe;


