import React from 'react';
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
import { GameLogo } from "./GameLogo";
import { GameRatingDisplay } from "./GameRatingDisplay";
import { GameMediaGallery } from "./GameMediaGallery";
import {
  Star,
  Calendar,
  Users,
  Gamepad2,
  Play,
  Globe,
  BookOpen,
  Monitor,
  Palette,
  Tag
} from "lucide-react";

interface Game {
  id: string;
  name: string;
  platform_name: string;
  database_id: number | null;
  release_year: number | null;
  overview: string | null;
  max_players: number | null;
  cooperative: boolean | null;
  community_rating: number | null;
  community_rating_count: number | null;
  esrb_rating: string | null;
  genres: string[];
  developer: string | null;
  publisher: string | null;
  video_url: string | null;
  screenshot_url: string | null;
  cover_url: string | null;
  logo_url: string | null;
  // Additional LaunchBox fields
  series?: string | null;
  region?: string | null;
  alternative_names?: string[];
  play_modes?: string[];
  themes?: string[];
  wikipedia_url?: string | null;
  video_urls?: string[];
  release_type?: string | null;
  release_date?: string | null;
}

interface GameDetailsModalProps {
  game: Game | null;
  isOpen: boolean;
  onClose: () => void;
}

export const GameDetailsModal: React.FC<GameDetailsModalProps> = ({
  game,
  isOpen,
  onClose
}) => {
  if (!game) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[76vw] max-h-[95vh] w-full h-full overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold pr-8">{game.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-8">
          {/* Game Media Section */}
          <div className="space-y-6">
            {/* Main Game Info Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Game Logo */}
              <div className="aspect-video w-full overflow-hidden rounded-lg border bg-gray-900/50 relative">
                {game.logo_url ? (
                  <img
                    src={game.logo_url}
                    alt={`${game.name} logo`}
                    className="w-full h-full object-contain p-4"
                  />
                ) : (
                  <GameLogo
                    gameName={game.name}
                    className="w-full h-full"
                    enableLazyLoading={false}
                  />
                )}
                <div className="absolute top-2 left-2">
                  <Badge variant="secondary" className="text-xs">Logo</Badge>
                </div>
              </div>

              {/* Cover Art */}
              {game.cover_url && (
                <div className="aspect-[3/4] w-full overflow-hidden rounded-lg border relative">
                  <img
                    src={game.cover_url}
                    alt={`${game.name} cover`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2">
                    <Badge variant="secondary" className="text-xs">Cover</Badge>
                  </div>
                </div>
              )}

              {/* Screenshot */}
              {game.screenshot_url && (
                <div className="aspect-video w-full overflow-hidden rounded-lg border relative">
                  <img
                    src={game.screenshot_url}
                    alt={`${game.name} screenshot`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2">
                    <Badge variant="secondary" className="text-xs">Screenshot</Badge>
                  </div>
                </div>
              )}
            </div>

            {/* Video Section */}
            {game.video_url && (
              <div>
                <h3 className="font-semibold text-lg mb-4">Video</h3>
                <div className="max-w-2xl">
                  <div className="aspect-video w-full overflow-hidden rounded-lg border">
                    {(() => {
                      // Extract YouTube ID from URL
                      const extractYouTubeId = (url: string): string | null => {
                        if (!url || typeof url !== 'string') return null;

                        const cleanUrl = url.trim();
                        const patterns = [
                          /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
                          /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
                          /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
                          /(?:https?:\/\/)?(?:www\.)?youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
                          /(?:https?:\/\/)?(?:m\.)?youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
                          /[?&]v=([a-zA-Z0-9_-]{11})/
                        ];

                        for (const pattern of patterns) {
                          const match = cleanUrl.match(pattern);
                          if (match && match[1] && match[1].length === 11) {
                            return match[1];
                          }
                        }
                        return null;
                      };

                      const youtubeId = extractYouTubeId(game.video_url);

                      if (youtubeId) {
                        return (
                          <iframe
                            src={`https://www.youtube.com/embed/${youtubeId}`}
                            className="w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            title={`${game.name} Video`}
                          />
                        );
                      } else {
                        // Fallback for non-YouTube videos
                        return (
                          <video
                            src={game.video_url}
                            controls
                            className="w-full h-full object-contain"
                            title={`${game.name} Video`}
                          />
                        );
                      }
                    })()}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Game Details Section */}
          <div className="space-y-8">
            {/* Main Game Information */}
            <div className="space-y-6">
              <h3 className="font-semibold text-xl">Game Information</h3>

              {/* Core Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm text-muted-foreground">Platform</h4>
                  <Badge variant="secondary" className="text-sm w-fit">
                    <Gamepad2 className="w-4 h-4 mr-1" />
                    {game.platform_name}
                  </Badge>
                </div>

                {(game.release_date || game.release_year) && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm text-muted-foreground">Release Date</h4>
                    <Badge variant="outline" className="text-sm w-fit">
                      <Calendar className="w-4 h-4 mr-1" />
                      {game.release_date || game.release_year}
                    </Badge>
                  </div>
                )}

                {game.release_type && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm text-muted-foreground">Game Type</h4>
                    <Badge variant="outline" className="text-sm w-fit">
                      {game.release_type}
                    </Badge>
                  </div>
                )}

                {game.max_players && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm text-muted-foreground">Max Players</h4>
                    <Badge variant="outline" className="text-sm w-fit">
                      <Users className="w-4 h-4 mr-1" />
                      {game.max_players}
                    </Badge>
                  </div>
                )}

                {game.cooperative !== null && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm text-muted-foreground">Cooperative</h4>
                    <Badge variant={game.cooperative ? "secondary" : "outline"} className="text-sm w-fit">
                      {game.cooperative ? "Yes" : "No"}
                    </Badge>
                  </div>
                )}

                {game.esrb_rating && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm text-muted-foreground">ESRB Rating</h4>
                    <Badge variant="outline" className="text-sm w-fit">
                      {game.esrb_rating}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Enhanced Rating Display */}
              <div>
                <h4 className="font-semibold text-sm text-muted-foreground mb-3">Community Rating</h4>
                <GameRatingDisplay
                  gameName={game.name}
                  platform={game.platform_name}
                  launchboxRating={game.community_rating}
                  launchboxRatingCount={game.community_rating_count}
                  showSources={true}
                />
              </div>
            </div>

            <Separator />

            {/* Overview Section */}
            {game.overview && (
              <div className="space-y-4">
                <h3 className="font-semibold text-xl">Overview</h3>
                <div className="bg-muted/30 p-4 rounded-lg">
                  <p className="text-sm leading-relaxed">{game.overview}</p>
                </div>
              </div>
            )}

            {/* Detailed Metadata */}
            <div className="space-y-6">
              <h3 className="font-semibold text-xl">Detailed Information</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left Column */}
                <div className="space-y-6">
                  {/* Developer & Publisher */}
                  <div className="space-y-4">
                    {game.developer && (
                      <div>
                        <h4 className="font-semibold text-sm text-muted-foreground mb-2">Developer</h4>
                        <p className="text-sm bg-muted/20 p-2 rounded">{game.developer}</p>
                      </div>
                    )}

                    {game.publisher && (
                      <div>
                        <h4 className="font-semibold text-sm text-muted-foreground mb-2">Publisher</h4>
                        <p className="text-sm bg-muted/20 p-2 rounded">{game.publisher}</p>
                      </div>
                    )}
                  </div>

                  {/* Genres */}
                  {game.genres && game.genres.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm text-muted-foreground mb-3">Genres</h4>
                      <div className="flex flex-wrap gap-2">
                        {game.genres.map(genre => (
                          <Badge key={genre} variant="secondary" className="text-sm">
                            {genre}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Series */}
                  {game.series && (
                    <div>
                      <h4 className="font-semibold text-sm text-muted-foreground mb-2 flex items-center gap-1">
                        <Tag className="w-4 h-4" />
                        Series
                      </h4>
                      <p className="text-sm bg-muted/20 p-2 rounded">{game.series}</p>
                    </div>
                  )}

                  {/* Region */}
                  {game.region && (
                    <div>
                      <h4 className="font-semibold text-sm text-muted-foreground mb-2 flex items-center gap-1">
                        <Globe className="w-4 h-4" />
                        Region
                      </h4>
                      <Badge variant="outline" className="text-sm">
                        {game.region}
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                  {/* Play Modes */}
                  {game.play_modes && game.play_modes.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm text-muted-foreground mb-3 flex items-center gap-1">
                        <Monitor className="w-4 h-4" />
                        Play Modes
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {game.play_modes.map(mode => (
                          <Badge key={mode} variant="secondary" className="text-sm">
                            {mode}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Themes */}
                  {game.themes && game.themes.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm text-muted-foreground mb-3 flex items-center gap-1">
                        <Palette className="w-4 h-4" />
                        Themes
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {game.themes.map(theme => (
                          <Badge key={theme} variant="outline" className="text-sm">
                            {theme}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Alternative Names */}
                  {game.alternative_names && game.alternative_names.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm text-muted-foreground mb-3">Alternate Names</h4>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {game.alternative_names.map((name, index) => (
                          <div key={index} className="text-sm bg-muted/20 p-2 rounded">
                            {name}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* External Links */}
                  {game.wikipedia_url && (
                    <div>
                      <h4 className="font-semibold text-sm text-muted-foreground mb-3 flex items-center gap-1">
                        <BookOpen className="w-4 h-4" />
                        External Links
                      </h4>
                      <div className="space-y-2">
                        <Button variant="outline" size="sm" asChild className="w-full justify-start">
                          <a href={game.wikipedia_url} target="_blank" rel="noopener noreferrer">
                            <Globe className="w-4 h-4 mr-2" />
                            Wikipedia Page
                          </a>
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Enhanced Media Gallery */}
            <Separator />

            <GameMediaGallery
              gameName={game.name}
              platform={game.platform_name}
              existingMedia={{
                screenshot_url: game.screenshot_url,
                cover_url: game.cover_url,
                logo_url: game.logo_url,
                video_url: game.video_url
              }}
            />

          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};