import React, { useState } from "react";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface ScoreEntryProps {
  onSubmit: (name: string, score: number) => void;
}

const ScoreEntry = ({ onSubmit }: ScoreEntryProps) => {
  const [name, setName] = useState("");
  const [score, setScore] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !score) {
      toast.error("Please enter both name and score");
      return;
    }
    onSubmit(name, parseInt(score));
    setName("");
    setScore("");
    toast.success("Score submitted successfully!");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-6 bg-black/20 rounded-lg backdrop-blur-sm">
      <h2 className="text-2xl font-bold text-arcade-neonYellow flex items-center gap-2">
        <Trophy className="animate-glow" />
        Submit Score
      </h2>
      <div className="space-y-2">
        <Input
          type="text"
          placeholder="Player Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="bg-black/30 border-arcade-neonCyan text-white"
        />
        <Input
          type="number"
          placeholder="Score"
          value={score}
          onChange={(e) => setScore(e.target.value)}
          className="bg-black/30 border-arcade-neonPink text-white"
        />
        <Button 
          type="submit"
          className="w-full bg-arcade-neonCyan hover:bg-arcade-neonCyan/80 text-black font-bold"
        >
          Submit Score
        </Button>
      </div>
    </form>
  );
};

export default ScoreEntry;