import React, { useMemo, useCallback } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getCardStyle, getTypographyStyle } from '@/utils/designSystem';

interface GamePopularityChartProps {
  scores: Array<{
    game_id: string;
    player_name: string;
    score: number;
    created_at: string;
  }>;
  games: Array<{
    id: string;
    name: string;
  }>;
}

const GamePopularityChart: React.FC<GamePopularityChartProps> = React.memo(({ scores, games }) => {
  const chartData = useMemo(() => {
    // Count scores per game
    const gameScoreCounts = scores.reduce((acc, score) => {
      acc[score.game_id] = (acc[score.game_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Create chart data with game names
    return Object.entries(gameScoreCounts)
      .map(([gameId, count]) => {
        const game = games.find(g => g.id === gameId);
        return {
          name: game?.name || 'Unknown Game',
          value: count,
          gameId
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [scores, games]);

  const colors = [
    '#ff00ff', '#00ffff', '#ffff00', '#ff00ff', '#00ffff',
    '#ffff00', '#ff00ff', '#00ffff', '#ffff00', '#ff00ff'
  ];

  const CustomTooltip = useCallback(({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-lg">
          <p className="text-white font-semibold">{data.name}</p>
          <p className="text-arcade-neonCyan">
            {`${data.value} scores submitted`}
          </p>
        </div>
      );
    }
    return null;
  }, []);

  const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.05) return null; // Don't show labels for slices < 5%
    
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        fontSize={12}
        fontWeight="bold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  if (chartData.length === 0) {
    return (
      <Card className="bg-gray-900 border-white/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            🎮 Game Popularity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center text-gray-400">
            No game data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={getCardStyle('primary')}>
      <CardHeader>
        <CardTitle className={getTypographyStyle('h4') + " flex items-center gap-2"}>
          🎮 Game Popularity
        </CardTitle>
        <p className="text-gray-400 text-sm">
          Distribution of score submissions across different games
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={CustomLabel}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {chartData.map((game, index) => (
            <div key={game.gameId} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: colors[index % colors.length] }}
              />
              <span className="text-gray-300 truncate">
                {game.name}: {game.value} scores
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
});

GamePopularityChart.displayName = 'GamePopularityChart';

export default GamePopularityChart;
