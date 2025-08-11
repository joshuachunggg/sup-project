import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getServiceClient } from "../_shared/db.ts";
import { getStripe } from "../_shared/stripe.ts";
import { handleCors, json } from "../_shared/cors.ts";

serve(async (req) => {
  const pre = handleCors(req);
  if (pre) return pre;

  try {
    if (req.method !== "POST") return json(req, { error: "Method Not Allowed" }, 405);

    const { userId, tableId, collateral_cents } = await req.json();
    if (!userId || !tableId || !collateral_cents) {
      return json(req, { error: "Missing userId, tableId or collateral_cents" }, 400);
    }

    const supabase = getServiceClient();
    const { data: user, error: uerr } = await supabase
      .from("users")
      .select("id, stripe_customer_id")
      .eq("id", userId)
      .single();
    if (uerr || !user?.stripe_customer_id) {
      return json(req, { error: "Stripe customer missing" }, 400);
    }

    const stripe = getStripe();
    const pi = await stripe.paymentIntents.create({
      amount: collateral_cents,
      currency: "usd",
      customer: user.stripe_customer_id,
      capture_method: "manual",
      confirmation_method: "automatic",
      setup_future_usage: "off_session",
      metadata: {
        userId: String(userId),
        tableId: String(tableId),
        strategy: "manual_hold",
      },
    });

    const { error: iErr } = await supabase.from("collateral_holds").insert({
      user_id: userId,
      table_id: tableId,
      collateral_cents,
      strategy: "manual_hold",
      stripe_payment_intent_id: pi.id,
      status: "hold_pending",
    });
    if (iErr) return json(req, { error: "Failed to record payment intent" }, 500);

    return json(req, { client_secret: pi.client_secret }, 200);
  } catch (e) {
    console.error(e);
    return json(req, { error: e.message ?? "Internal Error" }, 500);
  }
});
