import { useState, useEffect, useRef } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { deleteScoreWithAchievementCleanup } from "@/utils/achievementUtils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Trash2, Plus, ArrowLeft, Gamepad2, BarChart3, Settings, Users, TestTube, Webhook, Lock, Globe, Trophy, Copy, Zap, RotateCcw, Maximize, Palette, Search } from "lucide-react";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { isPlaceholderLogo, formatScore } from "@/lib/utils";
import ImagePasteUpload from "@/components/ImagePasteUpload";
import GameLogoSuggestions, { GameLogoSuggestionsRef } from "@/components/GameLogoSuggestions";
import { AutocompleteDropdown } from "@/components/ui/autocomplete-dropdown";
import { AdvancedSearchField } from "@/components/ui/advanced-search-field";
import { clearLogoService } from "@/services/clearLogoService";
import WebhookConfig from "@/components/WebhookConfig";
import UserManagement from "@/components/UserManagement";
import ResetFunctions from "@/components/ResetFunctions";
import PerformanceToggle from "@/components/PerformanceToggle";
import { RatingTest } from "@/components/RatingTest";
import PerformanceModeToggle from "@/components/PerformanceModeToggle";
import ThemeSelector from "@/components/ThemeSelector";
import CompetitionManager from "@/components/CompetitionManager";
import AchievementManagerV2 from "@/components/AchievementManagerV2";
import BracketManagement from "@/components/BracketManagement";
import FunctionTests from "@/components/FunctionTests";
import { getPageLayout, getCardStyle, getButtonStyle, getTypographyStyle, PageHeader, PageContainer } from "@/utils/designSystem";
import { useUserRoles } from "@/hooks/useUserRoles";
import { useTournament } from "@/contexts/TournamentContext";
import { usePerformanceMode } from "@/hooks/usePerformanceMode";
import { useFullscreenContext } from "@/contexts/FullscreenContext";
import { TournamentStatsModal } from "@/components/TournamentStatsModal";

interface AdminProps {
  isExiting?: boolean;
}

interface Game {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  tournament_id: string;
  created_at: string;
  updated_at: string;
}

interface CreateTournamentFormProps {
  isOpen: boolean;
  onClose: () => void;
  initialGames?: Array<{
    id?: number;
    name: string;
    description?: string;
    logo_url?: string;
  }>;
}

