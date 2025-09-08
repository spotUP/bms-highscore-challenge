import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CompetitionWebhookRequest {
  event_type: 'competition_started' | 'competition_ended';
  competition_name?: string;
  games: Array<{
    id: string;
    name: string;
    logo_url?: string;
  }>;
  timestamp: string;
  duration?: string; // For competition_ended events
  total_scores?: number; // For competition_ended events
  winner?: {
    player_name: string;
    total_score: number;
  }; // For competition_ended events
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const webhookData: CompetitionWebhookRequest = await req.json();
    const { event_type, competition_name, games, timestamp, duration, total_scores, winner } = webhookData;

    console.log(`Sending competition webhook for event: ${event_type}`);

    // Teams Adaptive Card
    const teamsMessage = {
      type: "message",
      attachments: [{
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          type: "AdaptiveCard",
          version: "1.3",
          body: [
            {
              type: "TextBlock",
              text: event_type === 'competition_started' ? "🎮 Competition Started!" : "🏁 Competition Ended!",
              weight: "Bolder",
              size: "Large",
              color: event_type === 'competition_started' ? "Good" : "Warning"
            },
            {
              type: "TextBlock",
              text: competition_name || "Arcade High Score Challenge",
              weight: "Bolder",
              size: "Medium"
            },
            {
              type: "TextBlock",
              text: event_type === 'competition_started' 
                ? `🎯 ${games.length} games selected for this competition!`
                : `📊 Competition completed with ${total_scores || 0} total scores submitted`,
              wrap: true
            },
            {
              type: "TextBlock",
              text: `🕐 ${new Date(timestamp).toLocaleString()}`,
              size: "Small",
              color: "Light"
            }
          ],
          actions: [
            {
              type: "Action.OpenUrl",
              title: "View Leaderboard",
              url: `${Deno.env.get('SITE_URL') || 'http://localhost:8080'}`
            }
          ]
        }
      }]
    };

    // Add winner info for ended competitions
    if (event_type === 'competition_ended' && winner) {
      teamsMessage.attachments[0].content.body.push({
        type: "TextBlock",
        text: `🏆 Winner: ${winner.player_name} with ${winner.total_score.toLocaleString()} points!`,
        weight: "Bolder",
        color: "Accent"
      });
    }

    // Add games list
    if (games.length > 0) {
      teamsMessage.attachments[0].content.body.push({
        type: "TextBlock",
        text: `🎮 Games: ${games.map(g => g.name).join(', ')}`,
        wrap: true,
        size: "Small"
      });
    }

    // Discord Embed
    const discordMessage = {
      embeds: [{
        title: event_type === 'competition_started' ? "🎮 Competition Started!" : "🏁 Competition Ended!",
        description: competition_name || "Arcade High Score Challenge",
        color: event_type === 'competition_started' ? 0x00ff00 : 0xffaa00,
        fields: [
          {
            name: event_type === 'competition_started' ? "Games Selected" : "Final Stats",
            value: event_type === 'competition_started' 
              ? `${games.length} games ready for competition!`
              : `📊 ${total_scores || 0} total scores submitted`,
            inline: true
          },
          {
            name: "Timestamp",
            value: new Date(timestamp).toLocaleString(),
            inline: true
          }
        ],
        footer: {
          text: "BMS High Score Challenge"
        }
      }]
    };

    // Add winner info for ended competitions
    if (event_type === 'competition_ended' && winner) {
      discordMessage.embeds[0].fields.push({
        name: "🏆 Winner",
        value: `${winner.player_name} - ${winner.total_score.toLocaleString()} points`,
        inline: false
      });
    }

    // Add games list
    if (games.length > 0) {
      discordMessage.embeds[0].fields.push({
        name: "🎮 Games",
        value: games.map(g => g.name).join(', '),
        inline: false
      });
    }

    // Slack Blocks
    const slackMessage = {
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: event_type === 'competition_started' ? "🎮 Competition Started!" : "🏁 Competition Ended!"
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${competition_name || "Arcade High Score Challenge"}*\n${event_type === 'competition_started' ? `🎯 ${games.length} games selected for this competition!` : `📊 Competition completed with ${total_scores || 0} total scores submitted`}`
          }
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `🕐 ${new Date(timestamp).toLocaleString()}`
            }
          ]
        }
      ]
    };

    // Add winner info for ended competitions
    if (event_type === 'competition_ended' && winner) {
      slackMessage.blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🏆 *Winner:* ${winner.player_name} with ${winner.total_score.toLocaleString()} points!`
        }
      });
    }

    // Add games list
    if (games.length > 0) {
      slackMessage.blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🎮 *Games:* ${games.map(g => g.name).join(', ')}`
        }
      });
    }

    // Add view leaderboard button
    slackMessage.blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "View Leaderboard"
          },
          url: `${Deno.env.get('SITE_URL') || 'http://localhost:8080'}`
        }
      ]
    });

    // Send to Teams
    const teamsWebhookUrl = Deno.env.get('TEAMS_WEBHOOK_URL');
    if (teamsWebhookUrl) {
      try {
        const teamsResponse = await fetch(teamsWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(teamsMessage),
        });
        console.log('Teams webhook response:', teamsResponse.status);
      } catch (error) {
        console.error('Teams webhook error:', error);
      }
    }

    // Send to Discord
    const discordWebhookUrl = Deno.env.get('DISCORD_WEBHOOK_URL');
    if (discordWebhookUrl) {
      try {
        const discordResponse = await fetch(discordWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(discordMessage),
        });
        console.log('Discord webhook response:', discordResponse.status);
      } catch (error) {
        console.error('Discord webhook error:', error);
      }
    }

    // Send to Slack
    const slackWebhookUrl = Deno.env.get('SLACK_WEBHOOK_URL');
    if (slackWebhookUrl) {
      try {
        const slackResponse = await fetch(slackWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(slackMessage),
        });
        console.log('Slack webhook response:', slackResponse.status);
      } catch (error) {
        console.error('Slack webhook error:', error);
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "Competition webhooks sent" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-competition-webhook function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
