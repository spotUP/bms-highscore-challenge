import React, { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, Plus } from "lucide-react";
import { formatScore } from '@/lib/utils';
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

interface Score {
  id: string;
  player_name: string;
  score: number;
  game_id: string;
  created_at: string;
  updated_at: string;
  games?: {
    name: string;
  };
}

interface CompetitionScore {
  id: string;
  player_name: string;
  score: number;
  game_name: string;
  rank_in_game: number;
  ranking_points: number;
  created_at: string;
}

interface Competition {
  id: string;
  competition_name: string;
  start_date: string;
  end_date: string;
  total_players: number;
  total_games: number;
  total_scores: number;
}

interface Game {
  id: string;
  name: string;
}

const ScoreManager = () => {
  const [scores, setScores] = useState<Score[]>([]);
  const [competitionScores, setCompetitionScores] = useState<CompetitionScore[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingScore, setEditingScore] = useState<Score | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCompetition, setSelectedCompetition] = useState<string>("current");
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [localScores, setLocalScores] = useState<Score[]>([]);
  const [formData, setFormData] = useState({
    player_name: "",
    score: "",
    game_id: ""
  });
  const { toast } = useToast();

  // Load scores and games
  const loadData = async () => {
    try {
      // Load games
      const { data: gamesData, error: gamesError } = await supabase
        .from('games')
        .select('id, name')
        .eq('is_active', true)
        .eq('include_in_challenge', true)
        .order('name');

      if (gamesError) throw gamesError;
      setGames(gamesData || []);

      // Load competitions
      const { data: competitionsData, error: competitionsError } = await supabase
        .from('competition_history')
        .select('*')
        .order('end_date', { ascending: false });

      if (competitionsError) throw competitionsError;
      setCompetitions(competitionsData || []);

      // Load current scores with game names
      const { data: scoresData, error: scoresError } = await supabase
        .from('scores')
        .select(`
          *,
          games!inner (
            name,
            include_in_challenge
          )
        `)
        .eq('games.include_in_challenge', true)
        .order('score', { ascending: false });

      if (scoresError) throw scoresError;
      setScores(scoresData || []);

      // Load competition scores if a specific competition is selected
      if (selectedCompetition !== "current") {
        await loadCompetitionScores(selectedCompetition);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Load scores for a specific competition
  const loadCompetitionScores = async (competitionId: string) => {
    try {
      const { data: competitionScoresData, error: competitionScoresError } = await supabase
        .from('competition_scores')
        .select('*')
        .eq('competition_id', competitionId)
        .order('score', { ascending: false });

      if (competitionScoresError) throw competitionScoresError;
      setCompetitionScores(competitionScoresData || []);
    } catch (error) {
      console.error('Error loading competition scores:', error);
      toast({
        title: "Error",
        description: "Failed to load competition scores",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update local scores when scores change
  useEffect(() => {
    setLocalScores(scores);
  }, [scores]);

  // Load competition scores when selection changes
  useEffect(() => {
    if (selectedCompetition !== "current" && competitions.length > 0) {
      loadCompetitionScores(selectedCompetition);
    }
  }, [selectedCompetition, competitions]);

  // Reset form
  const resetForm = () => {
    setFormData({
      player_name: "",
      score: "",
      game_id: ""
    });
    setEditingScore(null);
  };

  // Open dialog for editing
  const openEditDialog = (score: Score) => {
    setEditingScore(score);
    setFormData({
      player_name: score.player_name,
      score: score.score.toString(),
      game_id: score.game_id
    });
    setIsDialogOpen(true);
  };

  // Save score (create or update)
  const saveScore = async () => {
    if (!formData.player_name.trim() || !formData.score || !formData.game_id) {
      toast({
        title: "Error",
        description: "All fields are required",
        variant: "destructive"
      });
      return;
    }

    if (formData.player_name.length > 50) {
      toast({
        title: "Error",
        description: "Player name must be 50 characters or less",
        variant: "destructive"
      });
      return;
    }

    const scoreValue = parseInt(formData.score);
    if (isNaN(scoreValue) || scoreValue <= 0 || scoreValue > 999999999) {
      toast({
        title: "Error",
        description: "Score must be between 1 and 999,999,999",
        variant: "destructive"
      });
      return;
    }

    try {
      // Check rate limiting for new scores (not edits)
      if (!editingScore) {
        const { data: rateLimitCheck, error: rateLimitError } = await supabase
          .rpc('check_score_submission_rate_limit');
        
        if (rateLimitError) {
          console.error('Rate limit check error:', rateLimitError);
        } else if (!rateLimitCheck) {
          toast({
            title: "Rate Limit Exceeded",
            description: "You can only submit 10 scores per hour. Please wait before submitting again.",
            variant: "destructive",
          });
          return;
        }
      }

      if (editingScore) {
        // Update existing score - always allow admin to update
        const { error } = await supabase
          .from('scores')
          .update({
            player_name: formData.player_name.toUpperCase(),
            score: scoreValue,
            game_id: formData.game_id
          })
          .eq('id', editingScore.id);

        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Score updated successfully"
        });
      } else {
        // Create new score - check for existing score and handle appropriately
        const { data: existingScore, error: fetchError } = await supabase
          .from('scores')
          .select('*')
          .eq('player_name', formData.player_name.toUpperCase())
          .eq('game_id', formData.game_id)
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (existingScore) {
          // Update existing score instead of creating new one
          const { error } = await supabase
            .from('scores')
            .update({
              score: scoreValue,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingScore.id);

          if (error) throw error;
          
          toast({
            title: "Score Updated",
            description: `Updated ${formData.player_name}'s score (was: ${existingScore.score.toLocaleString()}, now: ${scoreValue.toLocaleString()})`
          });
        } else {
          // Create new score
          const { error } = await supabase
            .from('scores')
            .insert({
              player_name: formData.player_name.toUpperCase(),
              score: scoreValue,
              game_id: formData.game_id,
              tournament_id: formData.game_id // Use game_id as tournament_id for now
            });

          if (error) throw error;
          
          toast({
            title: "Success",
            description: "Score created successfully"
          });
        }
      }

      setIsDialogOpen(false);
      resetForm();
      loadData();
    } catch (error: any) {
      console.error('Error saving score:', error);
      
      // Handle specific constraint violations with user-friendly messages
      if (error.message?.includes('score_positive')) {
        toast({
          title: "Invalid Score",
          description: "Score must be a positive number",
          variant: "destructive",
        });
      } else if (error.message?.includes('score_reasonable')) {
        toast({
          title: "Invalid Score", 
          description: "Score is too high (maximum: 999,999,999)",
          variant: "destructive",
        });
      } else if (error.message?.includes('player_name_length')) {
        toast({
          title: "Invalid Player Name",
          description: "Player name must be between 1 and 50 characters",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to save score",
          variant: "destructive",
        });
      }
    }
  };

  // Animated delete handler
  const handleAnimatedDelete = async (score: Score) => {
    // Start the fade-out animation
    setDeletingIds(prev => new Set([...prev, score.id]));

    // Wait for animation, then remove from state (this will trigger the slide-up)
    setTimeout(() => {
      setLocalScores(prev => prev.filter(s => s.id !== score.id));
      // Call the actual delete function
      confirmDeleteScore(score.id);

      // Clean up animation state after a brief delay to let the slide-up complete
      setTimeout(() => {
        setDeletingIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(score.id);
          return newSet;
        });
      }, 50);
    }, 280); // Slightly before animation completes
  };

  // Delete score via confirmation dialog
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const handleDeleteScore = (id: string) => setDeleteDialog({ open: true, id });
  const confirmDeleteScore = async (scoreId?: string) => {
    const idToDelete = scoreId || deleteDialog.id;
    if (!idToDelete) return;
    try {
      const { error } = await supabase
        .from('scores')
        .delete()
        .eq('id', idToDelete);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Score deleted successfully"
      });

      if (!scoreId) {
        // Only reload data if this was called via dialog
        loadData();
        setDeleteDialog({ open: false, id: null });
      }
    } catch (error) {
      console.error('Error deleting score:', error);
      toast({
        title: "Error",
        description: "Failed to delete score",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="text-white">Loading scores...</div>
      </div>
    );
  }

  return (
    <>
    <Card className="bg-black/50 border-white/20">
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-1">
            <CardTitle className="text-white">Challenge Scores Management</CardTitle>
            <span className="text-sm text-gray-400">Current competition and historical scores</span>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <Select value={selectedCompetition} onValueChange={setSelectedCompetition}>
                <SelectTrigger className="bg-black/50 border-white/20 text-white w-48">
                  <SelectValue placeholder="Select competition" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-white/20">
                  <SelectItem value="current" className="text-white">
                    Current Competition
                  </SelectItem>
                  {competitions.map((competition) => (
                    <SelectItem key={competition.id} value={competition.id} className="text-white">
                      {competition.competition_name} ({new Date(competition.end_date).toLocaleDateString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {selectedCompetition === "current" && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm} variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Score
                </Button>
              </DialogTrigger>
            <DialogContent className="bg-gray-900 text-white border-white/20">
              <DialogHeader>
                <DialogTitle>
                  {editingScore ? 'Edit Score' : 'Add New Score'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="player_name">Player Name (max 50 chars) *</Label>
                  <Input
                    id="player_name"
                    value={formData.player_name}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      player_name: e.target.value.slice(0, 50)
                    }))}
                    placeholder="Enter player name"
                    maxLength={50}
                    className="bg-black/50 border-white/20 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="score">Score *</Label>
                  <Input
                    id="score"
                    type="number"
                    min="0"
                    value={formData.score}
                    onChange={(e) => setFormData(prev => ({ ...prev, score: e.target.value }))}
                    placeholder="Enter score"
                    className="bg-black/50 border-white/20 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="game_id">Game *</Label>
                  <Select 
                    value={formData.game_id} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, game_id: value }))}
                  >
                    <SelectTrigger className="bg-black/50 border-white/20 text-white">
                      <SelectValue placeholder="Select a game" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-white/20">
                      {games.map((game) => (
                        <SelectItem key={game.id} value={game.id} className="text-white">
                          {game.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={saveScore} variant="outline">
                    {editingScore ? 'Update' : 'Create'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md">
          {/* Header */}
          <div className={`grid gap-2 p-3 border-b bg-muted/50 font-medium text-sm border-white/20 ${
            selectedCompetition === "current" ? 'grid-cols-5' : 'grid-cols-6'
          }`}>
            <div className="text-white">Player</div>
            <div className="text-white">Score</div>
            <div className="text-white">Game</div>
            {selectedCompetition !== "current" && (
              <>
                <div className="text-white">Rank</div>
                <div className="text-white">Points</div>
              </>
            )}
            <div className="text-white">Date</div>
            {selectedCompetition === "current" && (
              <div className="text-white">Actions</div>
            )}
          </div>

          {/* Body */}
          <div>
            {selectedCompetition === "current" ? (
              <>
                {localScores.map((score, index) => (
                  <div
                    key={score.id}
                    className={`grid grid-cols-5 gap-2 p-3 border-white/20 border-b transition-all duration-300 ease-in-out overflow-hidden ${
                      deletingIds.has(score.id)
                        ? 'opacity-0 max-h-0 py-0 scale-y-0'
                        : 'opacity-100 max-h-20 scale-y-100'
                    }`}
                    style={{
                      transformOrigin: 'top',
                      transition: 'all 300ms ease-in-out'
                    }}
                  >
                    <div
                      className="font-arcade font-bold text-2xl animated-gradient"
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >{score.player_name}</div>
                    <div
                      className="font-bold font-arcade text-xl animated-gradient"
                      style={{ animationDelay: `${index * 0.1 + 0.2}s` }}
                    >
                      {formatScore(score.score)}
                    </div>
                    <div className="text-gray-300">{score.games?.name || 'Unknown'}</div>
                    <div className="text-gray-300">
                      {new Date(score.created_at).toLocaleDateString()}
                    </div>
                    <div>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(score)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-500 hover:border-red-400 hover:bg-red-500/10"
                          onClick={() => handleAnimatedDelete(score)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {scores.length === 0 && (
                  <div className="col-span-5 text-center text-gray-400 py-8">
                    No scores found. Add the first score!
                  </div>
                )}
              </>
            ) : (
              <>
                {competitionScores.map((score, index) => (
                  <TableRow key={score.id} className="border-white/20">
                    <TableCell 
                      className="font-arcade font-bold text-2xl animated-gradient"
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >{score.player_name}</TableCell>
                    <TableCell 
                      className="font-bold font-arcade text-xl animated-gradient"
                      style={{ animationDelay: `${index * 0.1 + 0.2}s` }}
                    >
                      {formatScore(score.score)}
                    </TableCell>
                    <TableCell className="text-gray-300">{score.game_name}</TableCell>
                    <TableCell className="text-center">
                      <div className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                        score.rank_in_game === 1 ? 'bg-yellow-500 text-black' : 
                        score.rank_in_game === 2 ? 'bg-gray-400 text-black' : 
                        score.rank_in_game === 3 ? 'bg-orange-600 text-white' : 
                        'bg-gray-600 text-white'
                      }`}>
                        {score.rank_in_game}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-bold text-arcade-neonCyan">{score.ranking_points}</span>
                    </TableCell>
                    <TableCell className="text-gray-300">
                      {new Date(score.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
                {competitionScores.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-400 py-8">
                      No archived scores found for this competition.
                    </TableCell>
                  </TableRow>
                )}
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
    <ConfirmationDialog
      open={deleteDialog.open}
      onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}
      title="Delete Score"
      description="Are you sure you want to delete this score? This action cannot be undone."
      confirmText="Delete Score"
      cancelText="Cancel"
      variant="outline"
      onConfirm={confirmDeleteScore}
    />
  </>
  );
};

export default ScoreManager;