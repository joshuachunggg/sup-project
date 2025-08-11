import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });
  }

  try {
    const { authUserId } = await req.json();
    if (!authUserId) {
      throw new Error("Auth user ID is required.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    );

    // Find the user with the provided auth_user_id
    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    // If there's a database error (not a "not found" error), throw it.
    if (error) {
      throw error;
    }

    // Return the user profile if found, otherwise return null.
    return new Response(JSON.stringify({ 
      success: true,
      user: user || null 
    }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in get-user-by-auth-id:", error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      status: 400,
    });
  }
});
