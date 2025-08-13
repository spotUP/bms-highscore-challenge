import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import LeaderboardEntry from "@/components/LeaderboardEntry";
import QRCodeDisplay from "@/components/QRCodeDisplay";
import pacmanLogo from "@/assets/pacman-logo.png";
import spaceInvadersLogo from "@/assets/space-invaders-logo.png";
import tetrisLogo from "@/assets/tetris-logo.png";
import donkeyKongLogo from "@/assets/donkey-kong-logo.png";

const GAMES = [
  { id: "pacman", name: "Pac-Man", logo: pacmanLogo },
  { id: "spaceinvaders", name: "Space Invaders", logo: spaceInvadersLogo },
  { id: "tetris", name: "Tetris", logo: tetrisLogo },
  { id: "donkeykong", name: "Donkey Kong", logo: donkeyKongLogo },
];

interface Score {
  id: number;
  name: string;
  score: number;
  gameId: string;
  timestamp: Date;
  isNew?: boolean;
}

const Index = () => {
  const { user, loading, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [scores, setScores] = useState<Score[]>([
    { id: 1, name: "ASH", score: 100000, gameId: "pacman", timestamp: new Date() },
    { id: 2, name: "ZAK", score: 95000, gameId: "pacman", timestamp: new Date() },
    { id: 3, name: "MEG", score: 90000, gameId: "pacman", timestamp: new Date() },
  ]);

  // Load scores from localStorage on mount and listen for updates
  useEffect(() => {
    const loadScores = () => {
      const savedScores = localStorage.getItem('arcade-scores');
      if (savedScores) {
        const parsed = JSON.parse(savedScores);
        // Merge with default scores, avoiding duplicates
        const merged = [...scores];
        parsed.forEach((savedScore: Score) => {
          if (!merged.find(s => s.id === savedScore.id)) {
            merged.push({
              ...savedScore,
              timestamp: new Date(savedScore.timestamp)
            });
          }
        });
        setScores(merged.sort((a, b) => b.score - a.score));
      }
    };

    loadScores();
    
    // Listen for storage changes (when mobile form submits)
    const handleStorageChange = () => {
      loadScores();
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Also check for updates periodically
    const interval = setInterval(loadScores, 2000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  if (loading) {
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
      <div className="max-w-4xl mx-auto space-y-8">
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
          {GAMES.map((game) => {
            const filtered = scores
              .filter((score) => score.gameId === game.id)
              .sort((a, b) => b.score - a.score);
            return (
              <section key={game.id} className="space-y-4">
                <div className="flex justify-center">
                  <img 
                    src={game.logo} 
                    alt={game.name} 
                    className="h-16 w-auto object-contain"
                  />
                </div>
                <div className="space-y-2">
                  {filtered.map((score, index) => (
                    <LeaderboardEntry
                      key={score.id}
                      rank={index + 1}
                      name={score.name}
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
        </div>
      </div>
    </div>
  );
};

export default Index;