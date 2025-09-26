import React, { useState, useRef } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { ChevronLeft, ChevronRight, Calendar, Plus, Trash2, Lock, Globe, Play, Pause, Shield, CheckSquare, Square, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useTournament } from "@/contexts/TournamentContext";
import { clearLogoService } from "@/services/clearLogoService";
import { AdvancedSearchField } from "@/components/ui/advanced-search-field";

interface CreateTournamentModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialGames?: Array<{
    id?: number;
    name: string;
    logo_url?: string;
    platforms?: Array<{ platform: { id: number; name: string; slug: string } }>;
  }>;
}

export const CreateTournamentModal: React.FC<CreateTournamentModalProps> = ({
  isOpen,
  onClose,
  initialGames = []
}) => {
  const { createTournament } = useTournament();
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState(() => {
    const now = new Date();
    const oneMonthLater = new Date(now);
    oneMonthLater.setMonth(now.getMonth() + 1);

    return {
      name: '',
      slug: '',
      is_public: false,
      start_time: now.toISOString().slice(0, 16), // Format for datetime-local
      end_time: oneMonthLater.toISOString().slice(0, 16), // Format for datetime-local
      status: 'draft' as const,
      is_active: true,
      is_locked: false,
      scores_locked: false,
    };
  });
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [games, setGames] = useState(initialGames);
  const [selectedGames, setSelectedGames] = useState<Set<string>>(new Set());
  const [newGame, setNewGame] = useState({
    name: '',
    logo_url: ''
  });

  // Search state for manual game addition (handled by AdvancedSearchField)
  const [gameSearchValue, setGameSearchValue] = useState('');
  const [clearLogoFound, setClearLogoFound] = useState(false);
  const [clearLogoResults, setClearLogoResults] = useState<Array<{name: string, url: string}>>([]);
  const [searchingLogos, setSearchingLogos] = useState(false);

  // Update games when initialGames prop changes and auto-search clear logos
  React.useEffect(() => {
    const processGames = async () => {
      try {
        // Get clear logos for all games at once
        const gameNames = initialGames.map(game => game.name);
        const clearLogos = await clearLogoService.getClearLogosForGames(gameNames);

        // Map games with clear logos
        const processedGames = initialGames.map((game) => {
          const clearLogo = clearLogos[game.name];
          if (clearLogo) {
            console.log('Found clear logo for game', game.name, ':', clearLogo);
            return { ...game, logo_url: clearLogo };
          }

          console.log('No clear logo found for game:', game.name, ', keeping original logo');
          return game;
        });

        setGames(processedGames);
      } catch (error) {
        console.error('Error fetching clear logos:', error);
        // Fallback to original games if clear logo service fails
        setGames(initialGames);
      }
    };

    if (initialGames.length > 0) {
      processGames();
    } else {
      setGames(initialGames);
    }
  }, [initialGames]);

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

  // Debounce reference for search
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Cleanup search timeout on unmount
  React.useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Search functions for manual game addition
  const handleGameSearchChange = async (value: string) => {
    setGameSearchValue(value);
    setNewGame(prev => ({ ...prev, name: value }));

    // Clear previous search timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Search for clear logos as user types (with debouncing)
    if (value.length >= 2) {
      setSearchingLogos(true);
      setClearLogoResults([]);

      // Debounce the search by 500ms
      searchTimeoutRef.current = setTimeout(async () => {
        // Generate potential game name variations for search
        const searchVariations = [
          value,
          `${value} 1`,
          `${value} 2`,
          `${value} 3`,
          `Super ${value}`,
          `${value} Championship`,
          `${value} Turbo`,
          `${value} Plus`,
          `${value} Edition`,
          `${value} Deluxe`
        ];

        try {
          // Search for clear logos for all variations
          const clearLogos = await clearLogoService.getClearLogosForGames(searchVariations);

          // Convert to results array
          const results = Object.entries(clearLogos)
            .filter(([_, url]) => url) // Only include entries with actual URLs
            .map(([name, url]) => ({ name, url }))
            .slice(0, 6); // Limit to 6 results

          setClearLogoResults(results);

          // If exact match found, auto-select it
          if (clearLogos[value]) {
            setClearLogoFound(true);
            setNewGame(prev => ({ ...prev, logo_url: clearLogos[value] }));
          } else {
            setClearLogoFound(false);
          }
        } catch (error) {
          console.warn('Failed to search for clear logos:', error);
          setClearLogoResults([]);
          setClearLogoFound(false);
        } finally {
          setSearchingLogos(false);
        }
      }, 500);
    } else {
      setClearLogoResults([]);
      setClearLogoFound(false);
      setNewGame(prev => ({ ...prev, logo_url: '' }));
      setSearchingLogos(false);
    }
  };

  const handleGameSearchSubmit = async (value: string) => {
    // This is called when user presses Enter or selects from autocomplete
    // The search already happens in handleGameSearchChange, so just ensure we have the right game name
    setNewGame(prev => ({ ...prev, name: value }));
  };

  const selectClearLogo = (logoData: {name: string, url: string}) => {
    setNewGame(prev => ({
      ...prev,
      name: gameSearchValue || logoData.name, // Keep the typed name, fallback to logo name
      logo_url: logoData.url
    }));
    setClearLogoFound(true);
  };


  const addGameToList = () => {
    if (!newGame.name.trim()) {
      toast({
        title: "Error",
        description: "Game name is required",
        variant: "destructive",
      });
      return;
    }

    setGames(prev => [...prev, {
      ...newGame,
      id: Date.now(), // temporary ID for UI
      name: newGame.name.trim(),
      logo_url: newGame.logo_url || null,
    }]);

    // Reset new game form
    setNewGame({
      name: '',
      logo_url: ''
    });
    setGameSearchValue('');
    setClearLogoFound(false);
    setClearLogoResults([]);
    setSearchingLogos(false);
  };

  const toggleGameSelection = (gameId: string | number) => {
    const gameKey = String(gameId);
    setSelectedGames(prev => {
      const newSet = new Set(prev);
      if (newSet.has(gameKey)) {
        newSet.delete(gameKey);
      } else {
        newSet.add(gameKey);
      }
      return newSet;
    });
  };

  const selectAllGames = () => {
    const allGameKeys = games.map(game => String(game.id || `game-${games.indexOf(game)}`));
    setSelectedGames(new Set(allGameKeys));
  };

  const deselectAllGames = () => {
    setSelectedGames(new Set());
  };

  const removeGameFromList = (gameIdOrIndex: number) => {
    const gameKey = String(gameIdOrIndex);
    // Also remove from selected set when removing from games list
    setSelectedGames(prev => {
      const newSet = new Set(prev);
      newSet.delete(gameKey);
      return newSet;
    });

    setGames(prev => {
      // Try to remove by ID first
      const filteredById = prev.filter(game => game.id !== gameIdOrIndex);

      // If no games were removed by ID, try removing by index
      if (filteredById.length === prev.length) {
        return prev.filter((_, index) => index !== gameIdOrIndex);
      }

      return filteredById;
    });
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
      slug: createForm.slug.trim().toLowerCase(),
      is_public: createForm.is_public,
      start_time: formatDateTimeForDatabase(createForm.start_time),
      end_time: formatDateTimeForDatabase(createForm.end_time),
      status: createForm.status,
      is_active: createForm.is_active,
      is_locked: createForm.is_locked,
      scores_locked: createForm.scores_locked,
    });

    if (tournament) {
      // Add only selected games to the newly created tournament
      const selectedGamesList = games.filter(game => {
        const gameKey = String(game.id || games.indexOf(game));
        return selectedGames.has(gameKey);
      });

      for (const game of selectedGamesList) {
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

          // Insert into tournament games table
          const { error } = await supabase
            .from('games')
            .insert({
              name: game.name,
              description: game.overview || null, // Use game overview as description if available
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
          } else {
            // If we have a logo URL, also save it to the games_database table for future use
            if (logoUrl && game.id) {
              try {
                const { error: logoError } = await supabase
                  .from('games_database')
                  .update({ logo_url: logoUrl })
                  .eq('database_id', game.id);

                if (logoError) {
                  console.log('Could not update logo in games_database for game ID', game.id, ':', logoError);
                } else {
                  console.log('Successfully saved logo to games_database for game:', game.name);
                }
              } catch (logoSaveError) {
                console.log('Error saving logo to games_database:', logoSaveError);
              }
            }
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
        status: 'draft' as const,
        is_active: true,
        is_locked: false,
        scores_locked: false,
      });
      setGames([]);
      setSelectedGames(new Set());
      setSlugAvailable(null);
      toast({
        title: "Success",
        description: `Tournament created successfully! ${selectedGamesList.length > 0 ? `${selectedGamesList.length} games added.` : ''}`,
      });
      onClose(); // Close the modal
    }
    setIsCreating(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Tournament</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="tournament" className="w-full flex flex-col flex-1">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="tournament">Tournament Details</TabsTrigger>
            <TabsTrigger value="games">Games ({selectedGames.size}/{games.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="tournament" className="space-y-4 mt-4 px-1">
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

            <div>
              <Label htmlFor="status" className="text-white">Tournament Status</Label>
              <Select
                value={createForm.status}
                onValueChange={(value: 'draft' | 'active' | 'completed') => setCreateForm(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger className="bg-black/50 border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">
                    <div className="flex items-center gap-2">
                      <Pause className="w-4 h-4" />
                      Draft (Not Started)
                    </div>
                  </SelectItem>
                  <SelectItem value="active">
                    <div className="flex items-center gap-2">
                      <Play className="w-4 h-4" />
                      Active (Running)
                    </div>
                  </SelectItem>
                  <SelectItem value="completed">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Completed (Finished)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="is_active" className="text-white">Tournament Active</Label>
                <Switch
                  id="is_active"
                  checked={createForm.is_active}
                  onCheckedChange={(checked) => setCreateForm(prev => ({ ...prev, is_active: checked }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="is_locked" className="text-white">Tournament Locked</Label>
                <Switch
                  id="is_locked"
                  checked={createForm.is_locked}
                  onCheckedChange={(checked) => setCreateForm(prev => ({ ...prev, is_locked: checked }))}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="scores_locked" className="text-white">Score Submissions Locked</Label>
                <p className="text-xs text-gray-400">Prevent new score submissions</p>
              </div>
              <Switch
                id="scores_locked"
                checked={createForm.scores_locked}
                onCheckedChange={(checked) => setCreateForm(prev => ({ ...prev, scores_locked: checked }))}
              />
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

          <TabsContent value="games" className="mt-4 flex-1 flex flex-col overflow-y-auto">
            {/* Manual Game Addition Form */}
            <div className="border rounded-lg p-4 mb-4 bg-gray-900/50">
              <h4 className="font-semibold text-white mb-3">Add Game Manually</h4>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="game-name" className="text-white text-sm">Game Name *</Label>
                  <AdvancedSearchField
                    value={gameSearchValue}
                    onChange={handleGameSearchChange}
                    onSubmit={handleGameSearchSubmit}
                    placeholder="Enter game name (clear logos search automatically)"
                    enableSuggestions={true}
                    searchHint="💡 Tip: Try 'Street Fighter', 'Pac-Man', 'Metal Slug', or use abbreviations like 'SF'"
                    className="bg-black/50 border-gray-700 text-white"
                  />

                  {/* Clear Logo Status */}
                  {clearLogoFound && newGame.logo_url && (
                    <div className="flex items-center gap-2 mt-2">
                      <img
                        src={newGame.logo_url}
                        alt="Clear logo found"
                        className="w-8 h-8 object-contain bg-white/10 rounded"
                      />
                      <span className="text-xs text-green-400">✓ Clear logo found automatically</span>
                    </div>
                  )}
                </div>


                {/* Upload/Paste Image - Only show if no clear logo found */}
                {!clearLogoFound && (
                  <div>
                    <Label htmlFor="game-logo" className="text-white text-sm">Logo URL (Optional)</Label>
                    <Input
                      id="game-logo"
                      value={newGame.logo_url}
                      onChange={(e) => setNewGame(prev => ({ ...prev, logo_url: e.target.value }))}
                      placeholder="Enter logo URL or paste/upload an image"
                      className="bg-black/50 border-gray-700 text-white"
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      💡 You can paste an image URL or upload an image file
                    </div>
                  </div>
                )}

                {/* Clear Logo Search Results */}
                {(searchingLogos || clearLogoResults.length > 0) && (
                  <div>
                    <Label className="text-white text-sm mb-2 block">
                      {searchingLogos ? 'Searching for clear logos...' : `Found ${clearLogoResults.length} clear logo(s)`}
                    </Label>

                    {searchingLogos && (
                      <div className="flex items-center justify-center py-4">
                        <div className="w-6 h-6 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
                      </div>
                    )}

                    {clearLogoResults.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                        {clearLogoResults.map((result, index) => (
                          <div
                            key={index}
                            onClick={() => selectClearLogo(result)}
                            className={`cursor-pointer border-2 rounded-lg p-3 transition-all ${
                              newGame.logo_url === result.url
                                ? 'border-blue-400 bg-blue-600/20 ring-2 ring-blue-400'
                                : 'border-gray-600 hover:border-gray-400 bg-black/30 hover:bg-black/50'
                            }`}
                          >
                            <div className="aspect-square mb-2 flex items-center justify-center bg-white/10 rounded">
                              <img
                                src={result.url}
                                alt={result.name}
                                className="max-w-full max-h-full object-contain"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  e.currentTarget.nextElementSibling!.textContent = '❌ Failed to load';
                                }}
                              />
                              <span className="text-xs text-gray-400 hidden">Loading...</span>
                            </div>
                            <p className="text-xs text-white text-center truncate" title={result.name}>
                              {result.name}
                            </p>
                            {newGame.logo_url === result.url && (
                              <div className="text-xs text-blue-400 text-center mt-1">
                                ✓ Selected
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <Button
                  onClick={addGameToList}
                  disabled={!newGame.name.trim()}
                  className="w-full bg-green-600 hover:bg-green-700 border-green-500 text-white"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Game to Tournament
                </Button>
              </div>
            </div>

            {/* Games List */}
            {games.length > 0 ? (
              <div className="border rounded-lg p-4 flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-white">Games to Add ({games.length})</h4>
                  <div className="flex gap-2">
                    <Button
                      onClick={selectedGames.size === games.length ? deselectAllGames : selectAllGames}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                    >
                      {selectedGames.size === games.length ? (
                        <>
                          <Square className="w-3 h-3 mr-1" />
                          Deselect All
                        </>
                      ) : (
                        <>
                          <CheckSquare className="w-3 h-3 mr-1" />
                          Select All
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2 flex-1 overflow-y-auto">
                  {games.map((game, index) => {
                    const gameKey = String(game.id || `game-${index}`);
                    const isSelected = selectedGames.has(gameKey);

                    return (
                      <div key={gameKey} className={`flex items-center justify-between p-2 rounded transition-all ${
                        isSelected
                          ? 'bg-blue-600/30 border-2 border-blue-400'
                          : 'bg-black/30 border-2 border-transparent hover:bg-black/50'
                      }`}>
                        <div className="flex items-center space-x-3">
                          {game.logo_url && (
                            <div
                              onClick={() => toggleGameSelection(game.id || `game-${index}`)}
                              className={`cursor-pointer rounded p-1 transition-all ${
                                isSelected
                                  ? 'ring-2 ring-blue-400 bg-blue-600/20'
                                  : 'hover:ring-2 hover:ring-gray-400'
                              }`}
                            >
                              <img
                                src={game.logo_url}
                                alt={game.name}
                                className="w-8 h-8 rounded object-cover"
                              />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-white">{game.name}</p>
                            {isSelected && (
                              <p className="text-xs text-blue-400 font-medium">✓ Selected</p>
                            )}
                          </div>
                        </div>
                        <Button
                          onClick={() => removeGameFromList(game.id || index)}
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-gray-400 text-center">No games selected. Go back to the games browser to select games for your tournament.</p>
              </div>
            )}

            {/* Create Tournament Button - Always at bottom */}
            <div className="mt-4">
              <Button
                onClick={handleCreateTournament}
                disabled={!createForm.name.trim() || !createForm.slug.trim() || isCreating || slugAvailable === false}
                className="w-full"
              >
                {isCreating ? 'Creating...' : `Create Tournament${selectedGames.size > 0 ? ` with ${selectedGames.size} Selected Games` : ''}`}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};