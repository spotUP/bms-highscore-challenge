import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useBrackets, Tournament, TournamentPlayer, TournamentMatch } from '@/contexts/BracketContext';
import { useAuth } from '@/hooks/useAuth';
import { usePerformanceMode } from '@/hooks/usePerformanceMode';
import { useToast } from '@/components/ui/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { supabase } from '@/integrations/supabase/client';
import BracketView, { BracketViewRef } from '@/components/BracketView';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import AdvancedConfetti from '@/components/AdvancedConfetti';
import { createPortal } from 'react-dom';
import { Check, Plus, BarChart3, Gamepad2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import BracketAnalytics from '@/components/BracketAnalytics';
import BracketDebugger from '@/components/BracketDebugger';
import { FightingGamesSuggestionsModal } from '@/components/FightingGamesSuggestionsModal';
import { ArcadeGamesSuggestionsModal } from '@/components/ArcadeGamesSuggestionsModal';

interface BracketAdminProps {
  isExiting?: boolean;
}

// Helper function to check if tournament is complete
const checkTournamentComplete = (matches: TournamentMatch[], bracketType: 'single' | 'double'): boolean => {
  if (bracketType === 'single') {
    // Single elimination: tournament is complete when round 1000 (grand final) has a winner
    const grandFinal = matches.find(m => m.round === 1000);

    if (!grandFinal) {
      return false;
    }

    if (!grandFinal.winner_participant_id) {
      return false;
    }

    // CRITICAL FIX: Ensure Grand Final has both participants before considering it complete
    if (!grandFinal.participant1_id || !grandFinal.participant2_id) {
      return false;
    }

    return true;
  } else {
    // Double elimination: more complex logic
    const grandFinal = matches.find(m => m.round === 1000);
    const bracketReset = matches.find(m => m.round === 1001);

    if (!grandFinal) {
      return false;
    }

    if (!grandFinal.winner_participant_id) {
      return false;
    }

    // CRITICAL FIX: Ensure Grand Final has both participants before considering it complete
    if (!grandFinal.participant1_id || !grandFinal.participant2_id) {
      return false;
    }

    if (!bracketReset) {
      return true;
    }

    if (bracketReset.winner_participant_id) {
      return true;
    }

    return false;
  }
};

// Helper function to get the tournament winner
const getTournamentWinner = (matches: TournamentMatch[], players: TournamentPlayer[]): TournamentPlayer | null => {
  // Check if bracket reset (round 1001) exists and is completed
  const bracketReset = matches.find(m => m.round === 1001);
  if (bracketReset?.winner_participant_id) {
    return players.find(p => p.id === bracketReset.winner_participant_id) || null;
  }

  // Otherwise, check grand final (round 1000)
  const grandFinal = matches.find(m => m.round === 1000);
  if (grandFinal?.winner_participant_id) {
    return players.find(p => p.id === grandFinal.winner_participant_id) || null;
  }

  return null;
};

const BracketAdmin: React.FC<BracketAdminProps> = ({ isExiting = false }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { enableAnimations } = usePerformanceMode();

  // Prevent page scrolling on this admin page
  useEffect(() => {
    // Save original overflow style
    const originalOverflow = document.body.style.overflow;
    // Prevent page scrolling
    document.body.style.overflow = 'hidden';

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const { tournaments, loading, refresh, createTournament, addPlayers, generateBracket, reportWinner, getTournamentData, deleteTournament } = useBrackets();

  const [form, setForm] = useState({ name: '', bracketType: 'single' as 'single' | 'double' });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selected, setSelected] = useState<Tournament | null>(null);
  const [playerBlock, setPlayerBlock] = useState('');
  const [quickBlock, setQuickBlock] = useState('');
  const [quickRunning, setQuickRunning] = useState(false);
  const [players, setPlayers] = useState<TournamentPlayer[]>([]);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [loadingBracket, setLoadingBracket] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);
  const [restartLoading, setRestartLoading] = useState(false);
  const [winnerOpen, setWinnerOpen] = useState(false);
  const [winnerName, setWinnerName] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [bracketZoomAnimation, setBracketZoomAnimation] = useState(false);
  const [highlightTarget, setHighlightTarget] = useState<{ round: number; position: number } | null>(null);
  const [navigationModalOpen, setNavigationModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [lastProcessedTournamentId, setLastProcessedTournamentId] = useState<string | null>(null);
  const [processingMatchId, setProcessingMatchId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'bracket' | 'analytics' | 'debug'>('bracket');
  const bracketViewRef = useRef<BracketViewRef>(null);
  const hasAutoSelectedRef = useRef(false);
  const tournamentNameInputRef = useRef<HTMLInputElement>(null);
  const [showShareLinkDialog, setShowShareLinkDialog] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [showFightingGamesModal, setShowFightingGamesModal] = useState(false);
  const [showArcadeGamesModal, setShowArcadeGamesModal] = useState(false);

  const ownedTournaments = useMemo(() => tournaments.filter(t => t.created_by === user?.id), [tournaments, user?.id]);

  // Check if current tournament is complete
  const isTournamentComplete = useMemo(() => {
    if (!selected || matches.length === 0) return false;
    return checkTournamentComplete(matches, selected.bracket_type || 'single');
  }, [selected, matches]);


  useEffect(() => {
    if (!loading) {
      const currentSelected = selected && ownedTournaments.find(t => t.id === selected.id);

      if (currentSelected) {
        // Keep current selection if it's still valid
        setSelected(currentSelected);
      } else if (!hasAutoSelectedRef.current && !selected) {
        // Auto-select the most recent finished tournament if no tournament is selected
        // (only do this once when first loading the page)
        const finishedTournaments = ownedTournaments.filter(t => t.status === 'completed');
        if (finishedTournaments.length > 0) {
          // Sort by updated_at (most recent first) and select the first one
          const mostRecentFinished = finishedTournaments.sort((a, b) =>
            new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
          )[0];
          setSelected(mostRecentFinished);
          hasAutoSelectedRef.current = true;
        }
      }
    }
  }, [loading, ownedTournaments]);

  useEffect(() => {
    if (!selected) {
      setQuickBlock('');
      setLastProcessedTournamentId(null);
      return;
    }

    // Only update if we haven't processed this tournament ID yet
    if (selected.id === lastProcessedTournamentId) return;

    setForm({ name: selected.name || '', bracketType: selected.bracket_type || 'single' });

    const load = async () => {
      setLoadingBracket(true);
      try {
        const data = await getTournamentData(selected.id);
        setPlayers(data.players);
        setMatches(data.matches);

        // Update quickBlock with player names, one per line
        if (data.players.length > 0) {
          const playerNames = data.players.map(p => p.name).join('\n');
          setQuickBlock(playerNames);
        } else {
          setQuickBlock('');
        }

        // Mark this tournament as processed
        setLastProcessedTournamentId(selected.id);
      } finally {
        setLoadingBracket(false);
      }
    };
    load();
  }, [selected, getTournamentData, lastProcessedTournamentId]);

  // Real-time subscription for match updates
  useEffect(() => {
    if (!selected) return;


    const channel = supabase
      .channel(`bracket_matches_admin_${selected.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'bracket_matches',
        filter: `tournament_id=eq.${selected.id}`
      }, async (payload) => {

        // Optimistic update for faster response
        if (payload.eventType === 'UPDATE' && payload.new) {
          const updatedMatch = payload.new as TournamentMatch;
          setMatches(prevMatches =>
            prevMatches.map(match =>
              match.id === updatedMatch.id ? updatedMatch : match
            )
          );
        }

        // Also do a full refresh to ensure consistency
        try {
          const data = await getTournamentData(selected.id);
          setPlayers(data.players);
          setMatches(data.matches);
        } catch (error) {
          console.error('🔄 BracketAdmin: Error refreshing data:', error);
        }
      })
      .subscribe((status) => {
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selected, getTournamentData]);

  // Auto-save player changes when quickBlock is edited
  useEffect(() => {
    if (!selected || !quickBlock.trim()) return;

    // DON'T auto-save if tournament already has matches (started/completed tournaments)
    if (matches.length > 0) return;

    // Debounce the save operation - wait 1 second after user stops typing
    const timeoutId = setTimeout(async () => {
      const names = quickBlock
        .split(/[\n,;]+/)
        .map(name => name.trim())
        .filter(Boolean);

      if (names.length < 2) return;

      try {
        // First remove all existing players
        await Promise.all(
          players.map(player =>
            supabase.from('bracket_players').delete().eq('id', player.id)
          )
        );

        // Then add the new players
        const playerRows = names.map(name => ({
          tournament_id: selected.id,
          name
        }));

        const { error } = await supabase
          .from('bracket_players')
          .insert(playerRows);

        if (error) throw error;

        // Refresh the tournament data
        const data = await getTournamentData(selected.id);
        setPlayers(data.players);
        setMatches(data.matches);
      } catch (e) {
        console.error('Auto-save failed:', e);
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(timeoutId);
  }, [quickBlock, selected, players, matches.length, getTournamentData]);

  // Auto-focus tournament name input when create form is shown
  useEffect(() => {
    if (showCreateForm && tournamentNameInputRef.current) {
      // Use setTimeout to ensure the input is rendered before focusing
      setTimeout(() => {
        tournamentNameInputRef.current?.focus();
      }, 100);
    }
  }, [showCreateForm]);

  const handleCreate = async () => {
    if (!user) {
      toast({ title: 'Authentication required', description: 'Please log in to create tournaments', variant: 'destructive' });
      return null;
    }
    if (!form.name.trim()) {
      toast({ title: 'Name required', description: 'Enter a tournament name', variant: 'destructive' });
      return null;
    }
    const tournament = await createTournament(form.name.trim(), form.bracketType);
    if (tournament) {
      toast({ title: 'Created', description: 'Tournament created' });
      setForm({ name: '', bracketType: 'single' });
    }
    return tournament;
  };

  const handleAddPlayers = async () => {
    if (!user) {
      toast({ title: 'Authentication required', description: 'Please log in to add players', variant: 'destructive' });
      return;
    }
    if (!selected) return;
    const names = playerBlock.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (names.length === 0) {
      toast({ title: 'No names', description: 'Paste one name per line', variant: 'destructive' });
      return;
    }
    const ok = await addPlayers(selected.id, names);
    if (ok) {
      toast({ title: 'Players added', description: `${names.length} added` });
      setPlayerBlock('');
      const data = await getTournamentData(selected.id);
      setPlayers(data.players);
    }
  };

  const handleQuickStart = async () => {
    if (!user) {
      toast({ title: 'Authentication required', description: 'Please log in to use quick start', variant: 'destructive' });
      return;
    }
    if (!selected) {
      toast({ title: 'Select a tournament', description: 'Choose a tournament first', variant: 'destructive' });
      return;
    }
    const names = quickBlock.split(/\r?\n|;|,/).map(s => s.trim()).filter(Boolean);
    if (names.length < 2) {
      toast({ title: 'Add at least two names', description: 'Paste one name per line (or separated by ; ,)', variant: 'destructive' });
      return;
    }
    setQuickRunning(true);
    try {
      const ok = await addPlayers(selected.id, names);
      if (!ok) throw new Error('Failed to add players');
      
      const okGen = await generateBracket(selected.id);
      if (!okGen) throw new Error('Failed to generate bracket');
      
      const data = await getTournamentData(selected.id);
      setPlayers(data.players);
      setMatches(data.matches);

      // Verify bracket was actually generated
      if (!data.matches || data.matches.length === 0) {
        throw new Error('Bracket generation failed - no matches created');
      }

      setQuickBlock('');
      const shareUrl = `${window.location.origin}/competition?tournament=${selected.id}`;

      // Show share link dialog instead of toast
      setShareUrl(shareUrl);
      setShowShareLinkDialog(true);

      // Show initial success toast
      toast({
        title: 'Bracket Tournament ready',
        description: `Players added and bracket generated (${data.matches.length} matches)`,
      });
    } catch (e: any) {
      toast({ title: 'Quick start failed', description: e?.message || 'Please try again', variant: 'destructive' });
    } finally {
      setQuickRunning(false);
    }
  };



  const handleRandomizeNames = () => {
    if (!quickBlock.trim()) return;

    const names = quickBlock
      .split(/[\n,;]+/)
      .map(name => name.trim())
      .filter(Boolean);

    if (names.length < 2) return;

    // Fisher-Yates shuffle algorithm
    const shuffled = [...names];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    setQuickBlock(shuffled.join('\n'));
  };

  const onReportClick = async (matchId: string, winnerId: string) => {
    if (!selected) return;

    // Store original matches for potential rollback
    const originalMatches = [...matches];

    // Set processing state immediately for visual feedback
    setProcessingMatchId(matchId);

    // Immediate UI feedback before any async operations
    toast({ title: 'Reporting result...', description: 'Processing match completion' });

    // Optimistically update the UI
    const optimisticMatches = matches.map(m =>
      m.id === matchId ? { ...m, winner_participant_id: winnerId, status: 'completed' as const } : m
    );
    setMatches(optimisticMatches);

    try {
      const ok = await reportWinner(matchId, winnerId);
      if (ok) {
        toast({ title: 'Result reported', description: 'Match completed' });
        if (!selected) return;

        // Get updated data
        const data = await getTournamentData(selected.id);
        setPlayers(data.players);
        setMatches(data.matches);

        // Check if this was the final match that determines the tournament winner
        const isTournamentComplete = checkTournamentComplete(data.matches, selected?.bracket_type || 'single');
        if (isTournamentComplete) {
          const tournamentWinner = getTournamentWinner(data.matches, data.players);
          if (tournamentWinner) {
            // Center on final match first, then start zoom animation
            bracketViewRef.current?.centerOnFinal();

            // Small delay to let centering finish, then start zoom animation
            setTimeout(() => {
              setBracketZoomAnimation(true);
              setTimeout(() => {
                setBracketZoomAnimation(false);
                setWinnerName(tournamentWinner.name);
                setWinnerOpen(true);
                setShowConfetti(true);
                // Reset processed tournament ID so tournament can reload properly if user switches away and back
                setLastProcessedTournamentId(null);
              }, 2000); // 2 seconds for the zoom animation
            }, 200); // 200ms delay for centering
          }
        }
      } else {
        toast({
          title: 'Failed to report result',
          description: 'Please try again',
          variant: 'destructive'
        });
        // Revert optimistic update on failure
        setMatches(originalMatches);
      }
    } catch (error) {
      console.error('Error reporting winner:', error);
      toast({
        title: 'Failed to report result',
        description: 'Please try again',
        variant: 'destructive'
      });
      // Revert optimistic update on error
      setMatches(originalMatches);
    } finally {
      // Clear processing state
      setProcessingMatchId(null);
    }
  };

  const onPlayerClick = (matchId: string, participantId: string, participantName: string) => {
    // Player clicks should only be used for winner reporting, not for showing winner announcements
    // Winner announcements are handled properly in onReportClick with fresh data
  };

  const handleRestart = async () => {
    if (!selected) return;
    setRestartLoading(true);
    try {
      await supabase.from('bracket_matches').delete().eq('tournament_id', selected.id);
      await supabase.from('bracket_tournaments').update({ status: 'draft' }).eq('id', selected.id);
      
      const data = await getTournamentData(selected.id);
      setPlayers(data.players);
      setMatches(data.matches);
      await refresh();
      
      toast({ title: 'Bracket Tournament restarted', description: 'All matches cleared. Generate a new bracket when ready.' });
    } catch (e) {
      toast({ title: 'Failed to restart', description: 'Please try again', variant: 'destructive' });
    } finally {
      setRestartLoading(false);
      setRestartOpen(false);
    }
  };

  const handleDeleteTournament = async () => {
    if (!user) {
      toast({ title: 'Authentication required', description: 'Please log in to delete tournaments', variant: 'destructive' });
      return;
    }
    if (!selected) return;
    setDeleting(true);
    try {
      const success = await deleteTournament(selected.id);
      if (success) {
        toast({ title: 'Tournament deleted', description: 'The tournament has been deleted.' });
        setSelected(null);
        setQuickBlock('');
      } else {
        throw new Error('Failed to delete tournament');
      }
    } catch (e) {
      toast({ 
        title: 'Failed to delete tournament', 
        description: 'An error occurred while deleting the tournament.',
        variant: 'destructive' 
      });
    } finally {
      setDeleting(false);
      setDeleteConfirmOpen(false);
    }
  };

  // Map players and matches into BracketView-compatible shapes
  const participantMap = useMemo(() => {
    const map: Record<string, any> = {};
    players.forEach(p => {
      map[p.id] = { id: p.id, display_name: p.name, name: p.name };
    });
    return map;
  }, [players]);

  const bracketMatches = useMemo(() => {
    return matches.map(m => ({
      id: m.id,
      tournament_id: m.tournament_id,
      round: m.round,
      position: m.position,
      participant1_id: m.participant1_id,
      participant2_id: m.participant2_id,
      winner_participant_id: m.winner_participant_id,
      status: m.winner_participant_id ? 'completed' : 'pending'
    }));
  }, [matches]);

  // Parse quickBlock names for preview when players haven't been saved yet
  const quickNamesList = useMemo(() => {
    const names = quickBlock
      .split(/[\r\n;,]+/)
      .map(s => s.trim())
      .filter(Boolean);
    return names;
  }, [quickBlock]);

  // Stable temp ID for preview participants derived from their name
  const makeTempId = (name: string) => `temp-${encodeURIComponent(name.toLowerCase())}`;

  // Build participants map for preview: merge real players with temporary quick names
  const previewParticipants = useMemo(() => {
    const map: Record<string, any> = { ...participantMap };
    // Ensure every id used by previewMatches has a participant entry
    const sourceList: { id: string; name: string }[] = quickNamesList.length >= 2
      ? quickNamesList.map((name) => ({ id: makeTempId(name), name }))
      : players.map(p => ({ id: p.id, name: p.name }));
    sourceList.forEach(({ id, name }) => {
      if (!map[id]) {
        map[id] = { id, display_name: name, name };
      }
    });
    return map;
  }, [participantMap, players, quickNamesList]);

  // Generate preview bracket matches for live preview when editing player names
  const generatePreviewMatches = (playerList: { id: string; name: string }[]) => {
    if (playerList.length < 2) return [];

    const matches = [];
    const numPlayers = playerList.length;
    const numRounds = Math.ceil(Math.log2(numPlayers));

    // Create first round matches
    let currentRound = 1;
    let position = 1;

    for (let i = 0; i < numPlayers; i += 2) {
      const participant1 = playerList[i];
      const participant2 = playerList[i + 1] || null; // Handle odd number of players

      matches.push({
        id: `preview-${currentRound}-${position}`,
        tournament_id: selected?.id || 'preview',
        round: currentRound,
        position: position,
        participant1_id: participant1.id,
        participant2_id: participant2?.id || null,
        winner_participant_id: null,
        status: 'pending' as const
      });

      position++;
    }

    // Generate subsequent rounds (empty for preview)
    for (let round = 2; round <= numRounds; round++) {
      const matchesInRound = Math.pow(2, numRounds - round);
      for (let pos = 1; pos <= matchesInRound; pos++) {
        matches.push({
          id: `preview-${round}-${pos}`,
          tournament_id: selected?.id || 'preview',
          round: round,
          position: pos,
          participant1_id: null,
          participant2_id: null,
          winner_participant_id: null,
          status: 'pending' as const
        });
      }
    }

    return matches;
  };

  // Generate preview matches when editing names
  const previewMatches = useMemo(() => {
    if (!selected) return [];

    // If we have actual matches, use those
    if (matches.length > 0) return bracketMatches;

    // Otherwise generate preview matches from quickNamesList or players
    const sourceList = quickNamesList.length >= 2
      ? quickNamesList.map((name) => ({ id: makeTempId(name), name }))
      : players.length >= 2
        ? players.map(p => ({ id: p.id, name: p.name }))
        : [];

    const generatedMatches = generatePreviewMatches(sourceList);
    return generatedMatches;
  }, [selected, matches.length, bracketMatches, quickNamesList, players]);

  return (
    <div className={`h-[calc(100dvh-5rem)] overflow-hidden flex flex-col ${enableAnimations ? (isExiting ? 'animate-slide-out-bottom' : 'animate-slide-in-bottom') : ''}`}>
      {/* Desktop two-column layout */}
      <div className="grid grid-cols-12 gap-2 flex-1 min-h-0 overflow-hidden p-1">
      <div className="col-span-12 lg:col-span-4 xl:col-span-3 space-y-2 min-h-0 h-full"><div className="h-full min-h-0">
      {/* Unified Left Panel */}
      <Card className="h-full flex flex-col overflow-hidden bg-black/20 backdrop-blur-sm border-white/10">
        <CardContent className="flex-1 min-h-0 overflow-auto space-y-3 p-3">
          {/* Select/Create Tournament */}
          <section className="space-y-1.5">
            <h3 className="text-sm font-semibold text-gray-200">Tournament</h3>
            <Select
              value={showCreateForm ? 'CREATE_NEW' : (selected?.id || '')}
              onValueChange={(value) => {
                if (value === 'CREATE_NEW') {
                  setShowCreateForm(true);
                  setSelected(null);
                  setForm({ name: '', bracketType: 'single' });
                } else {
                  setShowCreateForm(false);
                  const tour = ownedTournaments.find(t => t.id === value);
                  if (tour) {
                    setSelected(tour);
                    setForm({ name: tour.name, bracketType: tour.bracket_type });
                  }
                }
              }}
            >
              <SelectTrigger className="w-full bg-black/50 border-white/20 text-white">
                <SelectValue placeholder="Choose tournament…" />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-white/20">
                {ownedTournaments.map(t => (
                  <SelectItem
                    key={t.id}
                    value={t.id}
                    className="text-white focus:bg-gray-800 focus:text-white"
                  >
                    <div className="flex items-center gap-2">
                      <span>{t.name}</span>
                      {t.status === 'completed' && (
                        <Check className="w-4 h-4 text-green-400" />
                      )}
                    </div>
                  </SelectItem>
                ))}
                <SelectItem
                  value="CREATE_NEW"
                  className="text-white focus:bg-gray-800 focus:text-white"
                >
                  <div className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    <span>Create new tournament</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </section>

          {/* Create Tournament Form (only shown when creating) */}
          {showCreateForm && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-200">Create Tournament</h3>
              <div className="space-y-1">
                <Label htmlFor="tour-name" className="text-sm text-gray-300">Name</Label>
                <Input
                  id="tour-name"
                  ref={tournamentNameInputRef}
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Tournament name"
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="bracket-type" className="text-sm text-gray-300">Tournament Type</Label>
                <select
                  id="bracket-type"
                  value={form.bracketType}
                  onChange={(e) => setForm(prev => ({ ...prev, bracketType: e.target.value as 'single' | 'double' }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="single">Single Elimination</option>
                  <option value="double">Double Elimination</option>
                </select>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowCreateForm(false);
                    setForm({ name: '', bracketType: 'single' });
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  disabled={!form.name.trim()}
                  variant="outline"
                  onClick={async () => {
                    const tournament = await handleCreate();
                    if (tournament) {
                      setShowCreateForm(false);
                      setSelected(tournament);
                    }
                  }}
                >
                  Create
                </Button>
              </div>
            </section>
          )}

          {/* Add Player Names */}
          {selected && !showCreateForm && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-200">
                {isTournamentComplete ? 'Tournament Complete' : 'Add Player Names'}
              </h3>
              {isTournamentComplete ? (
                <div className="p-4 bg-green-500/20 border border-green-500/30 rounded-md">
                  <p className="text-sm text-green-200 flex items-center gap-2">
                    <span className="text-lg">🏆</span>
                    This tournament has finished. Use "Restart Tournament" to reset and create a new bracket.
                  </p>
                </div>
              ) : (
                <>
                  <Label htmlFor="quick-block" className="text-sm text-gray-300">Add any number of players (minimum 2)</Label>
                  <div className="text-xs text-gray-400 mb-2">Paste names one per line, or separate with ; or ,</div>
                  <Textarea
                    id="quick-block"
                    value={quickBlock}
                    onChange={(e) => setQuickBlock(e.target.value)}
                    rows={4}
                    placeholder={`Player A
Player B
Player C
Player D
...`}
                    className="bg-black/50 border-gray-700 text-white"
                  />
                  <div className="space-y-2">
                    <Button
                      onClick={handleRandomizeNames}
                      disabled={!quickBlock.trim()}
                      variant="outline"
                      className="w-full"
                    >
                      Randomize Order
                    </Button>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => setShowFightingGamesModal(true)}
                        variant="outline"
                        className="flex-1"
                        disabled={matches.length > 0}
                        title={matches.length > 0 ? 'Cannot suggest games after tournament has started' : 'Suggest 10 best arcade fighting games'}
                      >
                        <Gamepad2 className="w-4 h-4 mr-1" />
                        Fighting
                      </Button>
                      <Button
                        onClick={() => setShowArcadeGamesModal(true)}
                        variant="outline"
                        className="flex-1"
                        disabled={matches.length > 0}
                        title={matches.length > 0 ? 'Cannot suggest games after tournament has started' : 'Suggest 10 best arcade 2-player games (non-fighting)'}
                      >
                        <Gamepad2 className="w-4 h-4 mr-1" />
                        Arcade
                      </Button>
                    </div>
                  </div>
                  <Button onClick={handleQuickStart} disabled={!quickBlock.trim() || quickRunning} className="w-full" variant="outline">
                    {quickRunning ? 'Creating…' : 'Start'}
                  </Button>
                </>
              )}
            </section>
          )}

          {/* Action Buttons */}
          {selected && players.length > 0 && (
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full border-red-500 hover:border-red-400 hover:bg-red-500/10"
                onClick={() => setDeleteConfirmOpen(true)}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete Tournament'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      </div></div>
      <div className="col-span-12 lg:col-span-8 xl:col-span-9 min-h-0 h-full flex flex-col"><div className="h-full flex flex-col min-h-0">
        <Card className="h-full flex flex-col overflow-hidden bg-black/20 backdrop-blur-sm border-white/10">
          <CardHeader className="pb-3 shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Tournament Admin</CardTitle>
               <div className="flex items-center gap-2">
                 {selected && (
                   <>
                     {(players.length > 0 || matches.length > 0) && (
                       <div className="flex gap-1">
                         <Button
                           variant={currentView === 'bracket' ? 'default' : 'outline'}
                           size="sm"
                           onClick={() => setCurrentView('bracket')}
                           className="flex items-center gap-2"
                         >
                           Bracket
                         </Button>
                         <Button
                           variant={currentView === 'analytics' ? 'default' : 'outline'}
                           size="sm"
                           onClick={() => setCurrentView('analytics')}
                           className="flex items-center gap-2"
                         >
                           <BarChart3 className="h-4 w-4" />
                           Analytics
                         </Button>
                         <Button
                           variant={currentView === 'debug' ? 'default' : 'outline'}
                           size="sm"
                           onClick={() => setCurrentView('debug')}
                           className="flex items-center gap-2"
                         >
                           🔍 Debug
                         </Button>
                       </div>
                     )}
                     {!isTournamentComplete && (
                       <Button variant="outline" size="sm" onClick={() => window.location.assign(`/competition?tournament=${selected.id}`)}>
                         Competition View
                       </Button>
                     )}
                     <Button variant="outline" size="sm" onClick={() => setRestartOpen(true)}>Restart</Button>
                   </>
                 )}
               </div>
             </div>
           </CardHeader>
           <CardContent className="flex-1 min-h-0 p-0 overflow-hidden">
            {selected && (previewMatches.length > 0 || matches.length > 0) ? (
              <div className="h-full flex flex-col">
                {/* Tournament completion indicator */}
                {isTournamentComplete && (
                  <div className="shrink-0 px-4 py-2 bg-green-500/20 border-b border-green-500/30">
                    <p className="text-sm text-green-200 flex items-center gap-2">
                      <span className="text-lg">🏆</span>
                      Tournament Complete - Results are now read-only
                    </p>
                  </div>
                )}
                {/* Preview indicator when showing preview matches */}
                {matches.length === 0 && previewMatches.length > 0 && currentView === 'bracket' && (
                  <div className="shrink-0 px-4 py-2 bg-amber-500/20 border-b border-amber-500/30">
                    <p className="text-sm text-amber-200 flex items-center gap-2">
                      <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></span>
                      Live Preview - Edit player names to see changes
                    </p>
                  </div>
                )}
                <div className="flex-1 overflow-hidden">
                  {currentView === 'bracket' ? (
                    <BracketView
                      ref={bracketViewRef}
                      matches={previewMatches}
                      participants={previewParticipants}
                      adminMode={matches.length > 0 && !isTournamentComplete} // Only enable admin mode for actual matches that aren't complete
                      onReport={matches.length > 0 && !isTournamentComplete ? onReportClick : undefined}
                      onPlayerClick={matches.length > 0 && !isTournamentComplete ? onPlayerClick : undefined}
                      highlightTarget={highlightTarget}
                      disableKeyboardNavigation={true}
                      forceAutoFit={true}
                      showWinnerZoom={bracketZoomAnimation}
                      processingMatchId={processingMatchId}
                    />
                  ) : currentView === 'analytics' ? (
                    <div className="h-full overflow-auto p-4">
                      <BracketAnalytics
                        tournament={selected}
                        players={players}
                        matches={matches}
                      />
                    </div>
                  ) : (
                    <div className="h-full overflow-auto p-4">
                      <BracketDebugger
                        tournament={selected}
                        players={players}
                        matches={matches}
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-6 h-full flex flex-col items-center justify-center">
                {!selected ? (
                  <p className="text-gray-500 text-center">Select a tournament to get started</p>
                ) : quickNamesList.length < 2 && players.length < 2 ? (
                  <p className="text-gray-500 text-center">Add at least two players to see Bracket Tournament preview</p>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-gray-500 text-center">Use Quick Start to add players and generate Bracket Tournament</p>
                  </div>
                )}
              </div>
            )}
           </CardContent>
         </Card>
       </div></div>
      </div>

      <Dialog open={winnerOpen} onOpenChange={(o) => { setWinnerOpen(o); if (!o) setShowConfetti(false); }}>
        <DialogContent className="bg-gray-900 text-white border-white/20 max-w-xl w-[95vw]">
          <DialogHeader>
            <DialogTitle className="text-arcade-neonYellow text-2xl text-center">Champion Crowned!</DialogTitle>
          </DialogHeader>
          <div className="text-center space-y-4 py-4">
            <div className="text-6xl">🏆</div>
            <div className="text-xl text-gray-300">{selected?.name}</div>
            <div className="text-3xl font-bold text-arcade-neonPink">Champion: {winnerName}</div>
            <div className="pt-2 flex items-center justify-center gap-2">
              <Button variant="outline" onClick={async () => { const url = `${window.location.origin}/tournaments?c=${selected?.id}`; try { await navigator.clipboard.writeText(url); } catch {} }}>Copy Share Link</Button>
              <Button variant="outline" onClick={() => { setWinnerOpen(false); setShowConfetti(false); }}>Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {showConfetti && createPortal(
        <AdvancedConfetti isActive={showConfetti} onComplete={() => setShowConfetti(false)} />,
        document.body
      )}

      {/* Navigation Modal */}
      <Dialog open={navigationModalOpen} onOpenChange={setNavigationModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bracket Tournament Generated Successfully!</DialogTitle>
            <DialogDescription>
              Your Bracket Tournament has been created and is ready for competition. Would you like to navigate to the competition view to start reporting match results?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">Share this tournament with participants:</p>
              <Button
                variant="outline"
                onClick={async () => {
                  const shareUrl = `${window.location.origin}/competition?tournament=${selected?.id}`;
                  try {
                    await navigator.clipboard.writeText(shareUrl);
                    toast({ title: 'Link copied!', description: 'Share link copied to clipboard' });
                  } catch {
                    // Fallback for clipboard API not available
                    const textArea = document.createElement('textarea');
                    textArea.value = shareUrl;
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    toast({ title: 'Link copied!', description: 'Share link copied to clipboard' });
                  }
                }}
              >
                📋 Copy Share Link
              </Button>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNavigationModalOpen(false)}>
                Stay Here
              </Button>
              <Button onClick={() => {
                setNavigationModalOpen(false);
                navigate(`/competition?tournament=${selected?.id}`);
              }} variant="outline">
                Go to Competition
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="bg-gray-900 text-white border-white/20">
          <DialogHeader>
            <DialogTitle>Delete Tournament</DialogTitle>
            <DialogDescription className="text-gray-300">
              Are you sure you want to delete "{selected?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              className="border-red-500 hover:border-red-400 hover:bg-red-500/10"
              onClick={handleDeleteTournament}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete Tournament'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restart Confirmation */}
      <AlertDialog open={restartOpen} onOpenChange={setRestartOpen}>
        <AlertDialogContent className="bg-gray-900 text-white border-white/20">
          <AlertDialogHeader>
            <AlertDialogTitle>Restart tournament?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all matches and reset the tournament to draft. Players and seeds remain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restartLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={restartLoading} onClick={handleRestart}>{restartLoading ? 'Restarting…' : 'Confirm Restart'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Share Link Dialog */}
      <Dialog open={showShareLinkDialog} onOpenChange={setShowShareLinkDialog}>
        <DialogContent className="bg-gray-900 text-white border-white/20 max-w-md w-[95vw]">
          <DialogHeader>
            <DialogTitle className="text-arcade-neonYellow text-xl text-center">Share Tournament</DialogTitle>
            <DialogDescription className="text-gray-300 text-center">
              Copy the link to share your tournament with others
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="text-center text-6xl">🔗</div>
            <div className="bg-gray-800 p-3 rounded border border-gray-700">
              <p className="text-sm text-gray-400 break-all font-mono">{shareUrl}</p>
            </div>
          </div>

          <DialogFooter className="flex gap-3 justify-center">
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(shareUrl);
                  toast({ title: 'Link copied!', description: 'Share link copied to clipboard' });
                  setShowShareLinkDialog(false);
                  navigate(`/competition?tournament=${selected?.id}`);
                } catch {
                  // Fallback for clipboard API not available
                  const textArea = document.createElement('textarea');
                  textArea.value = shareUrl;
                  document.body.appendChild(textArea);
                  textArea.select();
                  document.execCommand('copy');
                  document.body.removeChild(textArea);
                  toast({ title: 'Link copied!', description: 'Share link copied to clipboard' });
                  setShowShareLinkDialog(false);
                  navigate(`/competition?tournament=${selected?.id}`);
                }
              }}
            >
              📋 Copy Link
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setShowShareLinkDialog(false);
                navigate(`/competition?tournament=${selected?.id}`);
              }}
            >
              Skip
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fighting Games Suggestions Modal */}
      <FightingGamesSuggestionsModal
        isOpen={showFightingGamesModal}
        onClose={() => setShowFightingGamesModal(false)}
        onSelectGames={(gameNames) => {
          const currentNames = quickBlock.split(/[\r\n;,]+/).map(s => s.trim()).filter(Boolean);
          const uniqueNames = [...new Set([...currentNames, ...gameNames])];
          setQuickBlock(uniqueNames.join('\n'));
        }}
      />

      {/* Arcade Games Suggestions Modal */}
      <ArcadeGamesSuggestionsModal
        isOpen={showArcadeGamesModal}
        onClose={() => setShowArcadeGamesModal(false)}
        onSelectGames={(gameNames) => {
          const currentNames = quickBlock.split(/[\r\n;,]+/).map(s => s.trim()).filter(Boolean);
          const uniqueNames = [...new Set([...currentNames, ...gameNames])];
          setQuickBlock(uniqueNames.join('\n'));
        }}
      />
    </div>
  );
}

export default BracketAdmin;
