import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { createPortal } from 'react-dom';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Play,
  Image as ImageIcon,
  Maximize2,
  ExternalLink,
  Download
} from "lucide-react";
import { gameMediaService, GameMedia, GameScreenshot, GameVideo } from "@/services/gameMediaService";

interface GameMediaGalleryProps {
  gameName: string;
  platform?: string;
  existingMedia?: {
    screenshot_url?: string;
    cover_url?: string;
    logo_url?: string;
    video_url?: string;
  };
  className?: string;
}

interface MediaLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  media: (GameScreenshot | GameVideo)[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
}

const MediaLightbox: React.FC<MediaLightboxProps> = ({
  isOpen,
  onClose,
  media,
  currentIndex,
  onIndexChange
}) => {
  const currentItem = media[currentIndex];

  const nextItem = () => {
    onIndexChange((currentIndex + 1) % media.length);
  };

  const prevItem = () => {
    onIndexChange((currentIndex - 1 + media.length) % media.length);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') nextItem();
    if (e.key === 'ArrowLeft') prevItem();
    if (e.key === 'Escape') onClose();
  };

  // Focus the lightbox when it opens and manage body scroll
  React.useEffect(() => {
    if (isOpen) {
      const handleEscapeKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };

      const handleArrowKeys = (e: KeyboardEvent) => {
        if (e.key === 'ArrowRight') nextItem();
        if (e.key === 'ArrowLeft') prevItem();
      };

      // Prevent body scroll
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleEscapeKey);
      document.addEventListener('keydown', handleArrowKeys);

      return () => {
        document.body.style.overflow = '';
        document.removeEventListener('keydown', handleEscapeKey);
        document.removeEventListener('keydown', handleArrowKeys);
      };
    }
  }, [isOpen, onClose, currentIndex, media.length]);

  if (!currentItem || !isOpen) return null;

  const isVideo = 'type' in currentItem;

  return createPortal(
    <div
      className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center"
      style={{ zIndex: 1000 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="relative w-full h-full flex items-center justify-center">
        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 z-10 text-white hover:bg-white hover:bg-opacity-20"
          onClick={onClose}
        >
          <X className="w-6 h-6" />
        </Button>

        {/* Navigation buttons */}
        {media.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white hover:bg-opacity-20"
              onClick={prevItem}
            >
              <ChevronLeft className="w-8 h-8" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white hover:bg-opacity-20"
              onClick={nextItem}
            >
              <ChevronRight className="w-8 h-8" />
            </Button>
          </>
        )}

        {/* Main content */}
        <div className="relative w-full h-full flex items-center justify-center p-4">
          {isVideo ? (
            <div className="w-full max-w-[90vw] max-h-[85vh] flex items-center justify-center">
              {currentItem.embedId ? (
                <iframe
                  src={'https://www.youtube.com/embed/' + currentItem.embedId + '?autoplay=1&rel=0'}
                  className="w-full h-full aspect-video rounded-lg"
                  style={{ minHeight: '60vh', maxHeight: '85vh' }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : (
                <video
                  src={currentItem.url}
                  controls
                  autoPlay
                  muted
                  className="w-full h-full max-h-[85vh] rounded-lg object-contain"
                />
              )}
            </div>
          ) : (
            <div className="w-full max-w-[90vw] max-h-[85vh] flex items-center justify-center">
              <img
                src={currentItem.url}
                alt={`Screenshot ${currentIndex + 1}`}
                className="w-full h-full max-w-full max-h-[85vh] object-contain rounded-lg"
              />
            </div>
          )}

          {/* Media info overlay */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black bg-opacity-60 text-white text-sm px-4 py-2 rounded-full flex items-center gap-2">
            {isVideo ? <Play className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
            <span>{currentIndex + 1} / {media.length}</span>
            {currentItem.source && (
              <Badge variant="secondary" className="text-xs">
                {currentItem.source}
              </Badge>
            )}
          </div>

          {/* Source and actions */}
          <div className="absolute top-4 left-4 flex items-center gap-2">
            {currentItem.source && (
              <Badge className="bg-black bg-opacity-60 text-white border-white border-opacity-20">
                {currentItem.source.toUpperCase()}
              </Badge>
            )}
            {isVideo && currentItem.title && (
              <Badge variant="outline" className="bg-black bg-opacity-60 text-white border-white border-opacity-20">
                {currentItem.title}
              </Badge>
            )}
          </div>
        </div>

        {/* Thumbnail strip */}
        {media.length > 1 && (
          <div className="absolute bottom-4 left-4 right-4">
            <div className="flex justify-center">
              <div className="flex gap-2 bg-black bg-opacity-60 p-2 rounded-lg max-w-full overflow-x-auto">
                {media.slice(0, 10).map((item, index) => {
                  const isCurrentVideo = 'type' in item;
                  return (
                    <button
                      key={index}
                      onClick={() => onIndexChange(index)}
                      className={`flex-shrink-0 w-16 h-10 rounded overflow-hidden border-2 transition-all relative ${
                        index === currentIndex
                          ? 'border-white'
                          : 'border-transparent hover:border-gray-400'
                      }`}
                    >
                      <img
                        src={item.thumbnailUrl || item.url}
                        alt={`Thumbnail ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      {isCurrentVideo && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40">
                          <Play className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
                {media.length > 10 && (
                  <div className="flex-shrink-0 w-16 h-10 rounded border-2 border-dashed border-white border-opacity-30 flex items-center justify-center">
                    <span className="text-xs text-white">+{media.length - 10}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export const GameMediaGallery: React.FC<GameMediaGalleryProps> = ({
  gameName,
  platform,
  existingMedia,
  className = ''
}) => {
  const [gameMedia, setGameMedia] = useState<GameMedia | null>(null);
  const [loading, setLoading] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(true);

  useEffect(() => {
    const fetchMedia = async () => {
      if (!gameName) return;

      setLoading(true);
      try {
        console.log(`🎮 GameMediaGallery: Fetching media for "${gameName}" with existing:`, existingMedia);
        const media = await gameMediaService.getGameMedia(gameName, platform, existingMedia);
        console.log(`📦 GameMediaGallery: Received media for "${gameName}":`, media);
        setGameMedia(media);
      } catch (error) {
        console.error('Error fetching game media:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMedia();
  }, [gameName, platform, existingMedia]);

  // Auto-play slideshow for featured screenshots
  useEffect(() => {
    if (!gameMedia || gameMedia.screenshots.length <= 1 || !autoPlayEnabled) return;

    const interval = setInterval(() => {
      setCurrentSlideIndex((prevIndex) =>
        (prevIndex + 1) % gameMedia.screenshots.length
      );
    }, 4000); // 4 seconds per slide

    return () => clearInterval(interval);
  }, [gameMedia, autoPlayEnabled]);

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
          <span className="text-sm text-muted-foreground">Loading media...</span>
        </div>
      </div>
    );
  }

  if (!gameMedia || gameMedia.totalMediaCount === 0) {
    return (
      <div className={`text-sm text-muted-foreground ${className}`}>
        No additional media available
      </div>
    );
  }

  const allMedia = [...gameMedia.screenshots, ...gameMedia.videos];

  // Mix media for unified display - limit to 4 screenshots and 4 videos max for better balance
  const unifiedMedia = [];
  const videos = gameMedia.videos.slice(0, 4); // Max 4 videos
  const screenshots = gameMedia.screenshots.slice(0, 4); // Max 4 screenshots

  // Add first few screenshots, then sprinkle in videos
  let screenshotIndex = 0;
  let videoIndex = 0;

  // Priority pattern: screenshots first, but prioritize Supabase videos early
  const maxItems = Math.min(8, screenshots.length + videos.length); // Max 8 total items for better preview
  for (let i = 0; i < maxItems; i++) {
    if (i < 3 && screenshotIndex < screenshots.length) {
      // First 3 positions for screenshots
      unifiedMedia.push({ ...screenshots[screenshotIndex], type: 'screenshot' });
      screenshotIndex++;
    } else if (videoIndex < videos.length && (videoIndex === 0 || i % 3 === 0)) {
      // Add videos strategically: first video early (position 3), then every 3rd position
      // Supabase videos will appear first since they're now at videos[0]
      unifiedMedia.push({ ...videos[videoIndex], type: 'video' });
      videoIndex++;
    } else if (screenshotIndex < screenshots.length) {
      // Fill remaining with screenshots
      unifiedMedia.push({ ...screenshots[screenshotIndex], type: 'screenshot' });
      screenshotIndex++;
    } else if (videoIndex < videos.length) {
      // Add remaining videos if screenshots are exhausted
      unifiedMedia.push({ ...videos[videoIndex], type: 'video' });
      videoIndex++;
    }
  }

  const openLightbox = (unifiedIndex: number) => {
    // Map unified index back to allMedia index for lightbox
    const mediaItem = unifiedMedia[unifiedIndex];
    let allMediaIndex = 0;

    if (mediaItem.type === 'video') {
      // Find this video in the original allMedia array
      allMediaIndex = allMedia.findIndex(item =>
        'type' in item && item.id === mediaItem.id
      );
    } else {
      // Find this screenshot in the original allMedia array
      allMediaIndex = allMedia.findIndex(item =>
        !('type' in item) && item.id === mediaItem.id
      );
    }

    setCurrentMediaIndex(allMediaIndex >= 0 ? allMediaIndex : unifiedIndex);
    setLightboxOpen(true);
  };

  const handleSlideChange = (index: number) => {
    setCurrentSlideIndex(index);
    setAutoPlayEnabled(false);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Media Summary */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1">
          <ImageIcon className="w-4 h-4" />
          <span>{gameMedia.screenshots.length} Screenshots</span>
        </div>
        <div className="flex items-center gap-1">
          <Play className="w-4 h-4" />
          <span>{gameMedia.videos.length} Videos</span>
        </div>
        {gameMedia.totalMediaCount > 0 && (
          <Badge variant="secondary" className="text-xs">
            {gameMedia.totalMediaCount} total items
          </Badge>
        )}
      </div>

      {/* Unified Media Grid */}
      {unifiedMedia.length > 0 && (
        <div>
          <h4 className="font-medium mb-3 flex items-center gap-2">
            Media Gallery
            <Badge variant="secondary" className="text-xs">
              {gameMedia.totalMediaCount} items
            </Badge>
          </h4>

          {/* Featured/Hero Media */}
          <div
            className="relative group cursor-pointer rounded-lg overflow-hidden bg-muted mb-4"
            onClick={() => openLightbox(currentSlideIndex)}
          >
            {unifiedMedia[currentSlideIndex]?.type === 'video' ? (
              <div className="w-full min-h-64 max-h-96 relative">
                <img
                  src={unifiedMedia[currentSlideIndex].thumbnailUrl}
                  alt={unifiedMedia[currentSlideIndex].title || `Video ${currentSlideIndex + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black bg-opacity-30 group-hover:bg-opacity-40 transition-colors duration-300 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-white bg-opacity-90 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Play className="w-8 h-8 text-black ml-1" />
                  </div>
                </div>
              </div>
            ) : (
              <img
                src={unifiedMedia[currentSlideIndex]?.url}
                alt={`Featured media ${currentSlideIndex + 1}`}
                className="w-full min-h-64 max-h-96 object-contain bg-gray-900 group-hover:scale-105 transition-all duration-500"
                loading="lazy"
                key={currentSlideIndex}
              />
            )}

            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-black group-hover:bg-opacity-20 transition-colors duration-300 flex items-center justify-center">
              {unifiedMedia[currentSlideIndex]?.type !== 'video' && (
                <Maximize2 className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              )}
            </div>

            <div className="absolute bottom-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
              {unifiedMedia[currentSlideIndex]?.type === 'video' ?
                <Play className="w-3 h-3" /> :
                <ImageIcon className="w-3 h-3" />
              }
              {currentSlideIndex + 1} / {unifiedMedia.length}
            </div>

            <div className="absolute top-2 left-2">
              <Badge className="bg-black bg-opacity-60 text-white border-white border-opacity-20 text-xs">
                {unifiedMedia[currentSlideIndex]?.source?.toUpperCase() || 'UNKNOWN'}
              </Badge>
            </div>

            {/* Slideshow indicators */}
            {unifiedMedia.length > 1 && (
              <div className="absolute bottom-2 left-2 flex gap-1">
                {unifiedMedia.map((_, index) => (
                  <button
                    key={index}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSlideChange(index);
                    }}
                    className={`w-2 h-2 rounded-full transition-all duration-300 hover:scale-125 ${
                      index === currentSlideIndex
                        ? 'bg-white'
                        : 'bg-white bg-opacity-40 hover:bg-opacity-70'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Unified Media Thumbnails */}
          <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
            {unifiedMedia.map((media, index) => {
              const isVideo = media.type === 'video';
              return (
                <div
                  key={`${media.type}-${media.id}-${index}`}
                  className={`relative group cursor-pointer rounded overflow-hidden bg-muted aspect-video border-2 transition-all duration-300 ${
                    currentSlideIndex === index
                      ? 'border-primary ring-2 ring-primary ring-opacity-50'
                      : 'border-transparent hover:border-gray-300'
                  }`}
                  onClick={() => handleSlideChange(index)}
                >
                  <img
                    src={media.thumbnailUrl || media.url}
                    alt={isVideo ? `Video ${index + 1}` : `Screenshot ${index + 1}`}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-black group-hover:bg-opacity-20 transition-colors duration-300" />

                  {/* Video play indicator */}
                  {isVideo && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20">
                      <div className="w-6 h-6 rounded-full bg-white bg-opacity-90 flex items-center justify-center">
                        <Play className="w-3 h-3 text-black ml-0.5" />
                      </div>
                    </div>
                  )}

                  <div className="absolute bottom-1 right-1">
                    <Badge className="bg-black bg-opacity-60 text-white text-xs">
                      {media.source?.[0]?.toUpperCase() || '?'}
                    </Badge>
                  </div>

                  {currentSlideIndex === index && (
                    <div className="absolute top-1 left-1">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Media Lightbox */}
      <MediaLightbox
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        media={allMedia}
        currentIndex={currentMediaIndex}
        onIndexChange={setCurrentMediaIndex}
      />
    </div>
  );
};