import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTournament } from "@/contexts/TournamentContext";
import { Trophy, Globe, Lock } from "lucide-react";

const TournamentDropdown = () => {
  const {
    currentTournament,
    userTournaments,
    switchTournament,
  } = useTournament();

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

  if (!currentTournament || userTournaments.length <= 1) {
    return null; // Don't show dropdown if no tournament or only one tournament
  }

  return (
    <div className="flex items-center gap-2">
      <Trophy className="w-4 h-4 text-yellow-400" />
      <Select 
        value={currentTournament.id} 
        onValueChange={handleTournamentChange}
      >
        <SelectTrigger className="bg-black/50 border-white/20 text-white min-w-[200px]">
          <SelectValue placeholder="Select Tournament" />
        </SelectTrigger>
        <SelectContent className="bg-gray-900 border-white/20">
          {userTournaments.map((tournament) => (
            <SelectItem 
              key={tournament.id} 
              value={tournament.id} 
              className="text-white focus:bg-gray-800 focus:text-white"
            >
              <div className="flex items-center gap-2 w-full">
                <span className="flex-1">{tournament.name}</span>
                {tournament.is_public ? (
                  <Globe className="w-3 h-3 text-green-400" />
                ) : (
                  <Lock className="w-3 h-3 text-gray-400" />
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default TournamentDropdown;
