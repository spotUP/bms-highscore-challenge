import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useBrackets, Tournament, TournamentPlayer, TournamentMatch } from '@/contexts/BracketContext';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import BracketView from '@/components/BracketView';
import TopNav from '@/components/TopNav';
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

const BracketAdmin: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { tournaments, loading, refresh, createTournament, addPlayers, generateBracket, reportWinner, getTournamentData, deleteTournament } = useBrackets();

  const [form, setForm] = useState({ name: '' });
  const [selected, setSelected] = useState<Tournament | null>(null);
  const [playerBlock, setPlayerBlock] = useState('');
  const [quickBlock, setQuickBlock] = useState('');
  const [quickRunning, setQuickRunning] = useState(false);
  const [players, setPlayers] = useState<TournamentPlayer[]>([]);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [loadingBracket, setLoadingBracket] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);
  const [restartLoading, setRestartLoading] = useState(false);
  const [winnerOpen, setWinnerOpen] = useState(false);
  const [winnerName, setWinnerName] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [highlightTarget, setHighlightTarget] = useState<{ round: number; position: number } | null>(null);
  const [navigationModalOpen, setNavigationModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [lastProcessedTournamentId, setLastProcessedTournamentId] = useState<string | null>(null);

  const ownedTournaments = useMemo(() => tournaments.filter(t => t.created_by === user?.id), [tournaments, user?.id]);

  useEffect(() => { 
    if (!loading) { 
      setSelected(s => s && ownedTournaments.find(t => t.id === s.id) || null); 
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
    
    setForm({ name: selected.name || '' });
    
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

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Name required', description: 'Enter a tournament name', variant: 'destructive' });
      return;
    }
    const tournament = await createTournament(form.name.trim());
    if (tournament) {
      toast({ title: 'Created', description: 'Tournament created' });
      setForm({ name: '' });
      setSelected(tournament);
    }
  };

  const handleAddPlayers = async () => {
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
      setQuickBlock('');
      toast({ title: 'Bracket ready', description: 'Players added and bracket generated' });
      setNavigationModalOpen(true);
    } catch (e: any) {
      toast({ title: 'Quick start failed', description: e?.message || 'Please try again', variant: 'destructive' });
    } finally {
      setQuickRunning(false);
    }
  };

  const handleGenerate = async () => {
    if (!selected) return;
    setGenerating(true);
    const ok = await generateBracket(selected.id);
    setGenerating(false);
    if (ok) {
      toast({ title: 'Bracket generated', description: 'Single-elimination matches created' });
      const data = await getTournamentData(selected.id);
      setMatches(data.matches);
      setNavigationModalOpen(true);
    }
  };

  const handleSavePlayerChanges = async () => {
    if (!selected) return;
    
    const names = quickBlock
      .split(/[\n,;]+/)
      .map(name => name.trim())
      .filter(Boolean);
    
    if (names.length < 2) {
      toast({ 
        title: 'Not enough players', 
        description: 'You need at least 2 players to create a bracket',
        variant: 'destructive' 
      });
      return;
    }
    
    try {
      // First remove all existing players
      await Promise.all(
        players.map(player => 
          supabase.from('bracket_players')
            .delete()
            .eq('id', player.id)
        )
      );
      
      // Add the new players
      const { error } = await supabase
        .from('bracket_players')
        .insert(
          names.map(name => ({
            tournament_id: selected.id,
            name,
            created_at: new Date().toISOString()
          }))
        );
      
      if (error) throw error;
      
      // Refresh the data
      const updatedData = await getTournamentData(selected.id);
      setPlayers(updatedData.players);
      
      toast({
        title: 'Players updated',
        description: 'The player list has been successfully updated.'
      });
      
      // Reset the last processed ID to ensure UI updates
      setLastProcessedTournamentId(null);
      
    } catch (error) {
      console.error('Error updating players:', error);
      toast({
        title: 'Failed to update players',
        description: 'An error occurred while updating the player list.',
        variant: 'destructive'
      });
    }
  };

  const onReportClick = async (matchId: string, winnerId: string) => {
    if (!selected) return;
    
    // Optimistically update the UI
    const optimisticMatches = matches.map(m => 
      m.id === matchId ? { ...m, winner_id: winnerId } : m
    );
    setMatches(optimisticMatches);
    
    const ok = await reportWinner(matchId, winnerId);
    if (ok) {
      toast({ title: 'Result reported', description: 'Match completed' });
      if (!selected) return;
      
      // Get updated data
      const data = await getTournamentData(selected.id);
      setPlayers(data.players);
      setMatches(data.matches);
      
      // Check if this was the final match (round 1000 or 1001)
      const finalMatch = data.matches.find(m => m.round === 1000 || m.round === 1001);
      if (finalMatch?.winner_id) {
        const winner = data.players.find(p => p.id === finalMatch.winner_id);
        if (winner) {
          // Small delay to ensure UI updates before showing the modal
          setTimeout(() => {
            setWinnerName(winner.name);
            setWinnerOpen(true);
            setShowConfetti(true);
          }, 500);
        }
      }
    } else {
      toast({ 
        title: 'Failed to report result', 
        description: 'Please try again',
        variant: 'destructive' 
      });
      // Revert optimistic update on failure
      await refresh();
    }
  };

  const handleRestart = async () => {
    if (!selected) return;
    setRestartLoading(true);
    try {
      await supabase.from('tournament_matches').delete().eq('tournament_id', selected.id);
      await supabase.from('tournaments').update({ status: 'draft' }).eq('id', selected.id);
      
      const data = await getTournamentData(selected.id);
      setMatches(data.matches);
      await refresh();
      
      toast({ title: 'Tournament restarted', description: 'All matches cleared. Generate a new bracket when ready.' });
    } catch (e) {
      toast({ title: 'Failed to restart', description: 'Please try again', variant: 'destructive' });
    } finally {
      setRestartLoading(false);
      setRestartOpen(false);
    }
  };

  const handleDeleteTournament = async () => {
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
      position: m.match_number,
      participant1_id: m.player1_id,
      participant2_id: m.player2_id,
      winner_participant_id: m.winner_id,
      status: m.winner_id ? 'completed' : 'pending'
    }));
  }, [matches]);

  // Parse quickBlock names for preview when players haven't been saved yet
  const quickNamesList = useMemo(() => {
    return quickBlock
      .split(/[\r\n;,]+/)
      .map(s => s.trim())
      .filter(Boolean);
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

  return (
    <div className="h-[100dvh] overflow-hidden flex flex-col text-white relative z-10" style={{ background: 'var(--page-bg)' }}>
      <div className="shrink-0">
        <TopNav
          rightActions={
            <div className="flex items-center gap-2">
              {selected && (
                <Button variant="outline" size="sm" onClick={() => window.location.assign(`/tournaments?c=${selected.id}`)}>Back to Tournaments</Button>
              )}
              {selected && (
                <Button variant="destructive" size="sm" onClick={() => setRestartOpen(true)}>Restart</Button>
              )}
            </div>
          }
        />
      </div>
      {/* Desktop two-column layout */}
      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0 overflow-hidden p-4">
      <div className="col-span-12 lg:col-span-4 xl:col-span-3 space-y-4 min-h-0 h-full pr-2"><div className="fly-in-left-offscreen anim-delay-50 h-full min-h-0">
      {/* Unified Left Panel */}
      <Card className="h-full flex flex-col overflow-hidden">
        <CardContent className="flex-1 min-h-0 overflow-auto space-y-5">
          {/* Select Tournament */}
          <section className="mt-4 space-y-1.5">
            <h3 className="text-sm font-semibold text-gray-200">Select Tournament</h3>
            {ownedTournaments.length > 0 ? (
              <select
                className="w-full bg-black/50 border border-white/20 rounded px-2 py-2 text-sm"
                value={selected?.id || ''}
                onChange={(e) => {
                  const tour = ownedTournaments.find(t => t.id === e.target.value);
                  if (tour) setSelected(tour);
                }}
              >
                <option value="" disabled>Choose…</option>
                {ownedTournaments.map(t => (<option key={t.id} value={t.id}>{t.name}</option>))}
              </select>
            ) : (
              <div className="text-sm text-gray-400">No tournaments yet — create one below.</div>
            )}
          </section>

          {/* Unified Create/Edit Tournament */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-200">{selected ? 'Edit Tournament' : 'Create Tournament'}</h3>
            <div className="space-y-1">
              <Label htmlFor="tour-name" className="text-sm text-gray-300">Name</Label>
              <Input id="tour-name" value={form.name} onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))} placeholder="Tournament name" />
            </div>
            <Button
              className="w-full"
              disabled={selected ? !(user && selected.created_by === user.id) : !form.name.trim()}
              onClick={async () => {
                if (selected && user && selected.created_by === user.id) {
                  const ok = await Promise.all([
                    supabase.from('tournaments').update({ name: form.name }).eq('id', selected.id),
                    getTournamentData(selected.id)
                  ]);
                  if (ok.every(Boolean)) {
                    await refresh();
                    const updated = tournaments.find(t => t.id === selected.id);
                    if (updated) setSelected(updated);
                  }
                } else {
                  await handleCreate();
                }
              }}
            >
              {selected ? 'Save Changes' : 'Create Tournament'}
            </Button>
          </section>

          {/* Add Players & Generate */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-200">Add Players & Generate</h3>
            <Label htmlFor="quick-block" className="text-sm text-gray-300">Paste names (one per line; ; or , also supported)</Label>
            <Textarea
              id="quick-block"
              value={quickBlock}
              onChange={(e) => setQuickBlock(e.target.value)}
              rows={4}
              placeholder={selected ? 'Player A\nPlayer B\nPlayer C' : 'Select a tournament first'}
              disabled={!selected}
              className="bg-black/50 border-gray-700 text-white"
            />
            <Button onClick={handleQuickStart} disabled={!selected || !quickBlock.trim() || quickRunning} className="w-full">
              {quickRunning ? 'Creating…' : 'Create Bracket'}
            </Button>
            <Button onClick={handleSavePlayerChanges} disabled={!selected || !quickBlock.trim()} className="w-full">
              Save Player Changes
            </Button>
          </section>

          {/* Seeding */}
          {selected && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-200">Seeding</h3>
              {players.length === 0 ? (
                <div className="text-sm text-gray-400">No players yet. Add players above.</div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-auto pr-2">
                  {players.map(p => (
                    <div key={p.id} className="flex items-center gap-2">
                      <div className="text-sm text-gray-300 truncate">{p.name}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
          {/* Action Buttons */}
          {selected && players.length > 0 && (
            <div className="space-y-3">
              {matches.length === 0 && players.length >= 2 && (
                <Button 
                  onClick={handleGenerate} 
                  className="w-full"
                  disabled={generating}
                >
                  {generating ? 'Generating...' : 'Create Bracket'}
                </Button>
              )}
              <Button 
                variant="destructive" 
                className="w-full"
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
      <div className="col-span-12 lg:col-span-8 xl:col-span-9 min-h-0 h-full flex flex-col"><div className="fly-in-right-offscreen anim-delay-100 h-full flex flex-col min-h-0">
        <Card className="h-full flex flex-col overflow-hidden">
          <CardHeader className="pb-3 shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Tournament Admin</CardTitle>
               <div className="flex items-center gap-2">
                 {matches.length === 0 && players.length >= 2 && (
                   <Button size="sm" variant="default" onClick={handleGenerate}>Generate</Button>
                 )}
                 {selected && (
                   <Button variant="destructive" size="sm" onClick={() => setRestartOpen(true)}>Restart</Button>
                 )}
               </div>
             </div>
           </CardHeader>
           <CardContent className="flex-1 min-h-0 p-0 overflow-hidden">
            {selected && matches.length > 0 ? (
              <BracketView
                matches={bracketMatches}
                participants={participantMap}
                adminMode
                onReport={onReportClick}
                highlightTarget={highlightTarget}
              />
            ) : (
              <div className="p-6 h-full flex flex-col items-center justify-center">
                {!selected ? (
                  <p className="text-gray-500 text-center">Select a tournament to get started</p>
                ) : players.length < 2 ? (
                  <p className="text-gray-500 text-center">Add at least two players to generate a bracket</p>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-gray-500 text-center">Generate a bracket to get started</p>
                    <Button onClick={handleGenerate}>Generate</Button>
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
            <DialogTitle>Bracket Generated Successfully!</DialogTitle>
            <DialogDescription>
              Your bracket has been created and is ready for competition. Would you like to navigate to the competition view to start reporting match results?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNavigationModalOpen(false)}>
              Stay Here
            </Button>
            <Button onClick={() => {
              setNavigationModalOpen(false);
              navigate(`/competition?tournament=${selected?.id}`);
            }}>
              Go to Competition
            </Button>
          </DialogFooter>
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
              variant="destructive" 
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
    </div>
  );
}

export default BracketAdmin;
