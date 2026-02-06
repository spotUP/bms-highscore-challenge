import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from '@/lib/api-client';
import { useTournament, Tournament } from '@/contexts/TournamentContext';
import { useToast } from '@/hooks/use-toast';
import { Globe, Lock, Users, Trophy, Search, Plus, Settings, Crown, Shield, User } from 'lucide-react';
import { getButtonStyle, getCardStyle, getTypographyStyle } from '@/utils/designSystem';

interface PublicTournament {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  is_public: boolean;
  created_at: string;
  member_count?: number;
}

const TournamentManagement = () => {
  const {
    currentTournament,
    userTournaments,
    switchTournament,
    createTournament,
    joinTournament,
    updateTournament,
    deleteTournament,
    currentUserRole
  } = useTournament();
  
  const [editTournament, setEditTournament] = useState<Tournament | null>(null);
  
  const { toast } = useToast();
  const [publicTournaments, setPublicTournaments] = useState<PublicTournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isJoining, setIsJoining] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    slug: '',
    is_public: false,
    demolition_man_active: false, // Default to inactive
  });
  const [joinSlug, setJoinSlug] = useState('');
  const [isJoiningBySlug, setIsJoiningBySlug] = useState(false);

  // Load public tournaments (only show tournaments marked as public)
  const loadPublicTournaments = async () => {
    try {
      const { data, error } = await api
        .from('tournaments')
        .select('*')
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Only show actually public tournaments - private tournaments should never appear here
      const tournaments = data?.filter(tournament => tournament.is_public === true).map(tournament => ({
        ...tournament,
        member_count: 0, // TODO: Get member count separately if needed
      })) || [];

      setPublicTournaments(tournaments);
    } catch (error) {
      console.error('Error loading public tournaments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPublicTournaments();
  }, []);

  const handleJoinTournament = async (slug: string) => {
    setIsJoining(slug);
    const success = await joinTournament(slug);
    if (success) {
      await loadPublicTournaments(); // Refresh the list
    }
    setIsJoining(null);
  };

  const handleJoinBySlug = async () => {
    if (!joinSlug.trim()) return;

    setIsJoiningBySlug(true);
    const success = await joinTournament(joinSlug.trim().toLowerCase());
    if (success) {
      setJoinSlug('');
      await loadPublicTournaments();
    }
    setIsJoiningBySlug(false);
  };

  const handleCreateTournament = async () => {
    if (!createForm.name.trim() || !createForm.slug.trim()) return;

    setIsCreating(true);
    const success = await createTournament({
      name: createForm.name.trim(),
      slug: createForm.slug.trim().toLowerCase(),
      is_public: createForm.is_public,
      demolition_man_active: createForm.demolition_man_active,
    });

    if (success) {
      setCreateForm({
        name: '',
        slug: '',
        is_public: false,
        demolition_man_active: false,
      });
      await loadPublicTournaments();
    }
    setIsCreating(false);
  };

  const handleSwitchTournament = async (tournament: any) => {
    if (tournament.id !== currentTournament?.id) {
      try {
        await switchTournament(tournament);
      } catch (error) {
        console.error('Error in handleSwitchTournament:', error);
      }
    }
  };

  const handleUpdateTournament = async () => {
    if (!currentTournament) return;
    
    const dataToUpdate = editTournament || currentTournament;
    
    const updateData = {
      name: dataToUpdate.name,
      description: dataToUpdate.description,
      slug: dataToUpdate.slug,
      is_public: dataToUpdate.is_public,
      demolition_man_active: dataToUpdate.demolition_man_active,
    };
    
    console.log('Updating tournament with data:', updateData);
    
    const success = await updateTournament(currentTournament.id, updateData);
    if (success) {
      setEditTournament(null); // Reset edit state
      toast({
        title: "Tournament Updated",
        description: "Tournament settings have been saved successfully.",
      });
    }
  };

  const handleDeleteTournament = async () => {
    if (!currentTournament) return;
    
    const success = await deleteTournament(currentTournament.id);
    if (success) {
      toast({
        title: "Tournament Deleted",
        description: "Tournament has been permanently deleted.",
      });
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return <Crown className="w-4 h-4 text-yellow-400" />;
      case 'admin': return <Shield className="w-4 h-4 text-red-400" />;
      case 'moderator': return <Settings className="w-4 h-4 text-blue-400" />;
      default: return <User className="w-4 h-4 text-gray-400" />;
    }
  };

  const filteredTournaments = publicTournaments.filter(tournament =>
    tournament.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tournament.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tournament.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const userTournamentSlugs = new Set(userTournaments.map(t => t.slug));

  return (
    <div className="space-y-6">
      <Tabs defaultValue="current" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-gray-800">
          <TabsTrigger value="current">Current Tournament</TabsTrigger>
          <TabsTrigger value="switch">Switch Tournament</TabsTrigger>
          <TabsTrigger value="join">Join/Browse</TabsTrigger>
          <TabsTrigger value="create">Create Tournament</TabsTrigger>
        </TabsList>

        <TabsContent value="current" className="space-y-4">
          <Card className={getCardStyle('primary')}>
            <CardHeader>
              <CardTitle className={getTypographyStyle('h3')}>Current Tournament Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentTournament ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="tournament-name" className="text-white">Tournament Name</Label>
                      <Input
                        id="tournament-name"
                        value={editTournament?.name || currentTournament.name}
                        onChange={(e) => {
                          if (currentTournament) {
                            setEditTournament({ ...currentTournament, ...editTournament, name: e.target.value });
                          }
                        }}
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tournament-slug" className="text-white">Slug</Label>
                      <Input
                        id="tournament-slug"
                        value={editTournament?.slug || currentTournament.slug}
                        onChange={(e) => {
                          if (currentTournament) {
                            setEditTournament({ ...currentTournament, ...editTournament, slug: e.target.value });
                          }
                        }}
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tournament-description" className="text-white">Description</Label>
                    <Textarea
                      id="tournament-description"
                      value={editTournament?.description || currentTournament.description || ''}
                      onChange={(e) => {
                        if (currentTournament) {
                          setEditTournament({ ...currentTournament, ...editTournament, description: e.target.value });
                        }
                      }}
                      className="bg-gray-800 border-gray-700 text-white min-h-[100px]"
                      placeholder="Enter tournament description..."
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="tournament-public"
                      checked={currentTournament.is_public}
                      onCheckedChange={(checked) => updateTournament(currentTournament.id, { is_public: checked })}
                    />
                    <Label htmlFor="tournament-public" className="text-white">
                      Make tournament public (visible to all users)
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="tournament-demolition-man"
                      checked={currentTournament.demolition_man_active || false}
                      onCheckedChange={(checked) => updateTournament(currentTournament.id, { demolition_man_active: checked })}
                    />
                    <Label htmlFor="tournament-demolition-man" className="text-white">
                      Enable Demolition Man Leaderboard
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
                          variant="outline"
                          disabled={currentUserRole !== 'owner'}
                        >
                          Delete Tournament
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-gray-900 border-gray-700">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-white">Delete Tournament</AlertDialogTitle>
                          <AlertDialogDescription className="text-gray-300">
                            Are you sure you want to delete "{currentTournament.name}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-gray-700 text-white hover:bg-gray-600">
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleDeleteTournament}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Delete Permanently
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <h3 className="text-xl font-bold mb-2 text-white">No Tournament Selected</h3>
                  <p className="text-gray-400">Please switch to a tournament or create a new one.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="switch" className="space-y-4">
          <Card className={getCardStyle('primary')}>
            <CardHeader>
              <CardTitle className={getTypographyStyle('h3')}>Switch Tournament</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-gray-400 mb-4">
                Current: <span className="text-white font-medium">{currentTournament?.name || 'None selected'}</span>
              </div>
              
              <div className="grid gap-3 max-h-60 overflow-y-auto">
                {userTournaments.map((tournament) => (
                  <Card 
                    key={tournament.id} 
                    className={`cursor-pointer transition-colors border ${
                      currentTournament?.id === tournament.id 
                        ? 'bg-blue-900/30 border-blue-600' 
                        : 'bg-gray-800/50 border-gray-700 hover:bg-gray-700/50'
                    }`}
                    onClick={() => handleSwitchTournament(tournament)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-white">{tournament.name}</h3>
                            {tournament.is_public ? (
                              <Globe className="w-4 h-4 text-green-400" />
                            ) : (
                              <Lock className="w-4 h-4 text-gray-400" />
                            )}
                            {getRoleIcon('member')}
                          </div>
                          {tournament.description && (
                            <p className="text-sm text-gray-400 mb-2">{tournament.description}</p>
                          )}
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>/t/{tournament.slug}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                {userTournaments.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No tournaments found</p>
                    <p className="text-sm">Create one or join an existing tournament</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="join" className="space-y-4">
          <Card className={getCardStyle('primary')}>
            <CardHeader>
              <CardTitle className={getTypographyStyle('h3')}>Join Tournament</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="join-slug" className="text-white">Tournament Slug</Label>
                  <div className="flex gap-2">
                    <Input
                      id="join-slug"
                      value={joinSlug}
                      onChange={(e) => setJoinSlug(e.target.value)}
                      placeholder="tournament-slug"
                      className="bg-black/50 border-gray-700 text-white"
                    />
                    <Button 
                      onClick={handleJoinBySlug}
                      disabled={!joinSlug.trim() || isJoiningBySlug}
                    >
                      {isJoiningBySlug ? 'Joining...' : 'Join'}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Enter the tournament slug (e.g., "awesome-arcade" from /t/awesome-arcade)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={getCardStyle('primary')}>
            <CardHeader>
              <CardTitle className={getTypographyStyle('h3')}>Browse Public Tournaments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search tournaments..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-black/50 border-gray-700 text-white"
                  />
                </div>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <div className="text-xl text-white">Loading tournaments...</div>
                </div>
              ) : (
                <div className="grid gap-4 max-h-96 overflow-y-auto">
                  {filteredTournaments.map((tournament) => (
                    <Card key={tournament.id} className="bg-gray-800/50 border-gray-700">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium text-white">{tournament.name}</h3>
                              <Globe className="w-4 h-4 text-green-400" />
                              {userTournamentSlugs.has(tournament.slug) && (
                                <Badge variant="secondary">Joined</Badge>
                              )}
                            </div>
                            {tournament.description && (
                              <p className="text-sm text-gray-400 mb-2">{tournament.description}</p>
                            )}
                            <div className="text-sm text-gray-400">
                              /t/{tournament.slug}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {!userTournamentSlugs.has(tournament.slug) && (
                              <Button 
                                size="sm" 
                                onClick={() => handleJoinTournament(tournament.slug)}
                                disabled={isJoining === tournament.slug}
                              >
                                {isJoining === tournament.slug ? 'Joining...' : 'Join'}
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  
                  {filteredTournaments.length === 0 && !loading && (
                    <div className="text-center py-12">
                      <Trophy className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <h3 className="text-xl font-bold mb-2 text-white">No tournaments found</h3>
                      <p className="text-gray-400">
                        {searchTerm ? 'Try adjusting your search terms.' : 'No public tournaments available.'}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="create" className="space-y-4">
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
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TournamentManagement;