const CreateTournamentForm = ({ isOpen, onClose, initialGames = [] }: CreateTournamentFormProps) => {
  const { createTournament } = useTournament();
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState(() => {
    const now = new Date();
    const oneMonthLater = new Date(now);
    oneMonthLater.setMonth(now.getMonth() + 1);

    return {
      name: '',
      description: '',
      slug: '',
      is_public: false,
      start_time: now.toISOString().slice(0, 16), // Format for datetime-local
      end_time: oneMonthLater.toISOString().slice(0, 16), // Format for datetime-local
    };
  });
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [games, setGames] = useState(initialGames);
  const [newGame, setNewGame] = useState({
    name: '',
    logo_url: ''
  });
  const logoSuggestionsRef = useRef<GameLogoSuggestionsRef>(null);

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

  const addGameToList = () => {
    console.log('🎮 Adding game to list:', newGame);
    if (!newGame.name.trim()) {
      toast({
        title: "Error",
        description: "Game name is required",
        variant: "destructive",
      });
      return;
    }

    const gameToAdd = {
      ...newGame,
      id: Date.now(), // temporary ID for UI
      name: newGame.name.trim(),
    };
    console.log('🎯 Game being added:', gameToAdd);
    setGames(prev => {
      const updated = [...prev, gameToAdd];
      console.log('📋 Updated games list:', updated);
      return updated;
    });

    // Reset new game form
    setNewGame({
      name: '',
      logo_url: ''
    });
  };

  const removeGameFromList = (gameId: number) => {
    setGames(prev => prev.filter(game => game.id !== gameId));
  };

  const handleCreateTournament = async () => {
    if (!createForm.name.trim() || !createForm.slug.trim()) {
      toast({
        title: "Error",
        description: "Highscore tournament name and slug are required",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    // Convert datetime-local values to ISO strings for the database
    const formatDateTimeForDatabase = (dateTimeLocal: string) => {
      if (!dateTimeLocal) return null;
      try {
        return new Date(dateTimeLocal).toISOString();
      } catch {
        return null;
      }
    };

    const tournament = await createTournament({
      name: createForm.name.trim(),
      description: createForm.description.trim() || undefined,
      slug: createForm.slug.trim().toLowerCase(),
      is_public: createForm.is_public,
      start_time: formatDateTimeForDatabase(createForm.start_time),
      end_time: formatDateTimeForDatabase(createForm.end_time),
    });

    if (tournament) {
      // Add games to the newly created tournament
      for (const game of games) {
        try {
          // Try to get clear logo if no logo is provided
          let logoUrl = game.logo_url || null;
          if (!logoUrl) {
            try {
              const clearLogos = await clearLogoService.getClearLogosForGames([game.name]);
              logoUrl = clearLogos[game.name] || null;
            } catch (error) {
              console.warn('Failed to fetch clear logo for', game.name, error);
            }
          }

          const { error } = await supabase
            .from('games')
            .insert({
              name: game.name,
              description: game.description,
              logo_url: logoUrl,
              tournament_id: tournament.id,
            });

          if (error) {
            console.error('Error adding game:', error);
            toast({
              title: "Warning",
              description: `Failed to add game "${game.name}" to tournament`,
              variant: "destructive",
            });
          }
        } catch (error) {
          console.error('Error adding game:', error);
        }
      }

      // Reset form with new default dates
      const now = new Date();
      const oneMonthLater = new Date(now);
      oneMonthLater.setMonth(now.getMonth() + 1);

      setCreateForm({
        name: '',
        description: '',
        slug: '',
        is_public: false,
        start_time: now.toISOString().slice(0, 16),
        end_time: oneMonthLater.toISOString().slice(0, 16),
      });
      setGames([]);
      setSlugAvailable(null);
      toast({
        title: "Success",
        description: `Tournament created successfully! ${games.length > 0 ? `${games.length} games added.` : ''}`,
      });
      onClose(); // Close the modal
    }
    setIsCreating(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Highscore Tournament</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="tournament" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="tournament">Tournament Details</TabsTrigger>
            <TabsTrigger value="games">Games ({games.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="tournament" className="space-y-4 mt-4">
        <div>
          <Label htmlFor="name" className="text-white">Highscore Tournament Name</Label>
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
            placeholder="My Awesome Highscore Tournament"
            className="bg-black/50 border-gray-700 text-white"
          />
        </div>


        <div>
          <Label htmlFor="slug" className="text-white">Highscore Tournament Slug</Label>
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

        <div className="space-y-4">
          <div>
            <Label className="text-white">Start Date & Time</Label>
            <div className="relative">
              <DatePicker
                selected={createForm.start_time ? new Date(createForm.start_time) : null}
                onChange={(date) => setCreateForm(prev => ({
                  ...prev,
                  start_time: date ? date.toISOString().slice(0, 16) : ''
                }))}
                showTimeSelect
                dateFormat="yyyy-MM-dd h:mm aa"
                className="w-full px-3 py-2 pr-10 bg-black/50 border border-gray-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                wrapperClassName="w-full"
                placeholderText="Select start date and time"
                renderCustomHeader={({
                  date,
                  decreaseMonth,
                  increaseMonth,
                  prevMonthButtonDisabled,
                  nextMonthButtonDisabled,
                }) => (
                  <div className="flex items-center justify-between px-2 py-2">
                    <button
                      onClick={decreaseMonth}
                      disabled={prevMonthButtonDisabled}
                      type="button"
                      className="p-1 text-white hover:bg-white/10 rounded disabled:opacity-50"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-white font-semibold">
                      {date.toLocaleDateString("en-US", {
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                    <button
                      onClick={increaseMonth}
                      disabled={nextMonthButtonDisabled}
                      type="button"
                      className="p-1 text-white hover:bg-white/10 rounded disabled:opacity-50"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              />
              <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <Label className="text-white">End Date & Time</Label>
            <div className="relative">
              <DatePicker
                selected={createForm.end_time ? new Date(createForm.end_time) : null}
                onChange={(date) => setCreateForm(prev => ({
                  ...prev,
                  end_time: date ? date.toISOString().slice(0, 16) : ''
                }))}
                showTimeSelect
                dateFormat="yyyy-MM-dd h:mm aa"
                className="w-full px-3 py-2 pr-10 bg-black/50 border border-gray-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                wrapperClassName="w-full"
                placeholderText="Select end date and time"
                renderCustomHeader={({
                  date,
                  decreaseMonth,
                  increaseMonth,
                  prevMonthButtonDisabled,
                  nextMonthButtonDisabled,
                }) => (
                  <div className="flex items-center justify-between px-2 py-2">
                    <button
                      onClick={decreaseMonth}
                      disabled={prevMonthButtonDisabled}
                      type="button"
                      className="p-1 text-white hover:bg-white/10 rounded disabled:opacity-50"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-white font-semibold">
                      {date.toLocaleDateString("en-US", {
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                    <button
                      onClick={increaseMonth}
                      disabled={nextMonthButtonDisabled}
                      type="button"
                      className="p-1 text-white hover:bg-white/10 rounded disabled:opacity-50"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              />
              <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        <Button
          onClick={handleCreateTournament}
          disabled={!createForm.name.trim() || !createForm.slug.trim() || isCreating || slugAvailable === false}
          className="w-full"
        >
          {isCreating ? 'Creating...' : 'Create Tournament'}
        </Button>
        </TabsContent>

        <TabsContent value="games" className="space-y-4 mt-4">
            {/* Add New Game Section */}
            <div className="border rounded-lg p-4 space-y-4">
              <h4 className="font-semibold text-white">Add Game</h4>

              <div>
                <Label htmlFor="game-name" className="text-white">Game Name *</Label>
                <AdvancedSearchField
                  value={newGame.name}
                  onChange={(value) => setNewGame(prev => ({ ...prev, name: value }))}
                  placeholder="Enter game name (logos search automatically as you type)"
                  enableSuggestions={true}
                  searchHint="💡 Tip: Try 'Street Fighter', 'Pac-Man', 'Metal Slug', or use abbreviations like 'SF'"
                  className="bg-black/50 border-white/20 text-white"
                />
              </div>



              <GameLogoSuggestions
                ref={logoSuggestionsRef}
                gameName={newGame.name}
                selectedImageUrl={newGame.logo_url}
                onSelectImage={(url) => setNewGame(prev => ({ ...prev, logo_url: url }))}
              />


              <Button
                onClick={addGameToList}
                disabled={!newGame.name.trim()}
                className="w-full"
                variant="outline"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Game to Tournament
              </Button>
            </div>

            {/* Games List */}
            {games.length > 0 && (
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold text-white mb-3">Games to Add ({games.length})</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {games.map((game) => (
                    <div key={game.id} className="flex items-center justify-between p-2 bg-black/30 rounded">
                      <div className="flex items-center space-x-3">
                        {game.logo_url && (
                          <img
                            src={game.logo_url}
                            alt={game.name}
                            className="w-8 h-8 rounded object-cover"
                          />
                        )}
                        <div>
                          <p className="font-medium text-white">{game.name}</p>
                          {game.description && (
                            <p className="text-xs text-gray-400 truncate max-w-48">{game.description}</p>
                          )}
                        </div>
                      </div>
                      <Button
                        onClick={() => removeGameFromList(game.id!)}
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button
              onClick={handleCreateTournament}
              disabled={!createForm.name.trim() || !createForm.slug.trim() || isCreating || slugAvailable === false}
              className="w-full"
            >
              {isCreating ? 'Creating...' : `Create Tournament${games.length > 0 ? ` with ${games.length} Games` : ''}`}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
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

const SuggestGames = ({ isOpen, onClose, loadGames }: { isOpen: boolean; onClose: () => void; loadGames: () => Promise<void> }) => {
  const { currentTournament } = useTournament();
  const [loading, setLoading] = useState(false);
  const [games, setGames] = useState<any[]>([]);
  const [selectedLogos, setSelectedLogos] = useState<Record<number, string>>({});
  const [clearLogos, setClearLogos] = useState<Record<string, string>>({});
  const [addingGames, setAddingGames] = useState(false);
  const [filters, setFilters] = useState({
    region: 'any',
    platform: 'any',
    series: 'any',
    homebrew: 'any',
    year: 'any',
    manufacturer: 'any',
    category: 'any',
    rotation: 'any',
    move_inputs: 'any',
    num_buttons: 'any'
  });
  const [misterCompatibleOnly, setMisterCompatibleOnly] = useState(true);
  const { toast } = useToast();

  const addGamesToTournament = async () => {
    if (!currentTournament) {
      toast({
        title: "Error",
        description: "No active highscore tournament selected",
        variant: "destructive"
      });
      return;
    }

    setAddingGames(true);
    try {
      const gamesToAdd = games.map((game, index) => ({
        name: game.name,
        logo_url: selectedLogos[index] || clearLogos[game.name] || '',
        tournament_id: currentTournament.id,
      }));

      const { data, error } = await supabase
        .from('games')
        .insert(gamesToAdd)
        .select();

      if (error) throw error;

      toast({
        title: "Success!",
        description: `Added ${gamesToAdd.length} games to "${currentTournament.name}"`,
      });

      // Refresh the games list
      await loadGames();

      // Close the modal
      onClose();

    } catch (error) {
      console.error('Error adding games:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add games",
        variant: "destructive"
      });
    } finally {
      setAddingGames(false);
    }
  };

  // Store all available games
  const [allAvailableGames, setAllAvailableGames] = useState<any[]>([]);
  const [gamesLoaded, setGamesLoaded] = useState(false);

  // Fallback data if CSV fails
  const misterFallbackGames = [
    { name: "Street Fighter II", year: "1991", manufacturer: "Capcom", category: "Fighter", region: "World", series: "Street Fighter", rotation: "0", num_buttons: "6" },
    { name: "Metal Slug", year: "1996", manufacturer: "SNK", category: "Shooter", region: "World", series: "Metal Slug", rotation: "0", num_buttons: "2" },
    { name: "The King of Fighters '98", year: "1998", manufacturer: "SNK", category: "Fighter", region: "World", series: "King of Fighters", rotation: "0", num_buttons: "4" },
    { name: "Pac-Man", year: "1980", manufacturer: "Namco", category: "Maze", region: "World", series: "", rotation: "90", num_buttons: "0" },
    { name: "Donkey Kong", year: "1981", manufacturer: "Nintendo", category: "Platform", region: "World", series: "Donkey Kong", rotation: "90", num_buttons: "2" },
    { name: "Galaga", year: "1981", manufacturer: "Namco", category: "Shooter", region: "World", series: "", rotation: "90", num_buttons: "1" },
    { name: "Mortal Kombat", year: "1992", manufacturer: "Midway", category: "Fighter", region: "USA", series: "Mortal Kombat", rotation: "0", num_buttons: "5" },
    { name: "Final Fight", year: "1989", manufacturer: "Capcom", category: "Beat 'em up", region: "World", series: "", rotation: "0", num_buttons: "2" }
  ];

  const mameFallbackGames = [
    { name: "Street Fighter II", year: "1991", manufacturer: "Capcom", category: "Fighter", region: "World", series: "Street Fighter", rotation: "0", num_buttons: "6" },
    { name: "Metal Slug", year: "1996", manufacturer: "SNK", category: "Shooter", region: "World", series: "Metal Slug", rotation: "0", num_buttons: "2" },
    { name: "Pac-Man", year: "1980", manufacturer: "Namco", category: "Maze", region: "World", series: "", rotation: "90", num_buttons: "0" },
    { name: "Asteroids", year: "1979", manufacturer: "Atari", category: "Shooter", region: "USA", series: "", rotation: "0", num_buttons: "5" },
    { name: "Centipede", year: "1980", manufacturer: "Atari", category: "Shooter", region: "USA", series: "", rotation: "90", num_buttons: "1" },
    { name: "Defender", year: "1980", manufacturer: "Williams", category: "Shooter", region: "USA", series: "", rotation: "0", num_buttons: "5" },
    { name: "Frogger", year: "1981", manufacturer: "Konami", category: "Action", region: "World", series: "", rotation: "90", num_buttons: "1" },
    { name: "Ms. Pac-Man", year: "1981", manufacturer: "Midway", category: "Maze", region: "USA", series: "Pac-Man", rotation: "90", num_buttons: "0" },
    { name: "Q*bert", year: "1982", manufacturer: "Gottlieb", category: "Action", region: "USA", series: "", rotation: "0", num_buttons: "1" },
    { name: "Robotron: 2084", year: "1982", manufacturer: "Williams", category: "Shooter", region: "USA", series: "", rotation: "0", num_buttons: "0" },
    { name: "Tempest", year: "1981", manufacturer: "Atari", category: "Shooter", region: "USA", series: "", rotation: "0", num_buttons: "2" },
    { name: "Joust", year: "1982", manufacturer: "Williams", category: "Action", region: "USA", series: "", rotation: "0", num_buttons: "1" },
    { name: "Missile Command", year: "1980", manufacturer: "Atari", category: "Shooter", region: "USA", series: "", rotation: "0", num_buttons: "1" },
    { name: "Phoenix", year: "1980", manufacturer: "Amstar", category: "Shooter", region: "USA", series: "", rotation: "90", num_buttons: "2" },
    { name: "BurgerTime", year: "1982", manufacturer: "Data East", category: "Platform", region: "World", series: "", rotation: "90", num_buttons: "1" }
  ];

  const loadAllGames = async () => {
    setLoading(true);

    try {

      // Try to fetch the CSV data with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      // Choose data source based on MiSTer compatibility toggle
      const csvUrl = misterCompatibleOnly
        ? 'https://raw.githubusercontent.com/MiSTer-devel/ArcadeDatabase_MiSTer/refs/heads/main/ArcadeDatabase_CSV/ArcadeDatabase.csv'
        : 'https://raw.githubusercontent.com/libretro/mame2003-plus-libretro/master/metadata/mame2003-plus_gamelist.csv'; // Full MAME library alternative

      const response = await fetch(csvUrl, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Network error: ${response.status}`);
      }

      const csvText = await response.text();

      if (!csvText || csvText.length < 100) {
        throw new Error('CSV appears to be empty or corrupted');
      }

      // Parse with ultra-safe approach
      const lines = csvText.split(/\r?\n/).filter(line => line && line.trim().length > 0);

      if (lines.length < 2) {
        throw new Error('CSV has insufficient data');
      }


      // Get headers more safely
      const headerLine = lines[0];
      const headers = headerLine.split(',').map(h => h.replace(/^["']|["']$/g, '').trim());

      if (headers.length < 3) {
        throw new Error('CSV headers appear malformed');
      }


      // Process games with maximum safety
      const allGames = [];
      let processed = 0;
      let skipped = 0;

      for (let i = 1; i < lines.length && i < 5000; i++) { // Limit to first 5000 rows
        processed++;

        try {
          const line = lines[i];
          if (!line || line.length < 10) continue;

          // Very simple parsing - just split and clean
          const rawValues = line.split(',');
          if (rawValues.length < headers.length / 2) continue; // Skip clearly malformed rows

          const values = rawValues.map(v => {
            if (!v) return '';
            return v.replace(/^["']|["']$/g, '').trim();
          });

          // Build game object safely
          const game: any = {};
          for (let j = 0; j < Math.min(headers.length, values.length); j++) {
            const header = headers[j];
            if (header && header.length > 0) {
              game[header] = values[j] || '';
            }
          }

          // Must have a name to be valid
          if (game.name && typeof game.name === 'string' && game.name.trim().length > 0) {
            allGames.push(game);
          } else {
            skipped++;
          }

        } catch (rowError) {
          skipped++;
          // Silently skip bad rows
        }

        // Progress indicator for large files
        if (processed % 1000 === 0) {
        }
      }


      if (allGames.length === 0) {
        throw new Error('No valid games found in CSV data');
      }

      // Apply filters safely
      let filteredGames = allGames;

      for (const [key, value] of Object.entries(filters)) {
        if (!value || !value.trim() || value === 'any') continue;

        const beforeCount = filteredGames.length;
        filteredGames = filteredGames.filter(game => {
          try {
            const gameValue = game[key];
            if (!gameValue) return false;
            return String(gameValue).toLowerCase().includes(value.toLowerCase());
          } catch {
            return false;
          }
        });

      }

      if (filteredGames.length === 0) {
        filteredGames = misterCompatibleOnly ? misterFallbackGames : mameFallbackGames;
      }

      // Select random games
      const selectedGames = [];
      const gamesToSelect = Math.min(5, filteredGames.length);
      const availableGames = [...filteredGames];

      for (let i = 0; i < gamesToSelect; i++) {
        const randomIndex = Math.floor(Math.random() * availableGames.length);
        selectedGames.push(availableGames.splice(randomIndex, 1)[0]);
      }



      if (allGames.length === 0) {
        throw new Error('No valid games found in CSV data');
      }

      setAllAvailableGames(allGames);
      setGamesLoaded(true);

    } catch (error) {
      setAllAvailableGames(misterCompatibleOnly ? misterFallbackGames : mameFallbackGames);
      setGamesLoaded(true);
    } finally {
      setLoading(false);
    }
  };

  // Function to load clear logos for games
  const loadClearLogos = async (gameList: any[]) => {
    if (gameList.length === 0) return;

    try {
      const gameNames = gameList.map(game => game.name);
      const logos = await clearLogoService.getClearLogosForGames(gameNames);
      setClearLogos(logos);
      console.log('Loaded clear logos for', Object.keys(logos).length, 'games');
    } catch (error) {
      console.error('Error loading clear logos:', error);
    }
  };

  // Filter and select 5 random games based on current filters
  const updateRandomGames = () => {
    if (!gamesLoaded || allAvailableGames.length === 0) return;

    // Apply filters
    let filteredGames = allAvailableGames;

    for (const [key, value] of Object.entries(filters)) {
      if (!value || !value.trim() || value === 'any') continue;

      filteredGames = filteredGames.filter(game => {
        try {
          const gameValue = game[key];
          if (!gameValue) return false;
          return String(gameValue).toLowerCase().includes(value.toLowerCase());
        } catch {
          return false;
        }
      });
    }

    if (filteredGames.length === 0) {
      filteredGames = allAvailableGames; // Reset if no matches
    }

    // Select 5 random games
    const selectedGames = [];
    const gamesToSelect = Math.min(5, filteredGames.length);
    const availableGames = [...filteredGames];

    for (let i = 0; i < gamesToSelect; i++) {
      const randomIndex = Math.floor(Math.random() * availableGames.length);
      selectedGames.push(availableGames.splice(randomIndex, 1)[0]);
    }


    setGames(selectedGames);
    setSelectedLogos({}); // Clear selected logos when games change

    // Load clear logos for the new games
    loadClearLogos(selectedGames);
  };

  // Load games when modal opens
  useEffect(() => {
    if (isOpen) {
      setGamesLoaded(false);
      loadAllGames();
    }
  }, [isOpen, misterCompatibleOnly]);

  // Update games when filters change
  useEffect(() => {
    if (gamesLoaded) {
      updateRandomGames();
    }
  }, [filters, gamesLoaded]);

  // Load clear logos whenever games change
  useEffect(() => {
    if (games.length > 0) {
      loadClearLogos(games);
    }
  }, [games]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Suggest Games from Arcade Database</DialogTitle>
          <DialogDescription>
            Filter and discover random arcade games from the MiSTer FPGA database or the full MAME library, then add them to your tournament.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* MiSTer Compatibility Toggle */}
          <div className="flex items-center space-x-2 p-3 bg-black/30 border border-white/20 rounded-lg">
            <Switch
              id="mister-compatible"
              checked={misterCompatibleOnly}
              onCheckedChange={setMisterCompatibleOnly}
            />
            <Label htmlFor="mister-compatible" className="text-white">
              Limit to MiSTer FPGA compatible games only
            </Label>
            <div className="text-xs text-gray-400 ml-2">
              {misterCompatibleOnly ? '(~900 games)' : '(~10,000+ games)'}
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <Label>Region</Label>
              <Select value={filters.region} onValueChange={(value) => setFilters(prev => ({ ...prev, region: value }))}>
                <SelectTrigger className="bg-black/50 border-gray-700 text-white">
                  <SelectValue placeholder="Any Region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any Region</SelectItem>
                  <SelectItem value="World">World</SelectItem>
                  <SelectItem value="Japan">Japan</SelectItem>
                  <SelectItem value="USA">USA</SelectItem>
                  <SelectItem value="Europe">Europe</SelectItem>
                  <SelectItem value="Asia">Asia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Platform</Label>
              <Select value={filters.platform} onValueChange={(value) => setFilters(prev => ({ ...prev, platform: value }))}>
                <SelectTrigger className="bg-black/50 border-gray-700 text-white">
                  <SelectValue placeholder="Any Platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any Platform</SelectItem>
                  <SelectItem value="Arcade">Arcade</SelectItem>
                  <SelectItem value="Neo Geo">Neo Geo</SelectItem>
                  <SelectItem value="CPS">CPS</SelectItem>
                  <SelectItem value="CPS2">CPS2</SelectItem>
                  <SelectItem value="CPS3">CPS3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Series</Label>
              <Select value={filters.series} onValueChange={(value) => setFilters(prev => ({ ...prev, series: value }))}>
                <SelectTrigger className="bg-black/50 border-gray-700 text-white">
                  <SelectValue placeholder="Any Series" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any Series</SelectItem>
                  <SelectItem value="Street Fighter">Street Fighter</SelectItem>
                  <SelectItem value="King of Fighters">King of Fighters</SelectItem>
                  <SelectItem value="Metal Slug">Metal Slug</SelectItem>
                  <SelectItem value="Fatal Fury">Fatal Fury</SelectItem>
                  <SelectItem value="Samurai Shodown">Samurai Shodown</SelectItem>
                  <SelectItem value="Tekken">Tekken</SelectItem>
                  <SelectItem value="Mortal Kombat">Mortal Kombat</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Homebrew</Label>
              <Select value={filters.homebrew} onValueChange={(value) => setFilters(prev => ({ ...prev, homebrew: value }))}>
                <SelectTrigger className="bg-black/50 border-gray-700 text-white">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="No">Official Games</SelectItem>
                  <SelectItem value="Yes">Homebrew Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Year</Label>
              <Select value={filters.year} onValueChange={(value) => setFilters(prev => ({ ...prev, year: value }))}>
                <SelectTrigger className="bg-black/50 border-gray-700 text-white">
                  <SelectValue placeholder="Any Year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any Year</SelectItem>
                  <SelectItem value="1980">1980s</SelectItem>
                  <SelectItem value="1990">1990s</SelectItem>
                  <SelectItem value="2000">2000s</SelectItem>
                  <SelectItem value="2010">2010s</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Manufacturer</Label>
              <Select value={filters.manufacturer} onValueChange={(value) => setFilters(prev => ({ ...prev, manufacturer: value }))}>
                <SelectTrigger className="bg-black/50 border-gray-700 text-white">
                  <SelectValue placeholder="Any Manufacturer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any Manufacturer</SelectItem>
                  <SelectItem value="Capcom">Capcom</SelectItem>
                  <SelectItem value="SNK">SNK</SelectItem>
                  <SelectItem value="Konami">Konami</SelectItem>
                  <SelectItem value="Namco">Namco</SelectItem>
                  <SelectItem value="Sega">Sega</SelectItem>
                  <SelectItem value="Taito">Taito</SelectItem>
                  <SelectItem value="Midway">Midway</SelectItem>
                  <SelectItem value="Data East">Data East</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Category</Label>
              <Select value={filters.category} onValueChange={(value) => setFilters(prev => ({ ...prev, category: value }))}>
                <SelectTrigger className="bg-black/50 border-gray-700 text-white">
                  <SelectValue placeholder="Any Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any Category</SelectItem>
                  <SelectItem value="Fighter">Fighter</SelectItem>
                  <SelectItem value="Shooter">Shooter</SelectItem>
                  <SelectItem value="Platform">Platform</SelectItem>
                  <SelectItem value="Beat 'em up">Beat 'em up</SelectItem>
                  <SelectItem value="Puzzle">Puzzle</SelectItem>
                  <SelectItem value="Racing">Racing</SelectItem>
                  <SelectItem value="Sports">Sports</SelectItem>
                  <SelectItem value="Action">Action</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Rotation</Label>
              <Select value={filters.rotation} onValueChange={(value) => setFilters(prev => ({ ...prev, rotation: value }))}>
                <SelectTrigger className="bg-black/50 border-gray-700 text-white">
                  <SelectValue placeholder="Any Rotation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any Rotation</SelectItem>
                  <SelectItem value="0">Horizontal (0°)</SelectItem>
                  <SelectItem value="90">Vertical CW (90°)</SelectItem>
                  <SelectItem value="180">Upside Down (180°)</SelectItem>
                  <SelectItem value="270">Vertical CCW (270°)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Move Inputs</Label>
              <Select value={filters.move_inputs} onValueChange={(value) => setFilters(prev => ({ ...prev, move_inputs: value }))}>
                <SelectTrigger className="bg-black/50 border-gray-700 text-white">
                  <SelectValue placeholder="Any Input" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any Input</SelectItem>
                  <SelectItem value="8-way">8-way Joystick</SelectItem>
                  <SelectItem value="4-way">4-way Joystick</SelectItem>
                  <SelectItem value="2-way">2-way Joystick</SelectItem>
                  <SelectItem value="Analog">Analog Stick</SelectItem>
                  <SelectItem value="Trackball">Trackball</SelectItem>
                  <SelectItem value="Paddle">Paddle</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Num Buttons</Label>
              <Select value={filters.num_buttons} onValueChange={(value) => setFilters(prev => ({ ...prev, num_buttons: value }))}>
                <SelectTrigger className="bg-black/50 border-gray-700 text-white">
                  <SelectValue placeholder="Any Buttons" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any Buttons</SelectItem>
                  <SelectItem value="1">1 Button</SelectItem>
                  <SelectItem value="2">2 Buttons</SelectItem>
                  <SelectItem value="3">3 Buttons</SelectItem>
                  <SelectItem value="4">4 Buttons</SelectItem>
                  <SelectItem value="5">5 Buttons</SelectItem>
                  <SelectItem value="6">6 Buttons</SelectItem>
                  <SelectItem value="7">7+ Buttons</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setFilters({
              region: 'any', platform: 'any', series: 'any', homebrew: 'any', year: 'any',
              manufacturer: 'any', category: 'any', rotation: 'any', move_inputs: 'any', num_buttons: 'any'
            })}>
              Clear Filters
            </Button>
            <Button onClick={updateRandomGames} variant="outline">
              Shuffle Games
            </Button>
            {games.length > 0 && currentTournament && (
              <Button
                onClick={addGamesToTournament}
                disabled={addingGames}
                className="bg-arcade-neonCyan text-black hover:bg-arcade-neonCyan/80"
              >
                {addingGames ? 'Adding...' : `Add to ${currentTournament.name}`}
              </Button>
            )}
          </div>

          {/* Results */}
          {games.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Suggested Games:</h3>
              <div className="space-y-6">
                {games.map((game, index) => (
                  <Card key={index} className="bg-black/30 border-white/20 mb-4">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {/* Game Name Header */}
                        <div className="border-b border-white/20 pb-2 mb-3">
                          <h3 className="text-lg font-bold text-arcade-neonCyan">{game.name}</h3>
                          <div className="text-xs text-gray-400">
                            {game.year} • {game.manufacturer} • {game.category}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                          <div><strong>Year:</strong> {game.year}</div>
                          <div><strong>Manufacturer:</strong> {game.manufacturer}</div>
                          <div><strong>Category:</strong> {game.category}</div>
                          <div><strong>Region:</strong> {game.region}</div>
                          <div><strong>Series:</strong> {game.series}</div>
                          <div><strong>Rotation:</strong> {game.rotation}°</div>
                          <div><strong>Buttons:</strong> {game.num_buttons}</div>
                          <div><strong>Platform:</strong> {game.platform || 'Arcade'}</div>
                        </div>

                        {/* Clear Logo Preview */}
                        {clearLogos[game.name] && (
                          <div className="border-t border-white/10 pt-3">
                            <div className="text-sm font-medium text-white mb-2">
                              Clear Logo Available:
                              <span className="ml-2 text-xs text-green-400">✓ Auto-selected from S3</span>
                            </div>
                            <div className="flex items-center gap-3 p-2 bg-green-900/20 border border-green-400/20 rounded">
                              <img
                                src={clearLogos[game.name]}
                                alt={`${game.name} clear logo`}
                                className="w-12 h-12 object-contain bg-white/10 rounded"
                              />
                              <div className="text-xs text-green-300">
                                High-quality clear logo will be used automatically
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Logo suggestions for this game - only show if no clear logo */}
                        {!clearLogos[game.name] && (
                          <div className="border-t border-white/10 pt-3">
                            <div className="text-sm font-medium text-white mb-2">
                              Available Logos:
                              {selectedLogos[index] && (
                                <span className="ml-2 text-xs text-arcade-neonCyan">✓ Selected</span>
                              )}
                            </div>
                            <GameLogoSuggestions
                              gameName={game.name}
                              selectedImageUrl={selectedLogos[index]}
                              onSelectImage={(imageUrl) => {
                                // Set the selected logo for this game
                                setSelectedLogos(prev => ({ ...prev, [index]: imageUrl }));
                                toast({
                                  title: "Logo Selected",
                                  description: `Logo selected for "${game.name}"`,
                                });
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const Admin: React.FC<AdminProps> = ({ isExiting = false }) => {
  const { user, isAdmin, loading } = useAuth();
  const { currentTournament, userTournaments, hasPermission, updateTournament, deleteTournament, refreshTournaments, currentUserRole, cloneTournament, switchTournament, loading: tournamentsLoading } = useTournament();
  const { enableAnimations } = usePerformanceMode();
  const { fullscreenEnabled, toggleFullscreenPreference, loading: fullscreenLoading } = useFullscreenContext();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [games, setGames] = useState<Game[]>([]);
  const [gameScores, setGameScores] = useState<Record<string, any[]>>({});
  const [gamesLoading, setGamesLoading] = useState(true);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [editingScore, setEditingScore] = useState<any | null>(null);
  const [editingTournament, setEditingTournament] = useState<any | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isScoreDialogOpen, setIsScoreDialogOpen] = useState(false);
  const [isTournamentEditOpen, setIsTournamentEditOpen] = useState(false);
  const [isCreateTournamentOpen, setIsCreateTournamentOpen] = useState(false);
  const [isSuggestGamesOpen, setIsSuggestGamesOpen] = useState(false);
  const [cloneDialogOpen, setCloneDialogOpen] = useState<string | null>(null);
  const [scoreFormData, setScoreFormData] = useState({
    player_name: "",
    score: ""
  });
  const [newScoreGameId, setNewScoreGameId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    logo_url: "",
    tournament_id: currentTournament?.id || ""
  });

  // Game search state (now handled by AdvancedSearchField)
  const [gameSearchValue, setGameSearchValue] = useState('');
  const [tournamentFormData, setTournamentFormData] = useState({
    name: "",
    slug: "",
    description: "",
    is_public: false,
    start_time: "",
    end_time: "",
    is_active: true,
    scores_locked: false
  });
  const gameLogoSuggestionsRef = useRef<GameLogoSuggestionsRef>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [tournamentSort, setTournamentSort] = useState<Record<string, { key: 'name' | 'created_at'; dir: 'asc' | 'desc' }>>({});
  const [tournamentExpanded, setTournamentExpanded] = useState<Record<string, boolean>>({});
  const [tournamentFilters, setTournamentFilters] = useState<Record<string, string>>({});
  // Persisted active tab
  const [activeTab, setActiveTab] = useState<string>('create-tournament');
  const [tabTransitioning, setTabTransitioning] = useState(false);
  const [previousTab, setPreviousTab] = useState<string>('create-tournament');
  // System subtab state
  const [systemSubTab, setSystemSubTab] = useState<string>('performance');
  const [systemSubTabTransitioning, setSystemSubTabTransitioning] = useState(false);
  const [competitionSubTab, setCompetitionSubTab] = useState<string>('tournaments');
  const [competitionSubTabTransitioning, setCompetitionSubTabTransitioning] = useState(false);
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
    if (loading || tournamentsLoading) return;
    // Add a short delay to allow isAdmin/currentUserRole to resolve after session restoration
    const timer = setTimeout(() => {
      const isAuthorized = !!user && (isAdmin || hasPermission('admin') || currentUserRole === 'owner');
      if (!isAuthorized) {
        navigate('/', { replace: true });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [user, isAdmin, currentUserRole, hasPermission, loading, tournamentsLoading, navigate]);

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

  // Simple animation trigger on mount
  useEffect(() => {
    // Only show content if not exiting
    if (!isExiting) {
      setShowContent(true);
      // Start animation after a brief moment
      const timer = setTimeout(() => {
        setHasAnimated(true);
      }, 50);
      return () => clearTimeout(timer);
    } else {
      // Reset animation states when exiting
      setShowContent(false);
      setHasAnimated(false);
    }
  }, [isExiting]);

  // Reset form
  const resetForm = () => {
    setFormData({
      name: "",
      logo_url: "",
      tournament_id: currentTournament?.id || ""
    });
    setEditingGame(null);
    setGameSearchValue('');
  };

  // Quick add game for a specific tournament (preselects tournament and opens dialog)
  const handleAddGameForTournament = (tournamentId: string) => {
    setEditingGame(null);
    setFormData({
      name: "",
      logo_url: "",
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
      tournament_id: game.tournament_id
    });
    setIsDialogOpen(true);
  };

  // Search enhancement functions
  // Game search handlers for AdvancedSearchField
  const handleGameSearchChange = (value: string) => {
    setGameSearchValue(value);
    setFormData(prev => ({ ...prev, name: value }));
  };

  const handleGameSearchSubmit = (value: string) => {
    // Optional: Could trigger additional actions on search submit
    console.log('Game search submitted:', value);
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
        // Try to get clear logo if no logo is provided
        let logoUrl = formData.logo_url || null;
        if (!logoUrl) {
          try {
            const clearLogos = await clearLogoService.getClearLogosForGames([formData.name]);
            logoUrl = clearLogos[formData.name] || null;
          } catch (error) {
            console.warn('Failed to fetch clear logo for', formData.name, error);
          }
        }

        const { error } = await supabase
          .from('games')
          .update({
            name: formData.name,
            logo_url: logoUrl
          })
          .eq('id', editingGame.id);

        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Game updated successfully"
        });
      } else {
        // Create new game
        // Try to get clear logo if no logo is provided
        let logoUrl = formData.logo_url || null;
        if (!logoUrl) {
          try {
            const clearLogos = await clearLogoService.getClearLogosForGames([formData.name]);
            logoUrl = clearLogos[formData.name] || null;
          } catch (error) {
            console.warn('Failed to fetch clear logo for', formData.name, error);
          }
        }

        const { error } = await supabase
          .from('games')
          .insert({
            name: formData.name,
            logo_url: logoUrl,
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
      await deleteScoreWithAchievementCleanup(deleteScoreDialog.scoreId);

      toast({
        title: "Success",
        description: "Score deleted successfully (including achievement cleanup)"
      });

      loadGames(); // Reload to refresh scores
      setDeleteScoreDialog({ open: false, scoreId: '' });
    } catch (error) {
      console.error('Error deleting score:', error);
      const msg = `Failed to delete score: ${String((error as any)?.message || error)}`;
      toast({
        title: "Error",
        description: msg,
        variant: "destructive",
        action: (
          <ToastAction altText="Copy error" onClick={() => navigator.clipboard.writeText(msg)}>Copy</ToastAction>
        )
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
      const msg = err?.message || 'Failed to update game';
      toast({ title: 'Error', description: msg, variant: 'destructive', action: (<ToastAction altText="Copy error" onClick={() => navigator.clipboard.writeText(msg)}>Copy</ToastAction>) });
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
      const msg = err?.message || 'Failed to update score';
      toast({ title: 'Error', description: msg, variant: 'destructive', action: (<ToastAction altText="Copy error" onClick={() => navigator.clipboard.writeText(msg)}>Copy</ToastAction>) });
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
      const msg = err?.message || 'Failed to add score';
      toast({ title: 'Error', description: msg, variant: 'destructive', action: (<ToastAction altText="Copy error" onClick={() => navigator.clipboard.writeText(msg)}>Copy</ToastAction>) });
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

  // Delete tournament with stats storage option
  const handleDeleteTournament = async (tournamentId: string, storeStats: boolean = false) => {
    if (!tournamentId) return;

    try {
      if (storeStats) {
        toast({
          title: "Info",
          description: "Stats storage functionality will be implemented in a future update"
        });
      }

      const success = await deleteTournament(tournamentId);

      if (success) {
        toast({
          title: "Success",
          description: storeStats ? "Tournament deleted and stats stored successfully" : "Tournament deleted successfully"
        });
      }
    } catch (error) {
      console.error('Error deleting tournament:', error);
      const msg = `Failed to delete tournament: ${String((error as any)?.message || error)}`;
      toast({ title: 'Error', description: msg, variant: 'destructive', action: (<ToastAction altText="Copy error" onClick={() => navigator.clipboard.writeText(msg)}>Copy</ToastAction>) });
    }
  };

  // Tournament stats modal state
  const [statsModal, setStatsModal] = useState<{
    isOpen: boolean;
    tournamentId: string;
    tournamentName: string;
  }>({ isOpen: false, tournamentId: '', tournamentName: '' });

  // Handle showing the stats storage prompt before deletion
  const handleTournamentDeletionFlow = (tournamentId: string, tournamentName: string) => {
    setStatsModal({ isOpen: true, tournamentId, tournamentName });
  };

  // Handle stats modal confirmation
  const handleStatsModalConfirm = (storeStats: boolean) => {
    setStatsModal({ isOpen: false, tournamentId: '', tournamentName: '' });
    handleDeleteTournament(statsModal.tournamentId, storeStats);
  };

  // Handle stats modal close
  const handleStatsModalClose = () => {
    setStatsModal({ isOpen: false, tournamentId: '', tournamentName: '' });
  };

  // Open edit tournament dialog
  const openEditTournamentDialog = (tournament: any) => {
    setEditingTournament(tournament);

    // Format dates for datetime-local input (YYYY-MM-DDTHH:MM format)
    const formatDateTimeForInput = (dateString: string | null) => {
      if (!dateString) return "";
      try {
        const date = new Date(dateString);
        return date.toISOString().slice(0, 16); // Keep YYYY-MM-DDTHH:MM
      } catch {
        return "";
      }
    };

    const formData = {
      name: tournament.name || "",
      slug: tournament.slug || "",
      is_public: tournament.is_public || false,
      start_time: formatDateTimeForInput(tournament.start_time),
      end_time: formatDateTimeForInput(tournament.end_time),
      is_active: tournament.is_active ?? true,
      scores_locked: tournament.scores_locked || false
    };
    setTournamentFormData(formData);
    setIsTournamentEditOpen(true);
  };

  // Handle tournament edit form submission
  const handleEditTournament = async () => {
    if (!editingTournament) return;

    try {
      // Convert datetime-local values to ISO strings
      const formatDateTimeForDatabase = (dateTimeLocal: string) => {
        if (!dateTimeLocal) return null;
        try {
          return new Date(dateTimeLocal).toISOString();
        } catch {
          return null;
        }
      };

      const success = await updateTournament(editingTournament.id, {
        name: tournamentFormData.name,
        slug: tournamentFormData.slug,
        is_public: tournamentFormData.is_public,
        start_time: formatDateTimeForDatabase(tournamentFormData.start_time),
        end_time: formatDateTimeForDatabase(tournamentFormData.end_time),
        is_active: tournamentFormData.is_active,
        scores_locked: tournamentFormData.scores_locked,
      });

      if (success) {
        toast({
          title: "Success",
          description: "Tournament updated successfully"
        });
        setIsTournamentEditOpen(false);
        setEditingTournament(null);
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


  if (!user || (!isAdmin && !hasPermission('admin'))) {
    return null; // Will redirect via useEffect
  }

  if (!currentTournament && !tournamentsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative z-10"
           style={{ background: 'radial-gradient(ellipse at center, rgba(26, 16, 37, 0.9) 0%, rgba(26, 16, 37, 0.7) 100%)' }}>
        <div className="text-center text-white">
          <div className="text-6xl mb-4">🏆</div>
          <h1 className="text-4xl font-bold mb-4">Tournament Required</h1>
          <p className="text-xl text-gray-300 mb-8">
            Select a tournament to access the admin panel.
          </p>
          <div className="mt-4">
            <p className="text-gray-300">Please select a tournament from the menu above.</p>
          </div>
        </div>
      </div>
    );
  }

  const pageLayout = getPageLayout();
  
  const shouldAnimate = showContent && !hasAnimated;

  const handleTabChange = (newTab: string) => {
    if (newTab !== activeTab) {
      setPreviousTab(activeTab);

      if (enableAnimations) {
        setTabTransitioning(true);
        // Switch active tab immediately so tab indicator changes during exit animation
        setActiveTab(newTab);
        // Wait for animations to complete
        setTimeout(() => {
          setTabTransitioning(false);
        }, 440); // Wait for full cycle: exit (200ms) + enter (200ms) + buffer (40ms)
      } else {
        // No animations - switch immediately
        setActiveTab(newTab);
      }
    }
  };

  const handleSystemSubTabChange = (newTab: string) => {
    if (newTab !== systemSubTab) {
      if (enableAnimations) {
        setSystemSubTabTransitioning(true);
        setSystemSubTab(newTab);
        setTimeout(() => {
          setSystemSubTabTransitioning(false);
        }, 440);
      } else {
        setSystemSubTab(newTab);
      }
    }
  };

  const handleCompetitionSubTabChange = (newTab: string) => {
    if (newTab !== competitionSubTab) {
      if (enableAnimations) {
        setCompetitionSubTabTransitioning(true);
        setCompetitionSubTab(newTab);
        setTimeout(() => {
          setCompetitionSubTabTransitioning(false);
        }, 440);
      } else {
        setCompetitionSubTab(newTab);
      }
    }
  };

  return (
    <div {...pageLayout} className={`${pageLayout.className || ''}`}>
      <PageContainer className="max-w-6xl mx-auto">
        <div className={`transition-all duration-300 ${
          isExiting
            ? 'animate-slide-out-bottom'
            : showContent
              ? (hasAnimated ? 'opacity-100 transform-none' : 'animate-slide-in-bottom')
              : 'opacity-0 translate-y-full'
        }`}>
          <PageHeader
            title="Admin Panel"
            subtitle={`Managing ${currentTournament?.name} tournament`}
          />

          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full min-h-[800px]">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="create-tournament">
              <Trophy className="w-4 h-4 mr-2" />Competitions
            </TabsTrigger>
            <TabsTrigger value="achievements">
              <BarChart3 className="w-4 h-4 mr-2" />Achievements
            </TabsTrigger>
            <TabsTrigger value="users">
              <Users className="w-4 h-4 mr-2" />Users
            </TabsTrigger>
            <TabsTrigger value="system">
              <Settings className="w-4 h-4 mr-2" />System
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create-tournament" className={`mt-6 ${enableAnimations ? (tabTransitioning ? 'animate-tab-out' : 'animate-tab-in') : ''}`}>
            <Tabs value={competitionSubTab} onValueChange={handleCompetitionSubTabChange} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="tournaments">
                  <Trophy className="w-3 h-3 mr-1" />Highscore Tournaments
                </TabsTrigger>
                <TabsTrigger value="brackets">
                  <Zap className="w-3 h-3 mr-1" />Bracket Tournaments
                </TabsTrigger>
              </TabsList>

              <TabsContent value="tournaments" className={`mt-6 ${enableAnimations ? (competitionSubTabTransitioning ? 'animate-tab-out' : 'animate-tab-in') : ''}`}>
                <div className="space-y-6">
                  <CompetitionManager />

                <Card className={getCardStyle('primary')}>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-4 w-full">
                      <CardTitle className={getTypographyStyle('h3')}>Manage Highscore Tournaments</CardTitle>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          onClick={() => setIsCreateTournamentOpen(true)}
                          variant="outline"
                          className="h-8"
                        >
                          <Plus className="w-4 h-4 mr-2" /> Create Highscore Tournament
                        </Button>
                        <Button
                          onClick={() => setIsSuggestGamesOpen(true)}
                          variant="outline"
                          className="h-8"
                        >
                          <Gamepad2 className="w-4 h-4 mr-2" /> Suggest Games
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-sm text-gray-300 mb-4">You have access to {userTournaments.length} highscore tournament{userTournaments.length !== 1 ? 's' : ''}.</div>
                  <Accordion type="single" defaultValue={currentTournament?.id} collapsible className="w-full">
                    {userTournaments.map((tournament) => (
                      <AccordionItem key={tournament.id} value={tournament.id} className="border-white/10">
                        <AccordionTrigger className="p-4 bg-black/30 rounded-t-lg border border-white/10 border-b-0 hover:bg-black/40 data-[state=open]:rounded-b-none">
                          <div className="flex items-center gap-2 flex-wrap w-full text-left">
                            <h4 className="font-semibold text-white">{tournament.name}</h4>
                            {tournament.id === currentTournament?.id && (<span className="px-2 py-1 text-xs bg-arcade-neonCyan text-black rounded">Current</span>)}
                            {tournament.is_public ? (<div title="Public Highscore Tournament"><Globe className="w-4 h-4 text-green-400" /></div>) : (<div title="Private Highscore Tournament"><Lock className="w-4 h-4 text-yellow-400" /></div>)}
                            <span className="text-sm text-gray-400">({games.filter(g => g.tournament_id === tournament.id).length} games)</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="p-0 max-h-[500px] overflow-y-auto">
                          <div className="p-4 bg-black/30 rounded-b-lg border border-white/10 border-t-0">
                            <div className="flex items-start justify-between gap-4 mb-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-400 mb-1 truncate">Slug: /t/{tournament.slug}</p>
                                <p className="text-xs text-gray-500">Created: {new Date(tournament.created_at).toLocaleDateString()}</p>
                              </div>
                          <div className="flex gap-3 items-center shrink-0">
                            <Dialog open={cloneDialogOpen === tournament.id} onOpenChange={(open) => setCloneDialogOpen(open ? tournament.id : null)}>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="outline" title="Clone"><Copy className="w-4 h-4" /></Button>
                              </DialogTrigger>
                              <DialogContent className="bg-gray-900 text-white border-white/20 max-h-[90vh] overflow-y-auto">
                                <DialogHeader><DialogTitle>Clone Highscore Tournament</DialogTitle></DialogHeader>
                                <div className="space-y-4">
                                  <div><Label className="text-white">Source Tournament</Label><Input value={tournament.name} disabled className="bg-black/50 border-white/20 text-white" /></div>
                                  <div><Label className="text-white">New Name</Label><Input id={`clone-name-${tournament.id}`} placeholder={`${tournament.name} (Copy)`} className="bg-black/50 border-white/20 text-white" /></div>
                                  <div><Label className="text-white">New Slug</Label><Input id={`clone-slug-${tournament.id}`} defaultValue={`${tournament.slug}-copy-${generateRandomString(4)}`} className="bg-black/50 border-white/20 text-white" /></div>
                                  <div className="flex items-center space-x-2"><Switch id={`clone-public-${tournament.id}`} defaultChecked={tournament.is_public} /><Label htmlFor={`clone-public-${tournament.id}`}>Make Public</Label></div>
                                  <div className="flex justify-end space-x-2 pt-4">
                                    <Button variant="outline" onClick={() => setCloneDialogOpen(null)}>Cancel</Button>
                                    <Button onClick={async () => { const nameEl = document.getElementById(`clone-name-${tournament.id}`) as HTMLInputElement; const slugEl = document.getElementById(`clone-slug-${tournament.id}`) as HTMLInputElement; const pubEl = document.getElementById(`clone-public-${tournament.id}`) as HTMLInputElement; const name = nameEl?.value?.trim() || `${tournament.name} (Copy)`; const slug = slugEl?.value?.trim() || `${tournament.slug}-${generateRandomString(4)}`; const isPublic = !!pubEl?.checked; const created = await cloneTournament(tournament.id, { name, slug, is_public: isPublic }); if (created) { await refreshTournaments(); setCloneDialogOpen(null); toast({ title: 'Success', description: `Cloned "${tournament.name}" as "${name}"` }); } }}>Clone Highscore Tournament</Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                            <Button size="sm" variant="outline" onClick={() => openEditTournamentDialog(tournament)}><Pencil className="w-4 h-4" /></Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="outline" className="border-red-500 hover:border-red-400 hover:bg-red-500/10" disabled={tournament.id === currentTournament?.id}><Trash2 className="w-4 h-4" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-gray-900 text-white border-white/20">
                                <AlertDialogHeader><AlertDialogTitle>Delete Highscore Tournament</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete "{tournament.name}"? This action cannot be undone and will remove all games, scores, and members.</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleTournamentDeletionFlow(tournament.id, tournament.name)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction></AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                        {/* Full-width games block below header row */}
                        <div className="mt-3 pt-3 border-t border-white/10">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="text-sm font-semibold text-white">Games ({games.filter(g => g.tournament_id === tournament.id).length})</h5>
                            <div className="flex items-center gap-2">
                              <AdvancedSearchField
                                value={tournamentFilters[tournament.id] || ''}
                                onChange={(value) => setTournamentFilters(prev => ({ ...prev, [tournament.id]: value }))}
                                placeholder="Search games..."
                                enableSuggestions={false}
                                enableRealTimeSearch={true}
                                className="h-7 w-40 bg-black/50 border-white/20 text-white text-xs"
                              />
                              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => handleAddGameForTournament(tournament.id)}><Plus className="w-3 h-3 mr-1" /> Add Game</Button>
                            </div>
                          </div>
                          {/* Bulk actions removed */}

                          <div className="overflow-x-auto max-h-96 overflow-y-auto">
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
                                                        <Button size="sm" variant="ghost" className="h-7 px-2 border border-red-500 hover:border-red-400 hover:bg-red-500/10" onClick={() => handleDeleteScore(s.id)}>Delete</Button>
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
                                              <Button size="sm" variant="ghost" className="h-6 px-2 hover:bg-red-600/20 border border-red-500 hover:border-red-400" title="Delete game" onClick={() => handleDeleteGame(game.id)}><Trash2 className="w-3 h-3" /></Button>
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
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              </CardContent>
            </Card>
                </div>
              </TabsContent>

              <TabsContent value="brackets" className={`mt-6 ${enableAnimations ? (competitionSubTabTransitioning ? 'animate-tab-out' : 'animate-tab-in') : ''}`}>
                <Card className={getCardStyle('primary')}>
                  <CardHeader>
                    <CardTitle className={getTypographyStyle('h3')}>Bracket Tournaments</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <BracketManagement />
                  </CardContent>
                </Card>
              </TabsContent>

            </Tabs>

            {/* Shared Dialogs */}
            <CreateTournamentForm
              isOpen={isCreateTournamentOpen}
              onClose={() => setIsCreateTournamentOpen(false)}
            />

            <SuggestGames
              isOpen={isSuggestGamesOpen}
              onClose={() => setIsSuggestGamesOpen(false)}
              loadGames={loadGames}
            />
          </TabsContent>

          <TabsContent value="system" className={`mt-6 ${enableAnimations ? (tabTransitioning ? 'animate-tab-out' : 'animate-tab-in') : ''}`}>
            <Tabs value={systemSubTab} onValueChange={handleSystemSubTabChange} className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="performance">
                  <Zap className="w-3 h-3 mr-1" />Performance
                </TabsTrigger>
                <TabsTrigger value="reset">
                  <RotateCcw className="w-3 h-3 mr-1" />Reset Functions
                </TabsTrigger>
                <TabsTrigger value="webhooks">
                  <Webhook className="w-3 h-3 mr-1" />Webhooks
                </TabsTrigger>
                <TabsTrigger value="tests">
                  <TestTube className="w-3 h-3 mr-1" />Tests
                </TabsTrigger>
              </TabsList>

              <TabsContent value="performance" className={`mt-6 ${enableAnimations ? (systemSubTabTransitioning ? 'animate-tab-out' : 'animate-tab-in') : ''}`}>
                <div className="space-y-6">
                  <Card className={getCardStyle('primary')}>
                    <CardHeader><CardTitle className={getTypographyStyle('h3')}>Performance Settings</CardTitle></CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Performance Mode Toggle</p>
                          <p className="text-xs text-muted-foreground">
                            Quick toggle for performance mode in the navigation
                          </p>
                        </div>
                        <PerformanceModeToggle displayType="switch" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className={getCardStyle('primary')}>
                    <CardHeader>
                      <CardTitle className={getTypographyStyle('h3')}>
                        <Maximize className="w-4 h-4 mr-2 inline-block" />
                        Fullscreen Preference
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Auto-enable fullscreen</p>
                          <p className="text-xs text-muted-foreground">
                            Automatically enter fullscreen mode when you visit the application
                          </p>
                        </div>
                        <Switch
                          checked={fullscreenEnabled}
                          onCheckedChange={toggleFullscreenPreference}
                          disabled={fullscreenLoading}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className={getCardStyle('primary')}>
                    <CardHeader>
                      <CardTitle className={getTypographyStyle('h3')}>
                        <Palette className="w-4 h-4 mr-2 inline-block" />
                        Theme Settings
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Application Theme</p>
                          <p className="text-xs text-muted-foreground">
                            Choose your preferred visual theme for the application
                          </p>
                        </div>
                        <ThemeSelector />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>


              <TabsContent value="reset" className={`mt-6 ${enableAnimations ? (systemSubTabTransitioning ? 'animate-tab-out' : 'animate-tab-in') : ''}`}>
                <ResetFunctions />
              </TabsContent>

              <TabsContent value="webhooks" className={`mt-6 ${enableAnimations ? (systemSubTabTransitioning ? 'animate-tab-out' : 'animate-tab-in') : ''}`}>
                <WebhookConfig />
              </TabsContent>

              <TabsContent value="tests" className={`mt-6 ${enableAnimations ? (systemSubTabTransitioning ? 'animate-tab-out' : 'animate-tab-in') : ''}`}>
                <div className="space-y-6">
                  <FunctionTests />

                  <Card className={getCardStyle('primary')}>
                    <CardHeader>
                      <CardTitle className={`${getTypographyStyle('h3')} flex items-center gap-2`}>
                        <TestTube className="w-5 h-5 text-blue-400" />
                        Rating System Test
                      </CardTitle>
                      <p className="text-muted-foreground">Test the new multi-source rating aggregation system</p>
                    </CardHeader>
                    <CardContent>
                      <RatingTest />
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </TabsContent>
          <TabsContent value="achievements" className={`mt-6 ${enableAnimations ? (tabTransitioning ? 'animate-tab-out' : 'animate-tab-in') : ''}`}><AchievementManagerV2 /></TabsContent>
          <TabsContent value="users" className={`mt-6 ${enableAnimations ? (tabTransitioning ? 'animate-tab-out' : 'animate-tab-in') : ''}`}><UserManagement /></TabsContent>

        </Tabs>
        </div>

        {/* Shared Add/Edit Game Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="bg-gray-900 text-white border-white/20 max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto mx-auto">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold break-words">
                {editingGame ? 'Edit Game' : 'Add New Game'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 px-1">
              <div className="w-full">
                <AdvancedSearchField
                  value={gameSearchValue}
                  onChange={handleGameSearchChange}
                  onSubmit={handleGameSearchSubmit}
                  label="Game Name *"
                  placeholder="Enter game name (logos search automatically as you type)"
                  className="[&_input]:bg-black/50 [&_input]:border-white/20 [&_input]:text-white"
                  enableSuggestions={true}
                  enableRealTimeSearch={true}
                  searchHint="💡 Tip: Try 'Street Fighter', 'Pac-Man', 'Metal Slug', or use abbreviations like 'SF'"
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
                  selectedImageUrl={formData.logo_url}
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
              <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-2 pt-4">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="w-full sm:w-auto">Cancel</Button>
                <Button onClick={saveGame} variant="outline" className="w-full sm:w-auto" disabled={!formData.name.trim() || !formData.tournament_id}>
                  {editingGame ? 'Update' : 'Create'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Tournament Dialog */}
        <Dialog open={isTournamentEditOpen} onOpenChange={setIsTournamentEditOpen}>
          <DialogContent className="bg-gray-900 text-white border-white/20 max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Tournament</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-white">Tournament Name</Label>
                <Input
                  value={tournamentFormData.name}
                  onChange={(e) => setTournamentFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="bg-black/50 border-white/20 text-white"
                  placeholder="Enter tournament name"
                />
              </div>
              <div>
                <Label className="text-white">Slug</Label>
                <Input
                  value={tournamentFormData.slug}
                  onChange={(e) => setTournamentFormData(prev => ({ ...prev, slug: e.target.value }))}
                  className="bg-black/50 border-white/20 text-white"
                  placeholder="tournament-slug"
                />
              </div>
              <div className="space-y-4">
                <div className="max-w-sm">
                  <Label className="text-white">Start Date & Time</Label>
                  <DatePicker
                    selected={tournamentFormData.start_time ? new Date(tournamentFormData.start_time) : null}
                    onChange={(date) => setTournamentFormData(prev => ({
                      ...prev,
                      start_time: date ? date.toISOString().slice(0, 16) : ''
                    }))}
                    showTimeSelect
                    dateFormat="yyyy-MM-dd h:mm aa"
                    className="w-full px-3 py-2 bg-black/50 border border-white/20 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    wrapperClassName="w-full"
                    placeholderText="Select start date and time"
                    renderCustomHeader={({
                      date,
                      decreaseMonth,
                      increaseMonth,
                      prevMonthButtonDisabled,
                      nextMonthButtonDisabled,
                    }) => (
                      <div className="flex items-center justify-between px-2 py-2">
                        <button
                          onClick={decreaseMonth}
                          disabled={prevMonthButtonDisabled}
                          type="button"
                          className="p-1 text-white hover:bg-white/10 rounded disabled:opacity-50"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-white font-semibold">
                          {date.toLocaleDateString("en-US", {
                            month: "long",
                            year: "numeric",
                          })}
                        </span>
                        <button
                          onClick={increaseMonth}
                          disabled={nextMonthButtonDisabled}
                          type="button"
                          className="p-1 text-white hover:bg-white/10 rounded disabled:opacity-50"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  />
                </div>
                <div className="max-w-sm">
                  <Label className="text-white">End Date & Time</Label>
                  <DatePicker
                    selected={tournamentFormData.end_time ? new Date(tournamentFormData.end_time) : null}
                    onChange={(date) => setTournamentFormData(prev => ({
                      ...prev,
                      end_time: date ? date.toISOString().slice(0, 16) : ''
                    }))}
                    showTimeSelect
                    dateFormat="yyyy-MM-dd h:mm aa"
                    className="w-full px-3 py-2 bg-black/50 border border-white/20 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    wrapperClassName="w-full"
                    placeholderText="Select end date and time"
                    renderCustomHeader={({
                      date,
                      decreaseMonth,
                      increaseMonth,
                      prevMonthButtonDisabled,
                      nextMonthButtonDisabled,
                    }) => (
                      <div className="flex items-center justify-between px-2 py-2">
                        <button
                          onClick={decreaseMonth}
                          disabled={prevMonthButtonDisabled}
                          type="button"
                          className="p-1 text-white hover:bg-white/10 rounded disabled:opacity-50"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-white font-semibold">
                          {date.toLocaleDateString("en-US", {
                            month: "long",
                            year: "numeric",
                          })}
                        </span>
                        <button
                          onClick={increaseMonth}
                          disabled={nextMonthButtonDisabled}
                          type="button"
                          className="p-1 text-white hover:bg-white/10 rounded disabled:opacity-50"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  />
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="edit-tournament-public" className="text-white">Make Public</Label>
                  <Switch
                    id="edit-tournament-public"
                    checked={tournamentFormData.is_public}
                    onCheckedChange={(checked) => setTournamentFormData(prev => ({ ...prev, is_public: checked }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="edit-tournament-active" className="text-white">Tournament Active</Label>
                  <Switch
                    id="edit-tournament-active"
                    checked={tournamentFormData.is_active}
                    onCheckedChange={(checked) => setTournamentFormData(prev => ({ ...prev, is_active: checked }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="edit-tournament-scores-locked" className="text-white">Lock Score Submissions</Label>
                    <p className="text-xs text-gray-400 mt-1">Prevent new score submissions when locked</p>
                  </div>
                  <Switch
                    id="edit-tournament-scores-locked"
                    checked={tournamentFormData.scores_locked}
                    onCheckedChange={(checked) => setTournamentFormData(prev => ({ ...prev, scores_locked: checked }))}
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setIsTournamentEditOpen(false)}>Cancel</Button>
                <Button onClick={handleEditTournament} disabled={!tournamentFormData.name.trim() || !tournamentFormData.slug.trim()}>
                  Update Tournament
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
          variant="outline"
          onConfirm={confirmDeleteGame}
        />

        <ConfirmationDialog
          open={deleteScoreDialog.open}
          onOpenChange={(open) => setDeleteScoreDialog(prev => ({ ...prev, open }))}
          title="Delete Score"
          description="Are you sure you want to delete this score? This action cannot be undone."
          confirmText="Delete Score"
          cancelText="Cancel"
          variant="outline"
          onConfirm={confirmDeleteScore}
        />

        <TournamentStatsModal
          isOpen={statsModal.isOpen}
          onClose={handleStatsModalClose}
          onConfirm={handleStatsModalConfirm}
          tournamentName={statsModal.tournamentName}
        />
      </PageContainer>
    </div>
  );
};

export default Admin;