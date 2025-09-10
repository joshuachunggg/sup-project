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

    // 2. Check if the table is actually full
    const { data: table } = await supabaseAdmin
      .from("tables")
      .select("spots_filled, total_spots")
      .eq("id", tableId)
      .single();

    if (table.spots_filled < table.total_spots) {
      throw new Error("This table is not full. Please join the table directly.");
    }

    // 3. Create a new user profile, including the marketing opt-in status
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

    // 4. Add the new user to the waitlist for the specified table
    const { error: waitlistError } = await supabaseAdmin
      .from("waitlists")
      .insert({ user_id: newUser.id, table_id: tableId });
    if (waitlistError) throw waitlistError;

    return new Response(JSON.stringify({ success: true, userId: newUser.id }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      status: 400,
    });
  }
});