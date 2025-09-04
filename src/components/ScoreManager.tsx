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

interface Game {
  id: string;
  name: string;
}

const ScoreManager = () => {
  const [scores, setScores] = useState<Score[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingScore, setEditingScore] = useState<Score | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
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
        .order('name');

      if (gamesError) throw gamesError;
      setGames(gamesData || []);

      // Load scores with game names
      const { data: scoresData, error: scoresError } = await supabase
        .from('scores')
        .select(`
          *,
          games (
            name
          )
        `)
        .order('score', { ascending: false });

      if (scoresError) throw scoresError;
      setScores(scoresData || []);
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

  useEffect(() => {
    loadData();
  }, []);

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
              game_id: formData.game_id
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

  // Delete score
  const deleteScore = async (id: string) => {
    if (!confirm('Are you sure you want to delete this score?')) return;

    try {
      const { error } = await supabase
        .from('scores')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Score deleted successfully"
      });
      
      loadData();
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
    <Card className="bg-black/50 border-white/20">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-white">Scores Management</CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} className="bg-arcade-neonCyan hover:bg-arcade-neonCyan/80">
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
                  <Button onClick={saveScore} className="bg-arcade-neonCyan hover:bg-arcade-neonCyan/80">
                    {editingScore ? 'Update' : 'Create'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="border-white/20">
              <TableHead className="text-white">Player</TableHead>
              <TableHead className="text-white">Score</TableHead>
              <TableHead className="text-white">Game</TableHead>
              <TableHead className="text-white">Date</TableHead>
              <TableHead className="text-white">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scores.map((score) => (
              <TableRow key={score.id} className="border-white/20">
                <TableCell className="font-arcade font-bold animated-gradient">{score.player_name}</TableCell>
                <TableCell className="font-bold font-arcade animated-gradient">
                  {score.score.toLocaleString()}
                </TableCell>
                <TableCell className="text-gray-300">{score.games?.name || 'Unknown'}</TableCell>
                <TableCell className="text-gray-300">
                  {new Date(score.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
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
                      variant="destructive"
                      onClick={() => deleteScore(score.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {scores.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-gray-400 py-8">
                  No scores found. Add the first score!
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default ScoreManager;