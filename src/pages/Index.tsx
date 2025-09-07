import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import LeaderboardEntry from "@/components/LeaderboardEntry";
import QRCodeDisplay from "@/components/QRCodeDisplay";
import OverallLeaderboard from "@/components/OverallLeaderboard";
import ScoreSubmissionDialog from "@/components/ScoreSubmissionDialog";
import SpinTheWheel from "@/components/SpinTheWheel";
import MobileMenu from "@/components/MobileMenu";
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
  const [games, setGames] = useState<Game[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [scores, setScores] = useState<Score[]>([]);
  const [selectedGameForSubmission, setSelectedGameForSubmission] = useState<Game | null>(null);
  const [isSubmissionDialogOpen, setIsSubmissionDialogOpen] = useState(false);
  const [isSpinWheelOpen, setIsSpinWheelOpen] = useState(false);

  // Load games from database
  const loadGames = async () => {
    try {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('is_active', true)
        .eq('include_in_challenge', true)
        .order('name', { ascending: true });

      if (error) throw error;
      setGames(data || []);
    } catch (error) {
      console.error('Error loading games:', error);
      // Fallback to hardcoded games if database fails
      setGames([
        { id: "pacman", name: "Pac-Man", logo_url: null, is_active: true },
        { id: "spaceinvaders", name: "Space Invaders", logo_url: null, is_active: true },
        { id: "tetris", name: "Tetris", logo_url: null, is_active: true },
        { id: "donkeykong", name: "Donkey Kong", logo_url: null, is_active: true },
      ]);
    } finally {
      setGamesLoading(false);
    }
  };

  // Load scores from database
  const loadScores = async () => {
    try {
      const { data, error } = await supabase
        .from('scores')
        .select('*')
        .order('score', { ascending: false });

      if (error) throw error;
      setScores(data || []);
    } catch (error) {
      console.error('Error loading scores:', error);
    }
  };

  useEffect(() => {
    loadGames();
    loadScores();
    
    // Set up real-time subscription for scores
    const channel = supabase
      .channel('scores-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'scores' 
        }, 
        () => {
          loadScores(); // Reload scores when changes occur
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleGameLogoClick = (game: Game) => {
    setSelectedGameForSubmission(game);
    setIsSubmissionDialogOpen(true);
  };

  const handleScoreSubmitted = () => {
    loadScores(); // Reload scores after submission
  };

  // Get unique player names for the wheel
  const getLeaderboardNames = () => {
    const uniqueNames = new Set<string>();
    scores.forEach(score => uniqueNames.add(score.player_name));
    return Array.from(uniqueNames);
  };

  if (loading || gamesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative z-10"
           style={{ background: 'radial-gradient(ellipse at center, rgba(26, 16, 37, 0.9) 0%, rgba(26, 16, 37, 0.7) 100%)' }}>
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white p-4 md:p-8 relative z-10"
         style={{ background: 'radial-gradient(ellipse at center, rgba(26, 16, 37, 0.9) 0%, rgba(26, 16, 37, 0.7) 100%)' }}>
      <div className="w-full space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-4xl md:text-6xl font-bold animated-gradient leading-tight py-2">
            Arcade High Scores
          </h1>
          
          {/* Desktop Menu */}
          <div className="hidden md:flex gap-4 items-center">
            {user ? (
              <>
                <span className="text-gray-300">Welcome, {user.email}</span>
                <Button variant="outline" onClick={() => setIsSpinWheelOpen(true)}>
                  🎡 Spin the Wheel
                </Button>
                {isAdmin && (
                  <Button variant="outline" onClick={() => navigate('/admin')}>
                    Admin Panel
                  </Button>
                )}
                <Button variant="ghost" onClick={signOut}>
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
        
        <div className={`grid gap-4 ${isMobile ? 'min-h-screen' : 'h-[calc(100vh-12rem)] grid-cols-1 lg:grid-cols-6'}`}>
          {/* Left column - Overall Leaderboard (smaller) */}
          <div className={`${isMobile ? 'order-2' : 'h-full lg:col-span-1'}`}>
            <OverallLeaderboard />
          </div>
          
          {/* Right column - Game content (much more space) */}
          <div className={`${isMobile ? 'order-1' : 'h-full lg:col-span-5'}`}>
            <div className={`${isMobile ? 'flex flex-col space-y-6' : 'flex gap-3 h-full'}`}>
              {games.map((game) => {
                // Get logo URL - either from database, fallback mapping, or null
                const logoUrl = game.logo_url || LOGO_MAP[game.name.toLowerCase()] || LOGO_MAP[game.id.toLowerCase()];
                
                const filtered = scores
                  .filter((score) => score.game_id === game.id)
                  .sort((a, b) => b.score - a.score);
                return (
                <section key={game.id} className={`flex flex-col ${isMobile ? 'min-h-[400px]' : 'h-full flex-1 min-w-0'}`}>
                  {/* Card containing logo, scores and QR code */}
                  <Card 
                    className="bg-black/30 border-white/20 flex-1 flex flex-col cursor-pointer hover:scale-[1.02] transition-transform duration-200"
                    onClick={() => handleGameLogoClick(game)}
                    title={`Click to submit score for ${game.name}`}
                  >
                      <CardHeader className="pb-3">
                        {/* Game logo inside card header */}
                        <div className="flex justify-center">
                          <div className="transition-transform duration-200">
                            {logoUrl ? (
                              <img 
                                src={logoUrl} 
                                alt={game.name} 
                                className="h-16 w-auto object-contain"
                              />
                            ) : (
                              <div className="h-16 flex items-center justify-center bg-black/30 rounded-lg px-4 transition-colors">
                                <span className="text-white font-bold text-lg">{game.name}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col">
                        {/* Scores section - scrollable if needed */}
                        <div className="flex-1 overflow-y-auto mb-4">
                          <div className="space-y-2">
                            {filtered.map((score, index) => (
                              <LeaderboardEntry
                                key={score.id}
                                rank={index + 1}
                                name={score.player_name}
                                score={score.score}
                                isNewScore={score.isNew}
                              />
                            ))}
                            {filtered.length === 0 && (
                              <div className="text-center py-8 text-gray-400">
                                No scores yet. Be the first to submit!
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* QR Code - inside card at bottom */}
                        <div className="mt-auto">
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
          leaderboardNames={getLeaderboardNames()}
        />
      </div>
    </div>
  );
};

export default Index;