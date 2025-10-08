// @ts-ignore
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

// Declare Deno global for TypeScript
declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AchievementWebhookRequest {
  player_name: string;
  achievement: {
    id: string;
    name: string;
    description: string;
    badge_icon: string;
    badge_color: string;
    points: number;
  };
  game_name?: string;
  game_id?: string;
  score?: number;
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
    const webhookData = await req.json() as AchievementWebhookRequest;
    
    console.log("Processing achievement webhook data:", JSON.stringify(webhookData, null, 2));

    // Validate required data
    if (!webhookData.achievement) {
      console.error("Missing achievement data in webhook request. Received:", webhookData);
      throw new Error("Missing achievement data in webhook request");
    }

    if (!webhookData.achievement.name) {
      console.error("Missing achievement name. Achievement data:", webhookData.achievement);
      throw new Error("Achievement missing required name field");
    }

    if (!webhookData.achievement.badge_color) {
      console.warn("Missing badge_color, using default");
      webhookData.achievement.badge_color = "#FFD700";
    }

    if (!webhookData.achievement.badge_icon) {
      console.warn("Missing badge_icon, using default");
      webhookData.achievement.badge_icon = "🏆";
    }

    // Get Clear Logo URL if game information is available
    let clearLogoUrl = null;
    if (webhookData.game_id) {
      try {
        // Get game information
        const { data: gameData, error: gameError } = await supabase
          .from('games')
          .select('name')
          .eq('id', webhookData.game_id)
          .single();

        if (!gameError && gameData) {
          // Generate Clear Logo URL using the same logic as the frontend
          const safeFileName = gameData.name.replace(/[^a-zA-Z0-9\-_\s]/g, '').replace(/\s+/g, '-').toLowerCase();
          clearLogoUrl = `http://localhost:3001/clear-logos/${safeFileName}.webp`;

          // For production, use the API route
          if (!supabaseUrl.includes('localhost')) {
            clearLogoUrl = `${supabaseUrl.replace('/functions/v1', '')}/api/clear-logos/${safeFileName}.webp`;
          }
        }
      } catch (error) {
        console.warn("Could not get Clear Logo URL for achievement:", error);
      }
    }

    // Use a simpler approach - just use a placeholder image or remove the image entirely
    // The SVG data URI might be causing issues with Teams
    const achievementBadgeUrl = "https://cdn-icons-png.flaticon.com/512/1574/1574337.png"; // Trophy icon placeholder

    // Create Teams message with Adaptive Card format to include Clear Logo
    let teamsMessage;

    if (clearLogoUrl) {
      // Use Adaptive Card format when we have a Clear Logo
      teamsMessage = {
        "attachments": [
          {
            "contentType": "application/vnd.microsoft.card.adaptive",
            "content": {
              "type": "AdaptiveCard",
              "version": "1.5",
              "body": [
                // Add Clear Logo at the top
                {
                  "type": "Image",
                  "url": clearLogoUrl,
                  "size": "Medium",
                  "horizontalAlignment": "Center",
                  "spacing": "Small"
                },
                {
                  "type": "TextBlock",
                  "text": "🏆 ACHIEVEMENT UNLOCKED!",
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
                      "text": `${webhookData.player_name} earned ${webhookData.achievement.name || "Unknown Achievement"}`,
                      "wrap": true,
                      "size": "Large",
                      "weight": "Bolder",
                      "color": "Accent",
                      "horizontalAlignment": "Center"
                    },
                    {
                      "type": "TextBlock",
                      "text": `+${webhookData.achievement.points || 0} points`,
                      "wrap": true,
                      "size": "Medium",
                      "weight": "Bolder",
                      "color": "Good",
                      "horizontalAlignment": "Center"
                    }
                  ]
                },
                // Add game context if available
                ...(webhookData.game_name && webhookData.score ? [{
                  "type": "TextBlock",
                  "text": `In ${webhookData.game_name} with score ${webhookData.score.toLocaleString()}`,
                  "wrap": true,
                  "size": "Medium",
                  "color": "Default",
                  "horizontalAlignment": "Center"
                }] : [])
              ]
            }
          }
        ]
      };
    } else {
      // Fallback to simple text message when no Clear Logo
      teamsMessage = {
        "text": `Achievement Unlocked: ${webhookData.player_name} earned ${webhookData.achievement.name || "Unknown Achievement"} (+${webhookData.achievement.points || 0} points)`
      };

      // Add game context if available
      if (webhookData.game_name && webhookData.score) {
        teamsMessage.text += ` in ${webhookData.game_name} with score ${webhookData.score.toLocaleString()}`;
      }
    }

    // Send to Microsoft Teams
    const teamsWebhookUrl = Deno.env.get('TEAMS_WEBHOOK_URL');
    let teamsResponse = null;
    
    console.log("🔍 Checking Teams webhook URL...");
    console.log("Teams webhook URL exists:", !!teamsWebhookUrl);
    console.log("Teams webhook URL length:", teamsWebhookUrl?.length || 0);
    console.log("Teams webhook URL value:", teamsWebhookUrl ? "FOUND" : "NOT FOUND");
    console.log("Available env vars:", Object.keys(Deno.env.toObject()));
    console.log("Env var TEAMS_WEBHOOK_URL specifically:", Deno.env.get('TEAMS_WEBHOOK_URL') ? "EXISTS" : "MISSING");
    
    if (teamsWebhookUrl) {
      try {
        console.log("🔗 Teams webhook URL found:", teamsWebhookUrl ? "Yes" : "No");
        console.log("📤 Sending achievement webhook to Teams...");
        console.log("📋 Teams message payload:", JSON.stringify(teamsMessage, null, 2));
        
        teamsResponse = await fetch(teamsWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(teamsMessage),
        });

        console.log("📊 Teams webhook response status:", teamsResponse.status);
        console.log("✅ Teams webhook response ok:", teamsResponse.ok);
        
        if (!teamsResponse.ok) {
          const errorText = await teamsResponse.text();
          console.error("❌ Teams webhook error details:", errorText);
          console.error("❌ Teams webhook headers:", Object.fromEntries(teamsResponse.headers.entries()));
        } else {
          const responseText = await teamsResponse.text();
          console.log("✅ Teams webhook success response:", responseText);
        }
      } catch (error) {
        console.error("💥 Error sending to Teams:", error);
        console.error("💥 Error stack:", (error as any).stack);
      }
    } else {
      console.warn("⚠️ No Teams webhook URL configured");
    }

    // Send to Discord if configured
    const discordWebhookUrl = Deno.env.get('DISCORD_WEBHOOK_URL');
    let discordResponse = null;
    
    if (discordWebhookUrl) {
      try {
        const discordMessage = {
          username: "BMS Achievement Bot",
          embeds: [{
            title: "🏆 Achievement Unlocked!",
            description: `**${webhookData.player_name}** just unlocked a new achievement!`,
            color: parseInt((webhookData.achievement.badge_color || '#FFD700').replace('#', ''), 16),
            thumbnail: { url: achievementBadgeUrl },
            fields: [
              {
                name: "🏅 Achievement",
                value: webhookData.achievement.name || "Unknown Achievement",
                inline: true
              },
              {
                name: "⭐ Points",
                value: `+${webhookData.achievement.points || 0}`,
                inline: true
              },
              {
                name: "📝 Description",
                value: webhookData.achievement.description || "No description available",
                inline: false
              }
            ],
            footer: {
              text: "BMS Highscore Challenge",
              icon_url: "https://cdn.discordapp.com/embed/avatars/0.png"
            },
            timestamp: new Date(webhookData.timestamp).toISOString()
          }]
        };

        // Add game context to Discord message
        if (webhookData.game_name && webhookData.score) {
          discordMessage.embeds[0].fields.push({
            name: "🎮 Game Context",
            value: `${webhookData.game_name} (Score: ${webhookData.score.toLocaleString()})`,
            inline: false
          });
        }

        console.log("Sending achievement webhook to Discord:", discordWebhookUrl);
        
        discordResponse = await fetch(discordWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(discordMessage),
        });

        console.log("Discord webhook response status:", discordResponse.status);
        
        if (!discordResponse.ok) {
          const errorText = await discordResponse.text();
          console.error("Discord webhook error:", errorText);
        }
      } catch (error) {
        console.error("Error sending to Discord:", error);
      }
    }

    // Send to Slack if configured
    const slackWebhookUrl = Deno.env.get('SLACK_WEBHOOK_URL');
    let slackResponse = null;
    
    if (slackWebhookUrl) {
      try {
        const slackMessage = {
          text: "🏆 Achievement Unlocked!",
          blocks: [
            {
              type: "header",
              text: {
                type: "plain_text",
                text: "🏆 Achievement Unlocked!"
              }
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*${webhookData.player_name}* just unlocked a new achievement!`
              },
              accessory: {
                type: "image",
                image_url: achievementBadgeUrl,
                alt_text: webhookData.achievement.name
              }
            },
            {
              type: "section",
              fields: [
                {
                  type: "mrkdwn",
                  text: `*Achievement:*\n${webhookData.achievement.name || "Unknown Achievement"}`
                },
                {
                  type: "mrkdwn",
                  text: `*Points:*\n+${webhookData.achievement.points || 0}`
                },
                {
                  type: "mrkdwn",
                  text: `*Description:*\n${webhookData.achievement.description || "No description available"}`
                }
              ]
            }
          ]
        };

        // Add game context to Slack message
        if (webhookData.game_name && webhookData.score) {
          slackMessage.blocks.push({
            type: "context",
            // @ts-ignore - Slack API allows elements in context blocks
            elements: [
              {
                type: "mrkdwn",
                text: `🎮 *${webhookData.game_name}* (Score: ${webhookData.score.toLocaleString()})`
              }
            ]
          });
        }

        console.log("Sending achievement webhook to Slack:", slackWebhookUrl);
        
        slackResponse = await fetch(slackWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(slackMessage),
        });

        console.log("Slack webhook response status:", slackResponse.status);
        
        if (!slackResponse.ok) {
          const errorText = await slackResponse.text();
          console.error("Slack webhook error:", errorText);
        }
      } catch (error) {
        console.error("Error sending to Slack:", error);
      }
    }

    // Collect results
    const results = {
      teams: teamsResponse ? { status: teamsResponse.status, success: teamsResponse.ok } : null,
      discord: discordResponse ? { status: discordResponse.status, success: discordResponse.ok } : null,
      slack: slackResponse ? { status: slackResponse.status, success: slackResponse.ok } : null
    };

    const successCount = Object.values(results).filter(r => r && r.success).length;
    const totalConfigured = Object.values(results).filter(r => r !== null).length;

    return new Response(JSON.stringify({ 
      success: successCount > 0,
      message: `Achievement webhook sent to ${successCount}/${totalConfigured} platforms`,
      results: results,
      achievement: webhookData.achievement,
      player: webhookData.player_name
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-achievement-webhook function:", error);
    console.error("Error stack:", error.stack);
    console.error("Error details:", JSON.stringify(error, null, 2));
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || "Unknown error",
        errorType: error.constructor.name,
        details: "Failed to send achievement webhook",
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
