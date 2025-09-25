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
        return <span className="w-8 h-8 flex items-center justify-center text-2xl animate-gold-shine">🏆</span>;
      case 2:
        return <span className="w-8 h-8 flex items-center justify-center text-2xl animate-silver-shine">🥈</span>;
      case 3:
        return <span className="w-8 h-8 flex items-center justify-center text-2xl animate-bronze-shine">🥉</span>;
      default:
        return <span className="w-8 h-8 flex items-center justify-center text-sm font-bold text-white">#{rank}</span>;
    }
  };

  const waveDelay = (rank - 1) * 0.3; // 300ms delay per rank for more visible wave effect

  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2">
        {getRankIcon(rank)}
        <div className="flex-1 min-w-0">
          <div
            className="font-arcade font-bold text-lg animated-gradient-vertical truncate"
            style={{ '--wave-delay': `${waveDelay}s` } as React.CSSProperties}
          >
            {name}
          </div>
          <div
            className="text-sm font-arcade animated-gradient-vertical mt-1"
            style={{ '--wave-delay': `${waveDelay}s` } as React.CSSProperties}
          >
            {formatScore(score)}
          </div>
        </div>
      </div>
      {isNewScore && <Star className="text-arcade-neonYellow animate-glow w-3 h-3 flex-shrink-0" />}
    </div>
  );
});

LeaderboardEntry.displayName = 'LeaderboardEntry';

export default LeaderboardEntry;