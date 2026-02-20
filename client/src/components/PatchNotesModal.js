import React, { useState, useEffect, createContext, useContext, useCallback, useMemo } from 'react';
import { FiCheckCircle, FiGitCommit, FiInfo, FiChevronDown, FiChevronUp, FiFileText } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import gitVersion from '../version.json';

const SEEN_COMMIT_KEY = 'patchNotesSeenCommit';

export const CURRENT_VERSION = {
  version: gitVersion.version || '1.0.0',
  commitHash: gitVersion.commitHash || 'unknown',
  commitMessage: gitVersion.commitMessage || 'No message',
  commitDate: gitVersion.commitDate || new Date().toISOString(),
  branch: gitVersion.branch || 'unknown',
  author: gitVersion.author || 'Unknown',
};

const PatchNotesContext = createContext({
  isOpen: false,
  openPatchNotes: () => {},
  closePatchNotes: () => {},
  currentVersion: CURRENT_VERSION,
  hasUpdate: false,
});

export const usePatchNotes = () => useContext(PatchNotesContext);

const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// ============================================
// AUTOMATIC UPDATE DETECTION
// 
// HOW IT WORKS:
// 1. When you push to GitHub and deploy, the build runs
// 2. generate-git-version.js captures the NEW commit hash
// 3. version.json is updated with latest commit info
// 4. When admin opens the app, CURRENT_VERSION.commitHash 
//    is compared to localStorage SEEN_COMMIT_KEY
// 5. If different → modal automatically shows!
//
// TO TEST LOCALLY:
// - Clear localStorage: localStorage.removeItem('patchNotesSeenCommit')
// - Refresh page → modal will show
// ============================================

// Real weekly updates from Git - THIS AUTO-UPDATES ON BUILD
const getWeeklyUpdates = () => [
  {
    id: 1,
    date: CURRENT_VERSION.commitDate.split(' ')[0],
    message: CURRENT_VERSION.commitMessage,
    author: CURRENT_VERSION.author,
    hash: CURRENT_VERSION.commitHash,
    isNew: true,
    // Expandable details
    details: `This update includes the latest changes pushed to the ${CURRENT_VERSION.branch} branch. Deployed automatically on build.`,
    filesChanged: ['server/routes/webhooks.js', 'server/index.js'],
    type: 'feature',
  },
  // Previous commits - in production these would come from API/Git
  {
    id: 2,
    date: '2026-02-17',
    message: 'Add 3rd booking slot column to calendar system',
    author: 'Tin',
    hash: '841314b',
    isNew: false,
    details: 'Added a third booking slot option to the calendar for better scheduling flexibility. Includes database migration for new column.',
    filesChanged: ['client/src/components/Calendar.js', 'database/migrations/'],
    type: 'feature',
  },
];

export const PatchNotesProvider = ({ children }) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [hasUpdate, setHasUpdate] = useState(false);
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (!isAdmin) return;
    const seenCommit = localStorage.getItem(SEEN_COMMIT_KEY);
    // Check if current commit is different from last seen
    if (seenCommit !== CURRENT_VERSION.commitHash) {
      setHasUpdate(true);
    }
  }, [isAdmin]);

  const openPatchNotes = useCallback(() => {
    setIsOpen(true);
    setTimeout(() => setIsAnimating(true), 10);
  }, []);

  const closePatchNotes = useCallback(() => {
    setIsAnimating(false);
    setTimeout(() => setIsOpen(false), 300);
  }, []);

  const markAsSeen = useCallback(() => {
    // Save the current commit hash as seen
    localStorage.setItem(SEEN_COMMIT_KEY, CURRENT_VERSION.commitHash);
    setHasUpdate(false);
  }, []);

  const hasSeenCurrentVersion = useCallback(() => {
    const seenCommit = localStorage.getItem(SEEN_COMMIT_KEY);
    return seenCommit === CURRENT_VERSION.commitHash;
  }, []);

  // Auto-show modal on login if new update
  useEffect(() => {
    if (!isAdmin) return;
    if (!hasSeenCurrentVersion()) {
      const timer = setTimeout(() => openPatchNotes(), 800);
      return () => clearTimeout(timer);
    }
  }, [isAdmin, hasSeenCurrentVersion, openPatchNotes]);

  return (
    <PatchNotesContext.Provider value={{
      isOpen, isAnimating, openPatchNotes, closePatchNotes, markAsSeen,
      currentVersion: CURRENT_VERSION, hasUpdate, isAdmin,
    }}>
      {children}
    </PatchNotesContext.Provider>
  );
};

