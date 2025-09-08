import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TestWebhookRequest {
  webhook_url: string;
  payload: any;
  platform: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { webhook_url, payload, platform }: TestWebhookRequest = await req.json();
    
    console.log("Testing webhook for platform:", platform);
    console.log("Webhook URL:", webhook_url);

    let testMessage;
    
    // Create platform-specific test messages
    switch (platform) {
      case 'teams':
        testMessage = {
          "attachments": [
            {
              "contentType": "application/vnd.microsoft.card.adaptive",
              "content": {
                "type": "AdaptiveCard",
                "version": "1.5",
                "body": [
                  {
                    "type": "TextBlock",
                    "text": "🧪 WEBHOOK TEST 🧪",
                    "wrap": true,
                    "style": "heading",
                    "size": "ExtraLarge",
                    "horizontalAlignment": "Center",
                    "color": "Accent"
                  },
                  {
                    "type": "TextBlock",
                    "text": "This is a test message to verify webhook functionality for BMS Highscore Challenge achievement notifications.",
                    "wrap": true,
                    "size": "Medium",
                    "horizontalAlignment": "Center"
                  },
                  {
                    "type": "TextBlock",
                    "text": "✅ If you see this message, your webhook is working correctly!",
                    "wrap": true,
                    "size": "Small",
                    "color": "Good",
                    "horizontalAlignment": "Center"
                  }
                ]
              }
            }
          ]
        };
        break;
        
      case 'discord':
        testMessage = {
          username: "BMS Test Bot",
          embeds: [{
            title: "🧪 Webhook Test",
            description: "This is a test message to verify webhook functionality for BMS Highscore Challenge achievement notifications.",
            color: 0x00ff00,
            fields: [
              {
                name: "Status",
                value: "✅ Webhook is working correctly!",
                inline: false
              }
            ],
            footer: {
              text: "BMS Highscore Challenge - Test Message"
            },
            timestamp: new Date().toISOString()
          }]
        };
        break;
        
      case 'slack':
        testMessage = {
          text: "🧪 Webhook Test",
          blocks: [
            {
              type: "header",
              text: {
                type: "plain_text",
                text: "🧪 Webhook Test"
              }
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "This is a test message to verify webhook functionality for BMS Highscore Challenge achievement notifications."
              }
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "✅ *Webhook is working correctly!*"
              }
            }
          ]
        };
        break;
        
      default:
        testMessage = {
          text: "Test webhook message",
          data: payload
        };
    }

    console.log("Sending test message:", JSON.stringify(testMessage, null, 2));

    const response = await fetch(webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testMessage),
    });

    console.log("Test webhook response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Test webhook error response:", errorText);
      throw new Error(`Webhook test failed: ${response.status} - ${errorText}`);
    }

    const responseText = await response.text();
    console.log("Test webhook success response:", responseText);

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Test webhook sent to ${platform} successfully`,
      platform: platform,
      status: response.status
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in test-webhook function:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        details: "Failed to test webhook"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
