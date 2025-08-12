// /supabase/functions/_shared/cors.ts
const ALLOWED_ORIGINS = [
  "https://app.supdinner.com",
  "https://www.supdinner.com/sign-up",
  "https://supdinner.com",
  "https://sup-380d9c.webflow.io",
  "https://sup-380d9c.webflow.io/sign-up",
  "https://joshuachunggg.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

function normalizeOrigin(s: string) {
  try { return new URL(s).origin.toLowerCase(); } catch { return ""; }
}
function originFor(req: Request) {
  const o = normalizeOrigin(req.headers.get("origin") ?? "");
  const set = new Set(ALLOWED_ORIGINS.map(normalizeOrigin));
  return set.has(o) ? o : ALLOWED_ORIGINS[0];
}

export function corsHeadersFor(req: Request): HeadersInit {
  return {
    "Access-Control-Allow-Origin": originFor(req),
    "Vary": "Origin",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    // Supabase client sends these headers on functions.invoke()
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

export function handleCors(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeadersFor(req) });
  }
  return null;
}

export function withCors(req: Request, res: Response) {
  const h = new Headers(res.headers);
  const base = corsHeadersFor(req);
  for (const [k, v] of Object.entries(base)) h.set(k, v as string);
  return new Response(res.body, { status: res.status, headers: h });
}

export function json(req: Request, body: unknown, status = 200) {
  return withCors(
    req,
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}
