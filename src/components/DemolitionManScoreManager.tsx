import React, { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Pencil, Trash2, Plus, Zap } from "lucide-react";
import { formatScore } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';

interface DemolitionScore {
  id: string;
  player_name: string;
  score: number;
  created_at: string;
  updated_at: string;
}

const DemolitionManScoreManager = () => {
  const [scores, setScores] = useState<DemolitionScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingScore, setEditingScore] = useState<DemolitionScore | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [demolitionManGameId, setDemolitionManGameId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    player_name: "",
    score: ""
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Load Demolition Man game ID and scores
  const loadData = async () => {
    try {
      setLoading(true);
      
      // First ensure Demolition Man game exists and get its ID
      let gameId = demolitionManGameId;
      
      if (!gameId) {
        // Try to find existing game
        const { data: games, error: gameError } = await supabase
          .from('games')
          .select('id')
          .eq('name', 'Demolition Man')
          .single();

        if (games && !gameError) {
          gameId = games.id;
          setDemolitionManGameId(gameId);
        } else {
          console.error('Demolition Man game not found in database');
          return;
        }
      }

      // Load Demolition Man scores
      const { data: scoresData, error: scoresError } = await supabase
        .from('scores')
        .select('id, player_name, score, created_at, updated_at')
        .eq('game_id', gameId)
        .order('score', { ascending: false });

      if (scoresError) throw scoresError;
      setScores(scoresData || []);

    } catch (error: any) {
      console.error('Error loading Demolition Man data:', error);
      toast({
        title: "Error",
        description: "Failed to load Demolition Man scores",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setFormData({ player_name: "", score: "" });
    setEditingScore(null);
  };

  const openEditDialog = (score: DemolitionScore) => {
    setEditingScore(score);
    setFormData({
      player_name: score.player_name,
      score: score.score.toString()
    });
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const saveScore = async () => {
    if (!formData.player_name.trim()) {
      toast({
        title: "Error",
        description: "Player name is required",
        variant: "destructive",
      });
      return;
    }

    if (!formData.score.trim() || isNaN(Number(formData.score)) || Number(formData.score) < 0) {
      toast({
        title: "Error",
        description: "Please enter a valid score",
        variant: "destructive",
      });
      return;
    }

    if (!demolitionManGameId) {
      toast({
        title: "Error",
        description: "Demolition Man game not available",
        variant: "destructive",
      });
      return;
    }

    try {
      const scoreValue = Number(formData.score);
      const playerName = formData.player_name.trim().toUpperCase();

      if (editingScore) {
        // Update existing score
        const { error } = await supabase
          .from('scores')
          .update({
            player_name: playerName,
            score: scoreValue,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingScore.id);

        if (error) throw error;
        
        toast({
          title: "Score Updated",
          description: `Updated ${playerName}'s Demolition Man score`
        });
      } else {
        // Check for existing score from same player
        const existingScore = scores.find(s => s.player_name === playerName);
        
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
            description: `Updated ${playerName}'s Demolition Man score (was: ${existingScore.score.toLocaleString()}, now: ${scoreValue.toLocaleString()})`
          });
        } else {
          // Create new score
          const { error } = await supabase
            .from('scores')
            .insert({
              player_name: playerName,
              score: scoreValue,
              game_id: demolitionManGameId,
              tournament_id: demolitionManGameId, // Use game_id as tournament_id for now
            });

          if (error) throw error;
          
          toast({
            title: "Score Added",
            description: `Added ${playerName}'s Demolition Man score: ${scoreValue.toLocaleString()}`
          });
        }
      }

      setIsDialogOpen(false);
      resetForm();
      loadData();
      
      // Invalidate React Query cache to update all leaderboards
      queryClient.invalidateQueries({ queryKey: ['scores'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
    } catch (error: any) {
      console.error('Error saving Demolition Man score:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save score",
        variant: "destructive",
      });
    }
  };

  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; scoreId: string | null }>({ open: false, scoreId: null });

  const handleDeleteScore = (scoreId: string) => {
    setDeleteDialog({ open: true, scoreId });
  };

  const confirmDeleteScore = async () => {
    if (!deleteDialog.scoreId) return;
    try {
      const { error } = await supabase
        .from('scores')
        .delete()
        .eq('id', deleteDialog.scoreId);

      if (error) throw error;

      toast({
        title: "Score Deleted",
        description: "Demolition Man score deleted successfully"
      });

      loadData();
      
      // Invalidate React Query cache to update all leaderboards
      queryClient.invalidateQueries({ queryKey: ['scores'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
    } catch (error: any) {
      console.error('Error deleting Demolition Man score:', error);
      toast({
        title: "Error",
        description: "Failed to delete score",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card className="bg-red-900/20 border-red-700/50">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-red-400" />
            Demolition Man Eternal Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-400 py-8">
            Loading Demolition Man scores...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
    <Card className="bg-red-900/20 border-red-700/50">
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-red-400" />
              Demolition Man Eternal Leaderboard
            </CardTitle>
            <span className="text-sm text-red-300">Scores never reset - eternal competition</span>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog} variant="outline" className="border-red-700 text-red-200 hover:bg-red-900/50">
                <Plus className="w-4 h-4 mr-2" />
                Add Score
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-black/90 border-red-700/50">
              <DialogHeader>
                <DialogTitle className="text-white">
                  {editingScore ? 'Edit' : 'Add'} Demolition Man Score
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="player_name" className="text-white">Player Name (3 characters)</Label>
                  <Input
                    id="player_name"
                    value={formData.player_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, player_name: e.target.value.slice(0, 3) }))}
                    className="bg-black/50 border-red-700/50 text-white"
                    placeholder="ABC"
                    maxLength={3}
                  />
                </div>
                <div>
                  <Label htmlFor="score" className="text-white">Score</Label>
                  <Input
                    id="score"
                    type="number"
                    value={formData.score}
                    onChange={(e) => setFormData(prev => ({ ...prev, score: e.target.value }))}
                    className="bg-black/50 border-red-700/50 text-white"
                    placeholder="1000000"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={saveScore} className="bg-red-700 hover:bg-red-600">
                    {editingScore ? 'Update' : 'Add'} Score
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
            <TableRow className="border-red-700/50">
              <TableHead className="text-red-200">Rank</TableHead>
              <TableHead className="text-red-200">Player</TableHead>
              <TableHead className="text-red-200">Score</TableHead>
              <TableHead className="text-red-200">Date</TableHead>
              <TableHead className="text-red-200">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scores.map((score, index) => (
              <TableRow key={score.id} className="border-red-700/50">
                <TableCell className="text-center">
                  <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                    index === 0 ? 'bg-yellow-500 text-black' : 
                    index === 1 ? 'bg-gray-400 text-black' : 
                    index === 2 ? 'bg-orange-600 text-white' : 
                    'bg-red-800 text-red-200'
                  }`}>
                    {index + 1}
                  </div>
                </TableCell>
                <TableCell 
                  className="font-arcade font-bold text-xl text-red-200"
                >
                  {score.player_name}
                </TableCell>
                <TableCell 
                  className="font-bold font-arcade text-lg text-red-200"
                >
                  {formatScore(score.score)}
                </TableCell>
                <TableCell className="text-red-300 text-sm">
                  {new Date(score.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditDialog(score)}
                      className="border-red-700 text-red-200 hover:bg-red-900/50"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteScore(score.id)}
                      className="bg-red-800 hover:bg-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {scores.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-red-400 py-8">
                  No Demolition Man scores yet. Add the first eternal score!
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
    <ConfirmationDialog
      open={deleteDialog.open}
      onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}
      title="Delete Score"
      description="Are you sure you want to delete this Demolition Man score? This action cannot be undone."
      confirmText="Delete Score"
      cancelText="Cancel"
      variant="destructive"
      onConfirm={confirmDeleteScore}
    />
    </>
  );
};

export default DemolitionManScoreManager;
