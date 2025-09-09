import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useGameData } from "@/hooks/useGameData";
import { getGameLogoUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import LeaderboardEntry from "@/components/LeaderboardEntry";
import QRCodeDisplay from "@/components/QRCodeDisplay";
import OverallLeaderboard from "@/components/OverallLeaderboard";
import ScoreSubmissionDialog from "@/components/ScoreSubmissionDialog";
import SpinTheWheel from "@/components/SpinTheWheel";
import MobileMenu from "@/components/MobileMenu";
import PerformanceModeToggle from "@/components/PerformanceModeToggle";
import pacmanLogo from "@/assets/pacman-logo.png";
import spaceInvadersLogo from "@/assets/space-invaders-logo.png";
import tetrisLogo from "@/assets/tetris-logo.png";
import donkeyKongLogo from "@/assets/donkey-kong-logo.png";

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

const Index = () => {
  const { user, loading, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { activeGames: games, gameScores, loading: gamesLoading, refetch } = useGameData();
  const [selectedGameForSubmission, setSelectedGameForSubmission] = useState<any>(null);
  const [isSubmissionDialogOpen, setIsSubmissionDialogOpen] = useState(false);
  const [isSpinWheelOpen, setIsSpinWheelOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Clock update effect - Optimized to reduce re-renders
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(prevTime => {
        // Only update if the time display actually changed (seconds)
        const prevDisplay = prevTime.toLocaleTimeString('en-GB', { 
          hour12: false, 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit' 
        });
        const newDisplay = now.toLocaleTimeString('en-GB', { 
          hour12: false, 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit' 
        });
        return prevDisplay !== newDisplay ? now : prevTime;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleGameLogoClick = useCallback((game: Game) => {
    setSelectedGameForSubmission(game);
    setIsSubmissionDialogOpen(true);
  }, []);

  const handleScoreSubmitted = useCallback(() => {
    refetch(); // Reload all data after submission
  }, [refetch]);

  // Get player names for the wheel - each player appears once per game they have scores for
  const getLeaderboardNames = useMemo(() => {
    const playerGameCounts = new Map<string, number>();
    
    // Count how many different games each player has scores for
    Object.values(gameScores).forEach(gameScoreList => {
      const playersInGame = new Set();
      gameScoreList.forEach(score => {
        playersInGame.add(score.player_name);
      });
      
      playersInGame.forEach(playerName => {
        const currentCount = playerGameCounts.get(playerName as string) || 0;
        playerGameCounts.set(playerName as string, currentCount + 1);
      });
    });
    
    // Create array where each player appears once per game they have scores for
    const wheelNames: string[] = [];
    playerGameCounts.forEach((gameCount, playerName) => {
      for (let i = 0; i < gameCount; i++) {
        wheelNames.push(playerName);
      }
    });
    
    return wheelNames;
  }, [gameScores]);

  if (loading || gamesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative z-10"
           style={{ background: 'radial-gradient(ellipse at center, rgba(26, 16, 37, 0.9) 0%, rgba(26, 16, 37, 0.7) 100%)' }}>
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white p-3 md:p-4 relative z-10"
         style={{ background: 'radial-gradient(ellipse at center, rgba(26, 16, 37, 0.9) 0%, rgba(26, 16, 37, 0.7) 100%)' }}>
      <div className="w-full space-y-4">
        <div className="flex items-center">
          {/* Left aligned title */}
          <h1 className="text-3xl md:text-4xl font-bold animated-gradient leading-tight">
            Arcade High Scores
          </h1>
          
          {/* Right aligned navigation */}
          <div className="ml-auto flex items-center">
            {/* Desktop Menu */}
            <div className="hidden md:flex gap-4 items-center">
              {/* Digital Clock */}
              <div className="font-arcade font-bold text-lg animated-gradient">
                {currentTime.toLocaleTimeString('en-GB', { 
                  hour12: false, 
                  hour: '2-digit', 
                  minute: '2-digit', 
                  second: '2-digit' 
                })}
              </div>
              
              {user ? (
                <>
                  <span className="text-gray-300">Welcome, {user.email}</span>
                  <Button variant="outline" onClick={() => setIsSpinWheelOpen(true)}>
                    Spin the Wheel
                  </Button>
                  <Button variant="outline" onClick={() => navigate('/statistics')}>
                    Statistics
                  </Button>
                  <Button variant="outline" onClick={() => navigate('/achievements')}>
                    Achievements
                  </Button>
                  <PerformanceModeToggle />
                  {isAdmin && (
                    <Button variant="outline" onClick={() => navigate('/admin')}>
                      Admin Panel
                    </Button>
                  )}
                  <Button variant="outline" onClick={signOut}>
                    Sign Out
                  </Button>
                </>
              ) : (
                <Button onClick={() => navigate('/auth')} variant="outline">
                  Sign In
                </Button>
              )}
            </div>
            
            {/* Mobile Menu */}
            <MobileMenu onSpinWheel={() => setIsSpinWheelOpen(true)} />
          </div>
        </div>
        
        <div className={`grid gap-4 ${isMobile ? 'min-h-screen' : 'h-[calc(100vh-8rem)] grid-cols-1 lg:grid-cols-5'}`}>
          {/* Left column - Overall Leaderboard (smaller) */}
          <div className={`${isMobile ? 'order-2' : 'h-full lg:col-span-1'}`}>
            <OverallLeaderboard />
          </div>
          
          {/* Right column - Game content (4 games instead of 5) */}
          <div className={`${isMobile ? 'order-1' : 'h-full lg:col-span-4'}`}>
            <div className={`${isMobile ? 'flex flex-col space-y-6' : 'flex gap-3 h-full'}`}>
              {games.slice(0, 4).map((game) => {
                // Get logo URL - convert local paths to Supabase Storage URLs
                const logoUrl = getGameLogoUrl(game.logo_url) || LOGO_MAP[game.name.toLowerCase()] || LOGO_MAP[game.id.toLowerCase()];
                
                const filtered = gameScores[game.id] || [];
                return (
                <section key={game.id} className={`flex flex-col ${isMobile ? 'min-h-[400px]' : 'h-full flex-1 min-w-0'}`}>
                  {/* Card containing logo, scores and QR code */}
                  <Card 
                    className="bg-black/30 border-white/20 flex-1 flex flex-col cursor-pointer hover:scale-[1.02] transition-transform duration-200"
                    onClick={() => handleGameLogoClick(game)}
                    title={`Click to submit score for ${game.name}`}
                  >
                      <CardHeader className="pb-1 pt-2">
                        {/* Game logo inside card header */}
                        <div className="flex justify-center">
                          <div className="transition-transform duration-200">
                            {logoUrl ? (
                              <img 
                                src={logoUrl} 
                                alt={game.name} 
                                className="h-32 md:h-40 w-auto object-contain max-w-full"
                              />
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
                          <div className="space-y-2">
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
              {games.length === 0 && (
                <div className="col-span-full text-center py-8 text-gray-400">
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

        <SpinTheWheel
          isOpen={isSpinWheelOpen}
          onClose={() => setIsSpinWheelOpen(false)}
          leaderboardNames={getLeaderboardNames}
        />
      </div>
    </div>
  );
};

export default Index;