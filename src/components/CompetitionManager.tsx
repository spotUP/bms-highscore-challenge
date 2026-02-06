import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import { useCompetitionWebhooks } from '@/hooks/useCompetitionWebhooks';
import { Play, Square, Calendar, Clock, Trophy, Settings } from 'lucide-react';

interface Competition {
  id?: string;
  name: string;
  description?: string;
  start_time: string;
  end_time: string;
  status: 'scheduled' | 'active' | 'completed';
  created_by?: string;
  created_at?: string;
}

const CompetitionManager: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { sendCompetitionStartedWebhook, sendCompetitionEndedWebhook } = useCompetitionWebhooks();

  const [currentCompetition, setCurrentCompetition] = useState<Competition | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [newCompetition, setNewCompetition] = useState<Partial<Competition>>({
    name: '',
    description: '',
    start_time: '',
    end_time: ''
  });

  useEffect(() => {
    loadCurrentCompetition();
  }, []);

  const loadCurrentCompetition = async () => {
    try {
      // For now, we'll check if there are active games as a proxy for an active competition
      const { data: games, error } = await api
        .from('games')
        .select('*');

      if (error) {
        console.error('Error loading games:', error);
        return;
      }

      if (games && games.length > 0) {
        // If there are games, assume there's an active competition
        const mockCompetition: Competition = {
          id: 'current',
          name: `Competition ${new Date().toLocaleDateString()}`,
          start_time: new Date().toISOString(),
          end_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
          status: 'active'
        };
        setCurrentCompetition(mockCompetition);
      }
    } catch (error) {
      console.error('Error loading current competition:', error);
    }
  };

  const startCompetition = async (competition?: Competition) => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Check if there are games available
      const { data: games, error: gamesError } = await api
        .from('games')
        .select('*');

      if (gamesError) throw gamesError;

      if (!games || games.length === 0) {
        toast({
          title: "No Games Available",
          description: "Please add some games to the competition first using 'Randomize Games'.",
          variant: "destructive",
        });
        return;
      }

      const competitionToStart = competition || currentCompetition || {
        name: `Competition ${new Date().toLocaleDateString()}`,
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'active' as const
      };

      // Update competition status
      const updatedCompetition = {
        ...competitionToStart,
        status: 'active' as const,
        start_time: new Date().toISOString()
      };

      setCurrentCompetition(updatedCompetition);

      // Send webhook notification
      const gamesForWebhook = games.map(game => ({
        id: game.id,
        name: game.name,
        logo_url: game.logo_url || undefined
      }));

      await sendCompetitionStartedWebhook(gamesForWebhook, competitionToStart.name);

      toast({
        title: "Competition Started! 🚀",
        description: `${competitionToStart.name} is now active. Webhook notifications sent.`,
      });

    } catch (error) {
      console.error('Error starting competition:', error);
      toast({
        title: "Error",
        description: "Failed to start competition",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const endCompetition = async () => {
    if (!user || !currentCompetition) return;

    setIsLoading(true);
    try {
      // Get competition results
      const [gamesResult, scoresResult, winnerResult] = await Promise.all([
        api
          .from('games')
          .select('id, name, logo_url'),
        api
          .from('scores')
          .select('player_name, score'),
        api
          .from('scores')
          .select('player_name, score')
          .order('score', { ascending: false })
          .limit(1)
          .single()
      ]);

      const games = gamesResult.data || [];
      const scores = scoresResult.data || [];
      const winner = winnerResult.data;

      // Update competition status
      const updatedCompetition = {
        ...currentCompetition,
        status: 'completed' as const,
        end_time: new Date().toISOString()
      };

      // Send webhook notification
      const gamesForWebhook = games.map(game => ({
        id: game.id,
        name: game.name,
        logo_url: game.logo_url || undefined
      }));

      const winnerData = winner ? {
        player_name: winner.player_name,
        total_score: winner.score
      } : undefined;

      await sendCompetitionEndedWebhook(
        gamesForWebhook,
        currentCompetition.name,
        undefined, // duration - could calculate from start/end time
        scores.length,
        winnerData
      );

      setCurrentCompetition(null);

      toast({
        title: "Competition Ended! 🏁",
        description: `${currentCompetition.name} has been completed. Results webhook sent.`,
      });

    } catch (error) {
      console.error('Error ending competition:', error);
      toast({
        title: "Error",
        description: "Failed to end competition",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createScheduledCompetition = async () => {
    if (!user || !newCompetition.name || !newCompetition.start_time || !newCompetition.end_time) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const competition: Competition = {
      name: newCompetition.name,
      description: newCompetition.description,
      start_time: newCompetition.start_time,
      end_time: newCompetition.end_time,
      status: 'scheduled'
    };

    setCurrentCompetition(competition);
    setIsCreateDialogOpen(false);
    setNewCompetition({ name: '', description: '', start_time: '', end_time: '' });

    toast({
      title: "Competition Scheduled! 📅",
      description: `${competition.name} has been scheduled for ${new Date(competition.start_time).toLocaleString()}`,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-600/20 text-blue-400';
      case 'active': return 'bg-green-600/20 text-green-400';
      case 'completed': return 'bg-gray-600/20 text-gray-300';
      default: return 'bg-gray-600/20 text-gray-300';
    }
  };

  const isStartTimeReached = (startTime: string) => {
    return new Date(startTime) <= new Date();
  };

  return (
    <Card className="bg-gray-900 border-white/20">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Trophy className="w-5 h-5" />
          Competition Manager
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* Current Competition Status */}
        {currentCompetition ? (
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-0">
                  <h3 className="text-lg font-semibold text-white leading-tight">{currentCompetition.name}</h3>
                  <Badge className={getStatusColor(currentCompetition.status)}>
                    {currentCompetition.status.toUpperCase()}
                  </Badge>
                </div>
                {currentCompetition.description && (
                  <p className="text-gray-400 text-sm mt-1 mb-0 leading-tight">{currentCompetition.description}</p>
                )}
                <div className="flex flex-wrap items-center gap-6 text-sm text-gray-300 mt-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>Start: {new Date(currentCompetition.start_time).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>End: {new Date(currentCompetition.end_time).toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center ml-4">
                {currentCompetition.status === 'active' && (
                  <Button
                    onClick={endCompetition}
                    disabled={isLoading}
                    variant="outline"
                    size="sm"
                  >
                    <Square className="w-4 h-4 mr-2" />
                    {isLoading ? 'Ending...' : 'End Competition'}
                  </Button>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              {currentCompetition.status === 'scheduled' && (
                <Button
                  onClick={() => startCompetition(currentCompetition)}
                  disabled={isLoading || !isStartTimeReached(currentCompetition.start_time)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Play className="w-4 h-4 mr-2" />
                  {isLoading ? 'Starting...' : 'Start Competition'}
                </Button>
              )}

              {currentCompetition.status === 'scheduled' && !isStartTimeReached(currentCompetition.start_time) && (
                <p className="text-sm text-yellow-400 flex items-center">
                  ⏳ Competition will be available to start at scheduled time
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No active competition</p>
            <p className="text-sm">Create a new competition to get started</p>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-3">
          {!currentCompetition && (
            <Button
              onClick={() => startCompetition()}
              disabled={isLoading}
              variant="outline"
              className="bg-green-600 hover:bg-green-700"
            >
              <Play className="w-4 h-4 mr-2" />
              Start Competition Now
            </Button>
          )}

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={!!currentCompetition}>
                <Calendar className="w-4 h-4 mr-2" />
                Schedule Competition
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-gray-900 text-white border-white/20">
              <DialogHeader>
                <DialogTitle>Schedule New Competition</DialogTitle>
                <DialogDescription>
                  Create a scheduled competition with specific start and end times.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="comp-name">Competition Name</Label>
                  <Input
                    id="comp-name"
                    value={newCompetition.name}
                    onChange={(e) => setNewCompetition(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Spring Championship 2024"
                    className="bg-gray-800 border-gray-600"
                  />
                </div>


                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start-time">Start Date & Time</Label>
                    <Input
                      id="start-time"
                      type="datetime-local"
                      value={newCompetition.start_time}
                      onChange={(e) => setNewCompetition(prev => ({ ...prev, start_time: e.target.value }))}
                      className="bg-gray-800 border-gray-600"
                    />
                  </div>

                  <div>
                    <Label htmlFor="end-time">End Date & Time</Label>
                    <Input
                      id="end-time"
                      type="datetime-local"
                      value={newCompetition.end_time}
                      onChange={(e) => setNewCompetition(prev => ({ ...prev, end_time: e.target.value }))}
                      className="bg-gray-800 border-gray-600"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={createScheduledCompetition} variant="outline">
                  Schedule Competition
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Info */}
        <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4 text-sm text-blue-200">
          <div className="flex items-start gap-2">
            <Settings className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium mb-1">Competition Lifecycle</p>
              <ul className="space-y-1 text-blue-300/80">
                <li>• Use "Randomize Games" to select games for your competition (setup only)</li>
                <li>• Use "Start Competition" to officially begin and send webhook notifications</li>
                <li>• Schedule competitions with specific start/end times for better organization</li>
                <li>• "End Competition" will archive results and send completion webhooks</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CompetitionManager;