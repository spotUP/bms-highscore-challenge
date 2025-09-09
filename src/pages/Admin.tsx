import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Trash2, Plus, Wrench, ArrowLeft, Gamepad2, BarChart3, Settings, Users, TestTube, Webhook, Lock, Globe } from "lucide-react";
import { isPlaceholderLogo, formatScore } from "@/lib/utils";
import ImagePasteUpload from "@/components/ImagePasteUpload";
import GameLogoSuggestions, { GameLogoSuggestionsRef } from "@/components/GameLogoSuggestions";
import RandomizeGames from "@/components/RandomizeGames";
import StopCompetition from "@/components/StopCompetition";
import WebhookConfig from "@/components/WebhookConfig";
import UserManagement from "@/components/UserManagement";
import ResetFunctions from "@/components/ResetFunctions";
import DemolitionManQRSubmit from "@/components/DemolitionManQRSubmit";
import DemolitionManEnsure from "@/components/DemolitionManEnsure";
import DemolitionManScoreManager from "@/components/DemolitionManScoreManager";
import PerformanceToggle from "@/components/PerformanceToggle";
import { getPageLayout, getCardStyle, getButtonStyle, getTypographyStyle, PageHeader, PageContainer, LoadingSpinner } from "@/utils/designSystem";
import { useUserRoles } from "@/hooks/useUserRoles";
import { useTournament } from "@/contexts/TournamentContext";
import TournamentSelector from "@/components/TournamentSelector";

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

