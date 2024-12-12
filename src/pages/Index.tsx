import { useState } from "react";
import ScoreEntry from "@/components/ScoreEntry";
import LeaderboardEntry from "@/components/LeaderboardEntry";
import GameSelector from "@/components/GameSelector";

const GAMES = [
  { id: "pacman", name: "Pac-Man" },
  { id: "spaceinvaders", name: "Space Invaders" },
  { id: "tetris", name: "Tetris" },
  { id: "donkeykong", name: "Donkey Kong" },
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
  const [selectedGame, setSelectedGame] = useState(GAMES[0].id);
  const [scores, setScores] = useState<Score[]>([
    { id: 1, name: "ASH", score: 100000, gameId: "pacman", timestamp: new Date() },
    { id: 2, name: "ZAK", score: 95000, gameId: "pacman", timestamp: new Date() },
    { id: 3, name: "MEG", score: 90000, gameId: "pacman", timestamp: new Date() },
  ]);

  const handleScoreSubmit = (name: string, score: number) => {
    const newScore = {
      id: scores.length + 1,
      name: name.toUpperCase(),
      score,
      gameId: selectedGame,
      timestamp: new Date(),
      isNew: true,
    };
    
    setScores(prev => [...prev, newScore].sort((a, b) => b.score - a.score));
    
    // Remove the isNew flag after 5 seconds
    setTimeout(() => {
      setScores(prev => 
        prev.map(score => 
          score.id === newScore.id ? { ...score, isNew: false } : score
        )
      );
    }, 5000);
  };

  const filteredScores = scores
    .filter(score => score.gameId === selectedGame)
    .sort((a, b) => b.score - a.score);

  return (
    <div className="min-h-screen bg-arcade-background text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-4xl md:text-6xl font-bold text-center bg-gradient-to-r from-arcade-neonPink via-arcade-neonCyan to-arcade-neonYellow text-transparent bg-clip-text">
          Arcade High Scores
        </h1>
        
        <GameSelector
          games={GAMES}
          selectedGame={selectedGame}
          onSelect={setSelectedGame}
        />

        <div className="grid md:grid-cols-[2fr,1fr] gap-8">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-arcade-neonCyan">Leaderboard</h2>
            <div className="space-y-2">
              {filteredScores.map((score, index) => (
                <LeaderboardEntry
                  key={score.id}
                  rank={index + 1}
                  name={score.name}
                  score={score.score}
                  isNewScore={score.isNew}
                />
              ))}
              {filteredScores.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  No scores yet. Be the first to submit!
                </div>
              )}
            </div>
          </div>

          <div>
            <ScoreEntry onSubmit={handleScoreSubmit} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;