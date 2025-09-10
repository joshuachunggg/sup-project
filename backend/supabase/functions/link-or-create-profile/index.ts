// supabase/functions/link-or-create-profile/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://www.supdinner.com/",
  "https://www.supdinner.com/sign-up/",
  "https://joshuachunggg.github.io/",
  "https://sup-380d9c.webflow.io/sign-up/",
  "https://sup-380d9c.webflow.io", // add your Webflow site here
]);

function cors(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allow || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    "Content-Type": "application/json",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(req) });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";

    // Service role client, but forward the user's JWT so auth.getUser() uses it
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // Must be logged in when this runs (after confirming email OR after a normal login)
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated (no session)" }), {
        status: 401,
        headers: cors(req),
      });
    }

    const body = await req.json().catch(() => ({}));
    const first_name: string | undefined = body.first_name;
    const phone_number: string | undefined = body.phone_number;
    const age_range: string | undefined = body.age_range;

    // 1) Already linked?
    const { data: existing, error: selErr } = await supabase
      .from("users")
      .select("id, auth_user_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (selErr) {
      return new Response(JSON.stringify({ error: `select users failed: ${selErr.message}` }), {
        status: 500,
        headers: cors(req),
      });
    }

    // 2) If not linked, try legacy by phone
    if (!existing) {
      if (phone_number) {
        const { data: legacy, error: legacyErr } = await supabase
          .from("users")
          .select("id, auth_user_id, email, first_name, age_range, phone_number")
          .eq("phone_number", phone_number)
          .maybeSingle();
        if (legacyErr) {
          return new Response(JSON.stringify({ error: `legacy lookup failed: ${legacyErr.message}` }), {
            status: 500,
            headers: cors(req),
          });
        }

        if (legacy && !legacy.auth_user_id) {
          const patch: Record<string, unknown> = { auth_user_id: user.id };
          if (user.email && !legacy.email) patch.email = user.email;
          if (first_name && !legacy.first_name) patch.first_name = first_name;
          if (age_range && !legacy.age_range) patch.age_range = age_range;

          const { error: upErr } = await supabase.from("users").update(patch).eq("id", legacy.id);
          if (upErr) {
            return new Response(JSON.stringify({ error: `link update failed: ${upErr.message}` }), {
              status: 500,
              headers: cors(req),
            });
          }
          return new Response(JSON.stringify({ user_id: legacy.id, linked: true }), {
            status: 200,
            headers: cors(req),
          });
        }
      }

      // 3) Create new row
      const insert = {
        auth_user_id: user.id,
        email: user.email ?? null,
        phone_number: phone_number ?? null,
        first_name: (first_name?.trim() || "Friend"),
        age_range: (age_range?.trim() || "23-27"),
      };
      const { data: created, error: insErr } = await supabase
        .from("users")
        .insert(insert)
        .select("id")
        .single();
      if (insErr) {
        return new Response(JSON.stringify({ error: `insert failed: ${insErr.message}` }), {
          status: 500,
          headers: cors(req),
        });
      }
      return new Response(JSON.stringify({ user_id: created.id, created: true }), {
        status: 200,
        headers: cors(req),
      });
    }

    // 4) Already linked — optional backfill
    const patch: Record<string, unknown> = {};
    if (first_name) patch.first_name = first_name;
    if (age_range) patch.age_range = age_range;
    if (phone_number) patch.phone_number = phone_number;
    if (user.email) patch.email = user.email;
    if (Object.keys(patch).length) {
      await supabase.from("users").update(patch).eq("id", existing.id);
    }

    return new Response(JSON.stringify({ user_id: existing.id, already: true }), {
      status: 200,
      headers: cors(req),
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: `Unhandled: ${String(err?.message || err)}` }), {
      status: 500,
      headers: cors(req),
    });
  }
});
