import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTournamentGameData } from "@/hooks/useTournamentGameData";
import { getGameLogoUrl } from "@/lib/utils";
import StorageImage from "@/components/StorageImage";
import { parseStorageObjectUrl } from "@/lib/storage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import LeaderboardEntry from "@/components/LeaderboardEntry";
import QRCodeDisplay from "@/components/QRCodeDisplay";
import DynamicOverallLeaderboard from "@/components/DynamicOverallLeaderboard";
import ScoreSubmissionDialog from "@/components/ScoreSubmissionDialog";
import TournamentDropdown from "@/components/TournamentDropdown";
import { useTournament } from "@/contexts/TournamentContext";
import { dlog } from "@/lib/debug";
import CompetitionStatus from "@/components/CompetitionStatus";
import pacmanLogo from "@/assets/pacman-logo.png";
import spaceInvadersLogo from "@/assets/space-invaders-logo.png";
import tetrisLogo from "@/assets/tetris-logo.png";
import donkeyKongLogo from "@/assets/donkey-kong-logo.png";
import { supabase } from "@/integrations/supabase/client";

// Fallback logo mapping for backwards compatibility
const LOGO_MAP: Record<string, string> = {
  "pacman": pacmanLogo,
  "pac-man": pacmanLogo,
  "spaceinvaders": spaceInvadersLogo,
  "space invaders": spaceInvadersLogo,
  "tetris": tetrisLogo,
  "donkeykong": donkeyKongLogo,
  "donkey kong": donkeyKongLogo,
};

interface Game {
  id: string;
  name: string;
  logo_url: string | null;
  is_active: boolean;
}

interface Score {
  id: string;
  player_name: string;
  score: number;
  game_id: string;
  created_at: string;
  isNew?: boolean;
}

interface IndexProps {
  isExiting?: boolean;
}

