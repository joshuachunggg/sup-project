// /supabase/functions/join-after-confirm/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getServiceClient } from "../_shared/db.ts";
import { getStripe } from "../_shared/stripe.ts";
import { handleCors, json } from "../_shared/cors.ts";

type Body = {
  userId?: number | string | null;
  tableId?: number | string | null;
  intentType?: "payment" | "setup" | null;
  intentId?: string | null;            // pi_... or si_...
  paymentMethodId?: string | null;
  clientSecret?: string | null;        // NEW: fallback source of truth
};

function parseIntentIdFromSecret(secret?: string | null): string | null {
  if (!secret) return null;
  const idx = secret.indexOf("_secret_");
  return idx > 0 ? secret.slice(0, idx) : null;
}

function inferTypeFromIntentId(id?: string | null): "payment" | "setup" | null {
  if (!id) return null;
  if (id.startsWith("pi_")) return "payment";
  if (id.startsWith("si_")) return "setup";
  return null;
}

serve(async (req) => {
  const pre = handleCors(req);
  if (pre) return pre;

  try {
    if (req.method !== "POST") return json(req, { error: "Method Not Allowed" }, 405);

    const body: Body = await req.json();

    // Normalize and derive what we can
    let intentId = body.intentId ?? null;
    if (!intentId) intentId = parseIntentIdFromSecret(body.clientSecret ?? null);

    let intentType = (body.intentType as "payment" | "setup" | null) ?? inferTypeFromIntentId(intentId);

    // Coerce numeric ids if provided
    let userId = body.userId != null ? Number(body.userId) : null;
    let tableId = body.tableId != null ? Number(body.tableId) : null;

    const supabase = getServiceClient();
    const stripe = getStripe();

    // Pull from Stripe if we still need data
    if (!intentType || !intentId) {
      return json(req, { error: "Unable to resolve intent from request. Provide clientSecret or intentId." }, 400);
    }

    let meta: Record<string, unknown> = {};
    if (intentType === "payment") {
      const pi = await stripe.paymentIntents.retrieve(intentId);
      if (!pi || pi.status === "canceled") {
        return json(req, { error: "PaymentIntent not valid/canceled" }, 400);
      }
      meta = (pi.metadata as Record<string, unknown>) ?? {};
      if (!body.paymentMethodId && pi.payment_method) {
        body.paymentMethodId = String(pi.payment_method);
      }
    } else {
      const si = await stripe.setupIntents.retrieve(intentId);
      if (!si || si.status !== "succeeded") {
        return json(req, { error: "SetupIntent not succeeded" }, 400);
      }
      meta = (si.metadata as Record<string, unknown>) ?? {};
      if (!body.paymentMethodId && si.payment_method) {
        body.paymentMethodId = String(si.payment_method);
      }
    }

    // Try metadata for userId/tableId
    if (!Number.isFinite(userId as number)) {
      const m = Number((meta as any).userId);
      if (Number.isFinite(m)) userId = m;
    }
    if (!Number.isFinite(tableId as number)) {
      const m = Number((meta as any).tableId);
      if (Number.isFinite(m)) tableId = m;
    }

    // Still missing? Look up collateral_holds by PI/SI id
    if (!Number.isFinite(userId as number) || !Number.isFinite(tableId as number)) {
      const q = intentType === "payment"
        ? supabase.from("collateral_holds")
            .select("user_id, table_id")
            .eq("stripe_payment_intent_id", intentId)
            .maybeSingle()
        : supabase.from("collateral_holds")
            .select("user_id, table_id")
            .eq("stripe_setup_intent_id", intentId)
            .maybeSingle();

      const { data: holdLookup } = await q;
      if (holdLookup) {
        if (!Number.isFinite(userId as number))  userId  = Number(holdLookup.user_id);
        if (!Number.isFinite(tableId as number)) tableId = Number(holdLookup.table_id);
      }
    }

    if (!Number.isFinite(userId as number) || !Number.isFinite(tableId as number)) {
      return json(req, { error: "Could not resolve userId/tableId from request, metadata, or DB." }, 400);
    }

    // Idempotent signup insert
    const { error: sErr } = await supabase
      .from("signups")
      .upsert(
        { user_id: Number(userId), table_id: Number(tableId) },
        { onConflict: "user_id,table_id", ignoreDuplicates: true },
      );
    if (sErr) return json(req, { error: "Failed to create signup" }, 500);

    // Update collateral status + payment method id
    if (intentType === "payment") {
      await supabase
        .from("collateral_holds")
        .update({
          status: "hold_authorized",
          stripe_payment_method_id: body.paymentMethodId ?? null,
        })
        .eq("stripe_payment_intent_id", intentId);
      return json(req, { ok: true, mode: "payment" }, 200);
    } else {
      await supabase
        .from("collateral_holds")
        .update({
          status: "setup_confirmed",
          stripe_payment_method_id: body.paymentMethodId ?? null,
        })
        .eq("stripe_setup_intent_id", intentId);
      return json(req, { ok: true, mode: "setup" }, 200);
    }
  } catch (e) {
    console.error(e);
    return json(req, { error: e?.message ?? "Internal Error" }, 500);
  }
});
