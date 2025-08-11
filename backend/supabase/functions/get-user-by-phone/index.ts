import { serve } from "http/server";
import { createClient } from "@supabase/supabase-js";

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });
  }

  try {
    const { phoneNumber } = await req.json();
    if (!phoneNumber) {
      throw new Error("Phone number is required.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    );

    // Find the user with the provided phone number using maybeSingle
    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("phone_number", phoneNumber)
      .maybeSingle();

    // If there's a database error (not a "not found" error), throw it.
    if (error) {
      throw error;
    }

    // Return the user's ID if found, otherwise return null.
    return new Response(JSON.stringify({ userId: user ? user.id : null }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in get-user-by-phone:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      status: 400,
    });
  }
});
