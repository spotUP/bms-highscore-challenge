import { Star } from "lucide-react";

interface LeaderboardEntryProps {
  rank: number;
  name: string;
  score: number;
  isNewScore?: boolean;
}

const LeaderboardEntry = ({ rank, name, score, isNewScore }: LeaderboardEntryProps) => {
  return (
    <div className={`
      flex items-center justify-between p-4 rounded-lg
      ${isNewScore ? 'bg-arcade-neonYellow/20 animate-glow' : 'bg-black/20'}
      backdrop-blur-sm transition-all hover:scale-102
    `}>
      <div className="flex items-center gap-4">
        <span className={`
          text-2xl font-bold
          ${rank === 1 ? 'text-arcade-neonYellow' : 
            rank === 2 ? 'text-arcade-neonCyan' : 
            rank === 3 ? 'text-arcade-neonPink' : 'text-white'}
        `}>
          #{rank}
        </span>
        <span className="text-white text-xl font-arcade">{name}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-arcade-neonCyan text-xl font-bold font-arcade">{score.toLocaleString()}</span>
        {isNewScore && <Star className="text-arcade-neonYellow animate-glow" />}
      </div>
    </div>
  );
};

export default LeaderboardEntry;