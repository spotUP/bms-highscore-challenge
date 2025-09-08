import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const AchievementTest = () => {
  const [achievements, setAchievements] = useState<any[]>([]);
  const [playerAchievements, setPlayerAchievements] = useState<any[]>([]);
  const [playerStats, setPlayerStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    testAchievementSystem();
  }, []);

  const testAchievementSystem = async () => {
    try {
      setLoading(true);
      setError(null);

      // Test achievements table
      const { data: achievementsData, error: achievementsError } = await supabase
        .from('achievements')
        .select('*')
        .limit(5);

      if (achievementsError) {
        throw new Error(`Achievements table error: ${achievementsError.message}`);
      }

      // Test player_achievements table
      const { data: playerAchievementsData, error: playerAchievementsError } = await supabase
        .from('player_achievements')
        .select('*')
        .limit(5);

      if (playerAchievementsError) {
        throw new Error(`Player achievements table error: ${playerAchievementsError.message}`);
      }

      // Test player_stats table
      const { data: playerStatsData, error: playerStatsError } = await supabase
        .from('player_stats')
        .select('*')
        .limit(5);

      if (playerStatsError) {
        throw new Error(`Player stats table error: ${playerStatsError.message}`);
      }

      setAchievements(achievementsData || []);
      setPlayerAchievements(playerAchievementsData || []);
      setPlayerStats(playerStatsData || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const testAchievementTrigger = async () => {
    try {
      // Insert a test score to trigger achievement system
      const { data: games } = await supabase
        .from('games')
        .select('id')
        .limit(1);

      if (!games || games.length === 0) {
        throw new Error('No games found in database');
      }

      const { error } = await supabase
        .from('scores')
        .insert({
          player_name: 'TEST_PLAYER',
          score: 1000,
          game_id: games[0].id
        });

      if (error) {
        throw new Error(`Score insert error: ${error.message}`);
      }

      alert('Test score inserted! Check if achievements were triggered.');
    } catch (err) {
      alert(`Error testing achievement trigger: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  if (loading) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>Achievement System Test</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
            <p className="mt-4">Testing achievement system...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Achievement System Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4">
            <h3 className="text-red-400 font-bold mb-2">Error:</h3>
            <p className="text-red-300">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-white font-bold mb-2">Achievements Table</h3>
            <p className="text-gray-300">Count: {achievements.length}</p>
            {achievements.length > 0 && (
              <div className="mt-2">
                <p className="text-sm text-gray-400">Sample:</p>
                <p className="text-xs text-gray-500">{achievements[0]?.name}</p>
              </div>
            )}
          </div>

          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-white font-bold mb-2">Player Achievements</h3>
            <p className="text-gray-300">Count: {playerAchievements.length}</p>
            {playerAchievements.length > 0 && (
              <div className="mt-2">
                <p className="text-sm text-gray-400">Sample:</p>
                <p className="text-xs text-gray-500">{playerAchievements[0]?.player_name}</p>
              </div>
            )}
          </div>

          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-white font-bold mb-2">Player Stats</h3>
            <p className="text-gray-300">Count: {playerStats.length}</p>
            {playerStats.length > 0 && (
              <div className="mt-2">
                <p className="text-sm text-gray-400">Sample:</p>
                <p className="text-xs text-gray-500">{playerStats[0]?.player_name}</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-4">
          <Button onClick={testAchievementSystem} variant="outline">
            Refresh Test
          </Button>
          <Button onClick={testAchievementTrigger} variant="outline">
            Test Achievement Trigger
          </Button>
        </div>

        {achievements.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-white font-bold mb-2">Available Achievements:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {achievements.map((achievement) => (
                <div key={achievement.id} className="flex items-center gap-2 p-2 bg-gray-700 rounded">
                  <span className="text-lg">{achievement.badge_icon}</span>
                  <div>
                    <p className="text-white text-sm font-medium">{achievement.name}</p>
                    <p className="text-gray-400 text-xs">{achievement.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AchievementTest;
