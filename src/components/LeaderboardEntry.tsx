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
        return <span className="w-12 h-12 flex items-center justify-center text-4xl animate-gold-shine">🏆</span>;
      case 2:
        return <span className="w-12 h-12 flex items-center justify-center text-4xl animate-silver-shine">🥈</span>;
      case 3:
        return <span className="w-12 h-12 flex items-center justify-center text-4xl animate-bronze-shine">🥉</span>;
      default:
        return <span className="w-12 h-12 flex items-center justify-center text-3xl font-bold text-white">#{rank}</span>;
    }
  };

  const waveDelay = (rank - 1) * 0.3; // 300ms delay per rank for more visible wave effect
  const swingDelay = (rank - 1) * 0.2; // 200ms stagger for swinging animation

  return (
    <div
      className="flex items-center justify-between py-1 animate-swing"
      style={{
        animationDelay: `${swingDelay}s`,
        '--wave-delay': `${waveDelay}s`
      } as React.CSSProperties}
    >
      <div className="flex items-center gap-3">
        {getRankIcon(rank)}
        <div className="flex-1">
          <div
            className="font-arcade font-bold text-2xl animated-gradient-vertical"
            style={{ '--wave-delay': `${waveDelay}s` } as React.CSSProperties}
          >
            {name}
          </div>
          <div
            className="text-lg font-arcade animated-gradient-vertical mt-1"
            style={{ '--wave-delay': `${waveDelay}s` } as React.CSSProperties}
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