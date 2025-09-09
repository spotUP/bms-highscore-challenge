import { useState, useEffect, useRef } from "react";
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

  if (loading || gamesLoading) {
    return <LoadingSpinner text="Loading admin panel..." />;
  }

  if (!user || !isAdmin) {
    return null; // Will redirect via useEffect
  }

  const pageLayout = getPageLayout();
  
  return (
    <div {...pageLayout}>
      <PageContainer className="max-w-6xl mx-auto">
        <PageHeader 
          title="Admin Panel"
          subtitle="Manage games, scores, and system configuration"
        >
          <Button 
            onClick={() => navigate('/')} 
            variant="outline"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Leaderboard
          </Button>
        </PageHeader>

        <Tabs defaultValue="games" className="w-full">
          <TabsList className="grid w-full grid-cols-6 bg-gray-900 border border-white/20">
            <TabsTrigger value="games" className="data-[state=active]:bg-arcade-neonCyan data-[state=active]:text-black">
              <Gamepad2 className="w-4 h-4 mr-2" />
              Games
            </TabsTrigger>
            <TabsTrigger value="scores" className="data-[state=active]:bg-arcade-neonCyan data-[state=active]:text-black">
              <BarChart3 className="w-4 h-4 mr-2" />
              Scores
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