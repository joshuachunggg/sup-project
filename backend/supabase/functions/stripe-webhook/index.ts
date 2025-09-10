// /supabase/functions/stripe-webhook/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "stripe";
import { getStripe } from "../_shared/stripe.ts";
import { getServiceClient } from "../_shared/db.ts";
import { handleCors } from "../_shared/cors.ts";

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

serve(async (req) => {
  // Handle CORS preflight
  const pre = handleCors(req);
  if (pre) return pre;

  try {
    const stripe = getStripe();
    const rawBody = await req.text();
    const sig = req.headers.get("stripe-signature");
    
    if (!sig || !webhookSecret) {
      console.error("Missing signature or webhook secret");
      return new Response("Missing signature or webhook secret", { status: 400 });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
      console.log(`✅ Webhook received: ${event.type}`);
    } catch (err) {
      console.error("Webhook signature verification failed.", err);
      return new Response("Signature verification failed", { status: 400 });
    }

    const supabase = getServiceClient();

    // Helper: upsert by payment_intent or setup_intent id if present
    // Idempotent helpers that also (optionally) upsert into signups
    async function markByPI(
      id: string,
      patch: Record<string, unknown>,
      opts: { upsertSignup?: boolean; paymentMethodId?: string | null } = {}
    ) {
      const { data: holds } = await supabase
        .from("collateral_holds")
        .select("id, user_id, table_id, status")
        .eq("stripe_payment_intent_id", id);
      if (!holds || holds.length === 0) return;

      const hold = holds[0];
      await supabase.from("collateral_holds").update({
        ...patch,
        ...(opts.paymentMethodId ? { stripe_payment_method_id: opts.paymentMethodId } : {}),
      }).eq("id", hold.id);

      if (opts.upsertSignup && hold.user_id && hold.table_id) {
        await supabase
          .from("signups")
          .upsert(
            { user_id: hold.user_id, table_id: hold.table_id },
            { onConflict: "user_id,table_id", ignoreDuplicates: true },
          );
      }
    }

    async function markBySI(
      id: string,
      patch: Record<string, unknown>,
      opts: { upsertSignup?: boolean; paymentMethodId?: string | null } = {}
    ) {
      const { data: holds } = await supabase
        .from("collateral_holds")
        .select("id, user_id, table_id, status")
        .eq("stripe_setup_intent_id", id);
      if (!holds || holds.length === 0) return;

      const hold = holds[0];
      await supabase.from("collateral_holds").update({
        ...patch,
        ...(opts.paymentMethodId ? { stripe_payment_method_id: opts.paymentMethodId } : {}),
      }).eq("id", hold.id);

      if (opts.upsertSignup && hold.user_id && hold.table_id) {
        await supabase
          .from("signups")
          .upsert(
            { user_id: hold.user_id, table_id: hold.table_id },
            { onConflict: "user_id,table_id", ignoreDuplicates: true },
          );
      }
    }

    switch (event.type) {
      case "setup_intent.succeeded": {
        const si = event.data.object as Stripe.SetupIntent;
        await markBySI(
          si.id,
          { status: "setup_confirmed" },
          { upsertSignup: true, paymentMethodId: (si.payment_method as string | null) ?? null }
        );
        break;
      }
      case "payment_intent.amount_capturable_updated": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await markByPI(
          pi.id,
          { status: "hold_authorized" },
          { upsertSignup: true, paymentMethodId: (pi.payment_method as string | null) ?? null }
        );
        break;
      }
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await markByPI(pi.id, { status: "captured" }, { paymentMethodId: (pi.payment_method as string | null) ?? null });
        break;
      }

      case "payment_intent.canceled": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await markByPI(pi.id, { status: "released" });
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await markByPI(pi.id, { status: "hold_failed", error_message: pi.last_payment_error?.message ?? "payment_failed" });
        break;
      }

      case "charge.refunded": {
        const ch = event.data.object as Stripe.Charge;
        if (typeof ch.payment_intent === "string") {
          await markByPI(ch.payment_intent, { status: "refunded" });
        }
        break;
      }
      default:
        // Log unhandled events for debugging
        console.log(`ℹ️ Unhandled webhook event: ${event.type}`);
        break;
    }

    console.log(`✅ Webhook processed successfully: ${event.type}`);
    return new Response("ok", { status: 200 });

  } catch (e) {
    console.error("❌ Webhook error:", e);
    return new Response("webhook-error", { status: 500 });
  }
});
