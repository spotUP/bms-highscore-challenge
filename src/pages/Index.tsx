import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import LeaderboardEntry from "@/components/LeaderboardEntry";
import QRCodeDisplay from "@/components/QRCodeDisplay";
import OverallLeaderboard from "@/components/OverallLeaderboard";
import ScoreSubmissionDialog from "@/components/ScoreSubmissionDialog";
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
  const [games, setGames] = useState<Game[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [scores, setScores] = useState<Score[]>([]);
  const [selectedGameForSubmission, setSelectedGameForSubmission] = useState<Game | null>(null);
  const [isSubmissionDialogOpen, setIsSubmissionDialogOpen] = useState(false);

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

  if (loading || gamesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative z-10"
           style={{ background: 'radial-gradient(ellipse at center, rgba(26, 16, 37, 0.9) 0%, rgba(26, 16, 37, 0.7) 100%)' }}>
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen text-white p-4 md:p-8 relative z-10"
           style={{ background: 'radial-gradient(ellipse at center, rgba(26, 16, 37, 0.9) 0%, rgba(26, 16, 37, 0.7) 100%)' }}>
        <div className="max-w-4xl mx-auto space-y-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold animated-gradient">
            Arcade High Scores
          </h1>
          <p className="text-xl text-gray-300">Please sign in to view and manage scores</p>
          <Button onClick={() => navigate('/auth')} size="lg">
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white p-4 md:p-8 relative z-10"
         style={{ background: 'radial-gradient(ellipse at center, rgba(26, 16, 37, 0.9) 0%, rgba(26, 16, 37, 0.7) 100%)' }}>
      <div className="w-full space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-4xl md:text-6xl font-bold animated-gradient">
            Arcade High Scores
          </h1>
          <div className="flex gap-4 items-center">
            <span className="text-gray-300">Welcome, {user.email}</span>
            {isAdmin && (
              <Button variant="outline" onClick={() => navigate('/admin')}>
                Admin Panel
              </Button>
            )}
            <Button variant="ghost" onClick={signOut}>
              Sign Out
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-6 gap-4 h-[calc(100vh-12rem)]">
          {/* Left column - Overall Leaderboard (smaller) */}
          <div className="lg:col-span-1 h-full">
            <OverallLeaderboard />
          </div>
          
          {/* Right column - Game content (much more space) */}
          <div className="lg:col-span-5 h-full">
            <div className="flex gap-3 h-full">
              {games.map((game) => {
                // Get logo URL - either from database, fallback mapping, or null
                const logoUrl = game.logo_url || LOGO_MAP[game.name.toLowerCase()] || LOGO_MAP[game.id.toLowerCase()];
                
                const filtered = scores
                  .filter((score) => score.game_id === game.id)
                  .sort((a, b) => b.score - a.score);
              return (
                <section key={game.id} className="flex flex-col h-full flex-1 min-w-0">
                  {/* Card containing logo, scores and QR code */}
                  <Card className="bg-black/50 border-white/20 flex-1 flex flex-col">
                    <CardHeader className="pb-3">
                      {/* Game logo inside card header */}
                      <div className="flex justify-center mb-2">
                        <div 
                          className="cursor-pointer hover:scale-105 transition-transform duration-200 hover:shadow-lg hover:shadow-arcade-neonCyan/30"
                          onClick={() => handleGameLogoClick(game)}
                          title={`Click to submit score for ${game.name}`}
                        >
                          {logoUrl ? (
                            <img 
                              src={logoUrl} 
                              alt={game.name} 
                              className="h-16 w-auto object-contain"
                            />
                          ) : (
                            <div className="h-16 flex items-center justify-center bg-black/30 rounded-lg px-4 hover:bg-black/50 transition-colors">
                              <span className="text-white font-bold text-lg">{game.name}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <CardTitle className="text-white text-lg text-center">{game.name}</CardTitle>
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
      </div>
    </div>
  );
};

export default Index;