import React, { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
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

const MobileEntry = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const gameId = searchParams.get("game");
  const [name, setName] = useState("");
  const [score, setScore] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const game = GAMES.find(g => g.id === gameId);

  if (!game) {
    return (
      <div className="min-h-screen bg-arcade-background text-white p-4 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-arcade-neonPink mb-4">Invalid Game</h1>
          <p className="text-gray-400">Game not found.</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !score) {
      toast.error("Please enter both name and score");
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Here you would typically send the data to your backend
      // For now, we'll use localStorage to simulate the submission
      const scores = JSON.parse(localStorage.getItem('arcade-scores') || '[]');
      const newScore = {
        id: Date.now(),
        name: name.toUpperCase(),
        score: parseInt(score),
        gameId: game.id,
        timestamp: new Date().toISOString(),
        isNew: true,
      };
      
      scores.push(newScore);
      localStorage.setItem('arcade-scores', JSON.stringify(scores));
      
      toast.success("Score submitted successfully!");
      setName("");
      setScore("");
      
      // Navigate back to main page after a short delay
      setTimeout(() => {
        navigate("/");
      }, 2000);
      
    } catch (error) {
      toast.error("Failed to submit score. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-arcade-background text-white p-4">
      <div className="max-w-md mx-auto space-y-6 pt-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-arcade-neonPink via-arcade-neonCyan to-arcade-neonYellow text-transparent bg-clip-text mb-2">
            Submit Score
          </h1>
          <div className="flex justify-center">
            <img 
              src={game.logo} 
              alt={game.name} 
              className="h-12 w-auto object-contain"
            />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6 bg-black/20 rounded-lg backdrop-blur-sm">
          <div className="flex items-center gap-2 justify-center mb-4">
            <Trophy className="animate-glow text-arcade-neonYellow" />
            <span className="text-lg font-semibold">Enter Your Score</span>
          </div>
          
          <div className="space-y-4">
            <Input
              type="text"
              placeholder="Player Name (3 characters)"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 3))}
              maxLength={3}
              className="bg-black/30 border-arcade-neonCyan text-white text-center text-lg"
              autoFocus
            />
            <Input
              type="number"
              placeholder="Score"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              className="bg-black/30 border-arcade-neonPink text-white text-center text-lg"
            />
            <Button 
              type="submit"
              className="w-full bg-arcade-neonYellow hover:bg-arcade-neonYellow/80 text-black font-bold text-lg py-3"
              disabled={!name || !score || isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Submit Score"}
            </Button>
          </div>
        </form>

        <div className="text-center">
          <Button
            variant="outline"
            onClick={() => navigate("/")}
            className="border-arcade-neonCyan text-arcade-neonCyan hover:bg-arcade-neonCyan hover:text-black"
          >
            Back to Leaderboard
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MobileEntry;