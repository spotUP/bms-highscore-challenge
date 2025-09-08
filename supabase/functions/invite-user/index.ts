import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InviteUserRequest {
  email: string;
  role: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, role }: InviteUserRequest = await req.json();
    
    console.log("Inviting user:", { email, role });

    // Validate input
    if (!email || !role) {
      throw new Error("Email and role are required");
    }

    if (!['admin', 'moderator', 'user'].includes(role)) {
      throw new Error("Invalid role specified");
    }

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Invite the user
    const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email);

    if (inviteError) {
      console.error("Error inviting user:", inviteError);
      throw new Error(`Failed to invite user: ${inviteError.message}`);
    }

    console.log("User invited successfully:", inviteData);

    // Set the user's role
    if (inviteData.user) {
      const { error: roleError } = await supabase
        .from('user_roles')
        .upsert(
          { 
            user_id: inviteData.user.id, 
            role: role,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          { onConflict: 'user_id' }
        );

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
      message: `User ${email} invited successfully with role ${role}`,
      user: inviteData.user
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("Error in invite-user function:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
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
