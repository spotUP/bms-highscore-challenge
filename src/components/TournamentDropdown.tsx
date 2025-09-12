import React, { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useTournament } from "@/contexts/TournamentContext";
import { Lock, Unlock } from "lucide-react";

const TournamentDropdown = () => {
  const {
    currentTournament,
    userTournaments,
    switchTournament,
    hasPermission,
    updateTournament,
  } = useTournament();

  const [toggling, setToggling] = useState(false);

  const handleTournamentChange = async (tournamentId: string) => {
    const selectedTournament = userTournaments.find(t => t.id === tournamentId);
    if (selectedTournament && selectedTournament.id !== currentTournament?.id) {
      try {
        await switchTournament(selectedTournament);
      } catch (error) {
        console.error('Error switching tournament:', error);
      }
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

  if (!currentTournament || userTournaments.length <= 1) {
    return null; // Don't show dropdown if no tournament or only one tournament
  }

  return (
    <div className="flex items-center gap-2">
      <Select 
        value={currentTournament.id} 
        onValueChange={handleTournamentChange}
      >
        <SelectTrigger className="bg-secondary/40 border-white/20 text-white min-w-[240px]">
          <div className="flex items-center gap-2">
            {currentTournament.is_locked ? (
              <Lock className="w-4 h-4 text-yellow-400" />
            ) : null}
            <SelectValue placeholder="Select Tournament" />
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
                {tournament.is_locked ? (
                  <Lock className="w-4 h-4 text-yellow-400" />
                ) : null}
                <span className="flex-1">{tournament.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hasPermission('admin') && (
        <Button
          onClick={toggleLock}
          variant="outline"
          size="sm"
          disabled={toggling}
          title={currentTournament.is_locked ? 'Unlock tournament' : 'Lock tournament'}
        >
          {currentTournament.is_locked ? (
            <div className="flex items-center gap-1"><Unlock className="w-4 h-4" /> Unlock</div>
          ) : (
            <div className="flex items-center gap-1"><Lock className="w-4 h-4" /> Lock</div>
          )}
        </Button>
      )}
    </div>
  );
};

export default TournamentDropdown;
