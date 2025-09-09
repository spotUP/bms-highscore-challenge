import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTournament } from "@/contexts/TournamentContext";
import { Trophy, Users, Settings, Plus, Globe, Lock, Crown, Shield, User } from "lucide-react";

const TournamentSelector = () => {
  const {
    currentTournament,
    userTournaments,
    switchTournament,
    createTournament,
    joinTournament,
    hasPermission
  } = useTournament();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    slug: '',
    is_public: false,
    theme_color: '#1a1a2e'
  });
  const [joinSlug, setJoinSlug] = useState('');

  const handleCreateTournament = async () => {
    if (!createForm.name.trim() || !createForm.slug.trim()) return;

    setIsCreating(true);
    const success = await createTournament({
      name: createForm.name.trim(),
      description: createForm.description.trim() || undefined,
      slug: createForm.slug.trim().toLowerCase(),
      is_public: createForm.is_public,
      theme_color: createForm.theme_color
    });

    if (success) {
      setCreateForm({
        name: '',
        description: '',
        slug: '',
        is_public: false,
        theme_color: '#1a1a2e'
      });
      setIsDialogOpen(false);
    }
    setIsCreating(false);
  };

  const handleJoinTournament = async () => {
    if (!joinSlug.trim()) return;

    setIsJoining(true);
    const success = await joinTournament(joinSlug.trim().toLowerCase());
    if (success) {
      setJoinSlug('');
      setIsDialogOpen(false);
    }
    setIsJoining(false);
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

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Trophy className="w-4 h-4" />
          {currentTournament ? (
            <>
              {currentTournament.name}
              <Badge variant="secondary" className="ml-1">
                {userTournaments.length}
              </Badge>
            </>
          ) : (
            'Select Tournament'
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-black/90 border-white/20">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Tournament Manager
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="switch" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="switch">Switch Tournament</TabsTrigger>
            <TabsTrigger value="join">Join Tournament</TabsTrigger>
            <TabsTrigger value="create">Create Tournament</TabsTrigger>
          </TabsList>

          <TabsContent value="switch" className="space-y-4">
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
                  onClick={() => {
                    if (tournament.id !== currentTournament?.id) {
                      switchTournament(tournament);
                      setIsDialogOpen(false);
                    }
                  }}
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
          </TabsContent>

          <TabsContent value="join" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="join-slug" className="text-white">Tournament Slug</Label>
                <Input
                  id="join-slug"
                  value={joinSlug}
                  onChange={(e) => setJoinSlug(e.target.value)}
                  placeholder="tournament-slug"
                  className="bg-black/50 border-gray-700 text-white"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter the tournament slug (e.g., "awesome-arcade" from /t/awesome-arcade)
                </p>
              </div>
              
              <Button 
                onClick={handleJoinTournament}
                disabled={!joinSlug.trim() || isJoining}
                className="w-full"
              >
                {isJoining ? 'Joining...' : 'Join Tournament'}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="create" className="space-y-4">
            <div className="space-y-4">
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
                <Input
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

              <Button 
                onClick={handleCreateTournament}
                disabled={!createForm.name.trim() || !createForm.slug.trim() || isCreating}
                className="w-full"
              >
                {isCreating ? 'Creating...' : 'Create Tournament'}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default TournamentSelector;
