import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

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
    const webhookData: AchievementWebhookRequest = await req.json();
    
    console.log("Processing achievement webhook data:", webhookData);

    // Create achievement badge image
    const achievementBadgeSvg = `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="badgeGradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" style="stop-color:${webhookData.achievement.badge_color};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${webhookData.achievement.badge_color}80;stop-opacity:1" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="90" fill="url(#badgeGradient)" stroke="#FFD700" stroke-width="4"/>
      <text x="100" y="110" font-family="Arial, sans-serif" font-size="60" fill="white" text-anchor="middle" dominant-baseline="middle">${webhookData.achievement.badge_icon}</text>
    </svg>`;
    
    const achievementBadgeUrl = `data:image/svg+xml;base64,${btoa(achievementBadgeSvg)}`;

    // Create Teams message for achievement
    const teamsMessage = {
      "attachments": [
        {
          "contentType": "application/vnd.microsoft.card.adaptive",
          "content": {
            "type": "AdaptiveCard",
            "version": "1.5",
            "body": [
              {
                "type": "Image",
                "url": achievementBadgeUrl,
                "horizontalAlignment": "Center",
                "size": "Medium",
                "width": "100px",
                "height": "100px"
              },
              {
                "type": "TextBlock",
                "text": "🏆 ACHIEVEMENT UNLOCKED! 🏆",
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
                    "text": "🎯 " + webhookData.player_name,
                    "wrap": true,
                    "size": "Large",
                    "weight": "Bolder",
                    "color": "Accent",
                    "horizontalAlignment": "Center"
                  },
                  {
                    "type": "TextBlock",
                    "text": "🏅 " + webhookData.achievement.name,
                    "wrap": true,
                    "size": "Medium",
                    "weight": "Bolder",
                    "color": "Good",
                    "horizontalAlignment": "Center"
                  },
                  {
                    "type": "TextBlock",
                    "text": webhookData.achievement.description,
                    "wrap": true,
                    "size": "Small",
                    "color": "Default",
                    "horizontalAlignment": "Center"
                  },
                  {
                    "type": "TextBlock",
                    "text": "⭐ +" + webhookData.achievement.points + " points",
                    "wrap": true,
                    "size": "Small",
                    "weight": "Bolder",
                    "color": "Warning",
                    "horizontalAlignment": "Center"
                  }
                ]
              }
            ]
          }
        }
      ]
    };

    // Add game context if available
    if (webhookData.game_name && webhookData.score) {
      teamsMessage.attachments[0].content.body.push({
        "type": "TextBlock",
        "text": "🎮 In " + webhookData.game_name + " (Score: " + webhookData.score.toLocaleString() + ")",
        "wrap": true,
        "size": "Small",
        "color": "Default",
        "horizontalAlignment": "Center"
      });
    }

    // Send to Microsoft Teams
    const teamsWebhookUrl = Deno.env.get('TEAMS_WEBHOOK_URL');
    let teamsResponse = null;
    
    if (teamsWebhookUrl) {
      try {
        console.log("Sending achievement webhook to Teams:", teamsWebhookUrl);
        
        teamsResponse = await fetch(teamsWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(teamsMessage),
        });

        console.log("Teams webhook response status:", teamsResponse.status);
        
        if (!teamsResponse.ok) {
          const errorText = await teamsResponse.text();
          console.error("Teams webhook error:", errorText);
        }
      } catch (error) {
        console.error("Error sending to Teams:", error);
      }
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
            color: parseInt(webhookData.achievement.badge_color.replace('#', ''), 16),
            thumbnail: { url: achievementBadgeUrl },
            fields: [
              {
                name: "🏅 Achievement",
                value: webhookData.achievement.name,
                inline: true
              },
              {
                name: "⭐ Points",
                value: `+${webhookData.achievement.points}`,
                inline: true
              },
              {
                name: "📝 Description",
                value: webhookData.achievement.description,
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
                  text: `*Achievement:*\n${webhookData.achievement.name}`
                },
                {
                  type: "mrkdwn",
                  text: `*Points:*\n+${webhookData.achievement.points}`
                },
                {
                  type: "mrkdwn",
                  text: `*Description:*\n${webhookData.achievement.description}`
                }
              ]
            }
          ]
        };

        // Add game context to Slack message
        if (webhookData.game_name && webhookData.score) {
          slackMessage.blocks.push({
            type: "context",
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
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        details: "Failed to send achievement webhook"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
