import React, { useState, useEffect, useCallback } from 'react';
import { Trophy, Medal, Award } from "lucide-react";
import { formatScore } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DemolitionManScore {
  player_name: string;
  score: number;
  created_at: string;
  id: string;
}

const DemolitionManLeaderboard = React.memo(() => {
  const [scores, setScores] = useState<DemolitionManScore[]>([]);
  const [loading, setLoading] = useState(true);

  const getDemolitionRankIcon = useCallback((index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="w-8 h-8 text-red-400" />;
      case 1:
        return <Medal className="w-8 h-8 text-orange-300" />;
      case 2:
        return <Award className="w-8 h-8 text-yellow-600" />;
      default:
        return <span className="w-8 h-8 flex items-center justify-center text-lg font-bold text-white">#{index + 1}</span>;
    }
  }, []);

  const loadDemolitionManScores = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get Demolition Man game ID
      const { data: demolitionGame } = await supabase
        .from('games')
        .select('id')
        .eq('name', 'Demolition Man')
        .single();

      if (!demolitionGame) {
        console.log('Demolition Man game not found');
        setScores([]);
        return;
      }

      // Get top scores for Demolition Man (eternal leaderboard)
      const { data: scoresData, error } = await supabase
        .from('scores')
        .select('player_name, score, created_at, id')
        .eq('game_id', demolitionGame.id)
        .order('score', { ascending: false })
        .limit(10); // Top 10 scores

      if (error) {
        console.error('Error loading Demolition Man scores:', error);
        setScores([]);
      } else {
        setScores(scoresData || []);
      }
    } catch (error) {
      console.error('Error in loadDemolitionManScores:', error);
      setScores([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDemolitionManScores();
  }, [loadDemolitionManScores]);

  if (loading) {
    return (
      <Card className="bg-black/30 border-red-500/30 h-full">
        <CardHeader>
          <CardTitle className="text-red-400 text-xl font-bold">
            🔥 Eternal Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-white py-8">Loading scores...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-black/30 border-red-500/30 h-full">
      <CardHeader>
        <CardTitle className="text-red-400 text-xl font-bold flex items-center gap-2">
          🔥 Eternal Leaderboard
          <span className="text-sm text-gray-400">({scores.length} scores)</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 overflow-y-auto max-h-96">
          {scores.map((score, index) => (
            <div 
              key={score.id} 
              className="flex items-center justify-between py-2 px-3 bg-black/20 rounded-lg border border-red-500/20 hover:border-red-500/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                {getDemolitionRankIcon(index)}
                <div>
                  <div 
                    className="font-arcade font-bold text-lg animated-gradient"
                    style={{ animationDelay: `${index * 0.15}s` }}
                  >
                    {score.player_name}
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(score.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <div 
                className="text-right font-bold font-arcade text-lg animated-gradient"
                style={{ animationDelay: `${index * 0.15 + 0.3}s` }}
              >
                {formatScore(score.score)}
              </div>
            </div>
          ))}
          {scores.length === 0 && (
            <div className="text-center text-gray-400 py-8">
              <div className="text-6xl mb-4">🎯</div>
              <div className="text-lg font-bold mb-2">No scores yet!</div>
              <div className="text-sm">Be the first to submit a Demolition Man score.</div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

DemolitionManLeaderboard.displayName = 'DemolitionManLeaderboard';

export default DemolitionManLeaderboard;
