import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import LeaderboardEntry from "@/components/LeaderboardEntry";
import QRCodeDisplay from "@/components/QRCodeDisplay";
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

  // Load games from database
  const loadGames = async () => {
    try {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('is_active', true)
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

  if (loading || gamesLoading) {
    return (
      <div className="min-h-screen bg-arcade-background flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-arcade-background text-white p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-arcade-neonPink via-arcade-neonCyan to-arcade-neonYellow text-transparent bg-clip-text">
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
    <div className="min-h-screen bg-arcade-background text-white p-4 md:p-8">
      <div className="w-full space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-arcade-neonPink via-arcade-neonCyan to-arcade-neonYellow text-transparent bg-clip-text">
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
        
        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4">
          {games.map((game) => {
            // Get logo URL - either from database, fallback mapping, or null
            const logoUrl = game.logo_url || LOGO_MAP[game.name.toLowerCase()] || LOGO_MAP[game.id.toLowerCase()];
            
            const filtered = scores
              .filter((score) => score.game_id === game.id)
              .sort((a, b) => b.score - a.score);
            return (
              <section key={game.id} className="space-y-4">
                <div className="flex justify-center">
                  {logoUrl ? (
                    <img 
                      src={logoUrl} 
                      alt={game.name} 
                      className="h-16 w-auto object-contain"
                    />
                  ) : (
                    <div className="h-16 flex items-center justify-center bg-black/30 rounded-lg px-4">
                      <span className="text-white font-bold text-lg">{game.name}</span>
                    </div>
                  )}
                </div>
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

                <QRCodeDisplay gameId={game.id} gameName={game.name} />
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
  );
};

export default Index;