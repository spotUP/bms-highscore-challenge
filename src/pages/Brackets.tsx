import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useBrackets, BracketCompetition, BracketParticipant, BracketMatch } from '@/contexts/BracketContext';
import { supabase } from '@/integrations/supabase/client';
import BracketView from '@/components/BracketView';

const Brackets: React.FC = () => {
  const { competitions, loading, refresh } = useBrackets();
  const [selected, setSelected] = useState<BracketCompetition | null>(null);
  const [participants, setParticipants] = useState<BracketParticipant[]>([]);
  const [matches, setMatches] = useState<BracketMatch[]>([]);
  const [loadingBracket, setLoadingBracket] = useState(false);

  useEffect(() => {
    if (!selected) return;
    const load = async () => {
      setLoadingBracket(true);
      try {
        const [{ data: p, error: pErr }, { data: m, error: mErr }] = await Promise.all([
          supabase.from('bracket_participants').select('*').eq('competition_id', selected.id),
          supabase.from('bracket_matches').select('*').eq('competition_id', selected.id)
        ]);
        if (pErr) throw pErr;
        if (mErr) throw mErr;
        setParticipants((p || []) as any);
        setMatches((m || []) as any);
      } catch (e) {
        console.error('Failed to load bracket data', e);
      } finally {
        setLoadingBracket(false);
      }
    };
    load();
  }, [selected?.id]);

  const participantsMap = useMemo(() => {
    const map: Record<string, BracketParticipant> = {} as any;
    participants.forEach(p => { map[p.id] = p; });
    return map;
  }, [participants]);

  return (
    <div className="min-h-screen text-white p-4" style={{ background: 'var(--page-bg)' }}>
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">Brackets</h1>
          <Button variant="outline" onClick={refresh} disabled={loading}>Refresh</Button>
        </div>

        <Card className="bg-black/30 border-white/20">
          <CardHeader>
            <CardTitle>Competitions</CardTitle>
          </CardHeader>
          <CardContent>
            {loading && <div>Loading...</div>}
            {!loading && (
              <div className="flex flex-wrap gap-2">
                {competitions.map(c => (
                  <Button key={c.id} variant={selected?.id === c.id ? 'default' : 'outline'} size="sm" onClick={() => setSelected(c)}>
                    {c.name}
                  </Button>
                ))}
                {competitions.length === 0 && <div className="text-sm text-gray-400">No competitions yet.</div>}
              </div>
            )}
          </CardContent>
        </Card>

        {selected && (
          <Card className="bg-black/30 border-white/20 h-[70vh]">
            <CardHeader>
              <CardTitle>{selected.name}</CardTitle>
            </CardHeader>
            <CardContent className="h-full">
              {loadingBracket ? (
                <div>Loading bracket...</div>
              ) : (
                <div className="h-full">
                  <BracketView matches={matches} participants={participantsMap} />
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Brackets;
