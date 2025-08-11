import { serve } from "http/server";

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });
  }

  try {
    const { name, phone, day, time, neighborhood, ageRange, theme } = await req.json();

    // Prepare the email content
    const subject = `New Table Request from ${name}!`;
    const body = `
      <h2>New Table Request! 🗓️</h2>
      <p>You've received a new dinner request. Here are the details:</p>
      <ul>
        <li><strong>Name:</strong> ${name}</li>
        <li><strong>Phone:</strong> ${phone}</li>
        <li><strong>Preferred Day:</strong> ${day}</li>
        <li><strong>Preferred Time:</strong> ${time}</li>
        <li><strong>Neighborhood:</strong> ${neighborhood}</li>
        <li><strong>Age Range:</strong> ${ageRange}</li>
        <li><strong>Theme:</strong> ${theme || 'N/A'}</li>
      </ul>
    `;

    // Send the email using Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
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
      throw new Error(`Resend API error: ${await response.text()}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });

  } catch (error) {
    console.error("Error sending request notification:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
