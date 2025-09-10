// Deno Deploy / Supabase Edge Function to clone a tournament with members and games
// Requires env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

// @deno-types="https://deno.land/std@0.168.0/http/server.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @deno-types="https://esm.sh/@supabase/supabase-js@2.43.4"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

interface CloneRequestBody {
  sourceTournamentId: string;
  name: string;
  slug: string;
  is_public?: boolean;
  created_by: string; // requester id
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
    }

    console.log('Received request to clone tournament');
    const { sourceTournamentId, name, slug, is_public = false, created_by } = await req.json() as CloneRequestBody;
    console.log('Request body:', { sourceTournamentId, name, slug, is_public, created_by });

    if (!sourceTournamentId || !name || !slug || !created_by) {
      console.error('Validation failed: Missing required fields');
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: corsHeaders });
    }

    console.log('Creating Supabase client...');
    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceKey) {
      console.error('Configuration error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set');
      return new Response(JSON.stringify({ error: 'Server not configured' }), { status: 500, headers: corsHeaders });
    }

    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

    // Read source tournament
    console.log(`Fetching source tournament with ID: ${sourceTournamentId}`);
    const { data: source, error: srcErr } = await supabase
      .from('tournaments')
      .select('id')
      .eq('id', sourceTournamentId)
      .single();
    if (srcErr || !source) {
      console.error('Error fetching source tournament:', srcErr);
      return new Response(JSON.stringify({ error: 'Source tournament not found' }), { status: 404, headers: corsHeaders });
    }
    console.log('Source tournament found:', source);

    // Create new tournament
    const insertTournament = {
      name,
      slug,
      description: null,
      is_public,
      created_by,
    } as Record<string, unknown>;

    console.log('Creating new tournament with data:', insertTournament);
    const { data: created, error: createErr } = await supabase
      .from('tournaments')
      .insert(insertTournament)
      .select('*')
      .single();
    if (createErr || !created) {
      console.error('Error creating new tournament:', createErr);
      return new Response(JSON.stringify({ error: createErr?.message || 'Failed to create tournament' }), { status: 400, headers: corsHeaders });
    }
    console.log('New tournament created successfully:', created);

    const newTournamentId = created.id as string;

    // Clone members: copy all members from source, but ensure requester is owner
    console.log(`Cloning members from source tournament ${sourceTournamentId}...`);
    const { data: members, error: memErr } = await supabase
      .from('tournament_members')
      .select('user_id, role, is_active')
      .eq('tournament_id', sourceTournamentId);
    if (memErr) {
      console.error('Error fetching members from source tournament:', memErr);
      return new Response(JSON.stringify({ error: memErr.message }), { status: 400, headers: corsHeaders });
    }
    console.log(`Found ${members?.length || 0} members to clone.`);

    // Filter out the creator from the list of members to clone, then add them as owner.
    const memberRows = (members || [])
      .filter(m => m.user_id !== created_by)
      .map((m) => ({
        tournament_id: newTournamentId,
        user_id: m.user_id,
        role: m.role,
        is_active: m.is_active,
        joined_at: new Date().toISOString(),
      }));

    // Ensure requester is always the owner of the new tournament
    memberRows.push({
      tournament_id: newTournamentId,
      user_id: created_by,
      role: 'owner',
      is_active: true,
      joined_at: new Date().toISOString(),
    } as any);

    if (memberRows.length > 0) {
      console.log('Inserting new member rows:', memberRows);
      const { error: insMemErr } = await supabase
        .from('tournament_members')
        .insert(memberRows);
      if (insMemErr) {
        console.error('Error inserting new members:', insMemErr);
        return new Response(JSON.stringify({ error: insMemErr.message }), { status: 400, headers: corsHeaders });
      }
      console.log('Members cloned successfully.');
    }

    // Clone games: copy basic fields, point to new tournament
    console.log(`Cloning games from source tournament ${sourceTournamentId}...`);
    const { data: games, error: gamesErr } = await supabase
      .from('games')
      .select('name, description, logo_url, is_active, include_in_challenge')
      .eq('tournament_id', sourceTournamentId);
    if (gamesErr) {
      console.error('Error fetching games from source tournament:', gamesErr);
      return new Response(JSON.stringify({ error: gamesErr.message }), { status: 400, headers: corsHeaders });
    }
    console.log(`Found ${games?.length || 0} games to clone.`);

    if (games && games.length > 0) {
      const gameRows = games.map((g) => ({
        name: g.name,
        description: g.description ?? null,
        logo_url: g.logo_url ?? null,
        is_active: g.is_active,
        include_in_challenge: g.include_in_challenge,
        tournament_id: newTournamentId,
      }));
      console.log('Inserting new game rows...');
      const { error: insGamesErr } = await supabase
        .from('games')
        .insert(gameRows);
      if (insGamesErr) {
        console.error('Error inserting new games:', insGamesErr);
        return new Response(JSON.stringify({ error: insGamesErr.message }), { status: 400, headers: corsHeaders });
      }
      console.log('Games cloned successfully.');
    }

    console.log('Clone process completed successfully.');
    return new Response(JSON.stringify({ tournament: created }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('An unexpected error occurred:', e);
    return new Response(JSON.stringify({ error: e?.message || 'Unexpected error' }), { status: 500, headers: corsHeaders });
  }
});



