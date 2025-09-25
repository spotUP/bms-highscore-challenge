import React, { useState, useEffect } from 'react';
import { useAuth } from "@/hooks/useAuth";
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
import { GameRatingDisplay } from "./GameRatingDisplay";
import { GameMediaGallery } from "./GameMediaGallery";
import { supabase } from "@/integrations/supabase/client";
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
  Tag,
  Loader2,
  Heart
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
  favoriteGameIds?: Set<string>;
  toggleFavorite?: (gameId: string) => void;
  pulsingHearts?: Set<string>;
}

export const GameDetailsModal: React.FC<GameDetailsModalProps> = ({
  game,
  isOpen,
  onClose,
  favoriteGameIds,
  toggleFavorite,
  pulsingHearts
}) => {
  const [enrichedGame, setEnrichedGame] = useState<Game | null>(game);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!game || !isOpen) return;

    // Start with the basic game data
    setEnrichedGame(game);
    setIsLoading(true);

    // Fetch additional metadata from Supabase
    const fetchEnrichedData = async () => {
      try {
        const { data, error } = await supabase
          .from('games_database')
          .select('*')
          .eq('id', game.id)
          .single();

        if (!error && data) {
          // Merge the fetched data with existing game data
          setEnrichedGame({
            ...game,
            ...data,
            // Keep existing fields that might not be in Supabase
            name: data.name || game.name,
            platform_name: data.platform_name || game.platform_name
          });
        }
      } catch (error) {
        console.warn('Failed to fetch enriched game data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEnrichedData();
  }, [game, isOpen]);

  if (!game) return null;

  // Use enriched data if available, otherwise fall back to original
  const displayGame = enrichedGame || game;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[60vw] max-w-[60vw] min-w-[60vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold pr-8 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {displayGame.name}
              {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
            </div>
            {favoriteGameIds && toggleFavorite && user && (
              <button
                className="p-2 transition-colors hover:bg-gray-100 rounded-full"
                onClick={() => toggleFavorite(displayGame.id.toString())}
              >
                <div className="relative">
                  <Heart
                    className={`w-6 h-6 ${
                      favoriteGameIds.has(displayGame.id.toString())
                        ? 'text-red-500 fill-red-500'
                        : 'text-gray-400 hover:text-red-400'
                    }`}
                  />
                  {pulsingHearts?.has(displayGame.id.toString()) && (
                    <Heart
                      className="absolute top-0 left-0 w-6 h-6 text-red-500 fill-red-500 heart-pulse pointer-events-none"
                    />
                  )}
                </div>
              </button>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-8">
          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Left Column - Game Information */}
            <div className="lg:col-span-2 space-y-6">
              <h3 className="font-semibold text-xl">Game Information</h3>

              {/* Cover Art */}
              {displayGame.cover_url && (
                <div className="aspect-[3/4] w-full max-w-sm mx-auto overflow-hidden rounded-lg border relative">
                  <img
                    src={displayGame.cover_url}
                    alt={`${displayGame.name} cover`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2">
                    <Badge variant="secondary" className="text-xs">Cover</Badge>
                  </div>
                </div>
              )}

              {/* Core Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm text-muted-foreground">Platform</h4>
                  <Badge variant="secondary" className="text-sm w-fit">
                    <Gamepad2 className="w-4 h-4 mr-1" />
                    {displayGame.platform_name}
                  </Badge>
                </div>

                {(displayGame.release_date || displayGame.release_year) && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm text-muted-foreground">Release Date</h4>
                    <Badge variant="outline" className="text-sm w-fit">
                      <Calendar className="w-4 h-4 mr-1" />
                      {displayGame.release_date || displayGame.release_year}
                    </Badge>
                  </div>
                )}

                {displayGame.release_type && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm text-muted-foreground">Game Type</h4>
                    <Badge variant="outline" className="text-sm w-fit">
                      {displayGame.release_type}
                    </Badge>
                  </div>
                )}

                {displayGame.max_players && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm text-muted-foreground">Max Players</h4>
                    <Badge variant="outline" className="text-sm w-fit">
                      <Users className="w-4 h-4 mr-1" />
                      {displayGame.max_players}
                    </Badge>
                  </div>
                )}

                {displayGame.cooperative !== null && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm text-muted-foreground">Cooperative</h4>
                    <Badge variant={displayGame.cooperative ? "secondary" : "outline"} className="text-sm w-fit">
                      {displayGame.cooperative ? "Yes" : "No"}
                    </Badge>
                  </div>
                )}

                {displayGame.esrb_rating && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm text-muted-foreground">ESRB Rating</h4>
                    <Badge variant="outline" className="text-sm w-fit">
                      {displayGame.esrb_rating}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Developer & Publisher */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {displayGame.developer && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm text-muted-foreground">Developer</h4>
                    <Badge variant="outline" className="text-sm w-fit">
                      {displayGame.developer}
                    </Badge>
                  </div>
                )}

                {displayGame.publisher && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm text-muted-foreground">Publisher</h4>
                    <Badge variant="outline" className="text-sm w-fit">
                      {displayGame.publisher}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Genres */}
              {displayGame.genres && displayGame.genres.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground mb-3">Genres</h4>
                  <div className="flex flex-wrap gap-2">
                    {displayGame.genres.map(genre => (
                      <Badge key={genre} variant="secondary" className="text-sm">
                        {genre}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}


              {/* Series */}
              {displayGame.series && (
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground mb-2 flex items-center gap-1">
                    <Tag className="w-4 h-4" />
                    Series
                  </h4>
                  <p className="text-sm bg-muted bg-opacity-20 p-2 rounded">{displayGame.series}</p>
                </div>
              )}

              {/* Region */}
              {displayGame.region && (
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground mb-2 flex items-center gap-1">
                    <Globe className="w-4 h-4" />
                    Region
                  </h4>
                  <Badge variant="outline" className="text-sm">
                    {displayGame.region}
                  </Badge>
                </div>
              )}

              {/* Play Modes */}
              {displayGame.play_modes && displayGame.play_modes.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground mb-3 flex items-center gap-1">
                    <Monitor className="w-4 h-4" />
                    Play Modes
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {displayGame.play_modes.map(mode => (
                      <Badge key={mode} variant="secondary" className="text-sm">
                        {mode}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Themes */}
              {displayGame.themes && displayGame.themes.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground mb-3 flex items-center gap-1">
                    <Palette className="w-4 h-4" />
                    Themes
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {displayGame.themes.map(theme => (
                      <Badge key={theme} variant="outline" className="text-sm">
                        {theme}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Alternative Names */}
              {displayGame.alternative_names && displayGame.alternative_names.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground mb-3">Alternate Names</h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {displayGame.alternative_names.map((name, index) => (
                      <div key={index} className="text-sm bg-muted bg-opacity-20 p-2 rounded">
                        {name}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* External Links */}
              {displayGame.wikipedia_url && (
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground mb-3 flex items-center gap-1">
                    <BookOpen className="w-4 h-4" />
                    External Links
                  </h4>
                  <div className="space-y-2">
                    <Button variant="outline" size="sm" asChild className="w-full justify-start">
                      <a href={displayGame.wikipedia_url} target="_blank" rel="noopener noreferrer">
                        <Globe className="w-4 h-4 mr-2" />
                        Wikipedia Page
                      </a>
                    </Button>
                  </div>
                </div>
              )}

              {/* Enhanced Rating Display */}
              <div>
                <h4 className="font-semibold text-sm text-muted-foreground mb-3">Community Rating</h4>
                <GameRatingDisplay
                  gameName={displayGame.name}
                  platform={displayGame.platform_name}
                  launchboxRating={displayGame.community_rating}
                  launchboxRatingCount={displayGame.community_rating_count}
                  showSources={true}
                />
              </div>
            </div>

            {/* Right Column - Media Gallery */}
            <div className="lg:col-span-3">
              <div>
                <h3 className="font-semibold text-xl mb-4">Media Gallery</h3>
                <GameMediaGallery
                  gameName={displayGame.name}
                  platform={displayGame.platform_name}
                  existingMedia={{
                    screenshot_url: displayGame.screenshot_url,
                    cover_url: displayGame.cover_url,
                    logo_url: displayGame.logo_url,
                    video_url: displayGame.video_url
                  }}
                />
              </div>
            </div>
          </div>

          {/* Game Details Section */}
          <div className="space-y-8">

            <Separator />

            {/* Overview Section */}
            {displayGame.overview && (
              <div className="space-y-4">
                <h4 className="font-semibold text-sm text-muted-foreground">Overview</h4>
                <div className="bg-muted bg-opacity-20 p-3 rounded">
                  <p className="text-sm leading-relaxed">{displayGame.overview}</p>
                </div>
              </div>
            )}



          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};