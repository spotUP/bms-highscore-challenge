import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, Trash2, Plus } from "lucide-react";
import ImagePasteUpload from "@/components/ImagePasteUpload";
import GameLogoSuggestions from "@/components/GameLogoSuggestions";
import ScoreManager from "@/components/ScoreManager";

interface Game {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  is_active: boolean;
  include_in_challenge: boolean;
  created_at: string;
  updated_at: string;
}

const Admin = () => {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [games, setGames] = useState<Game[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    logo_url: "",
    is_active: true,
    include_in_challenge: false
  });

  // Redirect if not admin
  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate('/');
    }
  }, [user, isAdmin, loading, navigate]);

  // Load games
  const loadGames = async () => {
    try {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGames(data || []);
    } catch (error) {
      console.error('Error loading games:', error);
      toast({
        title: "Error",
        description: "Failed to load games",
        variant: "destructive"
      });
    } finally {
      setGamesLoading(false);
    }
  };

  useEffect(() => {
    if (user && isAdmin) {
      loadGames();
    }
  }, [user, isAdmin]);

  // Reset form
  const resetForm = () => {
    setFormData({
      name: "",
      logo_url: "",
      is_active: true,
      include_in_challenge: false
    });
    setEditingGame(null);
  };

  // Open dialog for editing
  const openEditDialog = (game: Game) => {
    setEditingGame(game);
    setFormData({
      name: game.name,
      logo_url: game.logo_url || "",
      is_active: game.is_active,
      include_in_challenge: game.include_in_challenge
    });
    setIsDialogOpen(true);
  };

  // Toggle challenge inclusion
  const toggleChallengeInclusion = async (gameId: string, currentValue: boolean) => {
    try {
      const { error } = await supabase
        .from('games')
        .update({ include_in_challenge: !currentValue })
        .eq('id', gameId);

      if (error) throw error;

      // Refresh the games list
      loadGames();
      
      toast({
        title: "Success",
        description: `Game ${!currentValue ? 'included in' : 'removed from'} challenge`
      });
    } catch (error) {
      console.error('Error updating challenge inclusion:', error);
      toast({
        title: "Error",
        description: "Failed to update challenge inclusion",
        variant: "destructive"
      });
    }
  };

  // Save game (create or update)
  const saveGame = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Game name is required",
        variant: "destructive"
      });
      return;
    }

    try {
      if (editingGame) {
        // Update existing game
        const { error } = await supabase
          .from('games')
          .update({
            name: formData.name,
            logo_url: formData.logo_url || null,
            is_active: formData.is_active,
            include_in_challenge: formData.include_in_challenge
          })
          .eq('id', editingGame.id);

        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Game updated successfully"
        });
      } else {
        // Create new game
        const { error } = await supabase
          .from('games')
          .insert({
            name: formData.name,
            logo_url: formData.logo_url || null,
            is_active: formData.is_active,
            include_in_challenge: formData.include_in_challenge
          });

        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Game created successfully"
        });
      }

      setIsDialogOpen(false);
      resetForm();
      loadGames();
    } catch (error) {
      console.error('Error saving game:', error);
      toast({
        title: "Error",
        description: "Failed to save game",
        variant: "destructive"
      });
    }
  };

  // Delete game
  const deleteGame = async (id: string) => {
    if (!confirm('Are you sure you want to delete this game?')) return;

    try {
      const { error } = await supabase
        .from('games')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Game deleted successfully"
      });
      
      loadGames();
    } catch (error) {
      console.error('Error deleting game:', error);
      toast({
        title: "Error",
        description: "Failed to delete game",
        variant: "destructive"
      });
    }
  };

  if (loading || gamesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative z-10"
           style={{ background: 'radial-gradient(ellipse at center, rgba(26, 16, 37, 0.9) 0%, rgba(26, 16, 37, 0.7) 100%)' }}>
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen text-white p-4 md:p-8 relative z-10"
         style={{ background: 'radial-gradient(ellipse at center, rgba(26, 16, 37, 0.9) 0%, rgba(26, 16, 37, 0.7) 100%)' }}>
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-2xl sm:text-4xl md:text-6xl font-bold bg-gradient-to-r from-arcade-neonPink via-arcade-neonCyan to-arcade-neonYellow text-transparent bg-clip-text">
            Admin Panel
          </h1>
          <Button variant="outline" onClick={() => navigate('/')} className="w-full sm:w-auto">
            Back to Leaderboard
          </Button>
        </div>

        <Card className="bg-black/50 border-white/20">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <CardTitle className="text-white">Games Management</CardTitle>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={resetForm} className="bg-arcade-neonPink hover:bg-arcade-neonPink/80 w-full sm:w-auto">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Game
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-gray-900 text-white border-white/20 max-w-2xl w-[95vw] max-h-[90vh] overflow-hidden mx-auto">
                  <DialogHeader>
                    <DialogTitle className="text-lg font-semibold break-words">
                      {editingGame ? 'Edit Game' : 'Add New Game'}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 overflow-y-auto max-h-[70vh] px-1">
                      <div className="w-full">
                        <Label htmlFor="name">Game Name *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Enter game name"
                          className="bg-black/50 border-white/20 text-white w-full"
                        />
                      </div>
                    <div className="w-full">
                      <GameLogoSuggestions
                        gameName={formData.name}
                        onSelectImage={(url) => setFormData(prev => ({ ...prev, logo_url: url }))}
                      />
                    </div>
                    <div className="w-full">
                      <div className="overflow-hidden">
                        <ImagePasteUpload
                          value={formData.logo_url}
                          onChange={(url) => setFormData(prev => ({ ...prev, logo_url: url }))}
                          label="Logo URL or Upload"
                          placeholder="Enter logo URL or paste/upload an image"
                        />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="include_in_challenge"
                        checked={formData.include_in_challenge}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, include_in_challenge: checked }))}
                      />
                      <Label htmlFor="include_in_challenge">Include in Challenge</Label>
                    </div>
                    <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-2 pt-4">
                      <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="w-full sm:w-auto">
                        Cancel
                      </Button>
                      <Button onClick={saveGame} className="bg-arcade-neonPink hover:bg-arcade-neonPink/80 w-full sm:w-auto">
                        {editingGame ? 'Update' : 'Create'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/20">
                  <TableHead className="text-white min-w-[120px]">Name</TableHead>
                  <TableHead className="text-white min-w-[80px]">Challenge</TableHead>
                  <TableHead className="text-white min-w-[100px]">Created</TableHead>
                  <TableHead className="text-white min-w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {games.map((game) => (
                  <TableRow key={game.id} className="border-white/20">
                    <TableCell className="text-white font-medium">{game.name}</TableCell>
                    <TableCell>
                      <Checkbox
                        checked={game.include_in_challenge}
                        onCheckedChange={() => toggleChallengeInclusion(game.id, game.include_in_challenge)}
                        className="data-[state=checked]:bg-arcade-neonCyan data-[state=checked]:border-arcade-neonCyan"
                      />
                    </TableCell>
                    <TableCell className="text-gray-300">
                      {new Date(game.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(game)}
                          className="w-full sm:w-auto"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteGame(game.id)}
                          className="w-full sm:w-auto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {games.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-gray-400 py-8">
                      No games found. Add your first game!
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <ScoreManager />
      </div>
    </div>
  );
};

export default Admin;