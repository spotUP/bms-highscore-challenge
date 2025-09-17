import { useState, useEffect, useRef } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Trash2, Plus, ArrowLeft, Gamepad2, BarChart3, Settings, Users, TestTube, Webhook, Lock, Globe, Trophy, Copy, Zap, RotateCcw } from "lucide-react";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { isPlaceholderLogo, formatScore } from "@/lib/utils";
import ImagePasteUpload from "@/components/ImagePasteUpload";
import GameLogoSuggestions, { GameLogoSuggestionsRef } from "@/components/GameLogoSuggestions";
import WebhookConfig from "@/components/WebhookConfig";
import UserManagement from "@/components/UserManagement";
import ResetFunctions from "@/components/ResetFunctions";
import DemolitionManQRSubmit from "@/components/DemolitionManQRSubmit";
import DemolitionManEnsure from "@/components/DemolitionManEnsure";
import DemolitionManScoreManager from "@/components/DemolitionManScoreManager";
import PerformanceToggle from "@/components/PerformanceToggle";
import CompetitionManager from "@/components/CompetitionManager";
import AchievementManagerV2 from "@/components/AchievementManagerV2";
import BracketManagement from "@/components/BracketManagement";
import FunctionTests from "@/components/FunctionTests";
import { getPageLayout, getCardStyle, getButtonStyle, getTypographyStyle, PageHeader, PageContainer } from "@/utils/designSystem";
import { useUserRoles } from "@/hooks/useUserRoles";
import { useTournament } from "@/contexts/TournamentContext";
import { usePerformanceMode } from "@/hooks/usePerformanceMode";

interface AdminProps {
  isExiting?: boolean;
}

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

