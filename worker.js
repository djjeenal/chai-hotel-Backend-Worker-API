export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response("OK", { headers: corsHeaders });
    }

    const url = new URL(request.url);

    try {

      /* ================= SEND OTP ================= */

      if (url.pathname === "/send-otp" && request.method === "POST") {
        const body = await request.json();
        const email = body.email;

        if (!email) {
          return json({ success: false, message: "Email required" }, corsHeaders);
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 5 * 60 * 1000;

        await env.DB.prepare(
          "INSERT INTO otps (email, otp, expires_at) VALUES (?, ?, ?)"
        ).bind(email, otp, expiresAt).run();

        const emailRes = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": env.BREVO_API_KEY,
          },
          body: JSON.stringify({
            sender: {
              name: "Chai Hotel",
              email: "noreply@chaihotel.xyz"
            },
            to: [{ email }],
            subject: "Your OTP Code",
            htmlContent: `<h2>Your OTP: ${otp}</h2><p>Valid for 5 minutes</p>`
          }),
        });

        if (!emailRes.ok) {
          const errText = await emailRes.text();
          return json({
            success: false,
            message: "Email send failed",
            error: errText
          }, corsHeaders);
        }

        return json({ success: true, message: "OTP sent" }, corsHeaders);
      }

      /* ================= VERIFY OTP ================= */

      if (url.pathname === "/verify-otp" && request.method === "POST") {
        const body = await request.json();
        const { email, otp } = body;

        const record = await env.DB.prepare(
          "SELECT * FROM otps WHERE email = ? ORDER BY id DESC LIMIT 1"
        ).bind(email).first();

        if (!record) {
          return json({ success: false, message: "No OTP found" }, corsHeaders);
        }

        if (Date.now() > record.expires_at) {
          return json({ success: false, message: "OTP expired" }, corsHeaders);
        }

        if (record.otp !== otp) {
          return json({ success: false, message: "Invalid OTP" }, corsHeaders);
        }

        return json({ success: true, message: "OTP verified" }, corsHeaders);
      }

      return json({ success: false, message: "Not found" }, corsHeaders);

    } catch (err) {
      return json({
        success: false,
        message: "Worker crash",
        error: err.message
      }, corsHeaders);
    }
  },
};

function json(data, headers) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json", ...headers },
  });
}
