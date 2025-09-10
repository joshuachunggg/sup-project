import { serve } from "http/server";
import { createClient } from "@supabase/supabase-js";

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });
  }

  try {
    const { phoneNumber } = await req.json();
    if (!phoneNumber) throw new Error("Phone number is required.");

    // Use the admin client to interact with Supabase Auth
    const supabaseAdmin = createClient({
      url: Deno.env.get("SUPABASE_URL")!,
      // Use the corrected secret name here as well!
      serviceKey: Deno.env.get("SERVICE_ROLE_KEY")!, 
    });

    // This is the key change: use the built-in Supabase Auth method
    const { data, error } = await supabaseAdmin.auth.signInWithOtp({
      phone: phoneNumber,
    });

    if (error) {
      // Log the detailed error on the server for debugging
      console.error("Supabase OTP error:", error);
      // Return a generic error to the client
      throw new Error("Could not send verification code.");
    }

    return new Response(JSON.stringify({ success: true }), {
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