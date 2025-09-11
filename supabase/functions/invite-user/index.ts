import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

interface InviteUserRequest {
  action?: 'health';
  email?: string;
  role?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Accept health via GET or POST
    let action: InviteUserRequest['action'] | undefined = undefined;
    let email: string | undefined = undefined;
    let role: string | undefined = undefined;

    if (req.method === 'GET') {
      const url = new URL(req.url);
      const qAction = url.searchParams.get('action');
      action = (qAction as any) || undefined;
    } else {
      try {
        const body: InviteUserRequest = await req.json();
        action = body?.action;
        email = body?.email;
        role = body?.role as any;
      } catch (_e) {
        // Fallback to health if body is missing/invalid
        action = 'health';
      }
    }
    
    console.log("invite-user: request received", { action, email_present: !!email, role });

    // Resolve environment (used by both flows)
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // Health check endpoint
    if (action === 'health') {
      const hasSupabaseUrl = !!supabaseUrl;
      const hasServiceKey = !!supabaseServiceKey;
      const configured = hasSupabaseUrl && hasServiceKey;
      return new Response(JSON.stringify({
        success: configured,
        configured,
        hasSupabaseUrl,
        hasServiceKey
      }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    // Validate input for invite action
    if (!email || !role) {
      return new Response(JSON.stringify({ success: false, error: "Email and role are required" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }
    if (!['admin', 'moderator', 'user'].includes(role)) {
      return new Response(JSON.stringify({ success: false, error: "Invalid role specified" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing required env vars for invite-user function', {
        hasSupabaseUrl: !!supabaseUrl,
        hasServiceKey: !!supabaseServiceKey
      });
      return new Response(JSON.stringify({
        success: false,
        error: "Server not configured: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
      }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const redirectBase = Deno.env.get('SITE_URL')
      || Deno.env.get('PUBLIC_SITE_URL')
      || req.headers.get('origin')
      || 'http://localhost:8080';

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Try to send an email invite first (requires Email provider + SMTP)
    let inviteData: any = null;
    let inviteError: any = null;
    try {
      const res = await supabase.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${redirectBase.replace(/\/$/, '')}/auth`
      });
      inviteData = res.data;
      inviteError = res.error;
    } catch (e: any) {
      inviteError = e;
    }

    let usedFallback = false;
    if (inviteError) {
      console.warn("Email invite failed, falling back to link generation:", inviteError?.message || inviteError);
      const alt = await (supabase as any).auth.admin.generateLink({
        type: 'invite',
        email,
        options: {
          redirectTo: `${redirectBase.replace(/\/$/, '')}/auth`
        }
      });
      if (alt.error) {
        console.error("Error generating invite link:", alt.error);
        throw new Error(`Failed to invite user: ${alt.error.message}`);
      }
      inviteData = alt.data;
      usedFallback = true;
      console.log("Invite link generated successfully (fallback):", inviteData);
    } else {
      console.log("Invitation email requested successfully:", inviteData);
    }
    
    // Log email sending status
    if (inviteData.user) {
      console.log("Invitation email should be sent to:", email);
      console.log("User created with ID:", inviteData.user.id);
      console.log("User confirmation status:", inviteData.user.email_confirmed_at ? "confirmed" : "pending");
    }

    // Set the user's role
    if (inviteData?.user) {
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({ 
          user_id: inviteData.user.id, // This is already a UUID from auth.users
          role: role as any // Cast to avoid TypeScript issues
        });

      if (roleError) {
        console.error("Error setting user role:", roleError);
        // Don't throw here as the user was already invited
        console.warn("User invited but role not set:", roleError.message);
      } else {
        console.log("User role set successfully:", { user_id: inviteData.user.id, role });
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: usedFallback
        ? `Invite link generated for ${email} with role ${role}`
        : `Invitation email sent to ${email} with role ${role}`,
      user: inviteData?.user || null,
      action_link: usedFallback
        ? (inviteData?.properties?.action_link || inviteData?.action_link || null)
        : null
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("Error in invite-user function:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      details: error.details,
      hint: error.hint,
      statusCode: error.statusCode
    });
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || "Unknown error",
        errorCode: error.code,
        errorDetails: error.details,
        hint: error.hint,
        fullError: error.toString(),
        details: "Failed to invite user"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
