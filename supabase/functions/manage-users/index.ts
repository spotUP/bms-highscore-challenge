import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ManageUsersRequest {
  action: 'list' | 'delete';
  user_id?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, user_id }: ManageUsersRequest = await req.json();
    
    console.log("Managing users:", { action, user_id });

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (action === 'list') {
      // List all users
      const { data, error } = await supabase.auth.admin.listUsers();
      
      if (error) {
        throw new Error(`Failed to list users: ${error.message}`);
      }

      return new Response(JSON.stringify({ 
        success: true,
        users: data.users.map(user => ({
          id: user.id,
          email: user.email,
          created_at: user.created_at,
          last_sign_in_at: user.last_sign_in_at,
          email_confirmed_at: user.email_confirmed_at
        }))
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });

    } else if (action === 'delete') {
      if (!user_id) {
        throw new Error("User ID is required for delete action");
      }

      // Delete the user
      const { error } = await supabase.auth.admin.deleteUser(user_id);

      if (error) {
        throw new Error(`Failed to delete user: ${error.message}`);
      }

      // Also remove from user_roles
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', user_id);

      return new Response(JSON.stringify({ 
        success: true,
        message: "User deleted successfully"
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });

    } else {
      throw new Error("Invalid action specified");
    }

  } catch (error: any) {
    console.error("Error in manage-users function:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        details: "Failed to manage users"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
