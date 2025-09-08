import React, { useMemo, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PlayerPerformanceChartProps {
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
  selectedPlayers?: string[];
}

const PlayerPerformanceChart: React.FC<PlayerPerformanceChartProps> = React.memo(({ 
  scores, 
  games, 
  selectedPlayers = [] 
}) => {
  const chartData = useMemo(() => {
    // Get top 5 players by total score if no specific players selected
    const playersToShow = selectedPlayers.length > 0 
      ? selectedPlayers 
      : Object.entries(
          scores.reduce((acc, score) => {
            acc[score.player_name] = (acc[score.player_name] || 0) + score.score;
            return acc;
          }, {} as Record<string, number>)
        )
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .map(([name]) => name);

    // Group scores by date and player
    const scoresByDate = scores.reduce((acc, score) => {
      const date = new Date(score.created_at).toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = {};
      }
      if (!acc[date][score.player_name]) {
        acc[date][score.player_name] = 0;
      }
      acc[date][score.player_name] += score.score;
      return acc;
    }, {} as Record<string, Record<string, number>>);

    // Create cumulative data
    const dates = Object.keys(scoresByDate).sort();
    const cumulativeData: Record<string, number> = {};
    
    return dates.map(date => {
      const dayData: any = { date };
      
      playersToShow.forEach(player => {
        const dailyScore = scoresByDate[date]?.[player] || 0;
        cumulativeData[player] = (cumulativeData[player] || 0) + dailyScore;
        dayData[player] = cumulativeData[player];
      });
      
      return dayData;
    });
  }, [scores, selectedPlayers]);

  const colors = [
    '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6',
    '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#6366f1'
  ];

  const CustomTooltip = useCallback(({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-lg">
          <p className="text-white font-semibold mb-2">{`Date: ${label}`}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {`${entry.dataKey}: ${entry.value?.toLocaleString() || 0} points`}
            </p>
          ))}
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
            📈 Player Performance Over Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center text-gray-400">
            No performance data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-900 border-white/20">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          📈 Player Performance Over Time
        </CardTitle>
        <p className="text-gray-400 text-sm">
          Cumulative scores for top players over time
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="date" 
                stroke="#9ca3af"
                fontSize={12}
                tick={{ fill: '#9ca3af' }}
                tickFormatter={(value) => new Date(value).toLocaleDateString()}
              />
              <YAxis 
                stroke="#9ca3af"
                fontSize={12}
                tick={{ fill: '#9ca3af' }}
                tickFormatter={(value) => value.toLocaleString()}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ color: '#9ca3af', fontSize: '12px' }}
              />
              {Object.keys(chartData[0] || {}).filter(key => key !== 'date').map((player, index) => (
                <Line
                  key={player}
                  type="monotone"
                  dataKey={player}
                  stroke={colors[index % colors.length]}
                  strokeWidth={2}
                  dot={{ fill: colors[index % colors.length], strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: colors[index % colors.length], strokeWidth: 2 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
});

PlayerPerformanceChart.displayName = 'PlayerPerformanceChart';

export default PlayerPerformanceChart;
