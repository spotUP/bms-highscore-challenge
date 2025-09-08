import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getCardStyle, getTypographyStyle } from '@/utils/designSystem';

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
      { range: '0-1K', min: 0, max: 1000, count: 0, color: '#ff00ff' }, // arcade-neonPink
      { range: '1K-5K', min: 1000, max: 5000, count: 0, color: '#00ffff' }, // arcade-neonCyan
      { range: '5K-10K', min: 5000, max: 10000, count: 0, color: '#ffff00' }, // arcade-neonYellow
      { range: '10K-25K', min: 10000, max: 25000, count: 0, color: '#ff00ff' }, // arcade-neonPink
      { range: '25K-50K', min: 25000, max: 50000, count: 0, color: '#00ffff' }, // arcade-neonCyan
      { range: '50K-100K', min: 50000, max: 100000, count: 0, color: '#ffff00' }, // arcade-neonYellow
      { range: '100K+', min: 100000, max: Infinity, count: 0, color: '#ff00ff' }, // arcade-neonPink
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
    <Card className={getCardStyle('primary')}>
      <CardHeader>
        <CardTitle className={getTypographyStyle('h4') + " flex items-center gap-2"}>
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
