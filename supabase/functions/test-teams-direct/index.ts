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
    const teamsUrl = Deno.env.get('TEAMS_WEBHOOK_URL');
    
    if (!teamsUrl) {
      return new Response(JSON.stringify({ error: "No Teams URL configured" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Send the simplest possible message to Teams
    const message = {
      "text": "TEST: This is a test message from BMS Highscore Challenge!"
    };

    console.log("Sending test message to Teams:", teamsUrl.substring(0, 50) + "...");
    console.log("Message:", message);

    const response = await fetch(teamsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const responseText = await response.text();
    
    console.log("Teams response status:", response.status);
    console.log("Teams response text:", responseText);

    return new Response(JSON.stringify({
      success: response.ok,
      status: response.status,
      response: responseText,
      teamsUrl: teamsUrl.substring(0, 50) + "...",
      message: response.ok ? "Test message sent successfully!" : "Failed to send test message"
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
};

serve(handler);
