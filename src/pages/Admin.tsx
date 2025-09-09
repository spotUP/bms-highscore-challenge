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
import { Pencil, Trash2, Plus, Wrench, ArrowLeft, Gamepad2, BarChart3, Settings, Users, TestTube, Webhook } from "lucide-react";
import { isPlaceholderLogo } from "@/lib/utils";
import ImagePasteUpload from "@/components/ImagePasteUpload";
import GameLogoSuggestions, { GameLogoSuggestionsRef } from "@/components/GameLogoSuggestions";
import ScoreManager from "@/components/ScoreManager";
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

const Admin = () => {
  const { user, isAdmin, loading } = useAuth();
  const { currentTournament, hasPermission, updateTournament, deleteTournament, refreshTournaments, currentUserRole } = useTournament();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [games, setGames] = useState<Game[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [gamesUpdateTrigger, setGamesUpdateTrigger] = useState(0);
  const [formData, setFormData] = useState({
    name: "",
    logo_url: "",
    is_active: true,
    include_in_challenge: true
  });
  const gameLogoSuggestionsRef = useRef<GameLogoSuggestionsRef>(null);
  const [isResetting, setIsResetting] = useState(false);

  // Redirect if not admin
  useEffect(() => {
    if (!loading && (!user || (!isAdmin && !hasPermission('admin')))) {
      navigate('/');
    }
  }, [user, isAdmin, hasPermission, loading, navigate]);

  // Load games for current tournament
  const loadGames = async () => {
    if (!currentTournament) {
      setGamesLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('tournament_id', currentTournament.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGames(data || []);
      setGamesUpdateTrigger(prev => prev + 1); // Trigger refresh for StopCompetition
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
    if (user && (isAdmin || hasPermission('admin')) && currentTournament) {
      loadGames();
    }
  }, [user, isAdmin, hasPermission, currentTournament]);

  // Reset form
  const resetForm = () => {
    setFormData({
      name: "",
      logo_url: "",
      is_active: true,
      include_in_challenge: true
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
            include_in_challenge: formData.include_in_challenge,
            tournament_id: currentTournament?.id
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
          <TabsList className="grid w-full grid-cols-7 bg-gray-900 border border-white/20">
            <TabsTrigger value="games" className="data-[state=active]:bg-arcade-neonCyan data-[state=active]:text-black">
              <Gamepad2 className="w-4 h-4 mr-2" />
              Games
            </TabsTrigger>
            <TabsTrigger value="scores" className="data-[state=active]:bg-arcade-neonCyan data-[state=active]:text-black">
              <BarChart3 className="w-4 h-4 mr-2" />
              Scores
            </TabsTrigger>
            <TabsTrigger value="tournament" className="data-[state=active]:bg-arcade-neonCyan data-[state=active]:text-black">
              <Settings className="w-4 h-4 mr-2" />
              Tournament
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
          </TabsList>

          <TabsContent value="games" className="mt-6">
            <Card className={getCardStyle('primary')}>
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <CardTitle className={getTypographyStyle('h3')}>Games Management</CardTitle>
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
                            <Button onClick={saveGame} variant="outline" className="w-full sm:w-auto">
                              {editingGame ? 'Update' : 'Create'}
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
          </TabsContent>

          <TabsContent value="scores" className="mt-6">
            <div className="space-y-6">
              <ScoreManager />
              <DemolitionManScoreManager />
              <DemolitionManQRSubmit />
            </div>
          </TabsContent>

          <TabsContent value="tournament" className="mt-6">
            <div className="space-y-6">
              <Card className={getCardStyle('primary')}>
                <CardHeader>
                  <CardTitle className={getTypographyStyle('h3')}>Tournament Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {currentTournament && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="tournament-name" className="text-white">Tournament Name</Label>
                          <Input
                            id="tournament-name"
                            value={currentTournament.name}
                            onChange={(e) => setCurrentTournament({ ...currentTournament, name: e.target.value })}
                            className="bg-gray-800 border-gray-700 text-white"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="tournament-slug" className="text-white">Slug</Label>
                          <Input
                            id="tournament-slug"
                            value={currentTournament.slug}
                            onChange={(e) => setCurrentTournament({ ...currentTournament, slug: e.target.value })}
                            className="bg-gray-800 border-gray-700 text-white"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="tournament-description" className="text-white">Description</Label>
                        <Textarea
                          id="tournament-description"
                          value={currentTournament.description || ''}
                          onChange={(e) => setCurrentTournament({ ...currentTournament, description: e.target.value })}
                          className="bg-gray-800 border-gray-700 text-white min-h-[100px]"
                          placeholder="Enter tournament description..."
                        />
                      </div>

                      <div className="flex items-center space-x-2">
                        <Switch
                          id="tournament-public"
                          checked={currentTournament.is_public}
                          onCheckedChange={(checked) => setCurrentTournament({ ...currentTournament, is_public: checked })}
                        />
                        <Label htmlFor="tournament-public" className="text-white">
                          Make tournament public (visible to all users)
                        </Label>
                      </div>

                      <div className="flex gap-2 pt-4">
                        <Button
                          onClick={handleUpdateTournament}
                          className={getButtonStyle('primary')}
                          disabled={!currentTournament.name.trim() || !currentTournament.slug.trim()}
                        >
                          Save Changes
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="destructive"
                              disabled={currentUserRole !== 'owner'}
                            >
                              Delete Tournament
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-gray-900 border-gray-700">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-white">Delete Tournament</AlertDialogTitle>
                              <AlertDialogDescription className="text-gray-300">
                                Are you sure you want to delete "{currentTournament.name}"? This action cannot be undone and will permanently delete:
                                <br /><br />
                                • All games and scores
                                <br />
                                • All achievements and player progress
                                <br />
                                • All tournament members and invitations
                                <br /><br />
                                This action is irreversible.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="bg-gray-700 text-white hover:bg-gray-600">
                                Cancel
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={handleDeleteTournament}
                                className="bg-red-600 hover:bg-red-700 text-white"
                              >
                                Delete Tournament
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </>
                  )}

                  {!currentTournament && (
                    <div className="text-center py-8 text-gray-400">
                      <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No tournament selected</p>
                      <p className="text-sm">Please select a tournament to manage its settings</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {currentTournament && (
                <Card className={getCardStyle('secondary')}>
                  <CardHeader>
                    <CardTitle className={getTypographyStyle('h4')}>Tournament Statistics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-arcade-neonCyan">{games.length}</div>
                        <div className="text-sm text-gray-400">Games</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-arcade-neonCyan">{scores.length}</div>
                        <div className="text-sm text-gray-400">Total Scores</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-arcade-neonCyan">
                          {new Set(scores.map(s => s.player_name)).size}
                        </div>
                        <div className="text-sm text-gray-400">Players</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-arcade-neonCyan">
                          {currentTournament.is_public ? 'Public' : 'Private'}
                        </div>
                        <div className="text-sm text-gray-400">Visibility</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
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
        </Tabs>
      </PageContainer>
    </div>
  );
};

export default Admin;