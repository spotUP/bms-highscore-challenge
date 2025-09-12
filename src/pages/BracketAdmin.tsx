import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useBrackets, BracketCompetition, BracketParticipant, BracketMatch } from '@/contexts/BracketContext';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import BracketView from '@/components/BracketView';

const BracketAdmin: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { competitions, loading, refresh, createCompetition, addParticipants, generateSingleElimination, reportResult } = useBrackets();

  const [form, setForm] = useState({ name: '', is_public: false });
  const [selected, setSelected] = useState<BracketCompetition | null>(null);
  const [participantBlock, setParticipantBlock] = useState('');
  const [participants, setParticipants] = useState<BracketParticipant[]>([]);
  const [matches, setMatches] = useState<BracketMatch[]>([]);
  const [loadingBracket, setLoadingBracket] = useState(false);
  const [generating, setGenerating] = useState(false);

  const ownedCompetitions = useMemo(() => competitions.filter(c => c.created_by === user?.id), [competitions, user?.id]);

  useEffect(() => { if (!loading) { setSelected(s => s && ownedCompetitions.find(c => c.id === s.id) || null); } }, [loading, ownedCompetitions]);

  useEffect(() => {
    if (!selected) return;
    const load = async () => {
      setLoadingBracket(true);
      try {
        const [{ data: p, error: pErr }, { data: m, error: mErr }] = await Promise.all([
          supabase.from('bracket_participants').select('*').eq('competition_id', selected.id).order('created_at', { ascending: true }),
          supabase.from('bracket_matches').select('*').eq('competition_id', selected.id).order('round', { ascending: true }).order('position', { ascending: true })
        ]);
        if (pErr) throw pErr;
        if (mErr) throw mErr;
        setParticipants((p || []) as any);
        setMatches((m || []) as any);
      } catch (e: any) {
        console.error('Failed to load bracket data', e);
        toast({ title: 'Error', description: e?.message || 'Failed to load bracket data', variant: 'destructive' });
      } finally {
        setLoadingBracket(false);
      }
    };
    load();
  }, [selected?.id, toast]);

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Name required', description: 'Enter a competition name', variant: 'destructive' });
      return;
    }
    const comp = await createCompetition(form.name.trim(), form.is_public);
    if (comp) {
      toast({ title: 'Created', description: 'Competition created' });
      setForm({ name: '', is_public: false });
      setSelected(comp);
    }
  };

  const handleAddParticipants = async () => {
    if (!selected) return;
    const names = participantBlock.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (names.length === 0) {
      toast({ title: 'No names', description: 'Paste one name per line', variant: 'destructive' });
      return;
    }
    const ok = await addParticipants(selected.id, names);
    if (ok) {
      toast({ title: 'Participants added', description: `${names.length} added` });
      setParticipantBlock('');
      // reload
      const { data } = await supabase.from('bracket_participants').select('*').eq('competition_id', selected.id);
      setParticipants((data || []) as any);
    }
  };

  const handleGenerate = async () => {
    if (!selected) return;
    setGenerating(true);
    const ok = await generateSingleElimination(selected.id);
    setGenerating(false);
    if (ok) {
      toast({ title: 'Bracket generated', description: 'Single-elimination matches created' });
      // reload matches
      const { data } = await supabase.from('bracket_matches').select('*').eq('competition_id', selected.id);
      setMatches((data || []) as any);
    }
  };

  // Simple quick-report controls (for testing): mark participant1 or participant2 as winner
  const quickReport = async (m: BracketMatch, which: 1 | 2) => {
    const winnerId = which === 1 ? m.participant1_id : m.participant2_id;
    if (!winnerId) return;
    const ok = await reportResult(m.id, winnerId);
    if (ok) {
      toast({ title: 'Result reported', description: 'Match completed' });
      const { data } = await supabase.from('bracket_matches').select('*').eq('competition_id', m.competition_id);
      setMatches((data || []) as any);
    }
  };

  return (
    <div className="min-h-screen text-white p-4" style={{ background: 'var(--page-bg)' }}>
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Bracket Admin</h1>

        <Card className="bg-black/30 border-white/20">
          <CardHeader>
            <CardTitle>Create Competition</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="comp-name">Name</Label>
              <Input id="comp-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="bg-black/50 border-gray-700 text-white" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCreate}>Create</Button>
              <Button variant="outline" onClick={refresh} disabled={loading}>Refresh</Button>
            </div>
            {ownedCompetitions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {ownedCompetitions.map(c => (
                  <Button key={c.id} size="sm" variant={selected?.id === c.id ? 'default' : 'outline'} onClick={() => setSelected(c)}>
                    {c.name}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {selected && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="bg-black/30 border-white/20 lg:col-span-1">
              <CardHeader>
                <CardTitle>Add Participants</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Label>Paste one name per line</Label>
                <Textarea value={participantBlock} onChange={e => setParticipantBlock(e.target.value)} className="bg-black/50 border-gray-700 text-white min-h-[180px]" />
                <Button variant="outline" onClick={handleAddParticipants}>Add</Button>
                <div className="text-sm text-gray-400">Current: {participants.length}</div>
                <Button variant="outline" onClick={handleGenerate} disabled={generating || matches.length > 0}>Generate Single-Elimination</Button>
              </CardContent>
            </Card>

            <Card className="bg-black/30 border-white/20 lg:col-span-2 h-[70vh]">
              <CardHeader>
                <CardTitle>{selected.name}</CardTitle>
              </CardHeader>
              <CardContent className="h-full">
                {loadingBracket ? (
                  <div>Loading bracket...</div>
                ) : (
                  <div className="h-full">
                    <div className="mb-2 text-xs text-gray-400">Tip: Scroll to zoom, drag to pan</div>
                    <BracketView matches={matches} participants={participants.reduce((acc, p) => { (acc as any)[p.id] = p; return acc; }, {} as any)} />
                    {/* Quick report controls (basic) */}
                    <div className="mt-3 space-y-2">
                      <div className="text-sm font-semibold">Quick Report (testing)</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {matches.map(m => (
                          <div key={m.id} className="flex items-center justify-between bg-black/40 border border-white/10 rounded px-2 py-1 text-xs">
                            <div>R{m.round}-P{m.position}</div>
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" disabled={!m.participant1_id} onClick={() => quickReport(m, 1)}>P1 win</Button>
                              <Button size="sm" variant="outline" disabled={!m.participant2_id} onClick={() => quickReport(m, 2)}>P2 win</Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default BracketAdmin;