const Index: React.FC<IndexProps> = ({ isExiting = false }) => {
  // Clean index page with single navigation via Layout component
  const { currentTournament, loading: tournamentLoading } = useTournament();

  // Check if animations should be suppressed (during tests)
  const [suppressAnimations, setSuppressAnimations] = useState(
    window.localStorage.getItem('suppressAnimations') === 'true'
  );
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { activeGames: games, gameScores, loading: gamesLoading, refetch } = useTournamentGameData();

  // Temporarily allow overflow during animations
  useEffect(() => {
    if (!isExiting && !gamesLoading && !suppressAnimations) {
      document.body.classList.add('loading-animations');
      const timer = setTimeout(() => {
        document.body.classList.remove('loading-animations');
      }, 3000); // Remove after all animations complete
      return () => {
        clearTimeout(timer);
        document.body.classList.remove('loading-animations');
      };
    }
  }, [isExiting, gamesLoading, suppressAnimations]);

  // Monitor localStorage for animation suppression changes
  useEffect(() => {
    const checkSuppression = () => {
      setSuppressAnimations(window.localStorage.getItem('suppressAnimations') === 'true');
    };

    // Listen for storage events
    window.addEventListener('storage', checkSuppression);
    // Also check periodically in case the flag is set from the same tab
    const interval = setInterval(checkSuppression, 500);

    return () => {
      window.removeEventListener('storage', checkSuppression);
      clearInterval(interval);
    };
  }, []);

  const [selectedGameForSubmission, setSelectedGameForSubmission] = useState<any>(null);
  const [isSubmissionDialogOpen, setIsSubmissionDialogOpen] = useState(false);

  const handleGameLogoClick = useCallback((game: Game) => {
    setSelectedGameForSubmission(game);
    setIsSubmissionDialogOpen(true);
  }, []);

  const handleScoreSubmitted = useCallback(() => {
    refetch(); // Reload all data after submission
  }, [refetch]);


  // Realtime: auto-refresh when new score submissions are recorded for current tournament
  useEffect(() => {
    if (!currentTournament?.id) return;

    const channel = supabase
      .channel('index-score-subscriptions')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'score_submissions',
          filter: `tournament_id=eq.${currentTournament.id}`,
        },
        () => {
          // Skip updates during tests to prevent animations
          if (window.localStorage.getItem('suppressAnimations') === 'true') {
            return;
          }
          // Debounce/lightweight: refetch scores immediately on event
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentTournament?.id, refetch]);

  // Deterministic style for Tron edge runner per card
  const getRunnerStyle = (seed: string) => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
      h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    }
    const delay = (h % 2000) / 1000; // 0-2s
    const duration = 7 + ((h >> 3) % 4000) / 1000; // 7-11s
    return {
      ['--runner-delay' as any]: `${delay}s`,
      ['--runner-duration' as any]: `${duration}s`,
    } as React.CSSProperties;
  };

  // Show tournament selection if no current tournament (but only after loading is complete)
  if (!tournamentLoading && !currentTournament) {
    return (
      <div className="min-h-screen flex items-center justify-center relative z-10"
           style={{ background: 'radial-gradient(ellipse at center, rgba(26, 16, 37, 0.9) 0%, rgba(26, 16, 37, 0.7) 100%)' }}>
        <div className="text-center text-white">
          <div className="text-6xl mb-4">🏆</div>
          <h1 className="text-4xl font-bold mb-4">Welcome to Retro Ranks!</h1>
          <p className="text-xl text-gray-300 mb-8">
            Create your first tournament or join an existing one to get started.
          </p>
          <TournamentDropdown />
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-4 overflow-visible">
      <div className="w-full space-y-4 overflow-visible">
        <div className={`grid gap-4 ${isMobile ? 'min-h-screen' : 'h-[calc(100vh-12rem)] grid-cols-1 lg:grid-cols-5'} overflow-visible`}>
          {/* Left column - Overall Leaderboard (smaller) */}
          <div className={`${isMobile ? 'order-2' : 'h-full lg:col-span-1'} ${suppressAnimations ? '' : (isExiting ? 'animate-slide-out-left' : 'animate-slide-in-left animation-delay-200')}`}>
            <DynamicOverallLeaderboard />
          </div>

          {/* Right column - Game content (4 games instead of 5) */}
          <div className={`${isMobile ? 'order-1' : 'h-full lg:col-span-4'} overflow-visible`}>
            {/* Competition Status Subheader */}
            <div className={`mb-4 status-bar-stable ${suppressAnimations ? '' : (isExiting ? 'animate-slide-out-right' : 'animate-slide-in-right')}`} style={{animationDelay: suppressAnimations ? '0ms' : (isExiting ? '0ms' : '100ms')}}>
              <CompetitionStatus />
            </div>

            <div className={`${isMobile ? 'flex flex-col space-y-6' : 'flex gap-3 h-full'}`} style={{overflow: 'visible', position: 'relative'}}>
              {games.slice(0, 4).map((game) => {
                // Get logo URL - convert local paths to Supabase Storage URLs
                const logoUrl = getGameLogoUrl(game.logo_url) || LOGO_MAP[game.name.toLowerCase()] || LOGO_MAP[game.id.toLowerCase()];
                const storageRef = logoUrl && logoUrl.includes('supabase.co/storage/') ? parseStorageObjectUrl(logoUrl) : null;
                const isPublicObject = !!(logoUrl && logoUrl.includes('/storage/v1/object/public/'));

                const filtered = gameScores[game.id] || [];

                // Debug logging for joust specifically
                if (game.name.toLowerCase().includes('joust')) {
                  dlog('🎮 Joust Debug Info:', {
                    gameName: game.name,
                    gameId: game.id,
                    scoresForThisGame: filtered,
                    allGameScores: gameScores,
                    totalGames: games.length
                  });
                }

                return (
                <section key={game.id} data-game-id={game.id} className={`flex flex-col ${isMobile ? 'min-h-[400px]' : 'h-full flex-1 min-w-0'} ${suppressAnimations ? '' : (isExiting ? 'animate-slide-out-right' : 'animate-slide-in-right')}`} style={{animationDelay: suppressAnimations ? '0ms' : (isExiting ? `${(games.length - 1 - games.findIndex(g => g.id === game.id)) * 100}ms` : `${games.findIndex(g => g.id === game.id) * 200}ms`)}}>
                  {/* Card containing logo, scores and QR code */}
                  <Card
                    className="bg-black/30 border-white/20 theme-card flex-1 flex flex-col cursor-pointer hover:scale-[1.02] transition-transform duration-200"
                    style={getRunnerStyle(game.id)}
                    onClick={() => handleGameLogoClick(game)}
                    title={`Click to submit score for ${game.name}`}
                  >
                      <CardHeader className="pb-1 pt-2">
                        {/* Game logo inside card header */}
                        <div className="flex justify-center">
                          <div className="transition-transform duration-200">
                            {logoUrl ? (
                              storageRef && !isPublicObject ? (
                                <StorageImage
                                  bucket={storageRef.bucket}
                                  path={storageRef.path}
                                  alt={game.name}
                                  className="h-32 md:h-40 w-auto object-contain max-w-full"
                                  expiresIn={300}
                                />
                              ) : (
                                <img
                                  src={logoUrl}
                                  alt={game.name}
                                  className="h-32 md:h-40 w-auto object-contain max-w-full"
                                />
                              )
                            ) : (
                              <div className="h-32 md:h-40 flex items-center justify-center bg-black/30 rounded-lg px-4 min-w-[300px]">
                                <span className="text-white font-bold text-center text-xl">{game.name}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col pt-1">
                        {/* Scores section - scrollable if needed */}
                        <div className="flex-1 overflow-y-auto mb-4">
                          <div className="space-y-2 leaderboard-gradient-scope">
                            {filtered.map((score, index) => (
                              <LeaderboardEntry
                                key={score.id}
                                rank={index + 1}
                                name={score.player_name}
                                score={score.score}
                                isNewScore={false}
                              />
                            ))}
                            {filtered.length === 0 && (
                              <div className="text-center py-8 text-gray-400">
                                No scores yet. Be the first to submit!
                              </div>
                            )}
                          </div>
                        </div>

                        {/* QR Code - inside card at bottom - hidden on mobile */}
                        <div className="mt-auto hidden md:block">
                          <QRCodeDisplay gameId={game.id} gameName={game.name} />
                        </div>
                      </CardContent>
                    </Card>
                </section>
                );
              })}
              {!gamesLoading && games.length === 0 && (
                <div className={`col-span-full text-center py-8 text-gray-400 ${suppressAnimations ? '' : (isExiting ? 'animate-wave-out-right' : 'animate-wave-in-right')}`} style={{animationDelay: suppressAnimations ? '0ms' : (isExiting ? '0ms' : '600ms')}}>
                  No active games found. Please contact an administrator.
                </div>
              )}
            </div>
          </div>
        </div>

        <ScoreSubmissionDialog
          game={selectedGameForSubmission}
          isOpen={isSubmissionDialogOpen}
          onClose={() => setIsSubmissionDialogOpen(false)}
          onScoreSubmitted={handleScoreSubmitted}
        />
      </div>
    </div>
  );
};

export default Index;