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
                  src={'https://www.youtube.com/embed/' + currentItem.embedId + '?autoplay=1'}
                  className="w-full h-full aspect-video rounded-lg"
                  style={{ minHeight: '60vh', maxHeight: '85vh' }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video
                  src={currentItem.url}
                  controls
                  autoPlay
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
        const media = await gameMediaService.getGameMedia(gameName, platform, existingMedia);
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
  const featuredScreenshots = gameMedia.screenshots.slice(0, 6);
  const featuredVideos = gameMedia.videos.slice(0, 3);

  const openLightbox = (index: number) => {
    setCurrentMediaIndex(index);
    setLightboxOpen(true);
  };

  const handleSlideChange = (index: number) => {
    setCurrentSlideIndex(index);
    setAutoPlayEnabled(false); // Disable auto-play when user manually selects
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

      {/* Featured Screenshot */}
      {featuredScreenshots.length > 0 && (
        <div>
          <h4 className="font-medium mb-3 flex items-center gap-2">
            Screenshots
            <Badge variant="secondary" className="text-xs">
              {gameMedia.screenshots.length}
            </Badge>
          </h4>

          <div
            className="relative group cursor-pointer rounded-lg overflow-hidden bg-muted mb-4"
            onClick={() => openLightbox(currentSlideIndex)}
          >
            <img
              src={featuredScreenshots[currentSlideIndex].url}
              alt={`Featured screenshot ${currentSlideIndex + 1}`}
              className="w-full h-64 md:h-80 object-cover group-hover:scale-105 transition-all duration-500"
              loading="lazy"
              key={currentSlideIndex} // Force re-render for smooth transition
            />
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-black group-hover:bg-opacity-20 transition-colors duration-300 flex items-center justify-center">
              <Maximize2 className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
            <div className="absolute bottom-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
              <ImageIcon className="w-3 h-3" />
              {currentSlideIndex + 1} / {gameMedia.screenshots.length}
            </div>
            <div className="absolute top-2 left-2">
              <Badge className="bg-black bg-opacity-60 text-white border-white border-opacity-20 text-xs">
                {featuredScreenshots[currentSlideIndex].source.toUpperCase()}
              </Badge>
            </div>
            {/* Slideshow indicators */}
            {gameMedia.screenshots.length > 1 && (
              <div className="absolute bottom-2 left-2 flex gap-1">
                {gameMedia.screenshots.map((_, index) => (
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

          {/* Screenshot Thumbnails */}
          {featuredScreenshots.length > 1 && (
            <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
              {/* First thumbnail (for index 0) */}
              <div
                className={`relative group cursor-pointer rounded overflow-hidden bg-muted aspect-video border-2 transition-all duration-300 ${
                  currentSlideIndex === 0
                    ? 'border-primary ring-2 ring-primary ring-opacity-50'
                    : 'border-transparent hover:border-gray-300'
                }`}
                onClick={() => handleSlideChange(0)}
              >
                <img
                  src={featuredScreenshots[0].thumbnailUrl || featuredScreenshots[0].url}
                  alt="Screenshot 1"
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-black group-hover:bg-opacity-20 transition-colors duration-300" />
                <div className="absolute bottom-1 right-1">
                  <Badge className="bg-black bg-opacity-60 text-white text-xs">
                    {featuredScreenshots[0].source[0].toUpperCase()}
                  </Badge>
                </div>
                {currentSlideIndex === 0 && (
                  <div className="absolute top-1 left-1">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                  </div>
                )}
              </div>
              {featuredScreenshots.slice(1, 7).map((screenshot, index) => (
                <div
                  key={screenshot.id}
                  className={`relative group cursor-pointer rounded overflow-hidden bg-muted aspect-video border-2 transition-all duration-300 ${
                    currentSlideIndex === index + 1
                      ? 'border-primary ring-2 ring-primary ring-opacity-50'
                      : 'border-transparent hover:border-gray-300'
                  }`}
                  onClick={() => handleSlideChange(index + 1)}
                >
                  <img
                    src={screenshot.thumbnailUrl || screenshot.url}
                    alt={`Screenshot ${index + 2}`}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-black group-hover:bg-opacity-20 transition-colors duration-300" />
                  <div className="absolute bottom-1 right-1">
                    <Badge className="bg-black bg-opacity-60 text-white text-xs">
                      {screenshot.source[0].toUpperCase()}
                    </Badge>
                  </div>
                  {currentSlideIndex === index + 1 && (
                    <div className="absolute top-1 left-1">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                    </div>
                  )}
                </div>
              ))}

              {gameMedia.screenshots.length > 7 && (
                <div
                  className="relative group cursor-pointer rounded overflow-hidden bg-muted bg-opacity-50 aspect-video flex items-center justify-center border-2 border-dashed border-muted-foreground border-opacity-30"
                  onClick={() => handleSlideChange(7)}
                >
                  <div className="text-center">
                    <span className="text-sm font-medium text-muted-foreground">
                      +{gameMedia.screenshots.length - 7}
                    </span>
                    <div className="text-xs text-muted-foreground">more</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Videos Section */}
      {featuredVideos.length > 0 && (
        <div>
          <h4 className="font-medium mb-3 flex items-center gap-2">
            Videos & Trailers
            <Badge variant="secondary" className="text-xs">
              {gameMedia.videos.length}
            </Badge>
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {featuredVideos.map((video, index) => (
              <div
                key={video.id}
                className="relative group cursor-pointer rounded-lg overflow-hidden bg-muted"
                onClick={() => openLightbox(gameMedia.screenshots.length + index)}
              >
                <img
                  src={video.thumbnailUrl}
                  alt={video.title || `Video ${index + 1}`}
                  className="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black bg-opacity-20 group-hover:bg-opacity-40 transition-colors duration-300 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-white bg-opacity-90 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Play className="w-6 h-6 text-black ml-1" />
                  </div>
                </div>
                <div className="absolute top-2 left-2">
                  <Badge className="bg-black bg-opacity-60 text-white border-white border-opacity-20 text-xs">
                    {video.source.toUpperCase()}
                  </Badge>
                </div>
                <div className="absolute bottom-2 left-2 right-2">
                  {video.title && (
                    <div className="text-white text-sm font-medium bg-black bg-opacity-60 px-2 py-1 rounded truncate">
                      {video.title}
                    </div>
                  )}
                </div>
              </div>
            ))}
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