import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FiX, FiChevronLeft, FiChevronRight, FiPlay, FiPause,
  FiCheck, FiPlus, FiShoppingBag, FiImage, FiCheckSquare, FiSquare,
  FiMaximize, FiMinimize, FiLoader
} from 'react-icons/fi';
import { getCloudinaryUrl, getBlurPlaceholder } from '../utils/imageUtils';
import OptimizedImage from './OptimizedImage';
import axios from 'axios';

/**
 * PresentationGallery - Fullscreen slideshow for presenting photos to clients
 * Features smooth crossfade transitions, auto-play, and photo selection
 * Fetches ALL photos for the lead when opened (independent of parent's pagination)
 */
const PresentationGallery = ({
  isOpen,
  onClose,
  photos: initialPhotos = [], // Used as initial data while fetching all
  leadId,
  leadName,
  onProceedToPackage,
  initialSelectedIds = [],
  imageLimit = null, // null = unlimited, number = max allowed
  selectionMode = false // true when selecting after package chosen
}) => {
  // State
  const [photos, setPhotos] = useState(initialPhotos); // Local photos state - will be replaced with ALL photos
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [previousIndex, setPreviousIndex] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set(initialSelectedIds));
  const [isPlaying, setIsPlaying] = useState(true);
  const [playInterval] = useState(4000); // 4 seconds per photo
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isImmersive, setIsImmersive] = useState(false); // Hide UI for fullscreen view
  const [isFullscreen, setIsFullscreen] = useState(false); // Browser native fullscreen

  // Refs
  const thumbnailContainerRef = useRef(null);
  const autoPlayRef = useRef(null);
  const galleryContainerRef = useRef(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
      setPreviousIndex(null);
      setSelectedIds(new Set(initialSelectedIds));
      setIsPlaying(true);
      setImageLoaded(false);
      setIsImmersive(false);
      // Use initial photos immediately while we fetch all
      setPhotos(initialPhotos);
    }
  }, [isOpen, initialSelectedIds, initialPhotos]);

  // Fetch ALL photos for the lead when gallery opens (independent fetch)
  useEffect(() => {
    const fetchAllPhotos = async () => {
      if (!isOpen || !leadId) return;

      setIsLoadingPhotos(true);
      try {
        // Fetch ALL photos (limit 500 is server max)
        const response = await axios.get('/api/photos', {
          params: {
            leadId,
            limit: 500, // Fetch all photos for the gallery
            fields: 'minimal'
          }
        });

        if (response.data.success && response.data.photos) {
          const allPhotos = response.data.photos;
          console.log(`📸 Gallery: Fetched ${allPhotos.length} photos for lead ${leadId}`);
          setPhotos(allPhotos);
        }
      } catch (error) {
        console.error('Error fetching all photos for gallery:', error);
        // Keep using initialPhotos if fetch fails
      } finally {
        setIsLoadingPhotos(false);
      }
    };

    fetchAllPhotos();
  }, [isOpen, leadId]);

  // Select All / Deselect All handler
  const handleSelectAll = () => {
    const allSelected = photos.length > 0 && selectedIds.size === photos.length;
    if (allSelected) {
      // Deselect all
      setSelectedIds(new Set());
    } else {
      // Select all (respecting image limit if set)
      if (imageLimit !== null && photos.length > imageLimit) {
        // Select up to the limit
        const limitedIds = photos.slice(0, imageLimit).map(p => p.id);
        setSelectedIds(new Set(limitedIds));
      } else {
        setSelectedIds(new Set(photos.map(p => p.id)));
      }
    }
  };

  // Check if all photos are selected
  const allSelected = photos.length > 0 && (
    imageLimit !== null
      ? selectedIds.size === imageLimit || selectedIds.size === photos.length
      : selectedIds.size === photos.length
  );

  // Toggle browser native fullscreen
  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        // Enter fullscreen
        if (galleryContainerRef.current) {
          await galleryContainerRef.current.requestFullscreen();
          setIsFullscreen(true);
          setIsImmersive(true); // Also enable immersive mode
        }
      } else {
        // Exit fullscreen
        await document.exitFullscreen();
        setIsFullscreen(false);
        setIsImmersive(false);
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  }, []);

  // Listen for fullscreen changes (e.g., user presses ESC to exit)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isNowFullscreen);
      if (!isNowFullscreen) {
        setIsImmersive(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Exit fullscreen when modal closes
  useEffect(() => {
    if (!isOpen && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, [isOpen]);

  // Preload next image with optimized URL
  const preloadImage = useCallback((index) => {
    if (photos[index]) {
      const img = new Image();
      const imageUrl = photos[index].cloudinary_secure_url || photos[index].cloudinary_url;
      img.src = getCloudinaryUrl(imageUrl, 'large');
    }
  }, [photos]);

  // Navigate to specific photo
  const goToPhoto = useCallback((newIndex) => {
    if (isTransitioning || newIndex === currentIndex || photos.length === 0) return;

    // Wrap around
    const targetIndex = ((newIndex % photos.length) + photos.length) % photos.length;

    setIsTransitioning(true);
    setPreviousIndex(currentIndex);
    setCurrentIndex(targetIndex);
    setImageLoaded(false);

    // Preload next image
    preloadImage((targetIndex + 1) % photos.length);

    // Clear previous after transition
    setTimeout(() => {
      setPreviousIndex(null);
      setIsTransitioning(false);
    }, 800);
  }, [currentIndex, isTransitioning, photos.length, preloadImage]);

  // Next/Previous handlers
  const goToNext = useCallback(() => {
    goToPhoto(currentIndex + 1);
  }, [currentIndex, goToPhoto]);

  const goToPrevious = useCallback(() => {
    goToPhoto(currentIndex - 1);
  }, [currentIndex, goToPhoto]);

  // Auto-play effect
  useEffect(() => {
    if (!isPlaying || !isOpen || photos.length <= 1) {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current);
        autoPlayRef.current = null;
      }
      return;
    }

    autoPlayRef.current = setInterval(() => {
      goToNext();
    }, playInterval);

    return () => {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current);
      }
    };
  }, [isPlaying, isOpen, photos.length, playInterval, goToNext]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      switch (e.key) {
        case 'ArrowLeft':
          goToPrevious();
          setIsPlaying(false);
          break;
        case 'ArrowRight':
          goToNext();
          setIsPlaying(false);
          break;
        case ' ':
          e.preventDefault();
          setIsPlaying(prev => !prev);
          break;
        case 'Escape':
          if (isImmersive) {
            setIsImmersive(false);
          } else {
            onClose();
          }
          break;
        case 'Enter':
          toggleSelection(photos[currentIndex]?.id);
          break;
        case 'f':
        case 'F':
          toggleFullscreen();
          break;
        case 'a':
        case 'A':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleSelectAll();
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, goToNext, goToPrevious, onClose, photos, isImmersive, handleSelectAll, toggleFullscreen]);

  // Scroll thumbnail into view
  useEffect(() => {
    if (thumbnailContainerRef.current && photos.length > 0) {
      const container = thumbnailContainerRef.current;
      const thumbnail = container.children[currentIndex];
      if (thumbnail) {
        thumbnail.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [currentIndex, photos.length]);

  // Toggle photo selection
  const toggleSelection = (photoId) => {
    if (!photoId) return;

    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(photoId)) {
        newSet.delete(photoId);
      } else {
        // Check if we're at the limit
        if (imageLimit !== null && newSet.size >= imageLimit) {
          // At limit, don't add more
          return prev;
        }
        newSet.add(photoId);
      }
      return newSet;
    });
  };

  // Check if at selection limit
  const atLimit = imageLimit !== null && selectedIds.size >= imageLimit;

  // Handle proceed to package
  const handleProceedToPackage = () => {
    const selectedPhotos = photos.filter(p => selectedIds.has(p.id));
    const selectedPhotoIds = Array.from(selectedIds);
    onProceedToPackage(selectedPhotoIds, selectedPhotos);
  };

  if (!isOpen || photos.length === 0) return null;

  const currentPhoto = photos[currentIndex];
  const previousPhoto = previousIndex !== null ? photos[previousIndex] : null;
  const isCurrentSelected = selectedIds.has(currentPhoto?.id);

  return (
    <div ref={galleryContainerRef} className="fixed inset-0 z-50 bg-black">
      {/* Header */}
      <div className={`absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 to-transparent p-4 transition-all duration-300 ${
        isImmersive ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}>
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-4">
            <h2 className="text-white text-xl font-semibold">{leadName}'s Gallery</h2>
            <span className="text-white/60 text-sm">
              {currentIndex + 1} / {photos.length}
            </span>
            {isLoadingPhotos && (
              <span className="text-white/60 text-sm flex items-center space-x-1">
                <FiLoader className="w-4 h-4 animate-spin" />
                <span>Loading all photos...</span>
              </span>
            )}
          </div>

          <div className="flex items-center space-x-3">
            {/* Select All button */}
            <button
              onClick={handleSelectAll}
              className="text-white/80 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors flex items-center space-x-2"
              title={allSelected ? 'Deselect All (Ctrl+A)' : 'Select All (Ctrl+A)'}
            >
              {allSelected ? (
                <>
                  <FiCheckSquare className="w-5 h-5" />
                  <span className="text-sm font-medium">Deselect All</span>
                </>
              ) : (
                <>
                  <FiSquare className="w-5 h-5" />
                  <span className="text-sm font-medium">Select All</span>
                </>
              )}
            </button>

            {/* Image limit indicator - show when in selection mode with limit */}
            {selectionMode && imageLimit !== null && (
              <div className={`px-4 py-2 rounded-full flex items-center space-x-2 ${
                atLimit ? 'bg-green-600 text-white' : 'bg-white/20 text-white'
              }`}>
                <FiImage className="w-4 h-4" />
                <span className="font-medium">
                  {selectedIds.size} / {imageLimit} images
                  {atLimit && ' ✓ Complete'}
                </span>
              </div>
            )}

            {/* Selection counter - show when no limit or not in selection mode */}
            {(!selectionMode || imageLimit === null) && selectedIds.size > 0 && (
              <div className="bg-purple-600 text-white px-4 py-2 rounded-full flex items-center space-x-2">
                <FiImage className="w-4 h-4" />
                <span className="font-medium">
                  {selectedIds.size} selected
                  {imageLimit === null && selectionMode && ' (unlimited)'}
                </span>
              </div>
            )}

            {/* Play/Pause button */}
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isPlaying ? <FiPause className="w-6 h-6" /> : <FiPlay className="w-6 h-6" />}
            </button>

            {/* Fullscreen toggle button */}
            <button
              onClick={toggleFullscreen}
              className="text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
              title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
            >
              {isFullscreen ? <FiMinimize className="w-6 h-6" /> : <FiMaximize className="w-6 h-6" />}
            </button>

            {/* Close button */}
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
              title="Close (Esc)"
            >
              <FiX className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Image Container */}
      <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
        isImmersive ? 'px-4 py-4' : 'px-20 py-24'
      }`}>
        {/* Previous image (fading out) */}
        {previousPhoto && (
          <div className="slideshow-image previous">
            <img
              src={getCloudinaryUrl(previousPhoto.cloudinary_secure_url || previousPhoto.cloudinary_url, 'large')}
              alt=""
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            />
          </div>
        )}

        {/* Current image (fading in) */}
        <div className={`slideshow-image ${imageLoaded ? 'active' : ''}`}>
          {/* Blur placeholder for current image */}
          {!imageLoaded && (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{
                backgroundImage: `url(${getBlurPlaceholder(currentPhoto.cloudinary_secure_url || currentPhoto.cloudinary_url)})`,
                backgroundSize: 'contain',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                filter: 'blur(20px)',
                transform: 'scale(1.1)'
              }}
            />
          )}
          <img
            src={getCloudinaryUrl(currentPhoto.cloudinary_secure_url || currentPhoto.cloudinary_url, 'large')}
            alt={currentPhoto.description || `Photo ${currentIndex + 1}`}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl relative z-10"
            onLoad={() => setImageLoaded(true)}
          />
        </div>

        {/* Selection indicator on image */}
        {isCurrentSelected && (
          <div className={`absolute top-28 right-24 bg-purple-600 text-white p-3 rounded-full shadow-lg animate-pulse transition-all duration-300 ${
            isImmersive ? 'opacity-0' : 'opacity-100'
          }`}>
            <FiCheck className="w-8 h-8" />
          </div>
        )}
      </div>

      {/* Navigation Arrows - always visible, more subtle in fullscreen */}
      <button
        onClick={() => { goToPrevious(); setIsPlaying(false); }}
        className={`absolute left-4 top-1/2 -translate-y-1/2 z-20 text-white p-4 rounded-full transition-all hover:scale-110 ${
          isImmersive
            ? 'bg-white/5 hover:bg-white/20 opacity-50 hover:opacity-100'
            : 'bg-white/10 hover:bg-white/20 opacity-100'
        }`}
        title="Previous (←)"
      >
        <FiChevronLeft className="w-8 h-8" />
      </button>

      <button
        onClick={() => { goToNext(); setIsPlaying(false); }}
        className={`absolute right-4 top-1/2 -translate-y-1/2 z-20 text-white p-4 rounded-full transition-all hover:scale-110 ${
          isImmersive
            ? 'bg-white/5 hover:bg-white/20 opacity-50 hover:opacity-100'
            : 'bg-white/10 hover:bg-white/20 opacity-100'
        }`}
        title="Next (→)"
      >
        <FiChevronRight className="w-8 h-8" />
      </button>

      {/* Selection Button */}
      <div className={`absolute bottom-36 left-1/2 -translate-x-1/2 z-20 transition-all duration-300 ${
        isImmersive ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}>
        <button
          onClick={() => toggleSelection(currentPhoto?.id)}
          disabled={!isCurrentSelected && atLimit}
          className={`flex items-center space-x-3 px-8 py-4 rounded-full text-lg font-semibold transition-all transform shadow-xl ${
            isCurrentSelected
              ? 'bg-purple-600 text-white hover:scale-105'
              : atLimit
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : 'bg-white text-gray-900 hover:bg-purple-50 hover:scale-105'
          }`}
        >
          {isCurrentSelected ? (
            <>
              <FiCheck className="w-6 h-6" />
              <span>Selected</span>
            </>
          ) : atLimit ? (
            <>
              <FiImage className="w-6 h-6" />
              <span>Limit Reached</span>
            </>
          ) : (
            <>
              <FiPlus className="w-6 h-6" />
              <span>Add to Selection</span>
            </>
          )}
        </button>
      </div>

      {/* Thumbnail Strip */}
      <div className={`absolute bottom-0 left-0 right-0 z-20 transition-all duration-300 ${
        isImmersive ? 'opacity-0 pointer-events-none translate-y-full' : 'opacity-100 translate-y-0'
      }`}>
        <div
          ref={thumbnailContainerRef}
          className="thumbnail-strip"
        >
          {photos.map((photo, index) => {
            const imageUrl = photo.cloudinary_secure_url || photo.cloudinary_url;

            return (
              <button
                key={photo.id}
                onClick={() => { goToPhoto(index); setIsPlaying(false); }}
                className={`thumbnail ${index === currentIndex ? 'current' : ''} ${selectedIds.has(photo.id) ? 'selected' : ''}`}
              >
                <OptimizedImage
                  src={imageUrl}
                  alt={`Thumbnail ${index + 1}`}
                  size="thumb"
                  className="w-full h-full object-cover"
                  useBlur={true}
                  threshold={200}
                  onError={(e) => {
                    if (e && e.target && e.target.style) {
                      e.target.style.opacity = '0.3';
                    }
                  }}
                />
                {selectedIds.has(photo.id) && (
                  <div className="absolute top-1 right-1 bg-purple-600 rounded-full p-0.5 z-10">
                    <FiCheck className="w-3 h-3 text-white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Proceed to Package / Confirm Selection Button */}
      {selectedIds.size > 0 && (
        <div className={`absolute bottom-28 right-8 z-20 transition-all duration-300 ${
          isImmersive ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}>
          <button
            onClick={handleProceedToPackage}
            className={`flex items-center space-x-3 text-white px-8 py-4 rounded-full text-lg font-semibold shadow-xl hover:shadow-2xl transition-all transform hover:scale-105 ${
              selectionMode
                ? 'bg-gradient-to-r from-green-600 to-emerald-600'
                : 'bg-gradient-to-r from-purple-600 to-indigo-600'
            }`}
          >
            {selectionMode ? (
              <>
                <FiCheck className="w-6 h-6" />
                <span>Confirm Selection ({selectedIds.size}{imageLimit ? `/${imageLimit}` : ''} photos)</span>
              </>
            ) : (
              <>
                <FiShoppingBag className="w-6 h-6" />
                <span>Select Package ({selectedIds.size} photos)</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Auto-play indicator */}
      {isPlaying && (
        <div className={`absolute bottom-28 left-8 z-20 flex items-center space-x-2 text-white/60 transition-all duration-300 ${
          isImmersive ? 'opacity-0' : 'opacity-100'
        }`}>
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm">Auto-playing</span>
        </div>
      )}

      {/* Fullscreen mode exit hint */}
      {isFullscreen && (
        <div
          className="absolute top-4 right-4 z-30 text-white/40 text-sm cursor-pointer hover:text-white/80 transition-colors"
          onClick={toggleFullscreen}
        >
          Press F or ESC to exit fullscreen
        </div>
      )}
    </div>
  );
};

export default PresentationGallery;
