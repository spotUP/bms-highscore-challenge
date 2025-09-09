import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTournament } from '@/contexts/TournamentContext';
import { Globe, Lock, Users, Trophy, Search, Plus } from 'lucide-react';
import TournamentSelector from '@/components/TournamentSelector';

interface PublicTournament {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  is_public: boolean;
  created_at: string;
  member_count?: number;
  // Optional properties that may not exist in database
  theme_color?: string;
  logo_url?: string | null;
}

const TournamentLanding = () => {
  const { user } = useAuth();
  const { userTournaments, joinTournament } = useTournament();
  const navigate = useNavigate();
  const [publicTournaments, setPublicTournaments] = useState<PublicTournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isJoining, setIsJoining] = useState<string | null>(null);

  // Load public tournaments
  const loadPublicTournaments = async () => {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select(`
          *,
          tournament_members(count)
        `)
        .eq('is_public', true)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const tournaments = data?.map(tournament => ({
        ...tournament,
        member_count: tournament.tournament_members?.[0]?.count || 0
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
    if (!user) {
      navigate('/auth');
      return;
    }

    setIsJoining(slug);
    const success = await joinTournament(slug);
    if (success) {
      // Refresh the page to show updated tournament list
      window.location.reload();
    }
    setIsJoining(null);
  };

  const filteredTournaments = publicTournaments.filter(tournament =>
    tournament.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tournament.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tournament.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const userTournamentSlugs = new Set(userTournaments.map(t => t.slug));

  return (
    <div className="min-h-screen text-white p-4 relative z-10"
         style={{ background: 'radial-gradient(ellipse at center, rgba(26, 16, 37, 0.9) 0%, rgba(26, 16, 37, 0.7) 100%)' }}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🏆</div>
          <h1 className="text-4xl md:text-6xl font-bold mb-4 animated-gradient">
            Arcade Tournaments
          </h1>
          <p className="text-xl text-gray-300 mb-8">
            Join exciting arcade gaming competitions or create your own tournament
          </p>

          {user && (
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
              <TournamentSelector />
              <Button 
                onClick={() => navigate('/')}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Trophy className="w-4 h-4" />
                Enter Tournament
              </Button>
            </div>
          )}

          {!user && (
            <div className="flex gap-4 justify-center mb-8">
              <Button onClick={() => navigate('/auth')} size="lg">
                Sign In to Join
              </Button>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="mb-8">
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search tournaments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-black/50 border-gray-700 text-white"
            />
          </div>
        </div>

        {/* User's Tournaments */}
        {user && userTournaments.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Users className="w-6 h-6" />
              My Tournaments
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {userTournaments.map((tournament) => (
                <Card key={tournament.id} className="bg-blue-900/30 border-blue-600">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-white">{tournament.name}</CardTitle>
                      <Badge variant="secondary">Member</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {tournament.description && (
                      <p className="text-gray-300 text-sm mb-4">{tournament.description}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        {tournament.is_public ? (
                          <Globe className="w-4 h-4 text-green-400" />
                        ) : (
                          <Lock className="w-4 h-4" />
                        )}
                        <span>/t/{tournament.slug}</span>
                      </div>
                      <Button 
                        size="sm" 
                        onClick={() => navigate(`/t/${tournament.slug}`)}
                      >
                        Enter
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Public Tournaments */}
        <div>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Globe className="w-6 h-6" />
            Public Tournaments
          </h2>

          {loading ? (
            <div className="text-center py-12">
              <div className="text-xl">Loading tournaments...</div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredTournaments.map((tournament) => (
                <Card key={tournament.id} className="bg-gray-800/50 border-gray-700 hover:bg-gray-700/50 transition-colors">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-white">{tournament.name}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-green-400" />
                        {userTournamentSlugs.has(tournament.slug) && (
                          <Badge variant="secondary">Joined</Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {tournament.description && (
                      <p className="text-gray-300 text-sm mb-4">{tournament.description}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-400">
                        <div>/t/{tournament.slug}</div>
                        {tournament.member_count !== undefined && (
                          <div className="flex items-center gap-1 mt-1">
                            <Users className="w-3 h-3" />
                            {tournament.member_count} members
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => navigate(`/t/${tournament.slug}`)}
                        >
                          View
                        </Button>
                        {user && !userTournamentSlugs.has(tournament.slug) && (
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
                <div className="col-span-full text-center py-12">
                  <Trophy className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <h3 className="text-xl font-bold mb-2">No tournaments found</h3>
                  <p className="text-gray-400">
                    {searchTerm ? 'Try adjusting your search terms.' : 'Be the first to create a public tournament!'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TournamentLanding;
