import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const QueueManager = ({ 
  queue, 
  onLeadSelect, 
  selectedLead, 
  onAddToQueue, 
  onRemoveFromQueue,
  onRefresh 
}) => {
  const [showAddModal, setShowAddModal] = useState(false);

  if (!queue) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="space-y-3">
            <div className="h-12 bg-gray-200 rounded"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  const inProgress = queue.filter(lead => lead.queue_status === 'in_progress');
  const queued = queue.filter(lead => lead.queue_status === 'queued');
  const completed = queue.filter(lead => lead.queue_status === 'completed');

  const getStatusIcon = (status) => {
    switch (status) {
      case 'in_progress': return '🔵';
      case 'queued': return '⏳';
      case 'completed': return '✅';
      case 'failed': return '❌';
      default: return '⚪';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'in_progress': return 'bg-blue-100 border-blue-300';
      case 'queued': return 'bg-gray-100 border-gray-300';
      case 'completed': return 'bg-green-100 border-green-300';
      case 'failed': return 'bg-red-100 border-red-300';
      default: return 'bg-gray-100 border-gray-300';
    }
  };

  const getTimeSince = (timestamp) => {
    if (!timestamp) return 'Just now';
    const seconds = Math.floor((Date.now() - new Date(timestamp)) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const LeadCard = ({ lead }) => (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -10 }}
      whileHover={{ scale: 1.02 }}
      onClick={() => onLeadSelect(lead)}
      className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
        getStatusColor(lead.queue_status)
      } ${selectedLead?.id === lead.id ? 'ring-2 ring-blue-500' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{getStatusIcon(lead.queue_status)}</span>
            <p className="font-semibold text-gray-900 truncate">{lead.name}</p>
          </div>
          <p className="text-sm text-gray-600">
            {lead.salesape_status || 'Queued'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {getTimeSince(lead.salesape_last_updated || lead.created_at)}
          </p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm(`Remove ${lead.name} from queue?`)) {
              onRemoveFromQueue(lead.id);
            }
          }}
          className="text-gray-400 hover:text-red-500 transition-colors"
        >
          ✕
        </button>
      </div>
      
      {/* Progress indicator for in-progress leads */}
      {lead.queue_status === 'in_progress' && (
        <div className="mt-2">
          <div className="flex gap-1">
            <div className={`h-1 flex-1 rounded ${lead.salesape_initial_message_sent ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
            <div className={`h-1 flex-1 rounded ${lead.salesape_user_engaged ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
            <div className={`h-1 flex-1 rounded ${lead.salesape_goal_presented ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
            <div className={`h-1 flex-1 rounded ${lead.salesape_goal_hit ? 'bg-green-500' : 'bg-gray-300'}`}></div>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {lead.salesape_goal_hit ? 'Booked!' : 
             lead.salesape_goal_presented ? 'Goal presented' :
             lead.salesape_user_engaged ? 'User engaged' :
             lead.salesape_initial_message_sent ? 'Message sent' : 'Starting...'}
          </p>
        </div>
      )}
    </motion.div>
  );

  return (
    <div className="bg-white rounded-lg shadow-md p-6 h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          📋 Queue
          <span className="text-sm font-normal text-gray-500">
            ({queue.length} leads)
          </span>
        </h2>
        <button
          onClick={onRefresh}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          title="Refresh"
        >
          🔄
        </button>
      </div>

      {/* Queue Sections */}
      <div className="space-y-4 max-h-[600px] overflow-y-auto">
        {/* In Progress */}
        {inProgress.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <span className="text-blue-500">●</span>
              IN PROGRESS ({inProgress.length})
            </h3>
            <AnimatePresence>
              <div className="space-y-2">
                {inProgress.map(lead => (
                  <LeadCard key={lead.id} lead={lead} />
                ))}
              </div>
            </AnimatePresence>
          </div>
        )}

        {/* Queued */}
        {queued.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <span className="text-gray-500">●</span>
              QUEUED ({queued.length})
            </h3>
            <AnimatePresence>
              <div className="space-y-2">
                {queued.map(lead => (
                  <LeadCard key={lead.id} lead={lead} />
                ))}
              </div>
            </AnimatePresence>
          </div>
        )}

        {/* Completed (show last 5) */}
        {completed.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <span className="text-green-500">●</span>
              COMPLETED ({completed.length})
            </h3>
            <AnimatePresence>
              <div className="space-y-2">
                {completed.slice(0, 5).map(lead => (
                  <LeadCard key={lead.id} lead={lead} />
                ))}
              </div>
            </AnimatePresence>
            {completed.length > 5 && (
              <p className="text-xs text-gray-500 mt-2 text-center">
                ... and {completed.length - 5} more
              </p>
            )}
          </div>
        )}

        {/* Empty State */}
        {queue.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-4">📭</p>
            <p className="text-gray-500">No leads in queue</p>
            <p className="text-sm text-gray-400 mt-2">
              Add leads from the Leads page
            </p>
          </div>
        )}
      </div>

      {/* Add to Queue Button */}
      <div className="mt-4 pt-4 border-t">
        <button
          onClick={() => setShowAddModal(true)}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
        >
          <span>+</span> Add Lead to Queue
        </button>
      </div>
    </div>
  );
};

export default QueueManager;

