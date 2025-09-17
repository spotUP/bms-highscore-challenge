import React, { useState, useRef } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { ChevronLeft, ChevronRight, Calendar, Plus, Trash2, Lock, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTournament } from "@/contexts/TournamentContext";
import { searchArcadeGameLogo, isArcadeGame } from "@/utils/arcadeLogoSearch";
import { launchBoxService } from "@/services/launchboxService";

interface CreateTournamentModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialGames?: Array<{
    id?: number;
    name: string;
    description?: string;
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
    description: ''
  });

  // Update games when initialGames prop changes and auto-search logos for arcade games
  React.useEffect(() => {
    const processGames = async () => {
      const processedGames = await Promise.all(
        initialGames.map(async (game) => {
          // Check if this is an arcade game and needs a clear logo
          const isArcade = game.platforms && isArcadeGame(game.platforms);

          // Always search for clear logos to replace RAWG screenshots
          console.log('Searching for clear logo for game:', game.name);

          let logoUrl = null;

          // For arcade games, try arcade logo search first (more reliable currently)
          if (isArcade) {
            logoUrl = await searchArcadeGameLogo(game.name);
            if (logoUrl) {
              console.log('Found arcade clear logo for game', game.name, ':', logoUrl);
              return { ...game, logo_url: logoUrl };
            }
          }

          // For non-arcade games or if arcade search failed, try LaunchBox
          if (!logoUrl) {
            console.log('Trying LaunchBox for game:', game.name);
            logoUrl = await launchBoxService.getClearLogo(game.name);
            if (logoUrl) {
              console.log('Found LaunchBox clear logo for game', game.name, ':', logoUrl);
              return { ...game, logo_url: logoUrl };
            }
          }

          if (!logoUrl) {
            console.log('No clear logo found for game:', game.name, ', keeping original logo');
            // Keep the original RAWG logo as fallback
          }

          return game;
        })
      );
      setGames(processedGames);
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
      description: newGame.description.trim() || undefined,
    }]);

    // Reset new game form
    setNewGame({
      name: '',
      description: ''
    });
  };

  const removeGameFromList = (gameIdOrIndex: number) => {
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
          const { error } = await supabase
            .from('games')
            .insert({
              name: game.name,
              description: game.description,
              logo_url: game.logo_url || null,
              is_active: true,
              include_in_challenge: true,
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
          <DialogTitle>Create New Tournament</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="tournament" className="w-full h-[600px] flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="tournament">Tournament Details</TabsTrigger>
            <TabsTrigger value="games">Games ({games.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="tournament" className="space-y-4 mt-4 flex-1 overflow-y-auto px-1">
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

          <TabsContent value="games" className="mt-4 flex-1 flex flex-col overflow-y-auto">
            {/* Games List */}
            {games.length > 0 ? (
              <div className="border rounded-lg p-4 flex-1 flex flex-col">
                <h4 className="font-semibold text-white mb-3">Games to Add ({games.length})</h4>
                <div className="space-y-2 flex-1 overflow-y-auto">
                  {games.map((game, index) => (
                    <div key={game.id || `game-${index}`} className="flex items-center justify-between p-2 bg-black/30 rounded">
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
                        onClick={() => removeGameFromList(game.id || index)}
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
                {isCreating ? 'Creating...' : `Create Tournament${games.length > 0 ? ` with ${games.length} Games` : ''}`}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};