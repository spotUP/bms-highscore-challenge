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
          ${rank === 1 ? 'text-yellow-400' : 
            rank === 2 ? 'text-gray-300' : 
            rank === 3 ? 'text-orange-600' : 'text-white'}
        `}>
          #{rank}
        </span>
        <span className={`text-xl font-arcade ${
          rank === 1 ? 'text-yellow-400' : 
          rank === 2 ? 'text-gray-300' : 
          rank === 3 ? 'text-orange-600' : 'text-white'
        }`}>{name}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-xl font-bold font-arcade ${
          rank === 1 ? 'text-yellow-400' : 
          rank === 2 ? 'text-gray-300' : 
          rank === 3 ? 'text-orange-600' : 'text-arcade-neonCyan'
        }`}>{score.toLocaleString()}</span>
        {isNewScore && <Star className="text-arcade-neonYellow animate-glow" />}
      </div>
    </div>
  );
};

export default LeaderboardEntry;