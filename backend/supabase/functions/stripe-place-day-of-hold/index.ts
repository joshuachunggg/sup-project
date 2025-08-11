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

    const { data: prior, error: perr } = await supabase
      .from("collateral_holds")
      .select("id, stripe_setup_intent_id")
      .eq("user_id", userId)
      .eq("table_id", tableId)
      .eq("strategy", "setup_then_hold")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (perr || !prior) {
      return json(req, { error: "No setup intent found for this user/table" }, 400);
    }

    const stripe = getStripe();
    const customer = await stripe.customers.retrieve(user.stripe_customer_id, {
      expand: ["invoice_settings.default_payment_method"],
    }) as any;

    const pmId = customer?.invoice_settings?.default_payment_method?.id || customer?.default_source || null;
    if (!pmId) return json(req, { error: "No default payment method on customer" }, 400);

    const pi = await stripe.paymentIntents.create({
      amount: collateral_cents,
      currency: "usd",
      customer: user.stripe_customer_id,
      capture_method: "manual",
      confirm: true,
      off_session: true,
      payment_method: pmId,
    });

    const { error: iErr } = await supabase.from("collateral_holds").insert({
      user_id: userId,
      table_id: tableId,
      collateral_cents,
      strategy: "setup_then_hold",
      stripe_payment_intent_id: pi.id,
      status: pi.status === "requires_action" ? "hold_failed" : "hold_active",
    });
    if (iErr) return json(req, { error: "Failed to record day-of hold" }, 500);

    return json(req, {
      payment_intent_id: pi.id,
      status: pi.status,
      requires_action: pi.status === "requires_action",
    }, 200);
  } catch (e) {
    console.error(e);
    return json(req, { error: e.message ?? "Internal Error" }, 500);
  }
});
