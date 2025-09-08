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
    console.log("🗑️ Starting achievement reset process...");

    // Get current counts before deletion
    const { count: achievementCount } = await supabase
      .from('player_achievements')
      .select('*', { count: 'exact', head: true });

    const { count: statsCount } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true });

    console.log(`📊 Current data: ${achievementCount} player achievements, ${statsCount} player stats`);

    // Reset player achievements
    const { error: achievementError } = await supabase
      .from('player_achievements')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records

    if (achievementError) {
      console.error("❌ Error deleting player achievements:", achievementError);
      throw new Error(`Failed to delete player achievements: ${achievementError.message}`);
    }

    // Reset player stats
    const { error: statsError } = await supabase
      .from('player_stats')
      .delete()
      .neq('player_name', '__NONEXISTENT__'); // Delete all records

    if (statsError) {
      console.error("❌ Error deleting player stats:", statsError);
      throw new Error(`Failed to delete player stats: ${statsError.message}`);
    }

    console.log("✅ Achievement reset completed successfully");

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
                    "text": "🗑️ ACHIEVEMENT SYSTEM RESET",
                    "wrap": true,
                    "style": "heading",
                    "size": "Large",
                    "horizontalAlignment": "Center",
                    "color": "Warning"
                  },
                  {
                    "type": "TextBlock",
                    "text": "All player achievements and stats have been cleared.",
                    "wrap": true,
                    "horizontalAlignment": "Center"
                  },
                  {
                    "type": "TextBlock",
                    "text": `Deleted: ${achievementCount || 0} achievements, ${statsCount || 0} player stats`,
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
      message: "Achievement system reset successfully",
      deleted: {
        player_achievements: achievementCount || 0,
        player_stats: statsCount || 0
      },
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error: any) {
    console.error("❌ Error in reset-achievements function:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      details: "Failed to reset achievement system"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
};

serve(handler);
