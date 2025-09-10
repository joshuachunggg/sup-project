
serve(async (req) => {
  if (req.method === "OPTIONS") { return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } }); }
  try {
    const { tableIdToJoin, userIdToPromote } = await req.json();
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SERVICE_ROLE_KEY")!);

    // 1. Check if the user is currently signed up for any other table
    const { data: currentSignup } = await supabaseAdmin.from("signups").select("table_id").eq("user_id", userIdToPromote).maybeSingle();

    // 2. If they are, remove them from that other table
    if (currentSignup) {
      await supabaseAdmin.from("signups").delete().eq("user_id", userIdToPromote);
      await supabaseAdmin.rpc("decrement_spots", { table_id_in: currentSignup.table_id });
    }

    // 3. Add the user to the new table
    await supabaseAdmin.from("signups").insert({ user_id: userIdToPromote, table_id: tableIdToJoin });

    // 4. Remove the user from the waitlist for the new table
    await supabaseAdmin.from("waitlists").delete().match({ user_id: userIdToPromote, table_id: tableIdToJoin });

    // Note: We don't need to increment spots here, because the spot was just freed up.

    // (Optional) Here you could trigger a notification to the user that they've been moved off the waitlist.

    return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  }
});
