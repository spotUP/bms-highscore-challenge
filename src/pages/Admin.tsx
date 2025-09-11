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
import { Pencil, Trash2, Plus, Wrench, ArrowLeft, Gamepad2, BarChart3, Settings, Users, TestTube, Webhook, Lock, Globe, Trophy, Copy } from "lucide-react";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
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
import AchievementManagerV2 from "@/components/AchievementManagerV2";
import { getPageLayout, getCardStyle, getButtonStyle, getTypographyStyle, PageHeader, PageContainer, LoadingSpinner } from "@/utils/designSystem";
import { useUserRoles } from "@/hooks/useUserRoles";
import { useTournament } from "@/contexts/TournamentContext";

interface Game {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  is_active: boolean;
  include_in_challenge: boolean;
  tournament_id: string;
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
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const checkSlugAvailability = async (slug: string) => {
    if (!slug.trim()) {
      setSlugAvailable(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('id')
        .eq('slug', slug.trim().toLowerCase())
        .single();

      if (error && error.code === 'PGRST116') {
        // No rows returned - slug is available
        setSlugAvailable(true);
      } else if (data) {
        // Slug exists
        setSlugAvailable(false);
      } else {
        setSlugAvailable(null);
      }
    } catch (error) {
      setSlugAvailable(null);
    }
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
    const tournament = await createTournament({
      name: createForm.name.trim(),
      description: createForm.description.trim() || undefined,
      slug: createForm.slug.trim().toLowerCase(),
      is_public: createForm.is_public,
      demolition_man_active: createForm.demolition_man_active,
    });

    if (tournament) {
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
          <div className="relative">
            <Input
              id="slug"
              value={createForm.slug}
              onChange={(e) => {
                const newSlug = generateSlug(e.target.value);
                setCreateForm(prev => ({ ...prev, slug: newSlug }));
                // Debounce slug availability check
                setTimeout(() => checkSlugAvailability(newSlug), 500);
              }}
              placeholder="my-awesome-tournament"
              className={`bg-black/50 border-gray-700 text-white ${
                slugAvailable === false ? 'border-red-500' : 
                slugAvailable === true ? 'border-green-500' : ''
              }`}
            />
            {slugAvailable === true && (
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-green-500">
                ✓
              </div>
            )}
            {slugAvailable === false && (
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-red-500">
                ✗
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            URL: /t/{createForm.slug || 'tournament-slug'}
          </p>
          {slugAvailable === false && (
            <p className="text-xs text-red-500 mt-1">
              This slug is already taken. Please choose a different one.
            </p>
          )}
          {slugAvailable === true && (
            <p className="text-xs text-green-500 mt-1">
              This slug is available!
            </p>
          )}
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
          disabled={!createForm.name.trim() || !createForm.slug.trim() || isCreating || slugAvailable === false}
          className="w-full"
        >
          {isCreating ? 'Creating...' : 'Create Tournament'}
        </Button>
      </CardContent>
    </Card>
  );
};

const generateRandomString = (length: number) => {
  const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

const Admin = () => {
  const { user, isAdmin, loading } = useAuth();
  const { currentTournament, userTournaments, hasPermission, updateTournament, deleteTournament, refreshTournaments, currentUserRole, cloneTournament, switchTournament, loading: tournamentsLoading } = useTournament();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [games, setGames] = useState<Game[]>([]);
  const [gameScores, setGameScores] = useState<Record<string, any[]>>({});
  const [gamesLoading, setGamesLoading] = useState(true);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [editingScore, setEditingScore] = useState<any | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isScoreDialogOpen, setIsScoreDialogOpen] = useState(false);
  const [scoreFormData, setScoreFormData] = useState({
    player_name: "",
    score: ""
  });
  const [newScoreGameId, setNewScoreGameId] = useState<string | null>(null);
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
  const [tournamentSort, setTournamentSort] = useState<Record<string, { key: 'name' | 'created_at'; dir: 'asc' | 'desc' }>>({});
  const [tournamentExpanded, setTournamentExpanded] = useState<Record<string, boolean>>({});
  const [tournamentFilters, setTournamentFilters] = useState<Record<string, string>>({});
  // Persisted active tab
  const [activeTab, setActiveTab] = useState<string>('create-tournament');
  // Bulk selection removed
  // Inline score edits: map scoreId -> { player_name, score }
  const [inlineScoreEdits, setInlineScoreEdits] = useState<Record<string, { player_name: string; score: string }>>({});
  // Inline game name edits: map gameId -> name
  const [inlineGameNames, setInlineGameNames] = useState<Record<string, string>>({});
  
  // Confirmation dialog states
  const [deleteGameDialog, setDeleteGameDialog] = useState({ open: false, gameId: '' });
  const [deleteScoreDialog, setDeleteScoreDialog] = useState({ open: false, scoreId: '' });

  // Redirect if not admin
  useEffect(() => {
    // Wait for both auth and tournament context to finish loading before deciding
    if (!loading && !tournamentsLoading) {
      if (!user || (!isAdmin && !hasPermission('admin'))) {
        navigate('/');
      }
    }
  }, [user, isAdmin, hasPermission, loading, tournamentsLoading, navigate]);

  // Direct tournament switching (no global event/listener)

  // Load persisted UI state
  useEffect(() => {
    try {
      const s = localStorage.getItem('admin_tournament_sort');
      const e = localStorage.getItem('admin_tournament_expanded');
      const f = localStorage.getItem('admin_tournament_filters');
      const tab = localStorage.getItem('admin_active_tab');
      if (s) setTournamentSort(JSON.parse(s));
      if (e) setTournamentExpanded(JSON.parse(e));
      if (f) setTournamentFilters(JSON.parse(f));
      if (tab) setActiveTab(tab);
    } catch {}
  }, []);

  // Persist UI state
  useEffect(() => {
    try { localStorage.setItem('admin_tournament_sort', JSON.stringify(tournamentSort)); } catch {}
  }, [tournamentSort]);
  useEffect(() => {
    try { localStorage.setItem('admin_tournament_expanded', JSON.stringify(tournamentExpanded)); } catch {}
  }, [tournamentExpanded]);
  useEffect(() => {
    try { localStorage.setItem('admin_tournament_filters', JSON.stringify(tournamentFilters)); } catch {}
  }, [tournamentFilters]);

  // Persist active tab
  useEffect(() => {
    try { localStorage.setItem('admin_active_tab', activeTab); } catch {}
  }, [activeTab]);

  // Load games and their scores from all user tournaments
  const loadGames = async () => {
    setGamesLoading(true);
    try {
      // Build tournament IDs from memberships; fall back to currentTournament
      const tournamentIdsSet = new Set<string>();
      (userTournaments || []).forEach(t => t?.id && tournamentIdsSet.add(t.id));
      if (currentTournament?.id) {
        tournamentIdsSet.add(currentTournament.id);
      }
      const tournamentIds = Array.from(tournamentIdsSet);

      console.log('Admin.loadGames - tournamentIds:', tournamentIds);

      if (tournamentIds.length === 0) {
        setGamesLoading(false);
        return;
      }

      // Load games from all relevant tournaments
      const { data: gamesInTournaments, error: gamesError } = await supabase
        .from('games')
        .select('*')
        .in('tournament_id', tournamentIds)
        .order('created_at', { ascending: false });

      if (gamesError) throw gamesError;

      // Also include legacy/unassigned games (tournament_id null)
      const { data: legacyGames, error: legacyGamesError } = await supabase
        .from('games')
        .select('*')
        .is('tournament_id', null)
        .order('created_at', { ascending: false });

      if (legacyGamesError) throw legacyGamesError;

      const gamesCombinedMap: Record<string, any> = {};
      (gamesInTournaments || []).forEach(g => { if (g?.id) gamesCombinedMap[g.id] = g; });
      (legacyGames || []).forEach(g => { if (g?.id) gamesCombinedMap[g.id] = g; });
      const gamesCombined = Object.values(gamesCombinedMap);

      console.log('Admin.loadGames - fetched games:', gamesCombined.length);
      setGames(gamesCombined as any[]);

      // Load scores for all games from all tournaments
      const { data: scoresInTournaments, error: scoresError } = await supabase
        .from('scores')
        .select('*')
        .in('tournament_id', tournamentIds)
        .order('score', { ascending: false });

      if (scoresError) throw scoresError;

      // Include legacy/unassigned scores (tournament_id null)
      const { data: legacyScores, error: legacyScoresError } = await supabase
        .from('scores')
        .select('*')
        .is('tournament_id', null)
        .order('score', { ascending: false });

      if (legacyScoresError) throw legacyScoresError;

      const allScores = [...(scoresInTournaments || []), ...(legacyScores || [])];

      // Group scores by game_id
      const scoresByGame: Record<string, any[]> = {};
      (allScores || []).forEach(score => {
        if (!scoresByGame[score.game_id]) {
          scoresByGame[score.game_id] = [];
        }
        scoresByGame[score.game_id].push(score);
      });
      setGameScores(scoresByGame);

      setGamesUpdateTrigger(prev => prev + 1); // Trigger refresh for StopCompetition
    } catch (error: any) {
      console.error('Error loading games and scores:', error);
      toast({
        title: "Error",
        description: error?.message ? `Failed to load games and scores: ${error.message}` : "Failed to load games and scores",
        variant: "destructive"
      });
    } finally {
      setGamesLoading(false);
      setInitialLoaded(true);
    }
  };

  useEffect(() => {
    if (user && (isAdmin || hasPermission('admin')) && (userTournaments.length > 0 || !!currentTournament)) {
      loadGames();
    }
  }, [user, isAdmin, hasPermission, userTournaments, currentTournament]);

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

  // Quick add game for a specific tournament (preselects tournament and opens dialog)
  const handleAddGameForTournament = (tournamentId: string) => {
    setEditingGame(null);
    setFormData({
      name: "",
      logo_url: "",
      is_active: true,
      include_in_challenge: true,
      tournament_id: tournamentId,
    });
    setIsDialogOpen(true);
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

  // Set a game as active (included in challenge)
  const setGameActive = async (gameId: string) => {
    try {
      const { error } = await supabase
        .from('games')
        .update({ include_in_challenge: true })
        .eq('id', gameId);

      if (error) throw error;

      await loadGames();
      toast({ title: 'Success', description: 'Game marked as Active' });
    } catch (error) {
      console.error('Error setting game active:', error);
      toast({ title: 'Error', description: 'Failed to make game active', variant: 'destructive' });
    }
  };

  // Set a game as inactive (not included in challenge)
  const setGameInactive = async (gameId: string) => {
    try {
      const { error } = await supabase
        .from('games')
        .update({ include_in_challenge: false })
        .eq('id', gameId);

      if (error) throw error;

      await loadGames();
      toast({ title: 'Success', description: 'Game marked as Inactive' });
    } catch (error) {
      console.error('Error setting game inactive:', error);
      toast({ title: 'Error', description: 'Failed to make game inactive', variant: 'destructive' });
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
  const handleDeleteGame = (id: string) => {
    setDeleteGameDialog({ open: true, gameId: id });
  };

  const confirmDeleteGame = async () => {
    try {
      const { error } = await supabase
        .from('games')
        .delete()
        .eq('id', deleteGameDialog.gameId);

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

  const openAddScoreDialog = (gameId: string) => {
    setEditingScore(null);
    setNewScoreGameId(gameId);
    setScoreFormData({ player_name: "", score: "" });
    setIsScoreDialogOpen(true);
  };

  const saveScore = async () => {
    // Basic validation
    const pname = scoreFormData.player_name.trim();
    const sval = scoreFormData.score.trim();
    if (!pname || !sval) {
      toast({ title: "Error", description: "Player name and score are required", variant: "destructive" });
      return;
    }
    const scoreValue = Number(sval);
    if (Number.isNaN(scoreValue)) {
      toast({ title: "Error", description: "Score must be a number", variant: "destructive" });
      return;
    }

    try {
      if (editingScore) {
        // Update existing score
        const { error } = await supabase
          .from('scores')
          .update({
            player_name: pname.toUpperCase(),
            score: scoreValue
          })
          .eq('id', editingScore.id);

        if (error) throw error;
        toast({ title: "Success", description: "Score updated successfully" });
      } else {
        // Insert new score for selected game
        if (!newScoreGameId) {
          toast({ title: "Error", description: "No game selected for new score", variant: "destructive" });
          return;
        }
        const game = games.find(g => g.id === newScoreGameId);
        const tournamentId = game?.tournament_id || currentTournament?.id || null;
        const { error } = await supabase
          .from('scores')
          .insert({
            player_name: pname.toUpperCase(),
            score: scoreValue,
            game_id: newScoreGameId,
            tournament_id: tournamentId
          });
        if (error) throw error;
        toast({ title: "Success", description: "Score added successfully" });
      }

      setIsScoreDialogOpen(false);
      resetScoreForm();
      setNewScoreGameId(null);
      loadGames();
    } catch (error) {
      console.error('Error updating score:', error);
      toast({
        title: "Error",
        description: "Failed to save score",
        variant: "destructive"
      });
    }
  };

  const handleDeleteScore = (scoreId: string) => {
    setDeleteScoreDialog({ open: true, scoreId });
  };

  const confirmDeleteScore = async () => {
    try {
      const { error } = await supabase
        .from('scores')
        .delete()
        .eq('id', deleteScoreDialog.scoreId);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Score deleted successfully"
      });
      
      loadGames(); // Reload to refresh scores
      setDeleteScoreDialog({ open: false, scoreId: '' });
    } catch (error) {
      console.error('Error deleting score:', error);
      toast({
        title: "Error",
        description: "Failed to delete score",
        variant: "destructive"
      });
    }
  };

  // Inline helpers (defined here so all state and helpers are in scope)
  const saveGameNameInline = async (gameId: string) => {
    const newName = (inlineGameNames[gameId] || '').trim();
    if (!newName) {
      toast({ title: 'Error', description: 'Game name cannot be empty', variant: 'destructive' });
      return;
    }
    try {
      const { error } = await supabase.from('games').update({ name: newName }).eq('id', gameId);
      if (error) throw error;
      toast({ title: 'Saved', description: 'Game name updated' });
      setInlineGameNames(prev => { const c = { ...prev }; delete c[gameId]; return c; });
      loadGames();
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to update game', variant: 'destructive' });
    }
  };

  const updateScoreInline = async (scoreId: string) => {
    const edit = inlineScoreEdits[scoreId];
    if (!edit) return;
    const pname = (edit.player_name || '').trim();
    const sval = (edit.score || '').trim();
    if (!pname || !sval || Number.isNaN(Number(sval))) {
      toast({ title: 'Error', description: 'Provide player and numeric score', variant: 'destructive' });
      return;
    }
    try {
      const { error } = await supabase
        .from('scores')
        .update({ player_name: pname.toUpperCase(), score: Number(sval) })
        .eq('id', scoreId);
      if (error) throw error;
      toast({ title: 'Saved', description: 'Score updated' });
      setInlineScoreEdits(prev => { const c = { ...prev }; delete c[scoreId]; return c; });
      loadGames();
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to update score', variant: 'destructive' });
    }
  };

  const addScoreInline = async (gameId: string, tournamentId: string | null, player: string, sval: string) => {
    const pname = (player || '').trim();
    const scoreVal = Number((sval || '').trim());
    if (!pname || Number.isNaN(scoreVal)) {
      toast({ title: 'Error', description: 'Provide player and numeric score', variant: 'destructive' });
      return;
    }
    try {
      const { error } = await supabase
        .from('scores')
        .insert({ player_name: pname.toUpperCase(), score: scoreVal, game_id: gameId, tournament_id: tournamentId });
      if (error) throw error;
      toast({ title: 'Added', description: 'Score added' });
      loadGames();
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to add score', variant: 'destructive' });
    }
  };

  // Bulk move removed

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
  const handleDeleteTournament = async (tournamentId: string) => {
    if (!tournamentId) return;

    try {
      const success = await deleteTournament(tournamentId);

      if (success) {
        toast({
          title: "Success",
          description: "Tournament deleted successfully"
        });
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

  if (!initialLoaded && (loading || tournamentsLoading || gamesLoading)) {
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
            <Button 
              onClick={() => navigate('/')} 
              variant="outline"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Leaderboard
            </Button>
          </div>
        </PageHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6 bg-gray-900 border border-white/20">
            <TabsTrigger value="create-tournament" className="data-[state=active]:bg-arcade-neonCyan data-[state=active]:text-black">Tournaments</TabsTrigger>
            <TabsTrigger value="webhooks" className="data-[state=active]:bg-arcade-neonCyan data-[state=active]:text-black"><Webhook className="w-4 h-4 mr-2" />Webhooks</TabsTrigger>
            <TabsTrigger value="system" className="data-[state=active]:bg-arcade-neonCyan data-[state=active]:text-black"><TestTube className="w-4 h-4 mr-2" />System</TabsTrigger>
            <TabsTrigger value="achievements" className="data-[state=active]:bg-arcade-neonCyan data-[state=active]:text-black"><Trophy className="w-4 h-4 mr-2" />Achievements</TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-arcade-neonCyan data-[state=active]:text-black"><Users className="w-4 h-4 mr-2" />Users</TabsTrigger>
            <TabsTrigger value="demolition" className="data-[state=active]:bg-arcade-neonCyan data-[state=active]:text-black"><BarChart3 className="w-4 h-4 mr-2" />Demolition Man</TabsTrigger>
          </TabsList>

          <TabsContent value="create-tournament" className="mt-6">
            <Card className={getCardStyle('primary')}>
              <CardHeader>
                <div className="flex items-center justify-between gap-4 w-full">
                  <CardTitle className={getTypographyStyle('h3')}>Manage Tournaments</CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <RandomizeGames onGamesUpdated={loadGames} />
                    <StopCompetition onCompetitionStopped={loadGames} refreshTrigger={gamesUpdateTrigger} />
                    <Button onClick={cleanupPlaceholderLogos} variant="outline" className="h-8" title="Remove broken placeholder logos and use fallback UI instead">
                      <Wrench className="w-4 h-4 mr-2" /> Fix Logos
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-sm text-gray-300 mb-4">You have access to {userTournaments.length} tournament{userTournaments.length !== 1 ? 's' : ''}.</div>
                  <div className="grid gap-4">
                    {userTournaments.map((tournament) => (
                      <div key={tournament.id} className="p-4 bg-black/30 rounded-lg border border-white/10">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h4 className="font-semibold text-white">{tournament.name}</h4>
                              {tournament.id === currentTournament?.id && (<span className="px-2 py-1 text-xs bg-arcade-neonCyan text-black rounded">Current</span>)}
                              {tournament.is_public ? (<div title="Public Tournament"><Globe className="w-4 h-4 text-green-400" /></div>) : (<div title="Private Tournament"><Lock className="w-4 h-4 text-yellow-400" /></div>)}
                            </div>
                            <p className="text-sm text-gray-400 mb-1 truncate">Slug: /t/{tournament.slug}</p>
                            {tournament.description && (<p className="text-sm text-gray-300 break-words">{tournament.description}</p>)}
                            <p className="text-xs text-gray-500">Created: {new Date(tournament.created_at).toLocaleDateString()}</p>
                          </div>
                          <div className="flex gap-3 items-center shrink-0">
                            <div className="flex items-center gap-2">
                              <Label htmlFor={`t-active-${tournament.id}`} className="text-xs text-gray-300">Active</Label>
                              <Switch
                                key={`t-active-${tournament.id}-${tournament.id === currentTournament?.id ? 'on' : 'off'}`}
                                id={`t-active-${tournament.id}`}
                                checked={tournament.id === currentTournament?.id}
                                disabled={tournament.id === currentTournament?.id}
                                onCheckedChange={async (checked) => {
                                  if (!checked) return;
                                  await switchTournament(tournament);
                                  toast({ title: 'Tournament Switched', description: `Now managing "${tournament.name}"` });
                                }}
                                title={tournament.id === currentTournament?.id ? 'Current active tournament' : 'Activate this tournament'}
                              />
                            </div>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="outline" title="Clone"><Copy className="w-4 h-4" /></Button>
                              </DialogTrigger>
                              <DialogContent className="bg-gray-900 text-white border-white/20">
                                <DialogHeader><DialogTitle>Clone Tournament</DialogTitle></DialogHeader>
                                <div className="space-y-4">
                                  <div><Label className="text-white">Source Tournament</Label><Input value={tournament.name} disabled className="bg-black/50 border-white/20 text-white" /></div>
                                  <div><Label className="text-white">New Name</Label><Input id={`clone-name-${tournament.id}`} placeholder={`${tournament.name} (Copy)`} className="bg-black/50 border-white/20 text-white" /></div>
                                  <div><Label className="text-white">New Slug</Label><Input id={`clone-slug-${tournament.id}`} defaultValue={`${tournament.slug}-copy-${generateRandomString(4)}`} className="bg-black/50 border-white/20 text-white" /></div>
                                  <div className="flex items-center space-x-2"><Switch id={`clone-public-${tournament.id}`} defaultChecked={tournament.is_public} /><Label htmlFor={`clone-public-${tournament.id}`}>Make Public</Label></div>
                                  <div className="flex justify-end space-x-2 pt-4">
                                    <Button variant="outline" onClick={() => {}}>Cancel</Button>
                                    <Button onClick={async () => { const nameEl = document.getElementById(`clone-name-${tournament.id}`) as HTMLInputElement; const slugEl = document.getElementById(`clone-slug-${tournament.id}`) as HTMLInputElement; const pubEl = document.getElementById(`clone-public-${tournament.id}`) as HTMLInputElement; const name = nameEl?.value?.trim() || `${tournament.name} (Copy)`; const slug = slugEl?.value?.trim() || `${tournament.slug}-${generateRandomString(4)}`; const isPublic = !!pubEl?.checked; const created = await cloneTournament(tournament.id, { name, slug, is_public: isPublic }); if (created) { await refreshTournaments(); toast({ title: 'Success', description: `Cloned "${tournament.name}" as "${name}"` }); } }}>Clone Tournament</Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                            <Button size="sm" variant="outline" onClick={() => { toast({ title: 'Edit Tournament', description: `Edit functionality for "${tournament.name}" would go here` }); }}><Pencil className="w-4 h-4" /></Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="destructive" disabled={tournament.id === currentTournament?.id}><Trash2 className="w-4 h-4" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-gray-900 text-white border-white/20">
                                <AlertDialogHeader><AlertDialogTitle>Delete Tournament</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete "{tournament.name}"? This action cannot be undone and will remove all games, scores, and members.</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteTournament(tournament.id)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction></AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                        {/* Full-width games block below header row */}
                        <div className="mt-3 pt-3 border-t border-white/10">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="text-sm font-semibold text-white">Games ({games.filter(g => g.tournament_id === tournament.id).length})</h5>
                            <div className="flex items-center gap-2">
                              <Input placeholder="Search games..." value={tournamentFilters[tournament.id] || ''} onChange={(e) => setTournamentFilters(prev => ({ ...prev, [tournament.id]: e.target.value }))} className="h-7 w-40 bg-black/50 border-white/20 text-white text-xs" />
                              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => handleAddGameForTournament(tournament.id)}><Plus className="w-3 h-3 mr-1" /> Add Game</Button>
                            </div>
                          </div>
                          {/* Bulk actions removed */}

                          <div className="overflow-x-auto">
                            <Table className="w-full table-fixed">
                              <TableHeader>
                                <TableRow className="border-white/10 sticky top-0 bg-gray-900 z-10">
                                  <TableHead className="text-white text-xs w-[24%] cursor-pointer select-none" onClick={() => {
                                       const cur = tournamentSort[tournament.id] || { key: 'name', dir: 'asc' as const };
                                       const dir = cur.key === 'name' && cur.dir === 'asc' ? 'desc' : 'asc';
                                       setTournamentSort(prev => ({ ...prev, [tournament.id]: { key: 'name', dir } }));
                                     }} title="Sort by Name">Name{(() => { const s = tournamentSort[tournament.id]; return s?.key === 'name' ? (s.dir === 'asc' ? ' ▲' : ' ▼') : '' })()}</TableHead>
                                  <TableHead className="text-white text-xs w-[14%] cursor-pointer select-none" onClick={() => {
                                    const cur = tournamentSort[tournament.id] || { key: 'name', dir: 'asc' as const };
                                    const dir = cur.key === 'created_at' && cur.dir === 'asc' ? 'desc' : 'asc';
                                    setTournamentSort(prev => ({ ...prev, [tournament.id]: { key: 'created_at', dir } }));
                                  }} title="Sort by Created">Created{(() => { const s = tournamentSort[tournament.id]; return s?.key === 'created_at' ? (s.dir === 'asc' ? ' ▲' : ' ▼') : '' })()}</TableHead>
                                  <TableHead className="text-white text-xs w-[14%]">Active</TableHead>
                                  <TableHead className="text-white text-xs w-[30%]">Top Scores (inline)</TableHead>
                                  <TableHead className="text-white text-xs w-[20%] min-w-[240px] text-right">Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {(() => {
                                  const sort = tournamentSort[tournament.id] || { key: 'name' as const, dir: 'asc' as const };
                                  const filterTxt = (tournamentFilters[tournament.id] || '').toLowerCase();
                                  const all = games.filter(g => g.tournament_id === tournament.id).filter(g => !filterTxt || (g.name || '').toLowerCase().includes(filterTxt));
                                  const sorted = [...all].sort((a, b) => {
                                    if (sort.key === 'name') {
                                      const an = (a.name || '').toLowerCase();
                                      const bn = (b.name || '').toLowerCase();
                                      return sort.dir === 'asc' ? an.localeCompare(bn) : bn.localeCompare(an);
                                    } else {
                                      const at = a.created_at ? new Date(a.created_at).getTime() : 0;
                                      const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
                                      return sort.dir === 'asc' ? at - bt : bt - at;
                                    }
                                  });
                                  const expanded = !!tournamentExpanded[tournament.id];
                                  const page = expanded ? sorted : sorted.slice(0, 8);
                                  return (
                                    <>
                                      {page.map((game) => (
                                        <TableRow key={game.id} className="border-white/10">
                                            <TableCell className="text-white text-xs font-medium">
                                              <div className="flex items-center gap-2">
                                                <Input
                                                  value={inlineGameNames[game.id] ?? game.name}
                                                  onChange={(e) => setInlineGameNames(prev => ({ ...prev, [game.id]: e.target.value }))}
                                                  className="h-7 w-48 bg-secondary/40 border-white/20 text-white text-xs"
                                                />
                                                <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => saveGameNameInline(game.id)}>Save</Button>
                                              </div>
                                            </TableCell>
                                          <TableCell className="text-xs text-gray-300">{new Date(game.created_at).toLocaleDateString()}</TableCell>
                                          <TableCell className="text-xs">
                                            {game.include_in_challenge ? (
                                              <span className="px-2 py-1 rounded bg-green-600/20 text-green-400">Active</span>
                                            ) : (
                                              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setGameActive(game.id)}>Make Active</Button>
                                            )}
                                          </TableCell>
                                          <TableCell className="text-xs text-gray-300 align-top relative z-0">
                                            {(() => {
                                              const arr = gameScores[game.id] || [];
                                              return (
                                                <div className="flex flex-col gap-1 pr-16">
                                                  {arr.length === 0 && <span className="italic text-gray-500">No scores</span>}
                                                  {arr.map((s: any) => {
                                                    const edit = inlineScoreEdits[s.id] || { player_name: s.player_name, score: String(s.score) };
                                                    return (
                                                      <div key={s.id} className="flex items-center gap-2">
                                                        <Input
                                                          value={edit.player_name}
                                                          onChange={(e) => setInlineScoreEdits(prev => ({ ...prev, [s.id]: { ...(prev[s.id] || edit), player_name: e.target.value } }))}
                                                          className="h-7 w-24 bg-black/50 border-white/20 text-white text-xs"
                                                        />
                                                        <Input
                                                          value={edit.score}
                                                          onChange={(e) => setInlineScoreEdits(prev => ({ ...prev, [s.id]: { ...(prev[s.id] || edit), score: e.target.value } }))}
                                                          className="h-7 w-20 bg-black/50 border-white/20 text-white text-xs"
                                                          type="number"
                                                        />
                                                        <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => updateScoreInline(s.id)}>Save</Button>
                                                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => handleDeleteScore(s.id)}>Delete</Button>
                                                      </div>
                                                    );
                                                  })}
                                                  {/* View all removed; all scores shown */}
                                                  {/* Inline add new score row */}
                                                  <div className="flex items-center gap-2 pt-1">
                                                    <Input placeholder="Player" className="h-7 w-24 bg-black/50 border-white/20 text-white text-xs" id={`new-player-${game.id}`} />
                                                    <Input placeholder="Score" className="h-7 w-20 bg-black/50 border-white/20 text-white text-xs" id={`new-score-${game.id}`} type="number" />
                                                    <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => {
                                                      const p = (document.getElementById(`new-player-${game.id}`) as HTMLInputElement)?.value || '';
                                                      const sc = (document.getElementById(`new-score-${game.id}`) as HTMLInputElement)?.value || '';
                                                      const tId = game.tournament_id || currentTournament?.id || null;
                                                      addScoreInline(game.id, tId, p, sc);
                                                    }}>Add</Button>
                                                  </div>
                                                </div>
                                              );
                                            })()}
                                          </TableCell>
                                          <TableCell className="text-right align-top">
                                            <div className="flex items-center justify-end gap-2 flex-wrap pl-2 relative z-50">
                                              <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px] hover:bg-blue-600/20" title="Edit game" onClick={() => openEditDialog(game)}><Pencil className="w-3 h-3" /></Button>
                                              <Button size="sm" variant="ghost" className="h-6 px-2 hover:bg-red-600/20" title="Delete game" onClick={() => handleDeleteGame(game.id)}><Trash2 className="w-3 h-3" /></Button>
                                            </div>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                      {sorted.length === 0 && (
                                        <TableRow><TableCell colSpan={5} className="text-center text-gray-400 text-xs py-4 italic">No games in this tournament yet.</TableCell></TableRow>
                                      )}
                                      {sorted.length > 8 && (
                                        <TableRow>
                                          <TableCell colSpan={5} className="py-2">
                                            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setTournamentExpanded(prev => ({ ...prev, [tournament.id]: !prev[tournament.id] }))}>{expanded ? 'Show less' : `Show all (${sorted.length})`}</Button>
                                          </TableCell>
                                        </TableRow>
                                      )}
                                    </>
                                  );
                                })()}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Create New Tournament Section */}
            <CreateTournamentForm />
          </TabsContent>

          <TabsContent value="webhooks" className="mt-6"><WebhookConfig /></TabsContent>
          <TabsContent value="system" className="mt-6">
            <div className="space-y-6">
              <Card className={getCardStyle('primary')}>
                <CardHeader><CardTitle className={getTypographyStyle('h3')}>Performance Settings</CardTitle></CardHeader>
                <CardContent><PerformanceToggle /></CardContent>
              </Card>
              <DemolitionManEnsure />
              <ResetFunctions />
            </div>
          </TabsContent>
          <TabsContent value="achievements" className="mt-6"><AchievementManagerV2 /></TabsContent>
          <TabsContent value="users" className="mt-6"><UserManagement /></TabsContent>
          <TabsContent value="demolition" className="mt-6"><div className="space-y-6"><DemolitionManScoreManager /><DemolitionManQRSubmit /></div></TabsContent>
        </Tabs>

        {/* Shared Add/Edit Game Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
                <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="w-full sm:w-auto">Cancel</Button>
                <Button onClick={saveGame} variant="outline" className="w-full sm:w-auto" disabled={!formData.name.trim() || !formData.tournament_id}>
                  {editingGame ? 'Update' : 'Create'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Confirmation Dialogs */}
        <ConfirmationDialog
          open={deleteGameDialog.open}
          onOpenChange={(open) => setDeleteGameDialog(prev => ({ ...prev, open }))}
          title="Delete Game"
          description="Are you sure you want to delete this game? This action cannot be undone."
          confirmText="Delete Game"
          cancelText="Cancel"
          variant="destructive"
          onConfirm={confirmDeleteGame}
        />

        <ConfirmationDialog
          open={deleteScoreDialog.open}
          onOpenChange={(open) => setDeleteScoreDialog(prev => ({ ...prev, open }))}
          title="Delete Score"
          description="Are you sure you want to delete this score? This action cannot be undone."
          confirmText="Delete Score"
          cancelText="Cancel"
          variant="destructive"
          onConfirm={confirmDeleteScore}
        />
      </PageContainer>
    </div>
  );
};

export default Admin;