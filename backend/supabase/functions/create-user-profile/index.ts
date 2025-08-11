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
    const { 
      phoneNumber, 
      firstName, 
      ageRange, 
      referralSource, 
      marketingOptIn,
      tableId 
    } = await req.json();

    // Get the auth user ID from the request headers
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error("No valid authorization token provided.");
    }

    const token = authHeader.replace('Bearer ', '');
    
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    );

    // Verify the token and get user info
    const { data: { user }, error: tokenError } = await supabaseAdmin.auth.getUser(token);
    if (tokenError || !user) {
      throw new Error("Invalid or expired token.");
    }

    // Check if a user with this phone number already exists (legacy user)
    const { data: existingPhoneUser } = await supabaseAdmin
      .from("users")
      .select("id, auth_user_id, email")
      .eq("phone_number", phoneNumber)
      .maybeSingle();

    let userId: string;
    
    if (existingPhoneUser) {
      // Legacy user - update their record with new auth info
      const { error: updateError } = await supabaseAdmin
        .from("users")
        .update({
          auth_user_id: user.id,
          email: user.email,
          first_name: firstName,
          age_range: ageRange,
          referral_source: referralSource,
          marketing_opt_in: marketingOptIn
        })
        .eq("id", existingPhoneUser.id);
      
      if (updateError) throw updateError;
      userId = existingPhoneUser.id;
    } else {
      // New user - create profile
      const { data: newUser, error: insertError } = await supabaseAdmin
        .from("users")
        .insert({
          auth_user_id: user.id,
          email: user.email,
          first_name: firstName,
          phone_number: phoneNumber,
          age_range: ageRange,
          referral_source: referralSource,
          marketing_opt_in: marketingOptIn
        })
        .select()
        .single();
      
      if (insertError) throw insertError;
      userId = newUser.id;
    }

    // If tableId is provided, join the table
    if (tableId) {
      // Check if the table is available
      const { data: table, error: tableError } = await supabaseAdmin
        .from("tables")
        .select("spots_filled, total_spots, is_locked")
        .eq("id", tableId)
        .single();

      if (tableError || !table) {
        throw new Error(`Could not find table with ID: ${tableId}`);
      }

      if (table.is_locked) {
        throw new Error("This table is locked and cannot be joined.");
      }

      if (table.spots_filled >= table.total_spots) {
        throw new Error("This table is full.");
      }

      // Create the signup record
      const { error: signupError } = await supabaseAdmin
        .from("signups")
        .insert({ user_id: userId, table_id: tableId });
      
      if (signupError) throw signupError;

      // Increment spots_filled
      const newSpotsFilled = table.spots_filled + 1;
      const { error: updateError } = await supabaseAdmin
        .from("tables")
        .update({ spots_filled: newSpotsFilled })
        .eq("id", tableId);
      
      if (updateError) throw updateError;
    }

    return new Response(JSON.stringify({ 
      success: true, 
      userId: userId,
      authUserId: user.id,
      message: existingPhoneUser ? "Legacy account upgraded successfully!" : "Profile created successfully!"
    }), {
      headers: { 
        "Content-Type": "application/json", 
        "Access-Control-Allow-Origin": "*" 
      },
      status: 200,
    });
  } catch (error) {
    console.error("Error in create-user-profile function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 
        "Content-Type": "application/json", 
        "Access-Control-Allow-Origin": "*" 
      },
      status: 400,
    });
  }
});
