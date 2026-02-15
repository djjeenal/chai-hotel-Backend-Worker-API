export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    const jsonResponse = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });

    try {
      // ✅ Health Check
      if (path === "/") {
        return jsonResponse({ success: true, message: "Backend working" });
      }

      // ✅ SEND OTP
      if (path === "/auth/send-otp" && request.method === "POST") {
        const body = await request.json();
        const email = body.email;

        if (!email) {
          return jsonResponse({ success: false, message: "Email required" }, 400);
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Save OTP in DB
        await env.DB.prepare(
          "INSERT OR REPLACE INTO otps (email, otp, expires_at) VALUES (?, ?, ?)"
        )
          .bind(email, otp, Date.now() + 5 * 60 * 1000)
          .run();

        // Send Email via Resend
        const resendResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "Chai Hotel <onboarding@resend.dev>",
            to: [email],
            subject: "Your OTP Code",
            html: `<h2>Your OTP: ${otp}</h2><p>Valid for 5 minutes</p>`,
          }),
        });

        if (!resendResponse.ok) {
          return jsonResponse({ success: false, message: "Email send failed" }, 500);
        }

        return jsonResponse({ success: true, message: "OTP Sent to Email" });
      }

      // ✅ VERIFY OTP
      if (path === "/auth/verify-otp" && request.method === "POST") {
        const body = await request.json();
        const { email, otp, password } = body;

        if (!email || !otp || !password) {
          return jsonResponse({ success: false, message: "Missing fields" }, 400);
        }

        const record = await env.DB.prepare(
          "SELECT * FROM otps WHERE email = ?"
        )
          .bind(email)
          .first();

        if (!record) {
          return jsonResponse({ success: false, message: "OTP not found" }, 400);
        }

        if (record.otp !== otp) {
          return jsonResponse({ success: false, message: "Invalid OTP" }, 400);
        }

        if (Date.now() > record.expires_at) {
          return jsonResponse({ success: false, message: "OTP expired" }, 400);
        }

        // Save user
        await env.DB.prepare(
          "INSERT INTO users (email, password) VALUES (?, ?)"
        )
          .bind(email, password)
          .run();

        // Delete OTP
        await env.DB.prepare("DELETE FROM otps WHERE email = ?")
          .bind(email)
          .run();

        return jsonResponse({ success: true, message: "Account created" });
      }

      return jsonResponse({ success: false, message: "Not found" }, 404);
    } catch (err) {
      return jsonResponse({ success: false, message: err.message }, 500);
    }
  },
};
