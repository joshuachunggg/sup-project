import { serve } from "http/server";
import { createClient } from "@supabase/supabase-js";

serve(async (req) => {
  if (req.method === "OPTIONS") { return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } }); }
  try {
    const { tableId, userId } = await req.json();
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SERVICE_ROLE_KEY")!);

    // Check if table is actually full
    const { data: table } = await supabaseAdmin.from("tables").select("spots_filled, total_spots").eq("id", tableId).single();
    if (table.spots_filled < table.total_spots) throw new Error("This table is not full yet.");

    // Add user to waitlist
    const { error } = await supabaseAdmin.from("waitlists").insert({ user_id: userId, table_id: tableId });
    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  }
});
