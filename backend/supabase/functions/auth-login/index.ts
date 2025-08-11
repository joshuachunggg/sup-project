import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { 
      headers: { 
        "Access-Control-Allow-Origin": "*", 
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" 
      } 
    });
  }

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      throw new Error("Email and password are required.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    );

    // 1. Authenticate with Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (authError) {
      console.error("Auth login error:", authError);
      throw new Error("Invalid email or password.");
    }

    // 2. Get user profile from our users table
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from("users")
      .select("id, first_name, phone_number, age_range, is_suspended, suspension_end_date")
      .eq("auth_user_id", authData.user.id)
      .single();

    if (profileError || !userProfile) {
      throw new Error("User profile not found. Please contact support.");
    }

    // 3. Get user's current table and waitlist status
    const { data: signup } = await supabaseAdmin
      .from("signups")
      .select("table_id")
      .eq("user_id", userProfile.id)
      .maybeSingle();

    const { data: waitlists } = await supabaseAdmin
      .from("waitlists")
      .select("table_id")
      .eq("user_id", userProfile.id);

    return new Response(JSON.stringify({
      success: true,
      userId: userProfile.id,
      authUserId: authData.user.id,
      user: {
        id: userProfile.id,
        firstName: userProfile.first_name,
        phoneNumber: userProfile.phone_number,
        ageRange: userProfile.age_range,
        isSuspended: userProfile.is_suspended,
        suspensionEndDate: userProfile.suspension_end_date,
        joinedTableId: signup ? signup.table_id : null,
        waitlistedTableIds: waitlists ? waitlists.map(w => w.table_id) : []
      }
    }), {
      headers: { 
        "Content-Type": "application/json", 
        "Access-Control-Allow-Origin": "*" 
      },
      status: 200,
    });
  } catch (error) {
    console.error("Error in auth-login function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 
        "Content-Type": "application/json", 
        "Access-Control-Allow-Origin": "*" 
      },
      status: 400,
    });
  }
});