const PatchNotesModalContent = () => {
  const { isOpen, isAnimating, closePatchNotes, markAsSeen, currentVersion } = usePatchNotes();
  const [hasAcknowledged, setHasAcknowledged] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const updates = useMemo(() => getWeeklyUpdates(), []);

  if (!isOpen) return null;

  const handleContinue = () => {
    setHasAcknowledged(true);
    markAsSeen();
    setTimeout(() => {
      closePatchNotes();
      setHasAcknowledged(false);
    }, 300);
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300 ${
      isAnimating ? 'opacity-100' : 'opacity-0 pointer-events-none'
    }`}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xl" />

      <div className={`relative w-full max-w-sm transform transition-all duration-300 ${
        isAnimating ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
      }`}>
        <div className="relative overflow-hidden rounded-3xl bg-white shadow-2xl">
          {/* Header */}
          <div className="px-6 pt-6 pb-4 bg-gradient-to-b from-gray-50 to-white border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <FiGitCommit className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">Updates</h1>
                <p className="text-xs text-gray-500">{currentVersion.branch} • {currentVersion.commitHash}</p>
              </div>
            </div>
          </div>

          {/* Updates */}
          <div className="max-h-[55vh] overflow-y-auto px-4 py-3">
            <div className="space-y-2">
              {updates.map((update) => (
                <div 
                  key={update.id}
                  className={`rounded-xl overflow-hidden transition-all duration-200 ${
                    update.isNew ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50'
                  }`}
                >
                  {/* Main Content - Always visible */}
                  <button
                    onClick={() => toggleExpand(update.id)}
                    className="w-full p-3 text-left"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${update.isNew ? 'bg-blue-500' : 'bg-gray-300'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 leading-snug">
                          {update.message}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
                          <span className="font-mono text-gray-400">{update.hash}</span>
                          <span>•</span>
                          <span>{formatDate(update.date)}</span>
                          {update.isNew && (
                            <span className="ml-auto px-1.5 py-0.5 bg-blue-500 text-white text-[10px] font-medium rounded">
                              New
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mt-1 text-gray-400">
                        {expandedId === update.id ? (
                          <FiChevronUp className="h-4 w-4" />
                        ) : (
                          <FiChevronDown className="h-4 w-4" />
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Expanded Details */}
                  {expandedId === update.id && (
                    <div className="px-3 pb-3 pt-0 border-t border-gray-200/50">
                      <div className="mt-3 space-y-3">
                        {/* Description */}
                        <p className="text-sm text-gray-600 leading-relaxed">
                          {update.details}
                        </p>

                        {/* Files Changed */}
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1">
                            <FiFileText className="h-3 w-3" />
                            Files changed
                          </p>
                          <div className="space-y-1">
                            {update.filesChanged.map((file, idx) => (
                              <div key={idx} className="text-xs font-mono text-gray-600 bg-white/50 px-2 py-1 rounded">
                                {file}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Type Badge */}
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full ${
                            update.type === 'feature' ? 'bg-green-100 text-green-700' :
                            update.type === 'fix' ? 'bg-red-100 text-red-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {update.type}
                          </span>
                          <span className="text-xs text-gray-400">
                            by {update.author}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 bg-white border-t border-gray-100">
            <button
              onClick={handleContinue}
              disabled={hasAcknowledged}
              className={`w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-200 ${
                hasAcknowledged 
                  ? 'bg-gray-100 text-gray-400' 
                  : 'text-white bg-gray-900 hover:bg-gray-800'
              }`}
            >
              {hasAcknowledged ? 'Continuing...' : 'Continue'}
            </button>
            <p className="text-center text-[10px] text-gray-400 mt-2">
              Tap an update to see more details
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const PatchNotesModal = () => {
  const { isAdmin } = usePatchNotes();
  if (!isAdmin) return null;
  return <PatchNotesModalContent />;
};

export const PatchNotesButton = () => {
  const { openPatchNotes, hasUpdate, isAdmin } = usePatchNotes();
  if (!isAdmin) return null;

  return (
    <button
      onClick={openPatchNotes}
      className="fixed bottom-4 right-4 z-40 w-12 h-12 rounded-full bg-gray-900 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 flex items-center justify-center"
      title="View Updates"
    >
      <FiInfo className="h-5 w-5" />
      {hasUpdate && (
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse" />
      )}
    </button>
  );
};

export default PatchNotesModal;
