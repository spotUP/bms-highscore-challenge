import React, { useMemo, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PlayerScoreHistoryChartProps {
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
  playerName: string;
}

const PlayerScoreHistoryChart: React.FC<PlayerScoreHistoryChartProps> = React.memo(({ 
  scores, 
  games, 
  playerName 
}) => {
  const chartData = useMemo(() => {
    if (!scores || !Array.isArray(scores) || !playerName) {
      return [];
    }

    // Filter scores for this player
    const playerScores = scores.filter(score => 
      score && 
      score.player_name === playerName && 
      score.created_at && 
      typeof score.score === 'number'
    );
    
    if (playerScores.length === 0) {
      return [];
    }
    
    // Group by date and sum scores
    const scoresByDate = playerScores.reduce((acc, score) => {
      try {
        const date = new Date(score.created_at).toISOString().split('T')[0];
        if (!acc[date]) {
          acc[date] = { date, totalScore: 0, gameCount: 0 };
        }
        acc[date].totalScore += score.score;
        acc[date].gameCount += 1;
      } catch (error) {
        console.warn('Error processing score date:', error, score);
      }
      return acc;
    }, {} as Record<string, { date: string; totalScore: number; gameCount: number }>);

    // Convert to array and sort by date
    return Object.values(scoresByDate).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [scores, playerName]);

  const CustomTooltip = useCallback(({ active, payload, label }: any) => {
    if (active && payload && payload.length && label) {
      return (
        <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-lg">
          <p className="text-white font-semibold mb-2">{`Date: ${new Date(label).toLocaleDateString()}`}</p>
          <p className="text-arcade-neonCyan">
            {`Total Score: ${payload[0].value?.toLocaleString() || 0} points`}
          </p>
          <p className="text-gray-300 text-sm">
            {`Games Played: ${payload[0].payload.gameCount}`}
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
            📈 Score History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-gray-400">
            No score history available for {playerName}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-900 border-white/20">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          📈 Score History
        </CardTitle>
        <p className="text-gray-400 text-sm">
          Daily score progression for {playerName}
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
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
              <Line
                type="monotone"
                dataKey="totalScore"
                stroke="#3b82f6"
                strokeWidth={3}
                dot={{ fill: '#3b82f6', strokeWidth: 2, r: 5 }}
                activeDot={{ r: 7, stroke: '#3b82f6', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
});

PlayerScoreHistoryChart.displayName = 'PlayerScoreHistoryChart';

export default PlayerScoreHistoryChart;
