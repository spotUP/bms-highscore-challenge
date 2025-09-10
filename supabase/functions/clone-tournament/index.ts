// Deno Deploy / Supabase Edge Function to clone a tournament with members and games
// Requires env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

interface CloneRequestBody {
  sourceTournamentId: string;
  name: string;
  slug: string;
  is_public?: boolean;
  created_by: string; // requester id
}

serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
    }

    const { sourceTournamentId, name, slug, is_public = false, created_by } = await req.json() as CloneRequestBody;

    if (!sourceTournamentId || !name || !slug || !created_by) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
    }

    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceKey) {
      return new Response(JSON.stringify({ error: 'Server not configured' }), { status: 500 });
    }

    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

    // Read source tournament
    const { data: source, error: srcErr } = await supabase
      .from('tournaments')
      .select('id, logo_url, theme_color, demolition_man_active')
      .eq('id', sourceTournamentId)
      .single();
    if (srcErr || !source) {
      return new Response(JSON.stringify({ error: 'Source tournament not found' }), { status: 404 });
    }

    // Create new tournament
    const insertTournament = {
      name,
      slug,
      description: null,
      is_public,
      created_by,
      logo_url: source.logo_url ?? null,
      theme_color: source.theme_color ?? null,
      demolition_man_active: source.demolition_man_active ?? false,
    } as Record<string, unknown>;

    const { data: created, error: createErr } = await supabase
      .from('tournaments')
      .insert(insertTournament)
      .select('*')
      .single();
    if (createErr || !created) {
      return new Response(JSON.stringify({ error: createErr?.message || 'Failed to create tournament' }), { status: 400 });
    }

    const newTournamentId = created.id as string;

    // Clone members: copy all members from source, but ensure requester is owner
    const { data: members, error: memErr } = await supabase
      .from('tournament_members')
      .select('user_id, role, is_active')
      .eq('tournament_id', sourceTournamentId);
    if (memErr) {
      return new Response(JSON.stringify({ error: memErr.message }), { status: 400 });
    }

    const memberRows = (members || []).map((m) => ({
      tournament_id: newTournamentId,
      user_id: m.user_id,
      role: m.role,
      is_active: m.is_active,
      joined_at: new Date().toISOString(),
    }));

    // Ensure requester is owner (override/append)
    memberRows.push({
      tournament_id: newTournamentId,
      user_id: created_by,
      role: 'owner',
      is_active: true,
      joined_at: new Date().toISOString(),
    } as any);

    if (memberRows.length > 0) {
      const { error: insMemErr } = await supabase
        .from('tournament_members')
        .insert(memberRows);
      if (insMemErr) {
        return new Response(JSON.stringify({ error: insMemErr.message }), { status: 400 });
      }
    }

    // Clone games: copy basic fields, point to new tournament
    const { data: games, error: gamesErr } = await supabase
      .from('games')
      .select('name, description, logo_url, is_active, include_in_challenge')
      .eq('tournament_id', sourceTournamentId);
    if (gamesErr) {
      return new Response(JSON.stringify({ error: gamesErr.message }), { status: 400 });
    }

    if (games && games.length > 0) {
      const gameRows = games.map((g) => ({
        name: g.name,
        description: g.description ?? null,
        logo_url: g.logo_url ?? null,
        is_active: g.is_active,
        include_in_challenge: g.include_in_challenge,
        tournament_id: newTournamentId,
      }));
      const { error: insGamesErr } = await supabase
        .from('games')
        .insert(gameRows);
      if (insGamesErr) {
        return new Response(JSON.stringify({ error: insGamesErr.message }), { status: 400 });
      }
    }

    return new Response(JSON.stringify({ tournament: created }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Unexpected error' }), { status: 500 });
  }
});



