export default {
  async fetch(request, env) {

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response("OK", { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // ✅ SEND OTP
    if (path === "/send-otp" && request.method === "POST") {
      try {
        const { email } = await request.json();

        if (!email) {
          return new Response(JSON.stringify({ error: "Email required" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expires = Date.now() + 5 * 60 * 1000;

        await env.DB.prepare(
          "INSERT INTO otp_codes (email, otp, expires_at) VALUES (?, ?, ?)"
        ).bind(email, otp, expires).run();

        // ✅ EMAIL भेजो (Resend)
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Chai Hotel <noreply@resend.dev>",
            to: email,
            subject: "Your OTP Code",
            html: `<h2>Your OTP: ${otp}</h2>`,
          }),
        });

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ✅ VERIFY OTP
    if (path === "/verify-otp" && request.method === "POST") {
      try {
        const { email, otp } = await request.json();

        const record = await env.DB.prepare(
          "SELECT * FROM otp_codes WHERE email = ? ORDER BY rowid DESC LIMIT 1"
        ).bind(email).first();

        if (!record) {
          return new Response(JSON.stringify({ error: "OTP not found" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (record.otp !== otp) {
          return new Response(JSON.stringify({ error: "Invalid OTP" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (Date.now() > record.expires_at) {
          return new Response(JSON.stringify({ error: "OTP expired" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },
};
