import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useTournament } from "@/contexts/TournamentContext";
import { Lock, Unlock, Plus } from "lucide-react";

const TournamentDropdown = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    currentTournament,
    userTournaments,
    switchTournament,
    hasPermission,
    updateTournament,
    createTournament,
  } = useTournament();

  const [toggling, setToggling] = useState(false);
  const [newBracketName, setNewBracketName] = useState('');
  const [showNewBracketInput, setShowNewBracketInput] = useState(false);

  const handleTournamentChange = async (tournamentId: string) => {
    const selectedTournament = userTournaments.find(t => t.id === tournamentId);
    if (selectedTournament && selectedTournament.id !== currentTournament?.id) {
      try {
        await switchTournament(selectedTournament);

        // Redirect to index page if not already there
        if (location.pathname !== '/') {
          navigate('/');
        }
      } catch (error) {
        console.error('Error switching tournament:', error);
      }
    }
  };

  const handleCreateNewBracket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBracketName.trim()) return;
    
    try {
      const slug = newBracketName.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
      const newTournament = await createTournament({
        name: newBracketName,
        slug: slug,
        is_public: false
      });
      
      if (newTournament) {
        setNewBracketName('');
        setShowNewBracketInput(false);
      }
    } catch (error) {
      console.error('Error creating new tournament:', error);
    }
  };

  const toggleLock = async () => {
    if (!currentTournament) return;
    if (!hasPermission('admin')) return;
    try {
      setToggling(true);
      await updateTournament(currentTournament.id, { is_locked: !(currentTournament.is_locked ?? false) } as any);
    } catch (e) {
      console.error('Failed to toggle lock:', e);
    } finally {
      setToggling(false);
    }
  };

  if (!currentTournament && userTournaments.length === 0) {
    return (
      <Button 
        variant="outline" 
        size="sm"
        onClick={() => setShowNewBracketInput(true)}
        className="bg-secondary/40 border-white/20 text-white"
      >
        <Plus className="w-4 h-4 mr-2" />
        Create New Bracket
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Select 
        value={currentTournament?.id || ''}
        onValueChange={handleTournamentChange}
      >
        <SelectTrigger className="bg-secondary/40 border-white/20 text-white min-w-[240px]">
          <div className="flex items-center gap-2 w-full">
            <SelectValue placeholder="Select Tournament" />
            {currentTournament?.scores_locked && (
              <div title="Score submissions are locked">
                <Lock className="w-4 h-4 text-red-400 flex-shrink-0" />
              </div>
            )}
          </div>
        </SelectTrigger>
        <SelectContent className="bg-gray-900 border-white/20">
          {userTournaments.map((tournament) => (
            <SelectItem 
              key={tournament.id} 
              value={tournament.id} 
              className="text-white focus:bg-gray-800 focus:text-white"
            >
              <div className="flex items-center w-full gap-2">
                <span className="flex-1">{tournament.name}</span>
                {tournament.scores_locked && (
                  <div title="Score submissions are locked">
                    <Lock className="w-4 h-4 text-red-400" />
                  </div>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showNewBracketInput && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-gray-900 p-6 rounded-lg border border-white/20 w-full max-w-md">
            <h3 className="text-lg font-medium text-white mb-4">Create New Bracket</h3>
            <form onSubmit={handleCreateNewBracket} className="space-y-4">
              <div>
                <label htmlFor="bracketName" className="block text-sm font-medium text-gray-300 mb-1">
                  Bracket Name
                </label>
                <input
                  id="bracketName"
                  type="text"
                  value={newBracketName}
                  onChange={(e) => setNewBracketName(e.target.value)}
                  placeholder="Enter bracket name"
                  className="w-full px-3 py-2 bg-gray-800 border border-white/20 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => {
                    setShowNewBracketInput(false);
                    setNewBracketName('');
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={!newBracketName.trim()}
                >
                  Create Bracket
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default TournamentDropdown;
