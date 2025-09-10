import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getServiceClient } from "../_shared/db.ts";
import { getStripe } from "../_shared/stripe.ts";
import { handleCors, json } from "../_shared/cors.ts";

serve(async (req) => {
  const pre = handleCors(req);
  if (pre) return pre;

  try {
    if (req.method !== "POST") return json(req, { error: "Method Not Allowed" }, 405);

    const { userId } = await req.json();
    if (!userId) return json(req, { error: "Missing userId" }, 400);

    const supabase = getServiceClient();
    const { data: user, error: uErr } = await supabase
      .from("users")
      .select("id, first_name, phone_number, stripe_customer_id")
      .eq("id", userId)
      .single();

    if (uErr || !user) return json(req, { error: "User not found" }, 404);
    if (user.stripe_customer_id) {
      return json(req, { stripeCustomerId: user.stripe_customer_id }, 200);
    }

    const stripe = getStripe();
    const customer = await stripe.customers.create({
      name: user.first_name ?? undefined,
      phone: user.phone_number ?? undefined,
      metadata: { user_id: user.id },
    });

    const { error: updErr } = await supabase
      .from("users")
      .update({ stripe_customer_id: customer.id })
      .eq("id", user.id);

    if (updErr) {
      await stripe.customers.del(customer.id).catch(() => {});
      return json(req, { error: "Failed to save stripe_customer_id" }, 500);
    }

    return json(req, { stripeCustomerId: customer.id }, 200);
  } catch (e) {
    console.error(e);
    return json(req, { error: e.message ?? "Internal Error" }, 500);
  }
});
