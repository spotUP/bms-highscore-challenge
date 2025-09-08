import { Star, Trophy, Medal, Award } from "lucide-react";
import { formatScore } from '@/lib/utils';

interface LeaderboardEntryProps {
  rank: number;
  name: string;
  score: number;
  isNewScore?: boolean;
}

const LeaderboardEntry = ({ rank, name, score, isNewScore }: LeaderboardEntryProps) => {
  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-4 h-4 text-yellow-400 animate-gold-shine" />;
      case 2:
        return <Medal className="w-4 h-4 text-gray-300 animate-silver-shine" />;
      case 3:
        return <Award className="w-4 h-4 text-orange-600 animate-bronze-shine" />;
      default:
        return <span className="w-4 h-4 flex items-center justify-center text-xs font-bold text-white">#{rank}</span>;
    }
  };

  return (
    <div className={`
      flex items-center justify-between p-3 rounded-lg border
      ${isNewScore ? 'bg-arcade-neonYellow/20 border-arcade-neonYellow/40 animate-glow' : 
        rank === 1 ? 'bg-yellow-400/10 border-yellow-400/30' :
        rank === 2 ? 'bg-gray-300/10 border-gray-300/30' :
        rank === 3 ? 'bg-orange-600/10 border-orange-600/30' :
        'bg-white/5 border-white/10'
      }
      backdrop-blur-sm transition-all hover:scale-102
    `}>
      <div className="flex items-center gap-3">
        {getRankIcon(rank)}
        <div>
          <div 
            className="font-arcade font-bold text-sm animated-gradient"
            style={{ animationDelay: `${rank * 0.1}s` }}
          >
            {name}
          </div>
          <div 
            className="text-xs font-arcade animated-gradient mt-1"
            style={{ animationDelay: `${rank * 0.1 + 0.2}s` }}
          >
            {formatScore(score)}
          </div>
        </div>
      </div>
      {isNewScore && <Star className="text-arcade-neonYellow animate-glow w-4 h-4" />}
    </div>
  );
};

export default LeaderboardEntry;