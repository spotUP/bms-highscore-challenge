import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from '@/integrations/supabase/client';
import { Globe, Search, Trophy, Users } from 'lucide-react';

interface PublicTournament {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  is_public: boolean;
  created_at: string;
  member_count?: number;
}

const PublicTournamentBrowser = () => {
  const [publicTournaments, setPublicTournaments] = useState<PublicTournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Load public tournaments (only show tournaments marked as public)
  const loadPublicTournaments = async () => {
    try {
      const { data, error } = await supabase
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
    if (isDialogOpen) {
      loadPublicTournaments();
    }
  }, [isDialogOpen]);

  const filteredTournaments = publicTournaments.filter(tournament =>
    tournament.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tournament.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tournament.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleTournamentClick = (tournament: PublicTournament) => {
    // Navigate to the tournament's public page
    window.location.href = `/t/${tournament.slug}`;
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Trophy className="w-4 h-4" />
          Browse Tournaments
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-black/90 border-white/20">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Public Tournaments
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
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

        {/* Public Tournaments */}
        <div>
          {loading ? (
            <div className="text-center py-12">
              <div className="text-xl text-white">Loading tournaments...</div>
            </div>
          ) : (
            <div className="grid gap-4 max-h-96 overflow-y-auto">
              {filteredTournaments.map((tournament) => (
                <Card 
                  key={tournament.id} 
                  className="bg-gray-800/50 border-gray-700 transition-colors cursor-pointer"
                  onClick={() => handleTournamentClick(tournament)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-white">{tournament.name}</h3>
                          <Globe className="w-4 h-4 text-green-400" />
                          <Badge variant="secondary">Public</Badge>
                        </div>
                        {tournament.description && (
                          <p className="text-gray-300 text-sm mb-2">{tournament.description}</p>
                        )}
                        <div className="text-sm text-gray-400">
                          <div>/t/{tournament.slug}</div>
                          {tournament.member_count !== undefined && (
                            <div className="flex items-center gap-1 mt-1">
                              <Users className="w-3 h-3" />
                              {tournament.member_count} members
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTournamentClick(tournament);
                          }}
                        >
                          View Tournament
                        </Button>
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
                    {searchTerm ? 'Try adjusting your search terms.' : 'No public tournaments available at the moment.'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <p className="text-sm text-gray-300 text-center">
            <strong className="text-white">Want to join a tournament?</strong>
            <br />
            Sign in to join these tournaments and compete with other players!
          </p>
          <div className="flex justify-center mt-3">
            <Button 
              onClick={() => window.location.href = '/auth'}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Sign In to Join
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PublicTournamentBrowser;
