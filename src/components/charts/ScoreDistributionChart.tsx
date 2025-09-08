import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ScoreDistributionChartProps {
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

const ScoreDistributionChart: React.FC<ScoreDistributionChartProps> = React.memo(({ scores, games }) => {
  // Create score ranges with useMemo for performance
  const scoreRanges = useMemo(() => {
    const ranges = [
      { range: '0-1K', min: 0, max: 1000, count: 0, color: '#ef4444' },
      { range: '1K-5K', min: 1000, max: 5000, count: 0, color: '#f97316' },
      { range: '5K-10K', min: 5000, max: 10000, count: 0, color: '#eab308' },
      { range: '10K-25K', min: 10000, max: 25000, count: 0, color: '#22c55e' },
      { range: '25K-50K', min: 25000, max: 50000, count: 0, color: '#06b6d4' },
      { range: '50K-100K', min: 50000, max: 100000, count: 0, color: '#3b82f6' },
      { range: '100K+', min: 100000, max: Infinity, count: 0, color: '#8b5cf6' },
    ];

    // Count scores in each range
    scores.forEach(score => {
      const range = ranges.find(r => score.score >= r.min && score.score < r.max);
      if (range) {
        range.count++;
      }
    });

    return ranges;
  }, [scores]);

  const CustomTooltip = React.useCallback(({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-lg">
          <p className="text-white font-semibold">{`Score Range: ${label}`}</p>
          <p className="text-arcade-neonCyan">
            {`Count: ${payload[0].value} scores`}
          </p>
        </div>
      );
    }
    return null;
  }, []);

  return (
    <Card className="bg-gray-900 border-white/20">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          📊 Score Distribution
        </CardTitle>
        <p className="text-gray-400 text-sm">
          Distribution of all submitted scores across different ranges
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={scoreRanges} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="range" 
                stroke="#9ca3af"
                fontSize={12}
                tick={{ fill: '#9ca3af' }}
              />
              <YAxis 
                stroke="#9ca3af"
                fontSize={12}
                tick={{ fill: '#9ca3af' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {scoreRanges.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {scoreRanges.map((range) => (
            <div key={range.range} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: range.color }}
              />
              <span className="text-gray-300">{range.range}: {range.count}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
});

ScoreDistributionChart.displayName = 'ScoreDistributionChart';

export default ScoreDistributionChart;
