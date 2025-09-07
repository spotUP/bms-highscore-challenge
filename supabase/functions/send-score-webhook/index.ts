import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ScoreWebhookRequest {
  player_name: string;
  score: number;
  game_name: string;
  game_id: string;
  type: 'new_score' | 'score_improved';
  previous_score?: number;
  timestamp: string;
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const webhookData: ScoreWebhookRequest = await req.json();
    
    console.log("Processing webhook data:", webhookData);

    // Get game information including logo URL
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .select('logo_url, name')
      .eq('id', webhookData.game_id)
      .single();

    if (gameError) {
      console.error("Error fetching game data:", gameError);
      throw new Error(`Failed to fetch game data: ${gameError.message}`);
    }

    // Get the position/rank of this score
    const { data: scoresData, error: scoresError } = await supabase
      .from('scores')
      .select('score')
      .eq('game_id', webhookData.game_id)
      .order('score', { ascending: false });

    if (scoresError) {
      console.error("Error fetching scores for ranking:", scoresError);
      throw new Error(`Failed to fetch scores for ranking: ${scoresError.message}`);
    }

    // Calculate position (1-based index)
    const position = scoresData?.findIndex(score => score.score === webhookData.score) + 1 || 1;

    // Get the game logo URL - use database URL or fallback to a default
    const gameLogoUrl = gameData.logo_url || 'https://via.placeholder.com/200x200/1a1a1a/ffffff?text=GAME';

    // Create the Teams message with attachments array (Power Automate format)
    const teamsMessage = {
      "attachments": [
        {
          "contentType": "application/vnd.microsoft.card.adaptive",
          "content": {
            "type": "AdaptiveCard",
            "version": "1.5",
            "body": [
              {
                "type": "Container",
                "horizontalAlignment": "Center",
                "items": [
                  {
                    "type": "Image",
                    "url": gameLogoUrl,
                    "horizontalAlignment": "Center",
                    "width": "100%",
                    "height": "auto",
                    "size": "Auto"
                  }
                ]
              },
              {
                "type": "TextBlock",
                "text": "NEW HIGHSCORE ALERT!",
                "wrap": true,
                "style": "heading",
                "size": "ExtraLarge",
                "horizontalAlignment": "Center",
                "color": "Accent"
              },
              {
                "type": "Container",
                "horizontalAlignment": "Center",
                "items": [
                  {
                    "type": "TextBlock",
                    "text": "🏆 #1 " + webhookData.player_name,
                    "wrap": true,
                    "size": "Large",
                    "weight": "Bolder",
                    "color": "Accent",
                    "horizontalAlignment": "Center"
                  },
                  {
                    "type": "TextBlock",
                    "text": "Score: " + webhookData.score.toLocaleString(),
                    "wrap": true,
                    "size": "Medium",
                    "weight": "Bolder",
                    "color": "Good",
                    "horizontalAlignment": "Center"
                  },
                  {
                    "type": "TextBlock",
                    "text": "Game: " + webhookData.game_name,
                    "wrap": true,
                    "size": "Small",
                    "color": "Default",
                    "horizontalAlignment": "Center"
                  }
                ]
              }
            ]
          }
        }
      ]
    };

    // Send the Teams MessageCard to Microsoft Teams
    const webhookUrl = "https://defaultb880007628fd4e2691f5df32a17ab7.e4.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/feb381c9899444c3937d80295b4afc57/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=5H4ofX0in_nS0DVzRKur5Y4YpXKILSqp2BMUXH4rfKU";

    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(teamsMessage),
    });

    console.log("Webhook response status:", webhookResponse.status);
    console.log("Webhook response headers:", Object.fromEntries(webhookResponse.headers.entries()));

    
    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text();
      console.error("Webhook error response:", errorText);
      throw new Error(`Webhook failed: ${webhookResponse.status} - ${errorText}`);
    }

    const responseText = await webhookResponse.text();
    console.log("Webhook success response:", responseText);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Teams MessageCard sent successfully",
      position: position,
      gameLogoUrl: gameLogoUrl
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-score-webhook function:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        details: "Failed to send Teams MessageCard to Microsoft Teams"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);