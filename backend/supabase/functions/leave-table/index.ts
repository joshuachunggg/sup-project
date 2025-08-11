import { serve } from "http/server";
import { createClient } from "@supabase/supabase-js";

serve(async (req) => {
  if (req.method === "OPTIONS") { return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } }); }
  try {
    const { tableId, userId } = await req.json();
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SERVICE_ROLE_KEY")!);

    // (Existing logic...)
    const { data: table } = await supabaseAdmin.from("tables").select("is_locked").eq("id", tableId).single();
    if (table.is_locked) throw new Error("This table is locked. You cannot leave within 36 hours of the dinner.");
    await supabaseAdmin.from("signups").delete().match({ user_id: userId, table_id: tableId });
    await supabaseAdmin.rpc("decrement_spots", { table_id_in: tableId });

    // ** NEW LOGIC STARTS HERE **
    // After a user leaves, check the waitlist for that table
    const { data: waitlist } = await supabaseAdmin
      .from("waitlists")
      .select("user_id")
      .eq("table_id", tableId)
      .order("created_at", { ascending: true })
      .limit(1);

    // If there's someone on the waitlist, promote them
    if (waitlist && waitlist.length > 0) {
      const nextUser = waitlist[0];
      // Invoke the promotion function without waiting for it to complete
      supabaseAdmin.functions.invoke('promote-from-waitlist', {
          body: { tableIdToJoin: tableId, userIdToPromote: nextUser.user_id }
      });
    }

    return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  }
});