const CreateTournamentForm = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
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
        description: "Highscore tournament name and slug are required",
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
      setSlugAvailable(null);
      toast({
        title: "Success",
        description: "Highscore tournament created successfully!",
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
        <div className="space-y-4">
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
          <Label htmlFor="description" className="text-white">Description (Optional)</Label>
          <Textarea
            id="description"
            value={createForm.description}
            onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
            placeholder="A brief description of your highscore tournament"
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

        <div className="flex items-center space-x-2">
          <Switch
            id="create-demolition-man"
            checked={createForm.demolition_man_active}
            onCheckedChange={(checked) => setCreateForm(prev => ({ ...prev, demolition_man_active: checked }))}
          />
          <Label htmlFor="create-demolition-man" className="text-white">
            Enable Standing Competition Leaderboard
          </Label>
        </div>

        <Button
          onClick={handleCreateTournament}
          disabled={!createForm.name.trim() || !createForm.slug.trim() || isCreating || slugAvailable === false}
          className="w-full"
        >
          {isCreating ? 'Creating...' : 'Create Tournament'}
        </Button>
      </div>
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
        logo_url: selectedLogos[index] || '',
        tournament_id: currentTournament.id,
        include_in_challenge: true
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
      console.log(`🎮 Starting game suggestion fetch (${misterCompatibleOnly ? 'MiSTer FPGA' : 'Full MAME'})...`);

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
      console.log(`✅ Fetched CSV successfully (${Math.round(csvText.length / 1024)}KB)`);

      if (!csvText || csvText.length < 100) {
        throw new Error('CSV appears to be empty or corrupted');
      }

      // Parse with ultra-safe approach
      const lines = csvText.split(/\r?\n/).filter(line => line && line.trim().length > 0);

      if (lines.length < 2) {
        throw new Error('CSV has insufficient data');
      }

      console.log(`📊 Processing ${lines.length} lines...`);

      // Get headers more safely
      const headerLine = lines[0];
      const headers = headerLine.split(',').map(h => h.replace(/^["']|["']$/g, '').trim());

      if (headers.length < 3) {
        throw new Error('CSV headers appear malformed');
      }

      console.log(`🏷️ Found headers: ${headers.slice(0, 5).join(', ')}...`);

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
          console.log(`⏳ Processed ${processed} rows, found ${allGames.length} games...`);
        }
      }

      console.log(`🎯 Parsing complete: ${allGames.length} games found, ${skipped} rows skipped`);

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

        console.log(`🔍 Filter ${key}="${value}": ${beforeCount} → ${filteredGames.length} games`);
      }

      if (filteredGames.length === 0) {
        console.log('⚠️ No games match filters, using fallback data');
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

      console.log(`🎲 Selected ${selectedGames.length} random games:`, selectedGames.map(g => g.name));

      console.log(`🎯 Parsing complete: ${allGames.length} games found, ${skipped} rows skipped`);

      if (allGames.length === 0) {
        throw new Error('No valid games found in CSV data');
      }

      setAllAvailableGames(allGames);
      setGamesLoaded(true);

    } catch (error) {
      console.warn('⚠️ CSV fetch failed, using fallback games:', error);
      setAllAvailableGames(misterCompatibleOnly ? misterFallbackGames : mameFallbackGames);
      setGamesLoaded(true);
    } finally {
      setLoading(false);
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

    console.log(`🎲 Filtered from ${allAvailableGames.length} to ${filteredGames.length}, selected:`, selectedGames.map(g => g.name));

    setGames(selectedGames);
    setSelectedLogos({}); // Clear selected logos when games change
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

                        {/* Logo suggestions for this game */}
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
  const navigate = useNavigate();
  const { toast } = useToast();
  const [games, setGames] = useState<Game[]>([]);
  const [gameScores, setGameScores] = useState<Record<string, any[]>>({});
  const [gamesLoading, setGamesLoading] = useState(true);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [editingScore, setEditingScore] = useState<any | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isScoreDialogOpen, setIsScoreDialogOpen] = useState(false);
  const [isCreateTournamentOpen, setIsCreateTournamentOpen] = useState(false);
  const [isSuggestGamesOpen, setIsSuggestGamesOpen] = useState(false);
  const [scoreFormData, setScoreFormData] = useState({
    player_name: "",
    score: ""
  });
  const [newScoreGameId, setNewScoreGameId] = useState<string | null>(null);
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

  // Set hasAnimated to true when the page should animate for the first time
  useEffect(() => {
    if (!hasAnimated && !loading && !tournamentsLoading && !gamesLoading) {
      setHasAnimated(true);
    }
  }, [hasAnimated, loading, tournamentsLoading, gamesLoading]);

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
      const msg = `Failed to update challenge inclusion: ${String((error as any)?.message || error)}`;
      toast({ title: 'Error', description: msg, variant: 'destructive', action: (<ToastAction altText="Copy error" onClick={() => navigator.clipboard.writeText(msg)}>Copy</ToastAction>) });
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
      const msg = `Failed to make game active: ${String((error as any)?.message || error)}`;
      toast({ title: 'Error', description: msg, variant: 'destructive', action: (<ToastAction altText="Copy error" onClick={() => navigator.clipboard.writeText(msg)}>Copy</ToastAction>) });
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
      const msg = `Failed to make game inactive: ${String((error as any)?.message || error)}`;
      toast({ title: 'Error', description: msg, variant: 'destructive', action: (<ToastAction altText="Copy error" onClick={() => navigator.clipboard.writeText(msg)}>Copy</ToastAction>) });
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
      const msg = `Failed to delete tournament: ${String((error as any)?.message || error)}`;
      toast({ title: 'Error', description: msg, variant: 'destructive', action: (<ToastAction altText="Copy error" onClick={() => navigator.clipboard.writeText(msg)}>Copy</ToastAction>) });
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
  
  const shouldAnimate = enableAnimations && !hasAnimated && !loading && !tournamentsLoading && !gamesLoading;

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
        <div className={`${isExiting ? 'animate-slide-out-bottom' : hasAnimated ? 'opacity-100' : shouldAnimate ? 'animate-slide-in-bottom' : 'opacity-0'}`}>
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

          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-gray-900 border border-white/20">
            <TabsTrigger value="create-tournament" className="data-[state=active]:bg-arcade-neonCyan data-[state=active]:text-black"><Trophy className="w-4 h-4 mr-2" />Competitions</TabsTrigger>
            <TabsTrigger value="achievements" className="data-[state=active]:bg-arcade-neonCyan data-[state=active]:text-black"><Trophy className="w-4 h-4 mr-2" />Achievements</TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-arcade-neonCyan data-[state=active]:text-black"><Users className="w-4 h-4 mr-2" />Users</TabsTrigger>
            <TabsTrigger value="system" className="data-[state=active]:bg-arcade-neonCyan data-[state=active]:text-black"><TestTube className="w-4 h-4 mr-2" />System</TabsTrigger>
          </TabsList>

          <TabsContent value="create-tournament" className={`mt-6 ${enableAnimations ? (tabTransitioning ? 'animate-tab-out' : 'animate-tab-in') : ''}`}>
            <Tabs value={competitionSubTab} onValueChange={handleCompetitionSubTabChange} className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-gray-700 border border-white/10 rounded-md">
                <TabsTrigger value="tournaments" className="data-[state=active]:bg-gray-600 data-[state=active]:text-white text-gray-300 text-sm">
                  <Trophy className="w-3 h-3 mr-1" />Highscore Tournaments
                </TabsTrigger>
                <TabsTrigger value="brackets" className="data-[state=active]:bg-gray-600 data-[state=active]:text-white text-gray-300 text-sm">
                  <Zap className="w-3 h-3 mr-1" />Bracket Tournaments
                </TabsTrigger>
                <TabsTrigger value="standing" className="data-[state=active]:bg-gray-600 data-[state=active]:text-white text-gray-300 text-sm">
                  <BarChart3 className="w-3 h-3 mr-1" />Standing Competition
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
                  <div className="grid gap-4">
                    {userTournaments.map((tournament) => (
                      <div key={tournament.id} className="p-4 bg-black/30 rounded-lg border border-white/10">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h4 className="font-semibold text-white">{tournament.name}</h4>
                              {tournament.id === currentTournament?.id && (<span className="px-2 py-1 text-xs bg-arcade-neonCyan text-black rounded">Current</span>)}
                              {tournament.is_public ? (<div title="Public Highscore Tournament"><Globe className="w-4 h-4 text-green-400" /></div>) : (<div title="Private Highscore Tournament"><Lock className="w-4 h-4 text-yellow-400" /></div>)}
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
                                  toast({ title: 'Highscore Tournament Switched', description: `Now managing "${tournament.name}"` });
                                }}
                                title={tournament.id === currentTournament?.id ? 'Current active highscore tournament' : 'Activate this highscore tournament'}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Label htmlFor={`t-scores-locked-${tournament.id}`} className="text-xs text-gray-300">Lock Scores</Label>
                              <Switch
                                id={`t-scores-locked-${tournament.id}`}
                                checked={tournament.scores_locked || false}
                                onCheckedChange={async (checked) => {
                                  try {
                                    console.log('Attempting to update scores_locked for tournament:', tournament.id, 'to:', checked);
                                    
                                    // First, try to add the column if it doesn't exist
                                    const { error: columnError } = await supabase.rpc('exec_sql', {
                                      sql: 'ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS scores_locked BOOLEAN NOT NULL DEFAULT false;'
                                    });
                                    
                                    if (columnError && !columnError.message.includes('already exists')) {
                                      console.warn('Could not add scores_locked column:', columnError);
                                    }
                                    
                                    const { data, error } = await supabase
                                      .from('tournaments')
                                      .update({ scores_locked: checked })
                                      .eq('id', tournament.id)
                                      .select();
                                    
                                    if (error) {
                                      console.error('Database error:', error);
                                      
                                      // If column doesn't exist, show a helpful message
                                      if (error.message?.includes('column "scores_locked" of relation "tournaments" does not exist')) {
                                        throw new Error('Database migration required. Please run the migration to add score locking functionality.');
                                      }
                                      
                                      throw error;
                                    }
                                    
                                    console.log('Update successful:', data);
                                    await refreshTournaments();
                                    toast({ 
                                      title: checked ? 'Scores Locked' : 'Scores Unlocked', 
                                      description: `Score submissions are now ${checked ? 'locked' : 'unlocked'} for "${tournament.name}"` 
                                    });
                                  } catch (error: any) {
                                    console.error('Error updating score lock:', error);
                                    const errorMessage = error?.message || error?.details || 'Unknown error occurred';
                                    toast({ 
                                      title: 'Error', 
                                      description: `Failed to update score lock setting: ${errorMessage}`,
                                      variant: 'destructive'
                                    });
                                  }
                                }}
                                title={tournament.scores_locked ? 'Score submissions are locked' : 'Score submissions are unlocked'}
                              />
                            </div>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="outline" title="Clone"><Copy className="w-4 h-4" /></Button>
                              </DialogTrigger>
                              <DialogContent className="bg-gray-900 text-white border-white/20">
                                <DialogHeader><DialogTitle>Clone Highscore Tournament</DialogTitle></DialogHeader>
                                <div className="space-y-4">
                                  <div><Label className="text-white">Source Tournament</Label><Input value={tournament.name} disabled className="bg-black/50 border-white/20 text-white" /></div>
                                  <div><Label className="text-white">New Name</Label><Input id={`clone-name-${tournament.id}`} placeholder={`${tournament.name} (Copy)`} className="bg-black/50 border-white/20 text-white" /></div>
                                  <div><Label className="text-white">New Slug</Label><Input id={`clone-slug-${tournament.id}`} defaultValue={`${tournament.slug}-copy-${generateRandomString(4)}`} className="bg-black/50 border-white/20 text-white" /></div>
                                  <div className="flex items-center space-x-2"><Switch id={`clone-public-${tournament.id}`} defaultChecked={tournament.is_public} /><Label htmlFor={`clone-public-${tournament.id}`}>Make Public</Label></div>
                                  <div className="flex justify-end space-x-2 pt-4">
                                    <Button variant="outline" onClick={() => {}}>Cancel</Button>
                                    <Button onClick={async () => { const nameEl = document.getElementById(`clone-name-${tournament.id}`) as HTMLInputElement; const slugEl = document.getElementById(`clone-slug-${tournament.id}`) as HTMLInputElement; const pubEl = document.getElementById(`clone-public-${tournament.id}`) as HTMLInputElement; const name = nameEl?.value?.trim() || `${tournament.name} (Copy)`; const slug = slugEl?.value?.trim() || `${tournament.slug}-${generateRandomString(4)}`; const isPublic = !!pubEl?.checked; const created = await cloneTournament(tournament.id, { name, slug, is_public: isPublic }); if (created) { await refreshTournaments(); toast({ title: 'Success', description: `Cloned "${tournament.name}" as "${name}"` }); } }}>Clone Highscore Tournament</Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                            <Button size="sm" variant="outline" onClick={() => { toast({ title: 'Edit Highscore Tournament', description: `Edit functionality for "${tournament.name}" would go here` }); }}><Pencil className="w-4 h-4" /></Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="outline" className="border-red-500 hover:border-red-400 hover:bg-red-500/10" disabled={tournament.id === currentTournament?.id}><Trash2 className="w-4 h-4" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-gray-900 text-white border-white/20">
                                <AlertDialogHeader><AlertDialogTitle>Delete Highscore Tournament</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete "{tournament.name}"? This action cannot be undone and will remove all games, scores, and members.</AlertDialogDescription></AlertDialogHeader>
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
                    ))}
                  </div>
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

              <TabsContent value="standing" className={`mt-6 ${enableAnimations ? (competitionSubTabTransitioning ? 'animate-tab-out' : 'animate-tab-in') : ''}`}>
                <Card className={getCardStyle('primary')}>
                  <CardHeader>
                    <CardTitle className={getTypographyStyle('h3')}>Standing Competition</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <DemolitionManScoreManager />
                    <DemolitionManQRSubmit />
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
              <TabsList className="grid w-full grid-cols-5 bg-gray-700 border border-white/10 rounded-md">
                <TabsTrigger value="performance" className="data-[state=active]:bg-gray-600 data-[state=active]:text-white text-gray-300 text-sm">
                  <Zap className="w-3 h-3 mr-1" />Performance
                </TabsTrigger>
                <TabsTrigger value="demolition" className="data-[state=active]:bg-gray-600 data-[state=active]:text-white text-gray-300 text-sm">
                  <BarChart3 className="w-3 h-3 mr-1" />Standing Competition
                </TabsTrigger>
                <TabsTrigger value="reset" className="data-[state=active]:bg-gray-600 data-[state=active]:text-white text-gray-300 text-sm">
                  <RotateCcw className="w-3 h-3 mr-1" />Reset Functions
                </TabsTrigger>
                <TabsTrigger value="webhooks" className="data-[state=active]:bg-gray-600 data-[state=active]:text-white text-gray-300 text-sm">
                  <Webhook className="w-3 h-3 mr-1" />Webhooks
                </TabsTrigger>
                <TabsTrigger value="tests" className="data-[state=active]:bg-gray-600 data-[state=active]:text-white text-gray-300 text-sm">
                  <TestTube className="w-3 h-3 mr-1" />Tests
                </TabsTrigger>
              </TabsList>

              <TabsContent value="performance" className={`mt-6 ${enableAnimations ? (systemSubTabTransitioning ? 'animate-tab-out' : 'animate-tab-in') : ''}`}>
                <Card className={getCardStyle('primary')}>
                  <CardHeader><CardTitle className={getTypographyStyle('h3')}>Performance Settings</CardTitle></CardHeader>
                  <CardContent><PerformanceToggle /></CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="demolition" className={`mt-6 ${enableAnimations ? (systemSubTabTransitioning ? 'animate-tab-out' : 'animate-tab-in') : ''}`}>
                <DemolitionManEnsure />
              </TabsContent>

              <TabsContent value="reset" className={`mt-6 ${enableAnimations ? (systemSubTabTransitioning ? 'animate-tab-out' : 'animate-tab-in') : ''}`}>
                <ResetFunctions />
              </TabsContent>

              <TabsContent value="webhooks" className={`mt-6 ${enableAnimations ? (systemSubTabTransitioning ? 'animate-tab-out' : 'animate-tab-in') : ''}`}>
                <WebhookConfig />
              </TabsContent>

              <TabsContent value="tests" className={`mt-6 ${enableAnimations ? (systemSubTabTransitioning ? 'animate-tab-out' : 'animate-tab-in') : ''}`}>
                <FunctionTests />
              </TabsContent>
            </Tabs>
          </TabsContent>
          <TabsContent value="achievements" className={`mt-6 ${enableAnimations ? (tabTransitioning ? 'animate-tab-out' : 'animate-tab-in') : ''}`}><AchievementManagerV2 /></TabsContent>
          <TabsContent value="users" className={`mt-6 ${enableAnimations ? (tabTransitioning ? 'animate-tab-out' : 'animate-tab-in') : ''}`}><UserManagement /></TabsContent>
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
                  placeholder="Enter game name (logos search automatically as you type)"
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
        </div>
      </PageContainer>
    </div>
  );
};

export default Admin;