const CreateTournamentForm = () => {
  const { createTournament } = useTournament();
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    slug: '',
    is_public: false,
    demolition_man_active: false,
  });

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleCreateTournament = async () => {
    if (!createForm.name.trim() || !createForm.slug.trim()) {
      toast({
        title: "Error",
        description: "Tournament name and slug are required",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    const success = await createTournament({
      name: createForm.name.trim(),
      description: createForm.description.trim() || undefined,
      slug: createForm.slug.trim().toLowerCase(),
      is_public: createForm.is_public,
      demolition_man_active: createForm.demolition_man_active,
    });

    if (success) {
      setCreateForm({
        name: '',
        description: '',
        slug: '',
        is_public: false,
        demolition_man_active: false,
      });
      toast({
        title: "Success",
        description: "Tournament created successfully!",
      });
    }
    setIsCreating(false);
  };

  return (
    <Card className={getCardStyle('primary')}>
      <CardHeader>
        <CardTitle className={getTypographyStyle('h3')}>Create New Tournament</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="name" className="text-white">Tournament Name</Label>
          <Input
            id="name"
            value={createForm.name}
            onChange={(e) => {
              const name = e.target.value;
              setCreateForm(prev => ({
                ...prev,
                name,
                slug: generateSlug(name)
              }));
            }}
            placeholder="My Awesome Tournament"
            className="bg-black/50 border-gray-700 text-white"
          />
        </div>

        <div>
          <Label htmlFor="description" className="text-white">Description (Optional)</Label>
          <Textarea
            id="description"
            value={createForm.description}
            onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
            placeholder="A brief description of your tournament"
            className="bg-black/50 border-gray-700 text-white"
          />
        </div>

        <div>
          <Label htmlFor="slug" className="text-white">Tournament Slug</Label>
          <Input
            id="slug"
            value={createForm.slug}
            onChange={(e) => setCreateForm(prev => ({ ...prev, slug: generateSlug(e.target.value) }))}
            placeholder="my-awesome-tournament"
            className="bg-black/50 border-gray-700 text-white"
          />
          <p className="text-xs text-gray-500 mt-1">
            URL: /t/{createForm.slug || 'tournament-slug'}
          </p>
        </div>

        <div>
          <Label htmlFor="visibility" className="text-white">Visibility</Label>
          <Select 
            value={createForm.is_public ? 'public' : 'private'} 
            onValueChange={(value) => setCreateForm(prev => ({ ...prev, is_public: value === 'public' }))}
          >
            <SelectTrigger className="bg-black/50 border-gray-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="private">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Private (Invite Only)
                </div>
              </SelectItem>
              <SelectItem value="public">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  Public (Anyone Can Join)
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="create-demolition-man"
            checked={createForm.demolition_man_active}
            onCheckedChange={(checked) => setCreateForm(prev => ({ ...prev, demolition_man_active: checked }))}
          />
          <Label htmlFor="create-demolition-man" className="text-white">
            Enable Demolition Man Leaderboard
          </Label>
        </div>

        <Button 
          onClick={handleCreateTournament}
          disabled={!createForm.name.trim() || !createForm.slug.trim() || isCreating}
          className="w-full"
        >
          {isCreating ? 'Creating...' : 'Create Tournament'}
        </Button>
      </CardContent>
    </Card>
  );
};

const Admin = () => {
  const { user, isAdmin, loading } = useAuth();
  const { currentTournament, userTournaments, hasPermission, updateTournament, deleteTournament, refreshTournaments, currentUserRole } = useTournament();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [games, setGames] = useState<Game[]>([]);
  const [gameScores, setGameScores] = useState<Record<string, any[]>>({});
  const [gamesLoading, setGamesLoading] = useState(true);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [editingScore, setEditingScore] = useState<any | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isScoreDialogOpen, setIsScoreDialogOpen] = useState(false);
  const [scoreFormData, setScoreFormData] = useState({
    player_name: "",
    score: ""
  });
  const [gamesUpdateTrigger, setGamesUpdateTrigger] = useState(0);
  const [formData, setFormData] = useState({
    name: "",
    logo_url: "",
    is_active: true,
    include_in_challenge: true,
    tournament_id: currentTournament?.id || ""
  });
  const gameLogoSuggestionsRef = useRef<GameLogoSuggestionsRef>(null);
  const [isResetting, setIsResetting] = useState(false);

  // Redirect if not admin
  useEffect(() => {
    if (!loading && (!user || (!isAdmin && !hasPermission('admin')))) {
      navigate('/');
    }
  }, [user, isAdmin, hasPermission, loading, navigate]);

  // Load games and their scores from all user tournaments
  const loadGames = async () => {
    if (!userTournaments || userTournaments.length === 0) {
      setGamesLoading(false);
      return;
    }

    try {
      // Get all tournament IDs the user has access to
      const tournamentIds = userTournaments.map(t => t.id);

      // Load games from all user tournaments
      const { data: gamesData, error: gamesError } = await supabase
        .from('games')
        .select('*')
        .in('tournament_id', tournamentIds)
        .order('created_at', { ascending: false });

      if (gamesError) throw gamesError;
      setGames(gamesData || []);

      // Load scores for all games from all tournaments
      const { data: scoresData, error: scoresError } = await supabase
        .from('scores')
        .select('*')
        .in('tournament_id', tournamentIds)
        .order('score', { ascending: false });

      if (scoresError) throw scoresError;

      // Group scores by game_id
      const scoresByGame: Record<string, any[]> = {};
      (scoresData || []).forEach(score => {
        if (!scoresByGame[score.game_id]) {
          scoresByGame[score.game_id] = [];
        }
        scoresByGame[score.game_id].push(score);
      });
      setGameScores(scoresByGame);

      setGamesUpdateTrigger(prev => prev + 1); // Trigger refresh for StopCompetition
    } catch (error) {
      console.error('Error loading games and scores:', error);
      toast({
        title: "Error",
        description: "Failed to load games and scores",
        variant: "destructive"
      });
    } finally {
      setGamesLoading(false);
    }
  };

  useEffect(() => {
    if (user && (isAdmin || hasPermission('admin')) && userTournaments.length > 0) {
      loadGames();
    }
  }, [user, isAdmin, hasPermission, userTournaments]);

  // Update form default tournament when current tournament changes
  useEffect(() => {
    if (currentTournament && !editingGame) {
      setFormData(prev => ({
        ...prev,
        tournament_id: currentTournament.id
      }));
    }
  }, [currentTournament, editingGame]);

  // Reset form
  const resetForm = () => {
    setFormData({
      name: "",
      logo_url: "",
      is_active: true,
      include_in_challenge: true,
      tournament_id: currentTournament?.id || ""
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
      include_in_challenge: game.include_in_challenge,
      tournament_id: game.tournament_id
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
            include_in_challenge: formData.include_in_challenge,
            tournament_id: formData.tournament_id
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

  // Score management functions
  const resetScoreForm = () => {
    setScoreFormData({
      player_name: "",
      score: ""
    });
    setEditingScore(null);
  };

  const openEditScoreDialog = (score: any) => {
    setEditingScore(score);
    setScoreFormData({
      player_name: score.player_name,
      score: score.score.toString()
    });
    setIsScoreDialogOpen(true);
  };

  const saveScore = async () => {
    if (!editingScore) return;

    try {
      const { error } = await supabase
        .from('scores')
        .update({
          player_name: scoreFormData.player_name.trim().toUpperCase(),
          score: parseInt(scoreFormData.score)
        })
        .eq('id', editingScore.id);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Score updated successfully"
      });
      
      setIsScoreDialogOpen(false);
      resetScoreForm();
      loadGames(); // Reload to refresh scores
    } catch (error) {
      console.error('Error updating score:', error);
      toast({
        title: "Error",
        description: "Failed to update score",
        variant: "destructive"
      });
    }
  };

  const deleteScore = async (scoreId: string) => {
    if (!confirm('Are you sure you want to delete this score?')) return;

    try {
      const { error } = await supabase
        .from('scores')
        .delete()
        .eq('id', scoreId);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Score deleted successfully"
      });
      
      loadGames(); // Reload to refresh scores
    } catch (error) {
      console.error('Error deleting score:', error);
      toast({
        title: "Error",
        description: "Failed to delete score",
        variant: "destructive"
      });
    }
  };

  // Get tournament name by ID
  const getTournamentName = (tournamentId: string) => {
    const tournament = userTournaments.find(t => t.id === tournamentId);
    return tournament?.name || 'Unknown Tournament';
  };

  // Change game tournament
  const changeGameTournament = async (gameId: string, newTournamentId: string) => {
    try {
      const { error } = await supabase
        .from('games')
        .update({ tournament_id: newTournamentId })
        .eq('id', gameId);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Game tournament updated successfully"
      });
      
      loadGames(); // Reload to refresh the table
    } catch (error) {
      console.error('Error updating game tournament:', error);
      toast({
        title: "Error",
        description: "Failed to update game tournament",
        variant: "destructive"
      });
    }
  };

  // Clean up placeholder logos
  const cleanupPlaceholderLogos = async () => {
    try {
      const { data: gamesWithPlaceholders, error: fetchError } = await supabase
        .from('games')
        .select('id, name, logo_url')
        .not('logo_url', 'is', null);

      if (fetchError) throw fetchError;

      const gamesToUpdate = gamesWithPlaceholders?.filter(game =>
        isPlaceholderLogo(game.logo_url)
      ) || [];

      if (gamesToUpdate.length === 0) {
        toast({
          title: "No Action Needed",
          description: "No placeholder logos found to clean up"
        });
        return;
      }

      const updatePromises = gamesToUpdate.map(game =>
        supabase
          .from('games')
          .update({ logo_url: null })
          .eq('id', game.id)
      );

      const results = await Promise.all(updatePromises);
      const hasErrors = results.some(result => result.error);

      if (hasErrors) {
        throw new Error('Some updates failed');
      }

      toast({
        title: "Success",
        description: `Cleaned up ${gamesToUpdate.length} placeholder logos`
      });

      loadGames();
    } catch (error) {
      console.error('Error cleaning up placeholder logos:', error);
      toast({
        title: "Error",
        description: "Failed to clean up placeholder logos",
        variant: "destructive"
      });
    }
  };

  // Update tournament
  const handleUpdateTournament = async () => {
    if (!currentTournament) return;

    try {
      const success = await updateTournament(currentTournament.id, {
        name: currentTournament.name,
        slug: currentTournament.slug,
        description: currentTournament.description,
        is_public: currentTournament.is_public,
      });

      if (success) {
        toast({
          title: "Success",
          description: "Tournament updated successfully"
        });
        // Refresh tournaments to get updated data
        await refreshTournaments();
      }
    } catch (error) {
      console.error('Error updating tournament:', error);
      toast({
        title: "Error",
        description: "Failed to update tournament",
        variant: "destructive"
      });
    }
  };

  // Delete tournament
  const handleDeleteTournament = async () => {
    if (!currentTournament) return;

    try {
      const success = await deleteTournament(currentTournament.id);

      if (success) {
        toast({
          title: "Success",
          description: "Tournament deleted successfully"
        });
        // Navigate back to home since the tournament is deleted
        navigate('/');
      }
    } catch (error) {
      console.error('Error deleting tournament:', error);
      toast({
        title: "Error",
        description: "Failed to delete tournament",
        variant: "destructive"
      });
    }
  };

  if (loading || gamesLoading) {
    return <LoadingSpinner text="Loading admin panel..." />;
  }

  if (!user || (!isAdmin && !hasPermission('admin'))) {
    return null; // Will redirect via useEffect
  }

  if (!currentTournament) {
    return (
      <div className="min-h-screen flex items-center justify-center relative z-10"
           style={{ background: 'radial-gradient(ellipse at center, rgba(26, 16, 37, 0.9) 0%, rgba(26, 16, 37, 0.7) 100%)' }}>
        <div className="text-center text-white">
          <div className="text-6xl mb-4">🏆</div>
          <h1 className="text-4xl font-bold mb-4">Tournament Required</h1>
          <p className="text-xl text-gray-300 mb-8">
            Select a tournament to access the admin panel.
          </p>
          <TournamentSelector />
        </div>
      </div>
    );
  }

  const pageLayout = getPageLayout();
  
  return (
    <div {...pageLayout}>
      <PageContainer className="max-w-6xl mx-auto">
        <PageHeader 
          title="Admin Panel"
          subtitle={`Managing ${currentTournament?.name} tournament`}
        >
          <div className="flex items-center gap-4">
            <TournamentSelector />
            <Button 
              onClick={() => navigate('/')} 
              variant="outline"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Leaderboard
            </Button>
          </div>
        </PageHeader>

        <Tabs defaultValue="games" className="w-full">
          <TabsList className="grid w-full grid-cols-6 bg-gray-900 border border-white/20">
            <TabsTrigger value="games" className="data-[state=active]:bg-arcade-neonCyan data-[state=active]:text-black">
              <Gamepad2 className="w-4 h-4 mr-2" />
              Games & Scores
            </TabsTrigger>
            <TabsTrigger value="create-tournament" className="data-[state=active]:bg-arcade-neonCyan data-[state=active]:text-black">
              <Plus className="w-4 h-4 mr-2" />
              Create Tournament
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="data-[state=active]:bg-arcade-neonCyan data-[state=active]:text-black">
              <Webhook className="w-4 h-4 mr-2" />
              Webhooks
            </TabsTrigger>
            <TabsTrigger value="system" className="data-[state=active]:bg-arcade-neonCyan data-[state=active]:text-black">
              <TestTube className="w-4 h-4 mr-2" />
              System
            </TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-arcade-neonCyan data-[state=active]:text-black">
              <Users className="w-4 h-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="demolition" className="data-[state=active]:bg-arcade-neonCyan data-[state=active]:text-black">
              <BarChart3 className="w-4 h-4 mr-2" />
              Demolition Man
            </TabsTrigger>
          </TabsList>

          <TabsContent value="games" className="mt-6">
            <Card className={getCardStyle('primary')}>
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <CardTitle className={getTypographyStyle('h3')}>Games & Scores Management</CardTitle>
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <RandomizeGames onGamesUpdated={loadGames} />
                    <StopCompetition onCompetitionStopped={loadGames} refreshTrigger={gamesUpdateTrigger} />
                    <Button 
                      onClick={cleanupPlaceholderLogos}
                      variant="outline"
                      className="w-full sm:w-auto"
                      title="Remove broken placeholder logos and use fallback UI instead"
                    >
                      <Wrench className="w-4 h-4 mr-2" />
                      Fix Logos
                    </Button>
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                      <DialogTrigger asChild>
                        <Button onClick={resetForm} variant="outline" className="w-full sm:w-auto">
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
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  gameLogoSuggestionsRef.current?.searchForLogos();
                                }
                              }}
                              placeholder="Enter game name (press Enter to search local logos)"
                              className="bg-black/50 border-white/20 text-white w-full"
                            />
                          </div>
                          <div className="w-full">
                            <Label htmlFor="tournament">Tournament *</Label>
                            <Select 
                              value={formData.tournament_id} 
                              onValueChange={(value) => setFormData(prev => ({ ...prev, tournament_id: value }))}
                            >
                              <SelectTrigger className="bg-black/50 border-white/20 text-white">
                                <SelectValue placeholder="Select Tournament" />
                              </SelectTrigger>
                              <SelectContent className="bg-gray-900 border-white/20">
                                {userTournaments.map((tournament) => (
                                  <SelectItem 
                                    key={tournament.id} 
                                    value={tournament.id} 
                                    className="text-white focus:bg-gray-800 focus:text-white"
                                  >
                                    {tournament.name}
                                    {tournament.id === currentTournament?.id && " (Current)"}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="w-full">
                            <GameLogoSuggestions
                              ref={gameLogoSuggestionsRef}
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
                            <Button 
                              onClick={saveGame} 
                              variant="outline" 
                              className="w-full sm:w-auto"
                              disabled={!formData.name.trim() || !formData.tournament_id}
                            >
                              {editingGame ? 'Update' : 'Create'}
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>

                    {/* Score Edit Dialog */}
                    <Dialog open={isScoreDialogOpen} onOpenChange={setIsScoreDialogOpen}>
                      <DialogContent className="bg-gray-900 text-white border-white/20 max-w-md">
                        <DialogHeader>
                          <DialogTitle>Edit Score</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="edit-player-name">Player Name</Label>
                            <Input
                              id="edit-player-name"
                              value={scoreFormData.player_name}
                              onChange={(e) => setScoreFormData(prev => ({ ...prev, player_name: e.target.value }))}
                              className="bg-black/50 border-white/20 text-white"
                            />
                          </div>
                          <div>
                            <Label htmlFor="edit-score">Score</Label>
                            <Input
                              id="edit-score"
                              type="number"
                              value={scoreFormData.score}
                              onChange={(e) => setScoreFormData(prev => ({ ...prev, score: e.target.value }))}
                              className="bg-black/50 border-white/20 text-white"
                            />
                          </div>
                          <div className="flex justify-end space-x-2">
                            <Button variant="outline" onClick={() => setIsScoreDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button 
                              onClick={saveScore}
                              disabled={!scoreFormData.player_name.trim() || !scoreFormData.score}
                            >
                              Save Score
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/20">
                      <TableHead className="text-white min-w-[120px]">Name</TableHead>
                      <TableHead className="text-white min-w-[150px]">Tournament</TableHead>
                      <TableHead className="text-white min-w-[80px]">Challenge</TableHead>
                      <TableHead className="text-white min-w-[200px]">Top Scores</TableHead>
                      <TableHead className="text-white min-w-[100px]">Created</TableHead>
                      <TableHead className="text-white min-w-[120px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {games.map((game) => (
                      <TableRow key={game.id} className="border-white/20">
                        <TableCell className="text-white font-medium">{game.name}</TableCell>
                        <TableCell>
                          <Select 
                            value={game.tournament_id} 
                            onValueChange={(value) => changeGameTournament(game.id, value)}
                          >
                            <SelectTrigger className="bg-black/50 border-white/20 text-white h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-900 border-white/20">
                              {userTournaments.map((tournament) => (
                                <SelectItem 
                                  key={tournament.id} 
                                  value={tournament.id} 
                                  className="text-white focus:bg-gray-800 focus:text-white text-xs"
                                >
                                  {tournament.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Checkbox
                            checked={game.include_in_challenge}
                            onCheckedChange={() => toggleChallengeInclusion(game.id, game.include_in_challenge)}
                            className="data-[state=checked]:bg-arcade-neonCyan data-[state=checked]:border-arcade-neonCyan"
                          />
                        </TableCell>
                        <TableCell className="text-gray-300">
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {gameScores[game.id] && gameScores[game.id].length > 0 ? (
                              gameScores[game.id].slice(0, 5).map((score, index) => (
                                <div key={score.id} className="flex justify-between items-center text-xs group hover:bg-gray-800/50 rounded px-1 py-0.5">
                                  <div className="flex-1 flex justify-between items-center">
                                    <span className="text-white">{score.player_name}</span>
                                    <span className="text-arcade-neonCyan font-bold">{formatScore(score.score)}</span>
                                  </div>
                                  <div className="flex gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => openEditScoreDialog(score)}
                                      className="h-5 w-5 p-0 hover:bg-blue-600/20"
                                      title="Edit score"
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => deleteScore(score.id)}
                                      className="h-5 w-5 p-0 hover:bg-red-600/20"
                                      title="Delete score"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <span className="text-gray-500 text-xs italic">No scores yet</span>
                            )}
                            {gameScores[game.id] && gameScores[game.id].length > 5 && (
                              <div className="text-xs text-gray-400">
                                +{gameScores[game.id].length - 5} more
                              </div>
                            )}
                          </div>
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
                        <TableCell colSpan={6} className="text-center text-gray-400 py-8">
                          No games found. Add your first game!
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="create-tournament" className="mt-6">
            <CreateTournamentForm />
          </TabsContent>

          <TabsContent value="webhooks" className="mt-6">
            <WebhookConfig />
          </TabsContent>

          <TabsContent value="system" className="mt-6">
            <div className="space-y-6">
              <Card className={getCardStyle('primary')}>
                <CardHeader>
                  <CardTitle className={getTypographyStyle('h3')}>Performance Settings</CardTitle>
                </CardHeader>
                <CardContent>
                  <PerformanceToggle />
                </CardContent>
              </Card>
              <DemolitionManEnsure />
              <ResetFunctions />
            </div>
          </TabsContent>

          <TabsContent value="users" className="mt-6">
            <UserManagement />
          </TabsContent>

          <TabsContent value="demolition" className="mt-6">
            <div className="space-y-6">
              <DemolitionManScoreManager />
              <DemolitionManQRSubmit />
            </div>
          </TabsContent>
        </Tabs>
      </PageContainer>
    </div>
  );
};

export default Admin;