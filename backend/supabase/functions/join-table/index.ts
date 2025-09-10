import { serve } from "http/server";
import { createClient } from "@supabase/supabase-js";

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });
  }

  try {
    const { tableId, userId } = await req.json();
    if (!tableId || !userId) throw new Error("Table ID and User ID are required.");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    );

    // 1. Check for user suspension
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("is_suspended, suspension_end_date")
      .eq("id", userId)
      .single();
    if (userError) throw userError;
    if (user.is_suspended && new Date(user.suspension_end_date) > new Date()) {
      throw new Error("User is currently suspended.");
    }

    // 2. Check if user is already in a table
    const { data: existingSignup, error: signupError } = await supabaseAdmin
      .from("signups")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (signupError) throw signupError;
    if (existingSignup) throw new Error("User is already signed up for a table.");

    // 3. Check if table is full or locked
    const { data: table, error: tableError } = await supabaseAdmin
      .from("tables")
      .select("spots_filled, total_spots, is_locked")
      .eq("id", tableId)
      .single();
    if (tableError) throw tableError;
    if (table.is_locked) throw new Error("This table is locked and cannot be joined.");
    if (table.spots_filled >= table.total_spots) throw new Error("This table is full.");

    // 4. Create the signup
    const { error: insertError } = await supabaseAdmin
      .from("signups")
      .insert({ user_id: userId, table_id: tableId });
    if (insertError) throw insertError;

    // 5. Increment spots_filled directly
    const newSpotsFilled = table.spots_filled + 1;
    const { error: updateError } = await supabaseAdmin
      .from("tables")
      .update({ spots_filled: newSpotsFilled })
      .eq("id", tableId);
    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in join-table function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      status: 400,
    });
  }
});