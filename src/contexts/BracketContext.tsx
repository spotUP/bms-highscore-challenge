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

// Type alias for BracketView compatibility
export type BracketMatch = TournamentMatch;

export interface BracketParticipant {
  id: string;
  name: string;
  display_name: string;
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
  autoAdvanceMatches: (tournamentId: string) => Promise<void>;
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

    console.log(`Creating double elimination bracket for ${playerCount} players (bracket size: ${bracketSize})`);
    console.log('Seeded players:', seededPlayers.map(p => p?.name || 'BYE'));

    // Clear any existing matches for this tournament to prevent conflicts
    console.log('Clearing existing matches...');
    await supabase
      .from('bracket_matches')
      .delete()
      .eq('tournament_id', tournamentId);

    // 1. WINNERS BRACKET (1-99): Standard single elimination with GUARANTEED player assignments
    let position = 1;
    for (let i = 0; i < seededPlayers.length; i += 2) {
      const p1 = seededPlayers[i];
      const p2 = seededPlayers[i + 1];

      const match = {
        tournament_id: tournamentId,
        round: 1,
        position: position++,
        participant1_id: p1?.id || null,
        participant2_id: p2?.id || null,
        winner_participant_id: null
      };

      console.log(`R1P${match.position}: ${p1?.name || 'BYE'} vs ${p2?.name || 'BYE'}`);
      matches.push(match);
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

    // 2. LOSERS BRACKET (100-199): Proper double elimination structure
    // The formula for losers bracket rounds is 2*(totalWinnersRounds-1)
    const totalLosersRounds = 2 * (totalWinnersRounds - 1);

    // Create losers bracket matches with proper structure based on tournament size
    let losersRoundNum = 100;

    // Optimized implementations for common tournament sizes
    if (totalWinnersRounds === 2) {
      // 4-PLAYER TOURNAMENT (2 winners rounds, 2 losers rounds)
      // L1: 1 match (2 losers from W1)
      matches.push({
        tournament_id: tournamentId,
        round: losersRoundNum,
        position: 1,
        participant1_id: null,
        participant2_id: null,
        winner_participant_id: null
      });
      losersRoundNum++;

      // L2: 1 match (L1 winner vs W2 loser - losers bracket final)
      matches.push({
        tournament_id: tournamentId,
        round: losersRoundNum,
        position: 1,
        participant1_id: null,
        participant2_id: null,
        winner_participant_id: null
      });

    } else if (totalWinnersRounds === 3) {
      // 8-PLAYER TOURNAMENT (3 winners rounds, 4 losers rounds)
      // L1: 2 matches (4 losers from W1)
      for (let pos = 1; pos <= 2; pos++) {
        matches.push({
          tournament_id: tournamentId,
          round: losersRoundNum,
          position: pos,
          participant1_id: null,
          participant2_id: null,
          winner_participant_id: null
        });
      }
      losersRoundNum++;

      // L2: 2 matches (L1 winners vs W2 losers)
      for (let pos = 1; pos <= 2; pos++) {
        matches.push({
          tournament_id: tournamentId,
          round: losersRoundNum,
          position: pos,
          participant1_id: null,
          participant2_id: null,
          winner_participant_id: null
        });
      }
      losersRoundNum++;

      // L3: 1 match (L2 winners)
      matches.push({
        tournament_id: tournamentId,
        round: losersRoundNum,
        position: 1,
        participant1_id: null,
        participant2_id: null,
        winner_participant_id: null
      });
      losersRoundNum++;

      // L4: 1 match (L3 winner vs W3 loser - losers bracket final)
      matches.push({
        tournament_id: tournamentId,
        round: losersRoundNum,
        position: 1,
        participant1_id: null,
        participant2_id: null,
        winner_participant_id: null
      });

    } else if (totalWinnersRounds === 4) {
      // 16-PLAYER TOURNAMENT (4 winners rounds, 6 losers rounds)
      // L1: 4 matches (8 losers from W1)
      for (let pos = 1; pos <= 4; pos++) {
        matches.push({
          tournament_id: tournamentId,
          round: losersRoundNum,
          position: pos,
          participant1_id: null,
          participant2_id: null,
          winner_participant_id: null
        });
      }
      losersRoundNum++;

      // L2: 4 matches (L1 winners vs W2 losers)
      for (let pos = 1; pos <= 4; pos++) {
        matches.push({
          tournament_id: tournamentId,
          round: losersRoundNum,
          position: pos,
          participant1_id: null,
          participant2_id: null,
          winner_participant_id: null
        });
      }
      losersRoundNum++;

      // L3: 2 matches (L2 winners)
      for (let pos = 1; pos <= 2; pos++) {
        matches.push({
          tournament_id: tournamentId,
          round: losersRoundNum,
          position: pos,
          participant1_id: null,
          participant2_id: null,
          winner_participant_id: null
        });
      }
      losersRoundNum++;

      // L4: 2 matches (L3 winners vs W3 losers)
      for (let pos = 1; pos <= 2; pos++) {
        matches.push({
          tournament_id: tournamentId,
          round: losersRoundNum,
          position: pos,
          participant1_id: null,
          participant2_id: null,
          winner_participant_id: null
        });
      }
      losersRoundNum++;

      // L5: 1 match (L4 winners)
      matches.push({
        tournament_id: tournamentId,
        round: losersRoundNum,
        position: 1,
        participant1_id: null,
        participant2_id: null,
        winner_participant_id: null
      });
      losersRoundNum++;

      // L6: 1 match (L5 winner vs W4 loser - losers bracket final)
      matches.push({
        tournament_id: tournamentId,
        round: losersRoundNum,
        position: 1,
        participant1_id: null,
        participant2_id: null,
        winner_participant_id: null
      });

    } else if (totalWinnersRounds === 5) {
      // 32-PLAYER TOURNAMENT (5 winners rounds, 8 losers rounds)
      // L1: 8 matches (16 losers from W1)
      for (let pos = 1; pos <= 8; pos++) {
        matches.push({
          tournament_id: tournamentId,
          round: losersRoundNum,
          position: pos,
          participant1_id: null,
          participant2_id: null,
          winner_participant_id: null
        });
      }
      losersRoundNum++;

      // L2: 8 matches (L1 winners vs W2 losers)
      for (let pos = 1; pos <= 8; pos++) {
        matches.push({
          tournament_id: tournamentId,
          round: losersRoundNum,
          position: pos,
          participant1_id: null,
          participant2_id: null,
          winner_participant_id: null
        });
      }
      losersRoundNum++;

      // L3: 4 matches (L2 winners)
      for (let pos = 1; pos <= 4; pos++) {
        matches.push({
          tournament_id: tournamentId,
          round: losersRoundNum,
          position: pos,
          participant1_id: null,
          participant2_id: null,
          winner_participant_id: null
        });
      }
      losersRoundNum++;

      // L4: 4 matches (L3 winners vs W3 losers)
      for (let pos = 1; pos <= 4; pos++) {
        matches.push({
          tournament_id: tournamentId,
          round: losersRoundNum,
          position: pos,
          participant1_id: null,
          participant2_id: null,
          winner_participant_id: null
        });
      }
      losersRoundNum++;

      // L5: 2 matches (L4 winners)
      for (let pos = 1; pos <= 2; pos++) {
        matches.push({
          tournament_id: tournamentId,
          round: losersRoundNum,
          position: pos,
          participant1_id: null,
          participant2_id: null,
          winner_participant_id: null
        });
      }
      losersRoundNum++;

      // L6: 2 matches (L5 winners vs W4 losers)
      for (let pos = 1; pos <= 2; pos++) {
        matches.push({
          tournament_id: tournamentId,
          round: losersRoundNum,
          position: pos,
          participant1_id: null,
          participant2_id: null,
          winner_participant_id: null
        });
      }
      losersRoundNum++;

      // L7: 1 match (L6 winners)
      matches.push({
        tournament_id: tournamentId,
        round: losersRoundNum,
        position: 1,
        participant1_id: null,
        participant2_id: null,
        winner_participant_id: null
      });
      losersRoundNum++;

      // L8: 1 match (L7 winner vs W5 loser - losers bracket final)
      matches.push({
        tournament_id: tournamentId,
        round: losersRoundNum,
        position: 1,
        participant1_id: null,
        participant2_id: null,
        winner_participant_id: null
      });

    } else {
      // Generic fallback for other tournament sizes
      for (let losersRound = 1; losersRound <= totalLosersRounds; losersRound++) {
        const round = 100 + losersRound - 1;

        let matchesInRound: number;
        if (losersRound === 1) {
          // First losers round: half the R1 losers
          matchesInRound = Math.pow(2, totalWinnersRounds - 2);
        } else if (losersRound % 2 === 0) {
          // Even rounds: new losers from winners bracket enter
          const winnersRoundLosing = Math.ceil(losersRound / 2) + 1;
          matchesInRound = Math.pow(2, totalWinnersRounds - winnersRoundLosing);
        } else {
          // Odd rounds: only losers bracket players
          const roundSet = Math.floor(losersRound / 2) + 1;
          matchesInRound = Math.pow(2, totalWinnersRounds - roundSet);
        }

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
    }

    // 3. GRAND FINALS (1000): Winners champion vs Losers champion
    // Single match - winner takes all, no bracket reset
    matches.push({
      tournament_id: tournamentId,
      round: 1000,
      position: 1,
      participant1_id: null, // Will be filled by winners bracket champion
      participant2_id: null, // Will be filled by losers bracket champion
      winner_participant_id: null
    });

    console.log(`About to insert ${matches.length} matches`);
    console.log('First round participant assignments:');
    matches.filter(m => m.round === 1).forEach(m => {
      console.log(`  R${m.round}P${m.position}: p1=${m.participant1_id}, p2=${m.participant2_id}`);
    });

    const { error: insertErr } = await supabase
      .from('bracket_matches')
      .insert(matches);

    if (insertErr) {
      console.error('Failed to insert double elimination matches:', insertErr);
      throw insertErr;
    }

    console.log('✅ Double elimination bracket created successfully');

    // Update tournament status to active
    await supabase
      .from('bracket_tournaments')
      .update({ status: 'active' })
      .eq('id', tournamentId);

    return true;
  };

  // Validation function to prevent advancing too far ahead
  const validateMatchAdvancement = async (match: TournamentMatch): Promise<string | null> => {
    try {
      // Get all matches in the tournament
      const { data: allMatches, error: matchesErr } = await supabase
        .from('bracket_matches')
        .select('*')
        .eq('tournament_id', match.tournament_id)
        .order('round', { ascending: true });

      if (matchesErr) throw matchesErr;

      // For winners bracket matches (rounds 1-99)
      if (match.round < 100) {
        // Check if there are incomplete matches in earlier rounds
        const earlierIncompleteMatches = allMatches.filter(m =>
          m.round < match.round &&
          m.round < 100 && // Only winners bracket
          m.participant1_id &&
          m.participant2_id &&
          !m.winner_participant_id
        );

        if (earlierIncompleteMatches.length > 0) {
          return `Please complete round ${earlierIncompleteMatches[0].round} matches before advancing to round ${match.round}.`;
        }
      }

      // For losers bracket matches (rounds 100-999)
      if (match.round >= 100 && match.round < 1000) {
        // Check if there are incomplete matches in earlier losers rounds
        const earlierLosersIncompleteMatches = allMatches.filter(m =>
          m.round >= 100 &&
          m.round < match.round &&
          m.round < 1000 && // Only losers bracket
          m.participant1_id &&
          m.participant2_id &&
          !m.winner_participant_id
        );

        if (earlierLosersIncompleteMatches.length > 0) {
          const losersRound = earlierLosersIncompleteMatches[0].round - 100 + 1;
          return `Please complete losers bracket round L${losersRound} matches before advancing further.`;
        }

        // Also check if winners bracket should feed into this losers round
        const currentLosersRound = match.round - 100 + 1;
        if (currentLosersRound % 2 === 0) { // Even losers rounds receive winners bracket dropdowns
          const feedingWinnersRound = Math.ceil(currentLosersRound / 2) + 1;
          const winnersMatches = allMatches.filter(m =>
            m.round === feedingWinnersRound &&
            m.participant1_id &&
            m.participant2_id &&
            !m.winner_participant_id
          );

          if (winnersMatches.length > 0) {
            return `Please complete winners bracket round ${feedingWinnersRound} matches first - they feed into this losers bracket round.`;
          }
        }
      }

      // For Grand Final (round 1000)
      if (match.round === 1000) {
        // Check that both winners and losers bracket champions are determined
        const winnersChampionMatches = allMatches.filter(m =>
          m.round < 100 &&
          m.participant1_id &&
          m.participant2_id &&
          !m.winner_participant_id
        );

        const losersChampionMatches = allMatches.filter(m =>
          m.round >= 100 &&
          m.round < 1000 &&
          m.participant1_id &&
          m.participant2_id &&
          !m.winner_participant_id
        );

        if (winnersChampionMatches.length > 0) {
          return `Please complete all winners bracket matches before the Grand Final.`;
        }

        if (losersChampionMatches.length > 0) {
          return `Please complete all losers bracket matches before the Grand Final.`;
        }
      }

      return null; // No validation errors
    } catch (e) {
      console.error('Error validating match advancement:', e);
      return null; // Allow the match to proceed if validation fails
    }
  };

  // Auto-advance single participant matches
  const autoAdvanceSingleParticipantMatches = async (tournamentId: string): Promise<void> => {
    try {
      const { data: singleParticipantMatches, error } = await supabase
        .from('bracket_matches')
        .select('*')
        .eq('tournament_id', tournamentId)
        .is('winner_participant_id', null)
        .or('and(participant1_id.not.is.null,participant2_id.is.null),and(participant1_id.is.null,participant2_id.not.is.null)');

      if (error) throw error;

      console.log(`🔄 Found ${singleParticipantMatches?.length || 0} single-participant matches to auto-advance`);

      for (const match of singleParticipantMatches || []) {
        const winnerId = match.participant1_id || match.participant2_id;
        if (winnerId) {
          console.log(`🤖 Auto-advancing ${winnerId} in ${match.round >= 100 ? `L${match.round - 99}` : `R${match.round}`}P${match.position}`);

          // Set the winner for this match
          await supabase
            .from('bracket_matches')
            .update({
              winner_participant_id: winnerId,
              updated_at: new Date().toISOString()
            })
            .eq('id', match.id);

          // Manually call advancement logic for this match
          const matchWithTournament = { ...match, bracket_tournaments: { bracket_type: 'double' } } as any;
          await reportWinnerDoubleElimination(matchWithTournament, winnerId);
        }
      }
    } catch (e) {
      console.error('Error auto-advancing single participant matches:', e);
    }
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

      // Validate that we're not advancing too far ahead
      const validationError = await validateMatchAdvancement(matchWithTournament);
      if (validationError) {
        throw new Error(validationError);
      }

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

      // GRAND FINALS LOGIC (1000) - Single winner, no bracket reset
      if (round === 1000) {
        // Grand final match - whoever wins is the tournament champion
        // Complete the tournament regardless of who wins
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

        // Calculate next position - fix for 8-player double elimination
        let nextPosition: number;

        // Special handling for L2 → L3 in double elimination
        // In L2 there are 2 matches, but L3 has only 1 match
        // Both L2 winners should go to the single L3 match
        if (losersRound === 2 && nextLosersRound === 3) {
          nextPosition = 1;
        } else {
          // Default behavior for other rounds
          nextPosition = Math.ceil(position / 2);
        }

        // Check if this is losers bracket final (advances to grand final)
        console.log(`🔍 LOSERS BRACKET: L${losersRound} → L${nextLosersRound}, looking for round ${nextRound} position ${nextPosition}`);

        const { data: nextLosersMatch, error: nextLosersErr } = await supabase
          .from('bracket_matches')
          .select('*')
          .eq('tournament_id', match.tournament_id)
          .eq('round', nextRound)
          .eq('position', nextPosition)
          .maybeSingle();

        if (nextLosersErr) throw nextLosersErr;

        console.log(`🔍 LOSERS BRACKET: Next match found:`, nextLosersMatch ? 'YES' : 'NO (advancing to Grand Final)');

        if (nextLosersMatch) {
          // Determine which slot to fill
          let updateField: 'participant1_id' | 'participant2_id';

          // Special handling for L2 → L3: assign based on L2 position
          if (losersRound === 2 && nextLosersRound === 3) {
            // L2 position 1 winner → participant1_id, L2 position 2 winner → participant2_id
            updateField = position === 1 ? 'participant1_id' : 'participant2_id';
          } else {
            // Default behavior: alternate sides based on position
            const isLeftSide = (position % 2) === 1;
            updateField = isLeftSide ? 'participant1_id' : 'participant2_id';
          }

          await supabase
            .from('bracket_matches')
            .update({ [updateField]: winnerId })
            .eq('id', nextLosersMatch.id);
        } else {
          // This was losers bracket final - advance to grand final
          console.log(`🏆 LOSERS BRACKET FINAL: Advancing winner ${winnerId} to Grand Final`);
          const { data: grandFinalUpdate, error: grandFinalErr } = await supabase
            .from('bracket_matches')
            .update({ participant2_id: winnerId })
            .eq('tournament_id', match.tournament_id)
            .eq('round', 1000)
            .eq('position', 1)
            .select('*')
            .single();

          if (grandFinalErr) {
            console.error('🚨 GRAND FINAL UPDATE ERROR:', grandFinalErr);
            throw grandFinalErr;
          }

          console.log(`🏆 GRAND FINAL UPDATED:`, grandFinalUpdate);
        }

        return true;
      }

      // After any match completion, check for auto-advancement opportunities
      await autoAdvanceSingleParticipantMatches(match.tournament_id);

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
      // Get tournament info to determine total winners rounds
      const { data: matches } = await supabase
        .from('bracket_matches')
        .select('round')
        .eq('tournament_id', tournamentId)
        .lt('round', 100) // Only winners bracket
        .order('round', { ascending: false })
        .limit(1);

      const totalWinnersRounds = matches?.[0]?.round || 3; // Default to 8-player if not found

      // Calculate target losers bracket position based on tournament size and winners round
      let targetLosersRound: number;
      let targetPosition: number;
      let targetSlot: 'participant1_id' | 'participant2_id';

      if (totalWinnersRounds === 2) {
        // 4-PLAYER TOURNAMENT
        if (winnersRound === 1) {
          // W1 losers -> L1 (round 100)
          targetLosersRound = 100;
          targetPosition = 1;
          targetSlot = winnersPosition === 1 ? 'participant1_id' : 'participant2_id';
        } else {
          // W2 loser -> L2 (round 101)
          targetLosersRound = 101;
          targetPosition = 1;
          targetSlot = 'participant2_id';
        }

      } else if (totalWinnersRounds === 3) {
        // 8-PLAYER TOURNAMENT
        if (winnersRound === 1) {
          // W1 losers -> L1 (round 100)
          targetLosersRound = 100;
          targetPosition = Math.ceil(winnersPosition / 2);
          targetSlot = (winnersPosition % 2 === 1) ? 'participant1_id' : 'participant2_id';
        } else if (winnersRound === 2) {
          // W2 losers -> L2 (round 101)
          targetLosersRound = 101;
          targetPosition = winnersPosition;
          targetSlot = 'participant2_id';
        } else {
          // W3 loser -> L4 (round 103)
          targetLosersRound = 103;
          targetPosition = 1;
          targetSlot = 'participant2_id';
        }

      } else if (totalWinnersRounds === 4) {
        // 16-PLAYER TOURNAMENT
        if (winnersRound === 1) {
          // W1 losers -> L1 (round 100)
          targetLosersRound = 100;
          targetPosition = Math.ceil(winnersPosition / 2);
          targetSlot = (winnersPosition % 2 === 1) ? 'participant1_id' : 'participant2_id';
        } else if (winnersRound === 2) {
          // W2 losers -> L2 (round 101)
          targetLosersRound = 101;
          targetPosition = winnersPosition;
          targetSlot = 'participant2_id';
        } else if (winnersRound === 3) {
          // W3 losers -> L4 (round 103)
          targetLosersRound = 103;
          targetPosition = winnersPosition;
          targetSlot = 'participant2_id';
        } else {
          // W4 loser -> L6 (round 105)
          targetLosersRound = 105;
          targetPosition = 1;
          targetSlot = 'participant2_id';
        }

      } else if (totalWinnersRounds === 5) {
        // 32-PLAYER TOURNAMENT
        if (winnersRound === 1) {
          // W1 losers -> L1 (round 100)
          targetLosersRound = 100;
          targetPosition = Math.ceil(winnersPosition / 2);
          targetSlot = (winnersPosition % 2 === 1) ? 'participant1_id' : 'participant2_id';
        } else if (winnersRound === 2) {
          // W2 losers -> L2 (round 101)
          targetLosersRound = 101;
          targetPosition = winnersPosition;
          targetSlot = 'participant2_id';
        } else if (winnersRound === 3) {
          // W3 losers -> L4 (round 103)
          targetLosersRound = 103;
          targetPosition = winnersPosition;
          targetSlot = 'participant2_id';
        } else if (winnersRound === 4) {
          // W4 losers -> L6 (round 105)
          targetLosersRound = 105;
          targetPosition = winnersPosition;
          targetSlot = 'participant2_id';
        } else {
          // W5 loser -> L8 (round 107)
          targetLosersRound = 107;
          targetPosition = 1;
          targetSlot = 'participant2_id';
        }

      } else {
        // Generic fallback for other tournament sizes
        if (winnersRound === 1) {
          targetLosersRound = 100;
          targetPosition = Math.ceil(winnersPosition / 2);
          targetSlot = (winnersPosition % 2 === 1) ? 'participant1_id' : 'participant2_id';
        } else if (winnersRound === totalWinnersRounds) {
          // Finals loser goes to last losers round
          targetLosersRound = 100 + (2 * (totalWinnersRounds - 1)) - 1;
          targetPosition = 1;
          targetSlot = 'participant2_id';
        } else {
          // Middle rounds
          const losersRoundNumber = (winnersRound - 1) * 2;
          targetLosersRound = 100 + losersRoundNumber - 1;
          targetPosition = winnersPosition;
          targetSlot = 'participant2_id';
        }
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
        // Use the calculated target slot
        await supabase
          .from('bracket_matches')
          .update({ [targetSlot]: loserId })
          .eq('id', losersMatch.id);
      } else {
        console.warn(`Could not find losers bracket match at round ${targetLosersRound}, position ${targetPosition}`);
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
    renameTournament,
    autoAdvanceMatches: autoAdvanceSingleParticipantMatches
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
