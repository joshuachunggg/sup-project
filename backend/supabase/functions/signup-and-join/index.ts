import { serve } from "http/server";
import { createClient } from "@supabase/supabase-js";

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });
  }

  try {
    const { tableId, firstName, phoneNumber, ageRange, referralSource, marketingOptIn } = await req.json();
    if (!tableId || !firstName || !phoneNumber || !ageRange) {
      throw new Error("All required fields must be provided.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    );

    // 1. Check if a user with this phone number already exists
    const { data: existingUser } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("phone_number", phoneNumber)
      .maybeSingle();

    if (existingUser) {
      throw new Error("This phone number is already registered.");
    }

    // 2. Check if the table is full or locked
    const { data: table, error: tableError } = await supabaseAdmin
      .from("tables")
      .select("spots_filled, total_spots, is_locked")
      .eq("id", tableId)
      .single();

    // FIX: Add a check to ensure the table was found before accessing its properties.
    if (tableError || !table) {
        throw new Error(`Could not find a table with ID: ${tableId}.`);
    }

    if (table.is_locked) throw new Error("This table is locked and cannot be joined.");
    if (table.spots_filled >= table.total_spots) throw new Error("This table is full.");

    // 3. Create a new user profile
    const { data: newUser, error: insertError } = await supabaseAdmin
      .from("users")
      .insert({
        first_name: firstName,
        phone_number: phoneNumber,
        age_range: ageRange,
        referral_source: referralSource,
        marketing_opt_in: marketingOptIn,
      })
      .select()
      .single();
    
    if (insertError) throw insertError;

    // 4. Create the signup record
    const { error: signupError } = await supabaseAdmin
      .from("signups")
      .insert({ user_id: newUser.id, table_id: tableId });
    if (signupError) throw signupError;

    // 5. Increment spots_filled directly
    const newSpotsFilled = table.spots_filled + 1;
    const { error: updateError } = await supabaseAdmin
        .from("tables")
        .update({ spots_filled: newSpotsFilled })
        .eq("id", tableId);
    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true, userId: newUser.id }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      status: 200,
    });
  } catch (error) {
    // FIX: Add more detailed logging to see the full error in Supabase logs.
    console.error("Error in signup-and-join function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      status: 400,
    });
  }
});
