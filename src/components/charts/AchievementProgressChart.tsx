import React, { useMemo, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AchievementProgressChartProps {
  achievements: Array<{
    id: string;
    name: string;
    description: string;
    points: number;
    type: string;
  }>;
  playerAchievements: Array<{
    player_name: string;
    achievement_id: string;
    unlocked_at: string;
  }>;
}

const AchievementProgressChart: React.FC<AchievementProgressChartProps> = React.memo(({ 
  achievements, 
  playerAchievements 
}) => {
  const chartData = useMemo(() => {
    // Count how many players have unlocked each achievement
    const achievementCounts = achievements.map(achievement => {
      const unlockCount = playerAchievements.filter(
        pa => pa.achievement_id === achievement.id
      ).length;
      
      return {
        name: achievement.name,
        unlocked: unlockCount,
        total: playerAchievements.length > 0 ? playerAchievements.length : 1, // Avoid division by zero
        percentage: playerAchievements.length > 0 ? (unlockCount / playerAchievements.length) * 100 : 0,
        points: achievement.points,
        type: achievement.type
      };
    }).sort((a, b) => b.unlocked - a.unlocked);

    return achievementCounts;
  }, [achievements, playerAchievements]);

  const getColorByType = (type: string) => {
    switch (type) {
      case 'first_score': return '#22c55e';
      case 'first_place': return '#f59e0b';
      case 'score_milestone': return '#3b82f6';
      case 'game_master': return '#8b5cf6';
      case 'consistent_player': return '#06b6d4';
      default: return '#6b7280';
    }
  };

  const CustomTooltip = useCallback(({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-lg">
          <p className="text-white font-semibold">{data.name}</p>
          <p className="text-arcade-neonCyan">
            {`${data.unlocked} players unlocked`}
          </p>
          <p className="text-gray-300 text-sm">
            {`${data.percentage.toFixed(1)}% of players`}
          </p>
          <p className="text-yellow-400 text-sm">
            {`${data.points} points`}
          </p>
        </div>
      );
    }
    return null;
  }, []);

  if (chartData.length === 0) {
    return (
      <Card className="bg-gray-900 border-white/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            🏆 Achievement Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center text-gray-400">
            No achievement data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-900 border-white/20">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          🏆 Achievement Progress
        </CardTitle>
        <p className="text-gray-400 text-sm">
          How many players have unlocked each achievement
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={chartData} 
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
              layout="horizontal"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                type="number"
                stroke="#9ca3af"
                fontSize={12}
                tick={{ fill: '#9ca3af' }}
              />
              <YAxis 
                type="category"
                dataKey="name"
                stroke="#9ca3af"
                fontSize={10}
                tick={{ fill: '#9ca3af' }}
                width={120}
                tickFormatter={(value) => value.length > 15 ? value.substring(0, 15) + '...' : value}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="unlocked" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getColorByType(entry.type)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-gray-300">First Score</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span className="text-gray-300">First Place</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-gray-300">Score Milestone</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500" />
            <span className="text-gray-300">Game Master</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-cyan-500" />
            <span className="text-gray-300">Consistent Player</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

AchievementProgressChart.displayName = 'AchievementProgressChart';

export default AchievementProgressChart;
