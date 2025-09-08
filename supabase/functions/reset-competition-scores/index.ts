import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🗑️ Starting competition scores reset process...");

    // Get current active competition games (games with include_in_challenge = true)
    const { data: competitionGames, error: gamesError } = await supabase
      .from('games')
      .select('id, name')
      .eq('include_in_challenge', true)
      .eq('is_active', true);

    if (gamesError) {
      console.error("❌ Error fetching competition games:", gamesError);
      throw new Error(`Failed to fetch competition games: ${gamesError.message}`);
    }

    if (!competitionGames || competitionGames.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: "No active competition games found - nothing to reset",
        deleted: {
          scores: 0,
          player_achievements: 0,
          player_stats: 0
        },
        games: []
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const gameIds = competitionGames.map(g => g.id);
    console.log(`🎮 Found ${competitionGames.length} competition games:`, competitionGames.map(g => g.name));

    // Get current scores count before deletion
    const { count: scoresCount } = await supabase
      .from('scores')
      .select('*', { count: 'exact', head: true })
      .in('game_id', gameIds);

    const { count: achievementCount } = await supabase
      .from('player_achievements')
      .select('*', { count: 'exact', head: true });

    const { count: statsCount } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true });

    console.log(`📊 Current data: ${scoresCount} competition scores, ${achievementCount} achievements, ${statsCount} player stats`);

    // Delete scores for competition games only
    const { error: scoresError } = await supabase
      .from('scores')
      .delete()
      .in('game_id', gameIds);

    if (scoresError) {
      console.error("❌ Error deleting competition scores:", scoresError);
      throw new Error(`Failed to delete competition scores: ${scoresError.message}`);
    }

    // Also reset achievements and player stats since they're based on scores
    const { error: achievementError } = await supabase
      .from('player_achievements')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records

    if (achievementError) {
      console.error("❌ Error deleting player achievements:", achievementError);
      throw new Error(`Failed to delete player achievements: ${achievementError.message}`);
    }

    const { error: statsError } = await supabase
      .from('player_stats')
      .delete()
      .neq('player_name', '__NONEXISTENT__'); // Delete all records

    if (statsError) {
      console.error("❌ Error deleting player stats:", statsError);
      throw new Error(`Failed to delete player stats: ${statsError.message}`);
    }

    console.log("✅ Competition reset completed successfully");

    // Send notification to Teams if configured
    const teamsUrl = Deno.env.get('TEAMS_WEBHOOK_URL');
    if (teamsUrl) {
      try {
        const message = {
          "attachments": [
            {
              "contentType": "application/vnd.microsoft.card.adaptive",
              "content": {
                "type": "AdaptiveCard",
                "version": "1.5",
                "body": [
                  {
                    "type": "TextBlock",
                    "text": "🔄 COMPETITION RESET",
                    "wrap": true,
                    "style": "heading",
                    "size": "Large",
                    "horizontalAlignment": "Center",
                    "color": "Warning"
                  },
                  {
                    "type": "TextBlock",
                    "text": "Competition scores and achievements have been reset!",
                    "wrap": true,
                    "horizontalAlignment": "Center"
                  },
                  {
                    "type": "TextBlock",
                    "text": `🎮 Games: ${competitionGames.length} competition games`,
                    "wrap": true,
                    "size": "Small",
                    "horizontalAlignment": "Center"
                  },
                  {
                    "type": "TextBlock",
                    "text": `🗑️ Deleted: ${scoresCount || 0} scores, ${achievementCount || 0} achievements`,
                    "wrap": true,
                    "size": "Small",
                    "horizontalAlignment": "Center"
                  },
                  {
                    "type": "TextBlock",
                    "text": `Reset at: ${new Date().toLocaleString()}`,
                    "wrap": true,
                    "size": "Small",
                    "color": "Default",
                    "horizontalAlignment": "Center"
                  },
                  {
                    "type": "TextBlock",
                    "text": "🏁 Ready for a fresh competition!",
                    "wrap": true,
                    "weight": "Bolder",
                    "color": "Good",
                    "horizontalAlignment": "Center"
                  }
                ]
              }
            }
          ]
        };

        const teamsResponse = await fetch(teamsUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message),
        });

        if (teamsResponse.ok) {
          console.log("✅ Teams notification sent");
        } else {
          console.log("⚠️ Teams notification failed:", teamsResponse.status);
        }
      } catch (teamsError) {
        console.error("❌ Teams notification error:", teamsError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: "Competition reset successfully",
      deleted: {
        scores: scoresCount || 0,
        player_achievements: achievementCount || 0,
        player_stats: statsCount || 0
      },
      games: competitionGames.map(g => g.name),
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error: any) {
    console.error("❌ Error in reset-competition-scores function:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      details: "Failed to reset competition scores"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
};

serve(handler);
