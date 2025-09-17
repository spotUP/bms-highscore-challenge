import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { RAWGGame } from "@/utils/rawgApi";
import {
  Star,
  Calendar,
  Users,
  Globe,
  Clock,
  Monitor,
  ExternalLink,
  X,
  ChevronLeft,
  ChevronRight,
  Maximize2
} from "lucide-react";

interface GameDetailsModalProps {
  game: RAWGGame | null;
  isOpen: boolean;
  onClose: () => void;
}

const cleanDescription = (description: string | undefined): string => {
  if (!description) return '';

  // Remove HTML tags and decode entities
  return description
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
};

export const GameDetailsModal: React.FC<GameDetailsModalProps> = ({
  game,
  isOpen,
  onClose
}) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  if (!game) return null;

  const releaseDate = game.released ? new Date(game.released) : null;
  const description = cleanDescription(game.description || game.description_raw);

  // Prepare all images for gallery (background + screenshots)
  const allImages = [
    ...(game.background_image ? [{ id: 'background', image: game.background_image }] : []),
    ...(game.short_screenshots || []).slice(1) // Skip first screenshot as it's usually the same as background
  ];

  const openLightbox = (index: number) => {
    setCurrentImageIndex(index);
    setLightboxOpen(true);
  };

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % allImages.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') nextImage();
    if (e.key === 'ArrowLeft') prevImage();
    if (e.key === 'Escape') setLightboxOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <div className="relative">
          {/* Background Image Header */}
          {game.background_image && (
            <div className="relative h-64 overflow-hidden">
              <img
                src={game.background_image}
                alt={game.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />

              {/* Close button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 text-white hover:bg-white/20"
                onClick={onClose}
              >
                <X className="w-4 h-4" />
              </Button>

              {/* Title overlay */}
              <div className="absolute bottom-6 left-6 right-6">
                <h1 className="text-3xl font-bold text-white mb-2 drop-shadow-lg">
                  {game.name}
                </h1>
                <div className="flex items-center gap-4 text-white/90">
                  {releaseDate && (
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>{releaseDate.getFullYear()}</span>
                    </div>
                  )}
                  {game.rating > 0 && (
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span>{game.rating.toFixed(1)}</span>
                    </div>
                  )}
                  {game.metacritic && (
                    <div className={`px-2 py-1 rounded text-xs font-bold ${
                      game.metacritic >= 75 ? 'bg-green-500' :
                      game.metacritic >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                    } text-white`}>
                      Metacritic {game.metacritic}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Content */}
          <ScrollArea className="max-h-[calc(90vh-16rem)] p-6">
            <div className="space-y-6">
              {/* Description */}
              {description && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">About</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {description}
                  </p>
                </div>
              )}

              {/* Quick Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-4">
                  {/* Genres */}
                  {game.genres && game.genres.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Genres</h4>
                      <div className="flex flex-wrap gap-2">
                        {game.genres.map(genre => (
                          <Badge key={genre.id} variant="secondary">
                            {genre.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Platforms */}
                  {game.platforms && game.platforms.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Platforms</h4>
                      <div className="flex flex-wrap gap-2">
                        {game.platforms.slice(0, 6).map(platform => (
                          <Badge key={platform.platform.id} variant="outline">
                            {platform.platform.name}
                          </Badge>
                        ))}
                        {game.platforms.length > 6 && (
                          <Badge variant="outline">
                            +{game.platforms.length - 6} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tags */}
                  {game.tags && game.tags.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Tags</h4>
                      <div className="flex flex-wrap gap-1">
                        {game.tags.slice(0, 8).map(tag => (
                          <Badge key={tag.id} variant="secondary" className="text-xs">
                            {tag.name}
                          </Badge>
                        ))}
                        {game.tags.length > 8 && (
                          <Badge variant="secondary" className="text-xs">
                            +{game.tags.length - 8}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  {/* Game Details */}
                  <div className="space-y-3">
                    <h4 className="font-medium">Details</h4>

                    {releaseDate && (
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Release Date:</span>
                        <span>{releaseDate.toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}</span>
                      </div>
                    )}

                    {game.developers && game.developers.length > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Developer:</span>
                        <span>{game.developers[0].name}</span>
                      </div>
                    )}

                    {game.publishers && game.publishers.length > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <Monitor className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Publisher:</span>
                        <span>{game.publishers[0].name}</span>
                      </div>
                    )}

                    {game.playtime && (
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Playtime:</span>
                        <span>{game.playtime} hours</span>
                      </div>
                    )}

                    {game.esrb_rating && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">ESRB Rating:</span>
                        <Badge variant="outline">{game.esrb_rating.name}</Badge>
                      </div>
                    )}

                    {game.website && (
                      <div className="flex items-center gap-2 text-sm">
                        <Globe className="w-4 h-4 text-muted-foreground" />
                        <a
                          href={game.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          Official Website
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Where to Buy */}
                  {game.stores && game.stores.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Where to Buy</h4>
                      <div className="space-y-2">
                        {game.stores.slice(0, 5).map(store => (
                          <a
                            key={store.id}
                            href={store.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-primary hover:underline"
                          >
                            <span>{store.store.name}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Image Gallery */}
              {allImages.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    Screenshots & Media
                    <Badge variant="secondary" className="text-xs">
                      {allImages.length}
                    </Badge>
                  </h4>

                  {/* Main featured image */}
                  {allImages.length > 0 && (
                    <div className="mb-4">
                      <div
                        className="relative group cursor-pointer rounded-lg overflow-hidden bg-muted"
                        onClick={() => openLightbox(0)}
                      >
                        <img
                          src={allImages[0].image}
                          alt="Featured screenshot"
                          className="w-full h-64 md:h-80 object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
                          <Maximize2 className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        </div>
                        <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                          1 / {allImages.length}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Thumbnail grid */}
                  {allImages.length > 1 && (
                    <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                      {allImages.slice(1, 13).map((screenshot, index) => (
                        <div
                          key={screenshot.id}
                          className="relative group cursor-pointer rounded overflow-hidden bg-muted aspect-video"
                          onClick={() => openLightbox(index + 1)}
                        >
                          <img
                            src={screenshot.image}
                            alt={`Screenshot ${index + 2}`}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
                        </div>
                      ))}

                      {/* Show more indicator */}
                      {allImages.length > 13 && (
                        <div
                          className="relative group cursor-pointer rounded overflow-hidden bg-muted/50 aspect-video flex items-center justify-center border-2 border-dashed border-muted-foreground/30"
                          onClick={() => openLightbox(13)}
                        >
                          <div className="text-center">
                            <span className="text-sm font-medium text-muted-foreground">
                              +{allImages.length - 13}
                            </span>
                            <div className="text-xs text-muted-foreground">more</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>

      {/* Lightbox Modal */}
      {lightboxOpen && (
        <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
          <DialogContent
            className="max-w-[95vw] max-h-[95vh] p-0 border-none bg-black/95"
            onKeyDown={handleKeyDown}
          >
            <div className="relative w-full h-full flex items-center justify-center">
              {/* Close button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 z-10 text-white hover:bg-white/20"
                onClick={() => setLightboxOpen(false)}
              >
                <X className="w-6 h-6" />
              </Button>

              {/* Navigation buttons */}
              {allImages.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
                    onClick={prevImage}
                  >
                    <ChevronLeft className="w-8 h-8" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
                    onClick={nextImage}
                  >
                    <ChevronRight className="w-8 h-8" />
                  </Button>
                </>
              )}

              {/* Main image */}
              <div className="relative max-w-full max-h-full p-8">
                <img
                  src={allImages[currentImageIndex]?.image}
                  alt={`Screenshot ${currentImageIndex + 1}`}
                  className="max-w-full max-h-full object-contain rounded-lg"
                />

                {/* Image counter */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-sm px-3 py-1 rounded-full">
                  {currentImageIndex + 1} / {allImages.length}
                </div>
              </div>

              {/* Thumbnail strip */}
              {allImages.length > 1 && (
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="flex justify-center">
                    <div className="flex gap-2 bg-black/60 p-2 rounded-lg max-w-full overflow-x-auto">
                      {allImages.map((image, index) => (
                        <button
                          key={image.id}
                          onClick={() => setCurrentImageIndex(index)}
                          className={`flex-shrink-0 w-16 h-10 rounded overflow-hidden border-2 transition-all ${
                            index === currentImageIndex
                              ? 'border-white'
                              : 'border-transparent hover:border-white/50'
                          }`}
                        >
                          <img
                            src={image.image}
                            alt={`Thumbnail ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
};