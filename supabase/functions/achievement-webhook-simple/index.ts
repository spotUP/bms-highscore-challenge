import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SimpleAchievementRequest {
  player_name: string;
  achievements: Array<{
    name: string;
    description: string;
    points: number;
  }>;
  game_name?: string;
  score?: number;
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper function to send webhook to a specific URL
const sendToWebhook = async (webhookUrl: string, message: any, label: string) => {
  try {
    console.log(`Sending achievement webhook to ${label}:`, webhookUrl);

    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    console.log(`${label} achievement webhook response status:`, webhookResponse.status);

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text();
      console.error(`${label} achievement webhook error:`, errorText);
      throw new Error(`${label} achievement webhook failed: ${webhookResponse.status}`);
    }

    const responseText = await webhookResponse.text();
    console.log(`${label} achievement webhook success:`, responseText);
    return { success: true, response: responseText };
  } catch (error) {
    console.error(`${label} achievement webhook failed:`, error);
    throw error;
  }
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: SimpleAchievementRequest = await req.json();
    
    console.log("🏆 New achievement webhook:", data);

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
      // Fallback to environment variable
      const fallbackUrl = Deno.env.get('TEAMS_WEBHOOK_URL');
      if (fallbackUrl) {
        console.log("Using fallback Teams webhook URL");
      } else {
        console.log("No webhook configurations found and no fallback URL");
        return new Response(JSON.stringify({ 
          success: true, 
          message: "No webhooks configured"
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    // Calculate total points
    const totalPoints = data.achievements.reduce((sum, achievement) => sum + achievement.points, 0);
    
    // Create header based on number of achievements
    const headerText = data.achievements.length === 1 
      ? "🏆 ACHIEVEMENT UNLOCKED!"
      : `🏆 ${data.achievements.length} ACHIEVEMENTS UNLOCKED!`;

    // Create Teams Adaptive Card message
    const cardBody = [
        {
          "type": "TextBlock",
          "text": headerText,
          "wrap": true,
          "style": "heading",
          "size": "ExtraLarge",
          "horizontalAlignment": "Center",
          "color": "Good"
        },
        {
          "type": "TextBlock",
          "text": `🎯 ${data.player_name}`,
          "wrap": true,
          "size": "Large",
          "weight": "Bolder",
          "color": "Accent",
          "horizontalAlignment": "Center"
        }
      ];

      // Add each achievement
      data.achievements.forEach((achievement, index) => {
        cardBody.push({
          "type": "Container",
          "horizontalAlignment": "Center",
          "separator": index > 0,
          "items": [
            {
              "type": "TextBlock",
              "text": `🏅 ${achievement.name}`,
              "wrap": true,
              "size": "Medium",
              "weight": "Bolder",
              "color": "Good",
              "horizontalAlignment": "Center"
            },
            {
              "type": "TextBlock",
              "text": `📝 ${achievement.description}`,
              "wrap": true,
              "size": "Small",
              "color": "Default",
              "horizontalAlignment": "Center"
            },
            {
              "type": "TextBlock",
              "text": `⭐ +${achievement.points} Points`,
              "wrap": true,
              "size": "Small",
              "weight": "Bolder",
              "color": "Accent",
              "horizontalAlignment": "Center"
            }
          ]
        });
      });

      // Add total points if multiple achievements
      if (data.achievements.length > 1) {
        cardBody.push({
          "type": "TextBlock",
          "text": `🎊 Total: +${totalPoints} Points`,
          "wrap": true,
          "size": "Large",
          "weight": "Bolder",
          "color": "Accent",
          "horizontalAlignment": "Center",
          "separator": true
        });
      }

      // Add game context if available
      if (data.game_name && data.score) {
        cardBody.push({
          "type": "Container",
          "horizontalAlignment": "Center",
          "separator": true,
          "items": [
            {
              "type": "TextBlock",
              "text": `🎮 Earned in: ${data.game_name}`,
              "wrap": true,
              "size": "Small",
              "color": "Default",
              "horizontalAlignment": "Center"
            },
            {
              "type": "TextBlock",
              "text": `🎯 Score: ${data.score.toLocaleString()}`,
              "wrap": true,
              "size": "Small",
              "color": "Default",
              "horizontalAlignment": "Center"
            }
          ]
        });
      }

      const message = {
        "attachments": [
          {
            "contentType": "application/vnd.microsoft.card.adaptive",
            "content": {
              "type": "AdaptiveCard",
              "version": "1.5",
              "body": cardBody
            }
          }
        ]
      };

      console.log("Sending achievement to webhooks:", JSON.stringify(message, null, 2));

      let successCount = 0;
      let failureCount = 0;

      if (webhookConfigs && webhookConfigs.length > 0) {
        // Send to all enabled webhook URLs
        console.log(`Found ${webhookConfigs.length} enabled Teams webhook(s)`);
        
        const webhookPromises = webhookConfigs.map(async (config, index) => {
          return sendToWebhook(config.webhook_url, message, `user-${index + 1}`);
        });

        const results = await Promise.allSettled(webhookPromises);
        successCount = results.filter(r => r.status === 'fulfilled').length;
        failureCount = results.filter(r => r.status === 'rejected').length;

        console.log(`Achievement webhook results: ${successCount} succeeded, ${failureCount} failed`);
      } else {
        // Fallback to environment variable if no user configs found
        const fallbackUrl = Deno.env.get('TEAMS_WEBHOOK_URL');
        if (fallbackUrl) {
          try {
            await sendToWebhook(fallbackUrl, message, "fallback");
            successCount = 1;
          } catch (error) {
            failureCount = 1;
          }
        } else {
          console.log("No webhook configurations found and no fallback URL");
        }
      }

    return new Response(JSON.stringify({
      success: successCount > 0,
      message: successCount > 0 ? `Achievement sent to ${successCount} webhook(s)!` : "No webhooks configured or all failed",
      platforms_sent: successCount,
      platforms_failed: failureCount
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error: any) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
};

serve(handler);
