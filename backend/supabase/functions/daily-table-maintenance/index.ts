// Keeps your existing behavior (lock + cancel inside 36h window)
// AND adds: hourly "day-of" holds for users who joined >7 days out (SetupIntent path).
// AND adds: cleanup of old tables and signups 24 hours after dinner completion.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { getStripe } from "../_shared/stripe.ts";
import { handleCors, json } from "../_shared/cors.ts";

function getServiceClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SERVICE_ROLE_KEY")!; // keep your existing env name
  return createClient(url, key, { auth: { persistSession: false } });
}

serve(async (req) => {
  // If you ever hit this from a browser, preflight won't choke.
  const pre = handleCors(req);
  if (pre) return pre;

  try {
    const supabaseAdmin = getServiceClient();
    const stripe = getStripe();

    const now = new Date();
    const thirtySixHoursFromNow = new Date(now.getTime() + 36 * 60 * 60 * 1000);

    // === PART A: your existing 36h lock/cancel window ===
    const { data: tablesToProcess, error: selectError } = await supabaseAdmin
      .from("tables")
      .select("id, total_spots, spots_filled, min_spots")
      .lt("dinner_date", thirtySixHoursFromNow.toISOString())
      .gt("dinner_date", now.toISOString())
      .eq("is_locked", false);

    if (selectError) throw selectError;

    let lockedUpdated = 0;

    if (tablesToProcess && tablesToProcess.length > 0) {
      for (const table of tablesToProcess) {
        // Table confirmed if filled >= min_spots; if min_spots null, require full table
        const isConfirmed = table.spots_filled >= (table.min_spots ?? table.total_spots);

        const { error: updateError } = await supabaseAdmin
          .from("tables")
          .update({
            is_locked: true,
            is_cancelled: !isConfirmed, // cancel if NOT confirmed
          })
          .eq("id", table.id);

        if (updateError) {
          console.error(`Failed to update table ${table.id}:`, updateError);
        } else {
          lockedUpdated += 1;
        }
      }
      console.log(`Locked/updated ${lockedUpdated} tables in the 36h window.`);
    } else {
      console.log("No tables to process in the lock-in window.");
    }

    // === PART B: hourly "day-of" holds (next 24h), only for non-cancelled locked tables ===
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const { data: dayOfTables, error: dErr } = await supabaseAdmin
      .from("tables")
      .select("id, dinner_date, is_cancelled, is_locked")
      .gte("dinner_date", now.toISOString())
      .lt("dinner_date", in24h.toISOString())
      .eq("is_cancelled", false)
      .eq("is_locked", true);

    if (dErr) throw dErr;

    let holdsPlaced = 0;

    if (dayOfTables && dayOfTables.length > 0) {
      const tableIds = dayOfTables.map(t => t.id);

      // signups for these tables
      const { data: signups, error: sErr } = await supabaseAdmin
        .from("signups")
        .select("user_id, table_id")
        .in("table_id", tableIds);

      if (sErr) throw sErr;

      if (signups && signups.length > 0) {
        for (const s of signups) {
          // Find the latest collateral record. We want the "setup_then_hold" with status 'none'
          // which indicates the user completed a SetupIntent earlier (>7 days join).
          const { data: prior, error: hErr } = await supabaseAdmin
            .from("collateral_holds")
            .select("id, collateral_cents, strategy, status")
            .eq("user_id", s.user_id)
            .eq("table_id", s.table_id)
            .order("id", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (hErr) {
            console.error("collateral_holds lookup error:", hErr);
            continue;
          }
          if (!prior) continue;
          if (!(prior.strategy === "setup_then_hold" && prior.status === "none")) {
            // either already placed, failed, or was a direct manual hold path
            continue;
          }

          // Load Stripe customer
          const { data: user, error: uErr } = await supabaseAdmin
            .from("users")
            .select("id, stripe_customer_id")
            .eq("id", s.user_id)
            .single();

          if (uErr || !user?.stripe_customer_id) {
            console.warn("Missing stripe_customer_id for user", s.user_id);
            // mark failure to place hold so we don't retry forever
            await supabaseAdmin
              .from("collateral_holds")
              .update({ status: "hold_failed" })
              .eq("id", prior.id);
            continue;
          }

          // Get default PM for off-session
          const customer = await stripe.customers.retrieve(user.stripe_customer_id, {
            expand: ["invoice_settings.default_payment_method"],
          }) as any;

          const pmId =
            customer?.invoice_settings?.default_payment_method?.id ||
            customer?.default_source ||
            null;

          if (!pmId) {
            await supabaseAdmin
              .from("collateral_holds")
              .update({ status: "hold_failed" })
              .eq("id", prior.id);
            continue;
          }

          // Place the manual-capture hold
          try {
            const pi = await stripe.paymentIntents.create({
              amount: prior.collateral_cents,
              currency: "usd",
              customer: user.stripe_customer_id,
              capture_method: "manual",
              confirm: true,
              off_session: true,
              payment_method: pmId,
            });

            await supabaseAdmin.from("collateral_holds").insert({
              user_id: s.user_id,
              table_id: s.table_id,
              collateral_cents: prior.collateral_cents,
              strategy: "setup_then_hold",
              stripe_payment_intent_id: pi.id,
              status: pi.status === "requires_action" ? "hold_failed" : "hold_active",
            });

            holdsPlaced += 1;
          } catch (e) {
            console.error("day-of hold PI create failed:", e);
            await supabaseAdmin
              .from("collateral_holds")
              .update({ status: "hold_failed" })
              .eq("id", prior.id);
          }
        }
      }
    }

    // === PART C: Cleanup old tables and signups 24 hours after dinner completion ===
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Find tables that finished 24+ hours ago
    const { data: oldTables, error: cleanupError } = await supabaseAdmin
      .from("tables")
      .select("id")
      .lt("dinner_date", twentyFourHoursAgo.toISOString());

    if (cleanupError) {
      console.error("Error finding old tables for cleanup:", cleanupError);
    } else if (oldTables && oldTables.length > 0) {
      const oldTableIds = oldTables.map(t => t.id);
      
      // Delete old signups first (due to foreign key constraints)
      const { error: signupDeleteError } = await supabaseAdmin
        .from("signups")
        .delete()
        .in("table_id", oldTableIds);
      
      if (signupDeleteError) {
        console.error("Error deleting old signups:", signupDeleteError);
      } else {
        console.log(`Deleted signups for ${oldTableIds.length} old tables`);
      }
      
      // Delete old waitlist entries
      const { error: waitlistDeleteError } = await supabaseAdmin
        .from("waitlists")
        .delete()
        .in("table_id", oldTableIds);
      
      if (waitlistDeleteError) {
        console.error("Error deleting old waitlists:", waitlistDeleteError);
      } else {
        console.log(`Deleted waitlists for ${oldTableIds.length} old tables`);
      }
      
      // Delete old collateral holds
      const { error: collateralDeleteError } = await supabaseAdmin
        .from("collateral_holds")
        .delete()
        .in("table_id", oldTableIds);
      
      if (collateralDeleteError) {
        console.error("Error deleting old collateral holds:", collateralDeleteError);
      } else {
        console.log(`Deleted collateral holds for ${oldTableIds.length} old tables`);
      }
      
      // Finally, delete the old tables
      const { error: tableDeleteError } = await supabaseAdmin
        .from("tables")
        .delete()
        .in("id", oldTableIds);
      
      if (tableDeleteError) {
        console.error("Error deleting old tables:", tableDeleteError);
      } else {
        console.log(`Deleted ${oldTableIds.length} old tables and all related data`);
      }
    } else {
      console.log("No old tables to clean up");
    }

    return json(req, {
      success: true,
      locked_updated: lockedUpdated,
      holds_placed: holdsPlaced,
      cleanup_message: "Cleanup completed successfully",
    }, 200);
  } catch (error: any) {
    console.error("Error in daily-table-maintenance:", error);
    return json(req, { error: error.message ?? "Internal Error" }, 500);
  }
});
