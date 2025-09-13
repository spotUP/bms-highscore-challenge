import React from "react";
import { Star, Trophy, Medal, Award } from "lucide-react";
import { formatScore } from '@/lib/utils';

interface LeaderboardEntryProps {
  rank: number;
  name: string;
  score: number;
  isNewScore?: boolean;
}

const LeaderboardEntry = React.memo(({ rank, name, score, isNewScore }: LeaderboardEntryProps) => {

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-12 h-12 text-yellow-400 animate-gold-shine" />;
      case 2:
        return <Medal className="w-12 h-12 text-gray-300 animate-silver-shine" />;
      case 3:
        return <Award className="w-12 h-12 text-orange-600 animate-bronze-shine" />;
      default:
        return <span className="w-12 h-12 flex items-center justify-center text-3xl font-bold text-white">#{rank}</span>;
    }
  };

  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-3">
        {getRankIcon(rank)}
        <div className="flex-1">
          <div 
            className="font-arcade font-bold text-2xl animated-gradient-vertical"
          >
            {name}
          </div>
          <div 
            className="text-lg font-arcade animated-gradient-vertical mt-1"
          >
            {formatScore(score)}
          </div>
        </div>
      </div>
      {isNewScore && <Star className="text-arcade-neonYellow animate-glow w-4 h-4" />}
    </div>
  );
});

LeaderboardEntry.displayName = 'LeaderboardEntry';

export default LeaderboardEntry;