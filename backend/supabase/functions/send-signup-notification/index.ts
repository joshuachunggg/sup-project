import { serve } from "http/server";
import { createClient } from "@supabase/supabase-js";

serve(async (req) => {
  try {
    const payload = await req.json();
    // The actual data from the inserted row is in payload.record
    const signupRecord = payload.record;

    if (!signupRecord) {
      throw new Error("Webhook payload did not contain a record.");
    }

    // Create an admin client to securely fetch related data
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    );

    // Get the user's name from the 'users' table
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("first_name")
      .eq("id", signupRecord.user_id)
      .single();

    if (userError || !user) {
      throw new Error(`Could not find user with ID: ${signupRecord.user_id}. Error: ${userError?.message}`);
    }

    // Get the table details from the 'tables' table
    const { data: table, error: tableError } = await supabaseAdmin
      .from("tables")
      .select("day, time, neighborhood")
      .eq("id", signupRecord.table_id)
      .single();

    if (tableError || !table) {
        throw new Error(`Could not find table with ID: ${signupRecord.table_id}. Error: ${tableError?.message}`);
    }

    // Prepare the email content
    const subject = `New SupDinner Signup: ${user.first_name} joined a table!`;
    const body = `
      <h2>New Signup! 🎉</h2>
      <p><strong>${user.first_name}</strong> has just signed up for a dinner.</p>
      <h3>Dinner Details:</h3>
      <ul>
        <li><strong>Neighborhood:</strong> ${table.neighborhood}</li>
        <li><strong>Day:</strong> ${table.day}</li>
        <li><strong>Time:</strong> ${table.time}</li>
      </ul>
    `;

    // Send the email using Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
        throw new Error("RESEND_API_KEY is not set in secrets.");
    }
    
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "sup <noti@supdinner.com>", // Replace with your verified Resend domain
        to: ["joshua.chung6705@gmail.com"], // IMPORTANT: Replace with your actual email address
        subject: subject,
        html: body,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Resend API error: ${response.status} ${errorBody}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    // Log the detailed error to your Supabase function logs for easier debugging
    console.error("Error in send-signup-notification function:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
