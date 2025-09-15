import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Tournament {
  id: string;
  name: string;
  created_by: string;
  status: 'draft' | 'active' | 'completed';
  bracket_type: 'single' | 'double';
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
  winner_participant_id: string | null;
  created_at: string;
  updated_at: string;
}

interface BracketContextType {
  tournaments: Tournament[];
  loading: boolean;
  refresh: () => Promise<void>;
  createTournament: (name: string, bracketType?: 'single' | 'double') => Promise<Tournament | null>;
  addPlayers: (tournamentId: string, names: string[]) => Promise<boolean>;
  generateBracket: (tournamentId: string, options?: { mode?: 'seeded' | 'shuffle'; orderedPlayerIds?: string[] }) => Promise<boolean>;
  reportWinner: (matchId: string, winnerId: string) => Promise<boolean>;
  getTournamentData: (tournamentId: string) => Promise<{ players: TournamentPlayer[]; matches: TournamentMatch[] }>;
  deleteTournament: (tournamentId: string) => Promise<boolean>;
  renameTournament: (tournamentId: string, newName: string) => Promise<boolean>;
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

  const createTournament = async (name: string, bracketType: 'single' | 'double' = 'single'): Promise<Tournament | null> => {
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
          status: 'draft',
          bracket_type: bracketType
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
      // Get tournament info to determine bracket type
      const { data: tournament, error: tournamentErr } = await supabase
        .from('bracket_tournaments')
        .select('bracket_type')
        .eq('id', tournamentId)
        .single();

      if (tournamentErr) throw tournamentErr;
      if (!tournament) return false;

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

      // Generate bracket based on type
      if (tournament.bracket_type === 'double') {
        return await generateDoubleEliminationBracket(tournamentId, ordered);
      } else {
        return await generateSingleEliminationBracket(tournamentId, ordered);
      }
    } catch (e) {
      console.error('generateBracket failed', e);
      return false;
    }
  };

  // Single elimination bracket generation (existing logic)
  const generateSingleEliminationBracket = async (
    tournamentId: string,
    orderedPlayers: TournamentPlayer[]
  ): Promise<boolean> => {
    // Find next power of 2 for bracket size
    const bracketSize = Math.pow(2, Math.ceil(Math.log2(orderedPlayers.length)));

    // Create seeded bracket with byes
    const seededPlayers: (TournamentPlayer | null)[] = new Array(bracketSize).fill(null);

    // Place players in bracket positions
    for (let i = 0; i < orderedPlayers.length; i++) {
      seededPlayers[i] = orderedPlayers[i];
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
        winner_participant_id: null
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
          winner_participant_id: null
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
  };

  // Double elimination bracket generation (new logic)
  const generateDoubleEliminationBracket = async (
    tournamentId: string,
    orderedPlayers: TournamentPlayer[]
  ): Promise<boolean> => {
    const playerCount = orderedPlayers.length;
    const bracketSize = Math.pow(2, Math.ceil(Math.log2(playerCount)));
    const totalWinnersRounds = Math.log2(bracketSize);

    // Create seeded bracket with byes
    const seededPlayers: (TournamentPlayer | null)[] = new Array(bracketSize).fill(null);
    for (let i = 0; i < orderedPlayers.length; i++) {
      seededPlayers[i] = orderedPlayers[i];
    }

    const matches: Partial<TournamentMatch>[] = [];

    // 1. WINNERS BRACKET (1-99): Standard single elimination
    let position = 1;
    for (let i = 0; i < seededPlayers.length; i += 2) {
      matches.push({
        tournament_id: tournamentId,
        round: 1,
        position: position++,
        participant1_id: seededPlayers[i]?.id || null,
        participant2_id: seededPlayers[i + 1]?.id || null,
        winner_participant_id: null
      });
    }

    // Create subsequent winners bracket rounds
    for (let round = 2; round <= totalWinnersRounds; round++) {
      const matchesInRound = Math.pow(2, totalWinnersRounds - round);
      for (let pos = 1; pos <= matchesInRound; pos++) {
        matches.push({
          tournament_id: tournamentId,
          round: round,
          position: pos,
          participant1_id: null,
          participant2_id: null,
          winner_participant_id: null
        });
      }
    }

    // 2. LOSERS BRACKET (100-199): Complex interleaved structure
    // Losers bracket has (2 * totalWinnersRounds - 1) rounds
    const totalLosersRounds = (2 * totalWinnersRounds) - 1;

    for (let losersRound = 1; losersRound <= totalLosersRounds; losersRound++) {
      const round = 100 + losersRound - 1; // 100, 101, 102, ...

      let matchesInRound: number;
      if (losersRound === 1) {
        // First losers round: half the first winners round losers
        matchesInRound = Math.pow(2, totalWinnersRounds - 2);
      } else if (losersRound % 2 === 0) {
        // Even rounds: matches decrease by half
        matchesInRound = Math.pow(2, totalWinnersRounds - Math.ceil(losersRound / 2) - 1);
      } else {
        // Odd rounds: same as previous round
        matchesInRound = Math.pow(2, totalWinnersRounds - Math.ceil(losersRound / 2));
      }

      // Ensure we don't go below 1 match
      matchesInRound = Math.max(1, matchesInRound);

      for (let pos = 1; pos <= matchesInRound; pos++) {
        matches.push({
          tournament_id: tournamentId,
          round: round,
          position: pos,
          participant1_id: null,
          participant2_id: null,
          winner_participant_id: null
        });
      }
    }

    // 3. GRAND FINALS (1000, 1001): Winners champion vs Losers champion
    matches.push({
      tournament_id: tournamentId,
      round: 1000,
      position: 1,
      participant1_id: null, // Will be filled by winners bracket champion
      participant2_id: null, // Will be filled by losers bracket champion
      winner_participant_id: null
    });

    // Bracket reset match (only played if losers champion wins grand finals)
    matches.push({
      tournament_id: tournamentId,
      round: 1001,
      position: 1,
      participant1_id: null,
      participant2_id: null,
      winner_participant_id: null
    });

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
  };

  const reportWinner = async (matchId: string, winnerId: string): Promise<boolean> => {
    try {
      // Get tournament type first to determine advancement logic
      const { data: matchWithTournament, error: matchErr } = await supabase
        .from('bracket_matches')
        .select(`
          *,
          bracket_tournaments!inner (
            bracket_type
          )
        `)
        .eq('id', matchId)
        .single();

      if (matchErr) throw matchErr;

      const match = matchWithTournament as TournamentMatch & {
        bracket_tournaments: { bracket_type: 'single' | 'double' }
      };

      // Update the match with winner
      const { data: updatedMatch, error: updateErr } = await supabase
        .from('bracket_matches')
        .update({
          winner_participant_id: winnerId,
          updated_at: new Date().toISOString()
        })
        .eq('id', matchId)
        .select('*')
        .single();

      if (updateErr) throw updateErr;

      const updatedMatchData = updatedMatch as TournamentMatch;

      // Route to appropriate advancement logic
      if (match.bracket_tournaments.bracket_type === 'double') {
        return await reportWinnerDoubleElimination(updatedMatchData, winnerId);
      } else {
        return await reportWinnerSingleElimination(updatedMatchData, winnerId);
      }
    } catch (e) {
      console.error('Error reporting winner:', e);
      return false;
    }
  };

  // Single elimination winner advancement (existing logic)
  const reportWinnerSingleElimination = async (match: TournamentMatch, winnerId: string): Promise<boolean> => {
    try {
      // Check if this is the final match
      const { data: allMatches, error: allMatchesErr } = await supabase
        .from('bracket_matches')
        .select('round')
        .eq('tournament_id', match.tournament_id)
        .order('round', { ascending: false })
        .limit(1);

      if (allMatchesErr) throw allMatchesErr;

      const finalRound = allMatches?.[0]?.round || 0;

      if (match.round === finalRound) {
        // Tournament is complete
        await supabase
          .from('bracket_tournaments')
          .update({
            status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('id', match.tournament_id);

        return true;
      }

      // Find next round match to advance winner
      const nextRound = match.round + 1;
      const nextPosition = Math.ceil(match.position / 2);
      const isLeftSide = (match.position % 2) === 1;

      const { data: nextMatch, error: nextErr } = await supabase
        .from('bracket_matches')
        .select('*')
        .eq('tournament_id', match.tournament_id)
        .eq('round', nextRound)
        .eq('position', nextPosition)
        .maybeSingle();

      if (nextErr) throw nextErr;

      if (nextMatch) {
        const updateField = isLeftSide ? 'participant1_id' : 'participant2_id';
        await supabase
          .from('bracket_matches')
          .update({ [updateField]: winnerId })
          .eq('id', nextMatch.id);
      }

      return true;
    } catch (e) {
      console.error('Error in single elimination advancement:', e);
      return false;
    }
  };

  // Double elimination winner advancement (complex new logic)
  const reportWinnerDoubleElimination = async (match: TournamentMatch, winnerId: string): Promise<boolean> => {
    try {
      const { round, position, participant1_id, participant2_id } = match;
      const loserId = winnerId === participant1_id ? participant2_id : participant1_id;

      // GRAND FINALS LOGIC (1000-1001)
      if (round === 1000) {
        // First grand final match
        // Check if winner came from winners bracket (has never lost)
        const { data: winnerMatches, error: winnerMatchesErr } = await supabase
          .from('bracket_matches')
          .select('*')
          .eq('tournament_id', match.tournament_id)
          .or(`participant1_id.eq.${winnerId},participant2_id.eq.${winnerId}`)
          .gte('round', 100) // Check if winner played in losers bracket
          .not('winner_participant_id', 'is', null);

        if (winnerMatchesErr) throw winnerMatchesErr;

        const winnerHasLostBefore = winnerMatches && winnerMatches.length > 0;

        if (!winnerHasLostBefore) {
          // Winner from winners bracket wins - tournament over
          await supabase
            .from('bracket_tournaments')
            .update({
              status: 'completed',
              updated_at: new Date().toISOString()
            })
            .eq('id', match.tournament_id);
        } else {
          // Winner from losers bracket wins - bracket reset, play round 1001
          await supabase
            .from('bracket_matches')
            .update({
              participant1_id: loserId, // Original winners bracket champion
              participant2_id: winnerId, // Losers bracket champion who just won
              winner_participant_id: null
            })
            .eq('tournament_id', match.tournament_id)
            .eq('round', 1001)
            .eq('position', 1);
        }
        return true;
      }

      if (round === 1001) {
        // Bracket reset final - tournament complete regardless of winner
        await supabase
          .from('bracket_tournaments')
          .update({
            status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('id', match.tournament_id);
        return true;
      }

      // WINNERS BRACKET ADVANCEMENT (1-99)
      if (round < 100) {
        // Standard winners bracket advancement
        const nextRound = round + 1;
        const nextPosition = Math.ceil(position / 2);
        const isLeftSide = (position % 2) === 1;

        // Check if this is winners bracket final (advances to grand final)
        const { data: nextWinnersMatch, error: nextWinnersErr } = await supabase
          .from('bracket_matches')
          .select('*')
          .eq('tournament_id', match.tournament_id)
          .eq('round', nextRound)
          .eq('position', nextPosition)
          .lt('round', 100) // Still in winners bracket
          .maybeSingle();

        if (nextWinnersErr) throw nextWinnersErr;

        if (nextWinnersMatch) {
          // Advance to next winners bracket round
          const updateField = isLeftSide ? 'participant1_id' : 'participant2_id';
          await supabase
            .from('bracket_matches')
            .update({ [updateField]: winnerId })
            .eq('id', nextWinnersMatch.id);
        } else {
          // This was winners bracket final - advance to grand final
          await supabase
            .from('bracket_matches')
            .update({ participant1_id: winnerId })
            .eq('tournament_id', match.tournament_id)
            .eq('round', 1000)
            .eq('position', 1);
        }

        // LOSER DROPS TO LOSERS BRACKET
        if (loserId) {
          await advanceLoserToLosersBracket(match.tournament_id, round, position, loserId);
        }

        return true;
      }

      // LOSERS BRACKET ADVANCEMENT (100-999)
      if (round >= 100 && round < 1000) {
        const losersRound = round - 99; // Convert to 1-based losers round
        const nextLosersRound = losersRound + 1;
        const nextRound = 100 + nextLosersRound - 1;

        // Check if this is losers bracket final (advances to grand final)
        const { data: nextLosersMatch, error: nextLosersErr } = await supabase
          .from('bracket_matches')
          .select('*')
          .eq('tournament_id', match.tournament_id)
          .eq('round', nextRound)
          .eq('position', Math.ceil(position / 2))
          .maybeSingle();

        if (nextLosersErr) throw nextLosersErr;

        if (nextLosersMatch) {
          // Advance to next losers bracket round
          const isLeftSide = (position % 2) === 1;
          const updateField = isLeftSide ? 'participant1_id' : 'participant2_id';
          await supabase
            .from('bracket_matches')
            .update({ [updateField]: winnerId })
            .eq('id', nextLosersMatch.id);
        } else {
          // This was losers bracket final - advance to grand final
          await supabase
            .from('bracket_matches')
            .update({ participant2_id: winnerId })
            .eq('tournament_id', match.tournament_id)
            .eq('round', 1000)
            .eq('position', 1);
        }

        return true;
      }

      return true;
    } catch (e) {
      console.error('Error in double elimination advancement:', e);
      return false;
    }
  };

  // Helper function to drop losers from winners bracket into losers bracket
  const advanceLoserToLosersBracket = async (
    tournamentId: string,
    winnersRound: number,
    winnersPosition: number,
    loserId: string
  ): Promise<void> => {
    try {
      // Calculate target losers bracket position based on winners bracket elimination
      let targetLosersRound: number;
      let targetPosition: number;

      if (winnersRound === 1) {
        // First round losers go directly to losers bracket round 1
        targetLosersRound = 100; // Round 100 = losers round 1
        targetPosition = Math.ceil(winnersPosition / 2);
      } else {
        // Later round losers enter at specific positions
        // This is complex - losers from different winners rounds enter at different points
        const losersRoundNumber = (winnersRound - 1) * 2; // Approximate mapping
        targetLosersRound = 100 + losersRoundNumber - 1;
        targetPosition = Math.ceil(winnersPosition / 2);
      }

      // Find the target losers bracket match
      const { data: losersMatch, error: losersMatchErr } = await supabase
        .from('bracket_matches')
        .select('*')
        .eq('tournament_id', tournamentId)
        .eq('round', targetLosersRound)
        .eq('position', targetPosition)
        .maybeSingle();

      if (losersMatchErr) throw losersMatchErr;

      if (losersMatch) {
        // Determine which slot to fill (participant1 or participant2)
        let updateField: string;
        if (!losersMatch.participant1_id) {
          updateField = 'participant1_id';
        } else if (!losersMatch.participant2_id) {
          updateField = 'participant2_id';
        } else {
          // Both slots filled - this shouldn't happen in a properly structured bracket
          console.warn('Both participants already set in losers bracket match');
          return;
        }

        await supabase
          .from('bracket_matches')
          .update({ [updateField]: loserId })
          .eq('id', losersMatch.id);
      }
    } catch (e) {
      console.error('Error advancing loser to losers bracket:', e);
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
        hasWinner: matches?.some(m => m.winner_participant_id)
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

  const renameTournament = async (tournamentId: string, newName: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('bracket_tournaments')
        .update({
          name: newName.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', tournamentId);

      if (error) throw error;

      // Refresh the tournaments list
      await refresh();
      return true;
    } catch (e) {
      console.error('Failed to rename tournament', e);
      return false;
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
    deleteTournament,
    renameTournament
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
