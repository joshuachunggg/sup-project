import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { 
      headers: { 
        "Access-Control-Allow-Origin": "*", 
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" 
      } 
    });
  }

  try {
    const { email } = await req.json();

    if (!email) {
      throw new Error("Email is required.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    );

    // Resend verification email using the proper method
    const { error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'signup',
      email: email,
      options: {
        redirectTo: `${Deno.env.get("SUPABASE_URL")}/auth/callback`
      }
    });

    if (error) {
      console.error("Error resending verification:", error);
      throw new Error("Could not resend verification email. Please try again.");
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Verification email sent successfully. Please check your inbox and spam folder."
    }), {
      headers: { 
        "Content-Type": "application/json", 
        "Access-Control-Allow-Origin": "*" 
      },
      status: 200,
    });
  } catch (error) {
    console.error("Error in resend-verification function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 
        "Content-Type": "application/json", 
        "Access-Control-Allow-Origin": "*" 
      },
      status: 400,
    });
  }
});
