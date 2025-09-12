import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface BracketCompetition {
  id: string;
  name: string;
  created_by: string;
  is_public: boolean;
  is_locked: boolean;
  status: 'draft' | 'active' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface BracketParticipant {
  id: string;
  competition_id: string;
  user_id: string | null;
  display_name: string;
  seed: number | null;
  created_at: string;
}

export interface BracketMatch {
  id: string;
  competition_id: string;
  round: number;
  position: number;
  participant1_id: string | null;
  participant2_id: string | null;
  winner_participant_id: string | null;
  status: 'pending' | 'in_progress' | 'completed';
  reported_by: string | null;
  reported_at: string | null;
  created_at: string;
  updated_at: string;
}

interface BracketContextType {
  competitions: BracketCompetition[];
  loading: boolean;
  refresh: () => Promise<void>;
  createCompetition: (name: string, is_public?: boolean) => Promise<BracketCompetition | null>;
  addParticipants: (competitionId: string, names: string[]) => Promise<boolean>;
  generateSingleElimination: (competitionId: string) => Promise<boolean>;
  reportResult: (matchId: string, winnerParticipantId: string) => Promise<boolean>;
}

const BracketContext = createContext<BracketContextType | undefined>(undefined);

export function BracketProvider({ children }: { children: React.ReactNode }) {
  const [competitions, setCompetitions] = useState<BracketCompetition[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bracket_competitions')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCompetitions(data as any);
    } catch (e) {
      console.error('Failed to load bracket competitions', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const createCompetition = async (name: string, is_public: boolean = false) => {
    try {
      const { data, error } = await supabase
        .from('bracket_competitions')
        .insert({ name, is_public })
        .select('*')
        .single();
      if (error) throw error;
      await refresh();
      return data as any;
    } catch (e) {
      console.error('createCompetition failed', e);
      return null;
    }
  };

  const addParticipants = async (competitionId: string, names: string[]) => {
    try {
      const rows = names
        .map(n => (n || '').trim())
        .filter(Boolean)
        .map(n => ({ competition_id: competitionId, display_name: n }));
      if (rows.length === 0) return true;
      const { error } = await supabase.from('bracket_participants').insert(rows);
      if (error) throw error;
      return true;
    } catch (e) {
      console.error('addParticipants failed', e);
      return false;
    }
  };

  // Simple single-elimination generator: pairs participants by seed/order
  const generateSingleElimination = async (competitionId: string) => {
    try {
      const { data: participants, error: pErr } = await supabase
        .from('bracket_participants')
        .select('*')
        .eq('competition_id', competitionId)
        .order('seed', { ascending: true })
        .order('created_at', { ascending: true });
      if (pErr) throw pErr;
      const list = (participants || []) as BracketParticipant[];
      if (list.length < 2) return false;

      // Determine first round size as next power of two
      const pow2 = 1 << Math.ceil(Math.log2(list.length));
      const padded = [...list];
      while (padded.length < pow2) padded.push({
        id: `bye-${padded.length}`, competition_id: competitionId, user_id: null, display_name: 'BYE', seed: null, created_at: new Date().toISOString()
      } as any);

      const matches: Partial<BracketMatch>[] = [];
      let position = 1;
      for (let i = 0; i < padded.length; i += 2) {
        matches.push({
          competition_id: competitionId,
          round: 1,
          position: position++,
          participant1_id: (padded[i] as any).id?.startsWith('bye-') ? null : padded[i].id,
          participant2_id: (padded[i+1] as any).id?.startsWith('bye-') ? null : padded[i+1].id,
          status: 'pending',
        } as any);
      }
      const { error: mErr } = await supabase.from('bracket_matches').insert(matches as any);
      if (mErr) throw mErr;

      return true;
    } catch (e) {
      console.error('generateSingleElimination failed', e);
      return false;
    }
  };

  const reportResult = async (matchId: string, winnerParticipantId: string) => {
    try {
      const { error } = await supabase
        .from('bracket_matches')
        .update({ winner_participant_id: winnerParticipantId, status: 'completed', reported_at: new Date().toISOString() })
        .eq('id', matchId);
      if (error) throw error;
      return true;
    } catch (e) {
      console.error('reportResult failed', e);
      return false;
    }
  };

  return (
    <BracketContext.Provider value={{ competitions, loading, refresh, createCompetition, addParticipants, generateSingleElimination, reportResult }}>
      {children}
    </BracketContext.Provider>
  );
}

export function useBrackets() {
  const ctx = useContext(BracketContext);
  if (!ctx) throw new Error('useBrackets must be used within a BracketProvider');
  return ctx;
}
