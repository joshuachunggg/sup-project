import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";

// ----- CORS helpers -----
const ALLOW_ORIGIN = "*"; // set to your Webflow origin in prod
function cors(resp: Response) {
  resp.headers.set("Access-Control-Allow-Origin", ALLOW_ORIGIN);
  resp.headers.set("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type");
  resp.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  return resp;
}
function ok(body: unknown, status = 200) {
  return cors(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}
function fail(message: string, status = 400) {
  return ok({ error: message }, status);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
  if (req.method !== "POST") return fail("Method Not Allowed", 405);

  try {
    const { userId, tableId } = await req.json().catch(() => ({}));
    if (!userId || !tableId) return fail("Missing userId or tableId");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!, // server-side
      { auth: { persistSession: false } }
    );
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { httpClient: Stripe.createFetchHttpClient() });

    // Get latest hold for this user+table
    const { data: hold, error: hErr } = await supabase
      .from("collateral_holds")
      .select("id, status, stripe_payment_intent_id")
      .eq("user_id", userId)
      .eq("table_id", tableId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (hErr) return fail(`DB error: ${hErr.message}`, 500);
    if (!hold || !hold.stripe_payment_intent_id) return fail("No hold/payment_intent found for this user/table", 404);

    // Cancel the PI
    try {
      await stripe.paymentIntents.cancel(hold.stripe_payment_intent_id);
    } catch (e) {
      return fail(`Stripe cancel failed: ${e?.message ?? e}`, 500);
    }

    // Mark released
    const { error: uErr } = await supabase
      .from("collateral_holds")
      .update({ status: "hold_released" })
      .eq("id", hold.id);
    if (uErr) return fail(`Failed to update hold status: ${uErr.message}`, 500);

    return ok({ success: true });
  } catch (e) {
    console.error("stripe-cancel-hold error:", e);
    return fail(e?.message ?? "Internal Error", 500);
  }
});
