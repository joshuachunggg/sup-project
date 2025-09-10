import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOW_ORIGIN = "*"; // or set to your Webflow origin

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
    const { tableId } = await req.json().catch(() => ({}));
    if (!tableId) return fail("Missing tableId");

    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SERVICE_ROLE_KEY")!; // service key (server-only)
    const supa = createClient(url, key, { auth: { persistSession: false } });

    // signups + user info
    const { data: signups, error: sErr } = await supa
      .from("signups")
      .select("user_id, users(first_name, phone_number)")
      .eq("table_id", tableId);

    if (sErr) return fail(`signups query failed: ${sErr.message}`, 500);

    const guests: Array<{
      user_id: number;
      first_name: string | null;
      phone_number: string | null;
      hold: {
        strategy: string | null;
        status: string | null;
        collateral_cents: number | null;
        stripe_payment_intent_id: string | null;
        created_at: string | null;
      } | null;
    }> = [];

    for (const s of signups ?? []) {
      const { data: hold } = await supa
        .from("collateral_holds")
        .select("strategy,status,collateral_cents,stripe_payment_intent_id,created_at")
        .eq("user_id", s.user_id)
        .eq("table_id", tableId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      guests.push({
        user_id: s.user_id,
        first_name: (s as any).users?.first_name ?? null,
        phone_number: (s as any).users?.phone_number ?? null,
        hold: hold
          ? {
              strategy: hold.strategy,
              status: hold.status,
              collateral_cents: hold.collateral_cents,
              stripe_payment_intent_id: hold.stripe_payment_intent_id,
              created_at: hold.created_at,
            }
          : null,
      });
    }

    return ok({ guests });
  } catch (e) {
    console.error("admin-get-table-guests error:", e);
    return fail(e?.message ?? "Internal Error", 500);
  }
});
