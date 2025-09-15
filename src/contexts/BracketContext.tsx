import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Tournament {
  id: string;
  name: string;
  created_by: string;
  status: 'draft' | 'active' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface TournamentPlayer {
  id: string;
  tournament_id: string;
  name: string;
  created_at: string;
}

export interface TournamentMatch {
  id: string;
  tournament_id: string;
  round: number;
  position: number;
  participant1_id: string | null;
  participant2_id: string | null;
  winner_id: string | null;
  created_at: string;
  updated_at: string;
}

interface BracketContextType {
  tournaments: Tournament[];
  loading: boolean;
  refresh: () => Promise<void>;
  createTournament: (name: string) => Promise<Tournament | null>;
  addPlayers: (tournamentId: string, names: string[]) => Promise<boolean>;
  generateBracket: (tournamentId: string, options?: { mode?: 'seeded' | 'shuffle'; orderedPlayerIds?: string[] }) => Promise<boolean>;
  reportWinner: (matchId: string, winnerId: string) => Promise<boolean>;
  getTournamentData: (tournamentId: string) => Promise<{ players: TournamentPlayer[]; matches: TournamentMatch[] }>;
  deleteTournament: (tournamentId: string) => Promise<boolean>;
}

const BracketContext = createContext<BracketContextType | undefined>(undefined);

export function BracketProvider({ children }: { children: React.ReactNode }) {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bracket_tournaments')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTournaments(data || []);
    } catch (e) {
      console.error('Failed to load bracket tournaments', e);
      setTournaments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    refresh(); 
  }, []);

  const createTournament = async (name: string): Promise<Tournament | null> => {
    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const uid = userRes?.user?.id;
      if (!uid) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('bracket_tournaments')
        .insert({ 
          name: name.trim(), 
          created_by: uid,
          status: 'draft'
        })
        .select('*')
        .single();
      
      if (error) throw error;
      await refresh();
      return data;
    } catch (e) {
      console.error('createTournament failed', e);
      return null;
    }
  };

  const addPlayers = async (tournamentId: string, names: string[]): Promise<boolean> => {
    try {
      const playerRows = names
        .map(n => (n || '').trim())
        .filter(Boolean)
        .map(name => ({ 
          tournament_id: tournamentId, 
          name 
        }));
      
      if (playerRows.length === 0) return true;
      
      const { error } = await supabase
        .from('bracket_players')
        .insert(playerRows);
      
      if (error) throw error;
      return true;
    } catch (e) {
      console.error('addPlayers failed', e);
      return false;
    }
  };

  const generateBracket = async (
    tournamentId: string,
    options?: { mode?: 'seeded' | 'shuffle'; orderedPlayerIds?: string[] }
  ): Promise<boolean> => {
    try {
      // Clear existing matches first
      const { error: clearErr } = await supabase
        .from('bracket_matches')
        .delete()
        .eq('tournament_id', tournamentId);
      if (clearErr) throw clearErr;

      // Get players
      const { data: players, error: playersErr } = await supabase
        .from('bracket_players')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('created_at', { ascending: true });
      
      if (playersErr) throw playersErr;
      if (!players) return false;

      // Deduplicate players by case-insensitive name for safety (keep first)
      const seen = new Map<string, string>(); // lowerName -> keptId
      const duplicates: string[] = [];
      for (const p of players) {
        const key = (p.name || '').trim().toLowerCase();
        if (!key) continue;
        if (!seen.has(key)) {
          seen.set(key, p.id);
        } else {
          duplicates.push(p.id);
        }
      }
      if (duplicates.length > 0) {
        await supabase.from('bracket_players').delete().in('id', duplicates);
      }

      // Re-load players after cleanup
      const { data: playersClean } = await supabase
        .from('bracket_players')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('created_at', { ascending: true });
      if (!playersClean || playersClean.length < 2) return false;

      // Determine ordering strategy
      let ordered: TournamentPlayer[] = playersClean.slice();
      const mode = options?.mode || 'seeded';
      if (options?.orderedPlayerIds && options.orderedPlayerIds.length > 0) {
        const byId = new Map(playersClean.map(p => [p.id, p] as const));
        const picked: TournamentPlayer[] = [];
        options.orderedPlayerIds.forEach(id => { const p = byId.get(id); if (p) picked.push(p); });
        // Append any remaining players not in the provided order
        playersClean.forEach(p => { if (!options!.orderedPlayerIds!.includes(p.id)) picked.push(p); });
        ordered = picked;
      } else if (mode === 'shuffle') {
        ordered = playersClean.slice().sort(() => Math.random() - 0.5);
      }

      // Find next power of 2 for bracket size
      const bracketSize = Math.pow(2, Math.ceil(Math.log2(playersClean.length)));
      
      // Create seeded bracket with byes
      const seededPlayers: (TournamentPlayer | null)[] = new Array(bracketSize).fill(null);
      
      // Place players in bracket positions
      for (let i = 0; i < ordered.length; i++) {
        seededPlayers[i] = ordered[i];
      }

      // Create all matches for all rounds
      const matches: Partial<TournamentMatch>[] = [];
      const totalRounds = Math.log2(bracketSize);
      
      // Round 1: Initial pairings
      let position = 1;
      for (let i = 0; i < seededPlayers.length; i += 2) {
        matches.push({
          tournament_id: tournamentId,
          round: 1,
          position: position++,
          participant1_id: seededPlayers[i]?.id || null,
          participant2_id: seededPlayers[i + 1]?.id || null,
          winner_id: null
        });
      }
      
      // Create all subsequent rounds (empty, to be filled by progression)
      for (let round = 2; round <= totalRounds; round++) {
        const matchesInRound = Math.pow(2, totalRounds - round);
        for (let pos = 1; pos <= matchesInRound; pos++) {
          matches.push({
            tournament_id: tournamentId,
            round: round,
            position: pos,
            participant1_id: null,
            participant2_id: null,
            winner_id: null
          });
        }
      }

      const { error: insertErr } = await supabase
        .from('bracket_matches')
        .insert(matches);
      
      if (insertErr) throw insertErr;

      // Update tournament status to active
      await supabase
        .from('bracket_tournaments')
        .update({ status: 'active' })
        .eq('id', tournamentId);

      return true;
    } catch (e) {
      console.error('generateBracket failed', e);
      return false;
    }
  };

  const reportWinner = async (matchId: string, winnerId: string): Promise<boolean> => {
    try {
      // Update the match with winner
      const { data: updatedMatch, error: updateErr } = await supabase
        .from('bracket_matches')
        .update({ 
          winner_id: winnerId,
          updated_at: new Date().toISOString()
        })
        .eq('id', matchId)
        .select('*')
        .single();
      
      if (updateErr) throw updateErr;

      const match = updatedMatch as TournamentMatch;
      
      // Check if this is the final match (Grand Final or Reset Final)
      if (match.round === 1000 || match.round === 1001) {
        // Tournament is complete
        await supabase
          .from('bracket_tournaments')
          .update({ 
            status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('id', match.tournament_id);
        
        return true; // Early return since this was the final match
      }
      
      // Find next round match to advance winner
      const nextRound = match.round + 1;
      const nextPosition = Math.ceil(match.position / 2);
      const isLeftSide = (match.position % 2) === 1;

      // Check if there's a next round match
      const { data: nextMatch, error: nextErr } = await supabase
        .from('bracket_matches')
        .select('*')
        .eq('tournament_id', match.tournament_id)
        .eq('round', nextRound)
        .eq('position', nextPosition)
        .maybeSingle();
      
      if (nextErr) throw nextErr;
      
      if (nextMatch) {
        // Advance winner to next match
        const updateField = isLeftSide ? 'participant1_id' : 'participant2_id';

        const { error: advanceErr } = await supabase
          .from('bracket_matches')
          .update({ [updateField]: winnerId })
          .eq('id', nextMatch.id);

        if (advanceErr) throw advanceErr;
      }
      
      return true;
    } catch (e) {
      console.error('Error reporting winner:', e);
      return false;
    }
  };

  const getTournamentData = async (tournamentId: string) => {
    console.log('[BracketContext] getTournamentData called for:', tournamentId);
    
    try {
      // Get players
      const { data: players, error: playersError } = await supabase
        .from('bracket_players')
        .select('*')
        .eq('tournament_id', tournamentId);
      
      if (playersError) throw playersError;
      
      // Get matches
      const { data: matches, error: matchesError } = await supabase
        .from('bracket_matches')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('round', { ascending: true })
        .order('position', { ascending: true });
      
      if (matchesError) throw matchesError;
      
      console.log('[BracketContext] getTournamentData result:', {
        players: players?.length || 0,
        matches: matches?.length || 0,
        hasWinner: matches?.some(m => m.winner_id)
      });
      
      return { 
        players: players || [], 
        matches: matches || [] 
      };
      
    } catch (e) {
      console.error('[BracketContext] Error in getTournamentData:', e);
      return { players: [], matches: [] };
    }
  };

  const deleteTournament = async (tournamentId: string): Promise<boolean> => {
    try {
      // First delete all related records
      await supabase.from('bracket_matches').delete().eq('tournament_id', tournamentId);
      await supabase.from('bracket_players').delete().eq('tournament_id', tournamentId);
      
      // Then delete the tournament itself
      const { error } = await supabase
        .from('bracket_tournaments')
        .delete()
        .eq('id', tournamentId);
      
      if (error) throw error;
      
      // Refresh the tournaments list
      await refresh();
      return true;
    } catch (e) {
      console.error('Failed to delete tournament', e);
      return false;
    }
  };

  const contextValue: BracketContextType = {
    tournaments,
    loading,
    refresh,
    createTournament,
    addPlayers,
    generateBracket,
    reportWinner,
    getTournamentData,
    deleteTournament
  };

  return (
    <BracketContext.Provider value={contextValue}>
      {children}
    </BracketContext.Provider>
  );
}

export function useBrackets() {
  const context = useContext(BracketContext);
  if (context === undefined) {
    throw new Error('useBrackets must be used within a BracketProvider');
  }
  return context;
}
