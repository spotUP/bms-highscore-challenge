import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

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

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: SimpleAchievementRequest = await req.json();
    
    console.log("🏆 New achievement webhook:", data);

    // Get Teams webhook URL
    const teamsUrl = Deno.env.get('TEAMS_WEBHOOK_URL');
    console.log("Teams URL exists:", !!teamsUrl);

    let teamsSuccess = false;

    if (teamsUrl) {
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

      console.log("Sending to Teams:", JSON.stringify(message, null, 2));

      try {
        const response = await fetch(teamsUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message),
        });

        teamsSuccess = response.ok;
        console.log("Teams response:", response.status, response.ok);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error("Teams error:", errorText);
        }
      } catch (error) {
        console.error("Teams fetch error:", error);
      }
    } else {
      console.log("No Teams webhook URL configured");
    }

    return new Response(JSON.stringify({
      success: teamsSuccess,
      message: teamsSuccess ? "Achievement sent to Teams!" : "No webhook configured or failed",
      platforms_sent: teamsSuccess ? 1 : 0
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
