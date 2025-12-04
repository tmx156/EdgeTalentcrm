import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { getEmailContentPreview } from '../utils/emailContentDecoder';
import {
  FiMessageSquare,
  FiMail,
  FiSearch,
  FiRefreshCw,
  FiSend,
  FiPaperclip,
  FiStar,
  FiClock,
  FiChevronLeft
} from 'react-icons/fi';
import axios from 'axios';

const MessagesNew = () => {
  const { user } = useAuth();
  const { socket } = useSocket();

  // State
  const [activeTab, setActiveTab] = useState('email'); // 'email' or 'sms'
  const [messages, setMessages] = useState([]);
  const [threads, setThreads] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [readMessageIds, setReadMessageIds] = useState(new Set());
  const [localStorageLoaded, setLocalStorageLoaded] = useState(false);

  // Load read message IDs from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('readMessageIds');
      if (stored) {
        const parsedIds = JSON.parse(stored);
        if (Array.isArray(parsedIds)) {
          setReadMessageIds(new Set(parsedIds));
        }
      }
    } catch (error) {
      console.warn('Error loading read message IDs:', error);
    } finally {
      setLocalStorageLoaded(true);
    }
  }, []);

  // Save read message IDs to localStorage
  useEffect(() => {
    if (!localStorageLoaded) return;
    try {
      localStorage.setItem('readMessageIds', JSON.stringify(Array.from(readMessageIds)));
    } catch (error) {
      console.warn('Error saving read message IDs:', error);
    }
  }, [readMessageIds, localStorageLoaded]);

  // Group messages into threads (Gmail-style)
  const groupMessagesIntoThreads = useCallback((messages) => {
    const threadsMap = new Map();

    messages.forEach(message => {
      if (!message.leadId) return;

      let threadKey;
      if (activeTab === 'email' && message.type === 'email') {
        const subject = (message.subject || '').replace(/^(re|fwd?|fw):\s*/i, '').trim().toLowerCase();
        threadKey = `email_${message.leadId}_${subject}`;
      } else if (activeTab === 'sms' && message.type === 'sms') {
        threadKey = `sms_${message.leadId}`;
      } else {
        return; // Skip messages that don't match active tab
      }

      if (!threadsMap.has(threadKey)) {
        threadsMap.set(threadKey, {
          id: threadKey,
          leadId: message.leadId,
          leadName: message.leadName,
          leadEmail: message.leadEmail,
          leadPhone: message.leadPhone,
          subject: message.subject || '',
          messages: [],
          lastMessage: null,
          unreadCount: 0,
          timestamp: null,
          type: activeTab
        });
      }

      const thread = threadsMap.get(threadKey);
      thread.messages.push(message);

      // Update unread count
      if (!readMessageIds.has(message.id) && !message.isRead) {
        thread.unreadCount++;
      }

      // Update last message
      const messageTime = new Date(message.timestamp || message.created_at);
      if (!thread.timestamp || messageTime > thread.timestamp) {
        thread.lastMessage = message;
        thread.timestamp = messageTime;
      }
    });

    // Sort threads by most recent
    return Array.from(threadsMap.values())
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [activeTab, readMessageIds]);

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/messages-list');
      const fetchedMessages = response.data.messages || [];

      // Apply read status
      const messagesWithReadStatus = fetchedMessages.map(msg => ({
        ...msg,
        isRead: readMessageIds.has(msg.id) || msg.read_status === true
      }));

      setMessages(messagesWithReadStatus);
      const groupedThreads = groupMessagesIntoThreads(messagesWithReadStatus);
      setThreads(groupedThreads);
    } catch (error) {
      console.error('Error fetching messages:', error);
      setMessages([]);
      setThreads([]);
    } finally {
      setLoading(false);
    }
  }, [readMessageIds, groupMessagesIntoThreads]);

  // Initial load
  useEffect(() => {
    if (!localStorageLoaded) return;
    fetchMessages();
  }, [localStorageLoaded, fetchMessages]);

  // Re-group threads when tab changes
  useEffect(() => {
    const groupedThreads = groupMessagesIntoThreads(messages);
    setThreads(groupedThreads);
    setSelectedThread(null); // Clear selection when switching tabs
  }, [activeTab, messages, groupMessagesIntoThreads]);

  // Poll every 5 minutes
  useEffect(() => {
    if (!localStorageLoaded) return;
    const interval = setInterval(fetchMessages, 300000);
    return () => clearInterval(interval);
  }, [localStorageLoaded, fetchMessages]);

  // Listen for real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleMessageReceived = (data) => {
      if ((activeTab === 'email' && data.type === 'email') ||
          (activeTab === 'sms' && data.type === 'sms')) {
        fetchMessages();
      }
    };

    socket.on('message_received', handleMessageReceived);
    socket.on('email_received', handleMessageReceived);
    socket.on('sms_received', handleMessageReceived);

    return () => {
      socket.off('message_received', handleMessageReceived);
      socket.off('email_received', handleMessageReceived);
      socket.off('sms_received', handleMessageReceived);
    };
  }, [socket, activeTab, fetchMessages]);

  // Mark thread as read
  const markThreadAsRead = async (thread) => {
    const unreadMessages = thread.messages.filter(m => !readMessageIds.has(m.id));

    for (const message of unreadMessages) {
      try {
        await axios.put(`/api/messages-list/${message.id}/read`);
        setReadMessageIds(prev => new Set([...prev, message.id]));
      } catch (error) {
        console.error('Error marking message as read:', error);
      }
    }
  };

  // Handle thread click
  const handleThreadClick = (thread) => {
    setSelectedThread(thread);
    markThreadAsRead(thread);
    setReplyText('');
  };

  // Handle send reply
  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedThread) return;

    try {
      setSending(true);

      if (activeTab === 'email') {
        // Send email
        await axios.post('/api/messages/send-email', {
          leadId: selectedThread.leadId,
          to: selectedThread.leadEmail,
          subject: selectedThread.subject.startsWith('Re:')
            ? selectedThread.subject
            : `Re: ${selectedThread.subject}`,
          body: replyText
        });
      } else {
        // Send SMS
        await axios.post('/api/messages/send-sms', {
          leadId: selectedThread.leadId,
          to: selectedThread.leadPhone,
          message: replyText
        });
      }

      setReplyText('');
      setTimeout(fetchMessages, 1000);
    } catch (error) {
      console.error('Error sending reply:', error);
      alert('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  // Filter threads by search
  const filteredThreads = threads.filter(thread => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      thread.leadName?.toLowerCase().includes(search) ||
      thread.leadEmail?.toLowerCase().includes(search) ||
      thread.leadPhone?.includes(search) ||
      thread.subject?.toLowerCase().includes(search) ||
      thread.messages?.some(m => m.content?.toLowerCase().includes(search))
    );
  });

  // Format timestamp
  const formatTime = (timestamp) => {
    if (!timestamp) return 'Just now';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const hours = diff / (1000 * 60 * 60);

    if (hours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (hours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  const unreadEmailCount = threads.filter(t => t.type === 'email' && t.unreadCount > 0).length;
  const unreadSmsCount = threads.filter(t => t.type === 'sms' && t.unreadCount > 0).length;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
          <button
            onClick={fetchMessages}
            disabled={loading}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <FiRefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('email')}
              className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center space-x-2 ${
                activeTab === 'email'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FiMail className="h-4 w-4" />
              <span>Emails</span>
              {unreadEmailCount > 0 && (
                <span className="ml-1 px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full">
                  {unreadEmailCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('sms')}
              className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center space-x-2 ${
                activeTab === 'sms'
                  ? 'text-green-600 border-b-2 border-green-600 bg-green-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FiMessageSquare className="h-4 w-4" />
              <span>SMS</span>
              {unreadSmsCount > 0 && (
                <span className="ml-1 px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-800 rounded-full">
                  {unreadSmsCount}
                </span>
              )}
            </button>
          </div>

          {/* Search */}
          <div className="p-3 border-b border-gray-200">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Thread List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="text-gray-400 mb-2">
                  {activeTab === 'email' ? <FiMail className="h-12 w-12 mx-auto" /> : <FiMessageSquare className="h-12 w-12 mx-auto" />}
                </div>
                <p className="text-sm text-gray-500">No {activeTab === 'email' ? 'emails' : 'messages'} found</p>
              </div>
            ) : (
              filteredThreads.map((thread) => (
                <div
                  key={thread.id}
                  onClick={() => handleThreadClick(thread)}
                  className={`px-4 py-3 border-b border-gray-100 cursor-pointer transition-all ${
                    selectedThread?.id === thread.id
                      ? 'bg-blue-50 border-l-4 border-l-blue-600'
                      : thread.unreadCount > 0
                      ? 'bg-blue-50/50 hover:bg-blue-50'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <p className={`text-sm font-medium truncate ${
                      thread.unreadCount > 0 ? 'text-gray-900 font-semibold' : 'text-gray-700'
                    }`}>
                      {thread.leadName}
                    </p>
                    <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                      {formatTime(thread.timestamp)}
                    </span>
                  </div>
                  {activeTab === 'email' && thread.subject && (
                    <p className={`text-xs mb-1 truncate ${
                      thread.unreadCount > 0 ? 'text-gray-900 font-medium' : 'text-gray-600'
                    }`}>
                      {thread.subject}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 truncate">
                    {getEmailContentPreview(thread.lastMessage?.content || '', 60)}
                  </p>
                  {thread.unreadCount > 0 && (
                    <div className="mt-1 flex items-center space-x-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        {thread.unreadCount} unread
                      </span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Panel - Thread View */}
        <div className="flex-1 flex flex-col bg-gray-50">
          {selectedThread ? (
            <>
              {/* Thread Header */}
              <div className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setSelectedThread(null)}
                    className="lg:hidden text-gray-500 hover:text-gray-700"
                  >
                    <FiChevronLeft className="h-5 w-5" />
                  </button>
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold text-gray-900">{selectedThread.leadName}</h2>
                    {activeTab === 'email' ? (
                      <p className="text-sm text-gray-500">{selectedThread.leadEmail}</p>
                    ) : (
                      <p className="text-sm text-gray-500">{selectedThread.leadPhone}</p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button className="p-2 text-gray-400 hover:text-yellow-500 hover:bg-gray-100 rounded-lg">
                      <FiStar className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                {activeTab === 'email' && selectedThread.subject && (
                  <p className="mt-2 text-sm font-medium text-gray-700">Subject: {selectedThread.subject}</p>
                )}
              </div>

              {/* Messages Thread */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {selectedThread.messages
                  .sort((a, b) => new Date(a.timestamp || a.created_at) - new Date(b.timestamp || b.created_at))
                  .map((message, index) => (
                    <div
                      key={message.id || index}
                      className={`rounded-lg shadow-sm border p-4 ${
                        message.direction === 'sent'
                          ? 'bg-blue-50 border-blue-200 ml-12'
                          : 'bg-white border-gray-200 mr-12'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            message.direction === 'sent' ? 'bg-blue-600' : 'bg-gray-600'
                          }`}>
                            <span className="text-white text-sm font-medium">
                              {message.direction === 'sent' ? 'Y' : (message.leadName?.[0] || '?').toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {message.direction === 'sent' ? 'You' : message.leadName}
                            </p>
                            <p className="text-xs text-gray-500">
                              {message.direction === 'sent' ? selectedThread.leadEmail || selectedThread.leadPhone :
                                (activeTab === 'email' ? selectedThread.leadEmail : selectedThread.leadPhone)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 text-xs text-gray-500">
                          <FiClock className="h-3 w-3" />
                          <span>{formatTime(message.timestamp || message.created_at)}</span>
                        </div>
                      </div>
                      <div className="text-sm text-gray-700 whitespace-pre-wrap">
                        {message.content}
                      </div>
                    </div>
                  ))}
              </div>

              {/* Reply Box */}
              <div className="bg-white border-t border-gray-200 px-6 py-4">
                <div className="mb-3">
                  <p className="text-sm text-gray-600 mb-2">
                    Reply to {activeTab === 'email' ? selectedThread.leadEmail : selectedThread.leadPhone}
                  </p>
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={`Type your ${activeTab === 'email' ? 'email' : 'message'} here...`}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {activeTab === 'email' && (
                      <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                        <FiPaperclip className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={handleSendReply}
                    disabled={!replyText.trim() || sending}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Sending...
                      </>
                    ) : (
                      <>
                        <FiSend className="h-4 w-4 mr-2" />
                        Send {activeTab === 'email' ? 'Email' : 'SMS'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                {activeTab === 'email' ? (
                  <FiMail className="h-16 w-16 mx-auto mb-4" />
                ) : (
                  <FiMessageSquare className="h-16 w-16 mx-auto mb-4" />
                )}
                <p className="text-lg font-medium">Select a conversation</p>
                <p className="text-sm mt-1">Choose a {activeTab === 'email' ? 'email thread' : 'conversation'} from the list to view messages</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessagesNew;
