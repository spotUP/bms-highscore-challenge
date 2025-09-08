import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const teamsWebhookUrl = Deno.env.get('TEAMS_WEBHOOK_URL');
    
    if (!teamsWebhookUrl) {
      return new Response(JSON.stringify({ error: "No Teams webhook URL configured" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    console.log("Teams webhook URL:", teamsWebhookUrl);

    // Test with the absolute simplest Teams message format
    const simpleMessage = {
      "text": "🏆 Test achievement notification from BMS Highscore Challenge!"
    };

    console.log("Sending simple test message:", simpleMessage);

    const response = await fetch(teamsWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(simpleMessage),
    });

    const responseText = await response.text();
    
    console.log("Teams response status:", response.status);
    console.log("Teams response text:", responseText);
    console.log("Teams response headers:", Object.fromEntries(response.headers.entries()));

    return new Response(JSON.stringify({ 
      success: response.ok,
      status: response.status,
      response: responseText,
      webhookUrl: teamsWebhookUrl.substring(0, 50) + "...", // Show partial URL for debugging
      message: response.ok ? "Success!" : "Failed - check logs for details"
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: "Failed to test Teams webhook"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
};

serve(handler);
