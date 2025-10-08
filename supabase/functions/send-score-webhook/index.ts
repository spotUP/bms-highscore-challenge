// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

// Declare Deno global for TypeScript
declare const Deno: any;

interface Score {
  score: number;
}

interface WebhookConfig {
  id: string;
  user_id: string;
  platform: string;
  webhook_url: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ScoreWebhookRequest {
  player_name: string;
  score: number;
  game_name: string;
  game_id: string;
  type?: 'new_score' | 'score_improved';
  previous_score?: number;
  timestamp: string;
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper function to send webhook to a specific URL
const sendToWebhook = async (webhookUrl: string, message: any, label: string) => {
  try {
    console.log(`Sending webhook to ${label}:`, webhookUrl);
    console.log(`${label} message payload:`, JSON.stringify(message, null, 2));

    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    console.log(`${label} webhook response status:`, webhookResponse.status);

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text();
      console.error(`${label} webhook error response:`, errorText);
      throw new Error(`${label} webhook failed: ${webhookResponse.status} - ${errorText}`);
    }

    const responseText = await webhookResponse.text();
    console.log(`${label} webhook success response:`, responseText);
    return { success: true, response: responseText };
  } catch (error) {
    console.error(`${label} webhook failed:`, error);
    throw error;
  }
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const webhookData = await req.json() as ScoreWebhookRequest;
    
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

    const scores: Score[] = scoresData || [];
    // Calculate position (1-based index) - count how many scores are higher than this one
    const position = (scores.filter((score: Score) => score.score > webhookData.score).length || 0) + 1;

    // Use a simple, reliable placeholder image that Teams can display
    let gameLogoUrl = "https://cdn-icons-png.flaticon.com/512/1574/1574337.png"; // Trophy icon
    
    // Try to use the actual game logo from Supabase Storage
    if (gameData.logo_url && gameData.logo_url.startsWith('/game-logos/')) {
      const fileName = gameData.logo_url.substring('/game-logos/'.length);
      const supabaseLogoUrl = `${supabaseUrl}/storage/v1/object/public/game-logos/${fileName}`;
      // Use the actual logo URL, fall back to trophy if it fails to load
      gameLogoUrl = supabaseLogoUrl;
    }
    else if (gameData.logo_url && gameData.logo_url.includes('supabase.co/storage/')) {
      gameLogoUrl = gameData.logo_url;
    }
    
    console.log("Game logo URL:", gameLogoUrl);
    console.log("Game data:", JSON.stringify(gameData, null, 2));

    // Get Clear Logo URL for the game
    let clearLogoUrl = null;
    try {
      // Try to get the Clear Logo using the same logic as the frontend
      if (gameData.name) {
        const safeFileName = gameData.name.replace(/[^a-zA-Z0-9\-_\s]/g, '').replace(/\s+/g, '-').toLowerCase();
        clearLogoUrl = `http://localhost:3001/clear-logos/${safeFileName}.webp`;

        // For production, use the API route
        if (!supabaseUrl.includes('localhost')) {
          clearLogoUrl = `${supabaseUrl.replace('/functions/v1', '')}/api/clear-logos/${safeFileName}.webp`;
        }
      }
    } catch (error) {
      console.warn("Could not generate Clear Logo URL:", error);
    }

    // Create the Teams message with attachments array (Power Automate format)
    const teamsMessage = {
      "attachments": [
        {
          "contentType": "application/vnd.microsoft.card.adaptive",
          "content": {
            "type": "AdaptiveCard",
            "version": "1.5",
            "body": [
              // Add Clear Logo at the top if available
              ...(clearLogoUrl ? [{
                "type": "Image",
                "url": clearLogoUrl,
                "size": "Medium",
                "horizontalAlignment": "Center",
                "spacing": "Small"
              }] : []),
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
                    "text": "🏆 #" + position + " " + webhookData.player_name,
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
                    "size": "Medium",
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

    // Get all enabled webhook configurations from all users
    const { data: webhookConfigs, error: webhookError } = await supabase
      .from('webhook_config')
      .select('*')
      .eq('platform', 'teams')
      .eq('enabled', true)
      .neq('webhook_url', '')
      .not('webhook_url', 'is', null);

    if (webhookError) {
      console.error("Error fetching webhook configs:", webhookError);
      // Fallback to environment variable or hardcoded URL
      const fallbackUrl = Deno.env.get('TEAMS_WEBHOOK_URL') || "https://defaultb880007628fd4e2691f5df32a17ab7.e4.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/feb381c9899444c3937d80295b4afc57/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=5H4ofX0in_nS0DVzRKur5Y4YpXKILSqp2BMUXH4rfKU";
      await sendToWebhook(fallbackUrl, teamsMessage, "fallback");
    } else if (!webhookConfigs || webhookConfigs.length === 0) {
      console.log("No enabled Teams webhooks found");
      return new Response(JSON.stringify({
        success: true,
        message: "No enabled Teams webhooks configured",
        position: position,
        gameLogoUrl: gameLogoUrl
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    } else {
      const configs: WebhookConfig[] = webhookConfigs;
      // Send to all enabled webhook URLs
      console.log(`Found ${configs.length} enabled Teams webhook(s)`);

      const webhookPromises = configs.map(async (config: WebhookConfig, index: number) => {
        return sendToWebhook(config.webhook_url, teamsMessage, `user-${index + 1}`);
      });

      const results = await Promise.allSettled(webhookPromises);
      const successCount = results.filter((r: PromiseSettledResult<any>) => r.status === 'fulfilled').length;
      const failureCount = results.filter((r: PromiseSettledResult<any>) => r.status === 'rejected').length;

      console.log(`Webhook results: ${successCount} succeeded, ${failureCount} failed`);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Webhooks processed",
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