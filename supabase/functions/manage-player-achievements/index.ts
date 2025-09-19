import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

interface ManagePlayerAchievementsRequest {
  action: 'delete';
  player_achievement_id: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    );

    // Get auth header and verify user is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    // Verify the user's session
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Invalid or expired token');
    }

    // Check if user is admin/tournament creator
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    const isAdmin = userRole?.role === 'admin' || userRole?.role === 'tournament_creator';
    if (!isAdmin) {
      throw new Error('Insufficient permissions - admin access required');
    }

    const body = await req.json();
    const { action, player_achievement_id }: ManagePlayerAchievementsRequest = body;

    if (action === 'delete') {
      if (!player_achievement_id) {
        throw new Error('player_achievement_id is required for delete action');
      }

      // Verify the record exists before deletion
      const { data: existingRecord, error: checkError } = await supabase
        .from('player_achievements')
        .select('id, player_name, achievements(name)')
        .eq('id', player_achievement_id)
        .single();

      if (checkError) {
        console.error('❌ Error checking record:', checkError);
        throw new Error(`Failed to verify record: ${checkError.message}`);
      }

      if (!existingRecord) {
        throw new Error('Player achievement not found');
      }

      console.log('🎯 Deleting player achievement:', {
        id: existingRecord.id,
        player: existingRecord.player_name,
        achievement: existingRecord.achievements?.name
      });

      // Delete the player achievement
      const { error: deleteError } = await supabase
        .from('player_achievements')
        .delete()
        .eq('id', player_achievement_id);

      if (deleteError) {
        console.error('❌ Delete error:', deleteError);
        throw new Error(`Failed to delete player achievement: ${deleteError.message}`);
      }

      console.log('✅ Successfully deleted player achievement');

      return new Response(JSON.stringify({
        success: true,
        message: `Successfully deleted player achievement for ${existingRecord.player_name}`,
        deletedRecord: existingRecord
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });

    } else {
      throw new Error("Invalid action specified");
    }

  } catch (error: any) {
    console.error("Error in manage-player-achievements function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "An unknown error occurred",
        details: error.toString()
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
};

Deno.serve(handler);