export default {
  async fetch(request, env) {

    if (request.method === "OPTIONS") {
      return new Response("", {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }

    if (request.method !== "POST") {
      return new Response("Not allowed", { status: 405 });
    }

    const { action, email, otp } = await request.json();

    if (action === "send") {

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = Date.now() + 5 * 60 * 1000;

      await env.DB.prepare(`
        INSERT OR REPLACE INTO otp_codes (email, otp, expires_at)
        VALUES (?, ?, ?)
      `).bind(email, code, expires).run();

      // Brevo Email
      await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": env.BREVO_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sender: { name: "Chai Hotel", email: "no-reply@chaihotel.xyz" },
          to: [{ email }],
          subject: "Your OTP Code",
          htmlContent: `<h2>Your OTP: ${code}</h2>`
        })
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Access-Control-Allow-Origin": "*" }
      });
    }

    if (action === "verify") {

      const row = await env.DB.prepare(`
        SELECT otp, expires_at FROM otp_codes WHERE email = ?
      `).bind(email).first();

      if (!row) {
        return new Response(JSON.stringify({ success: false }), {
          headers: { "Access-Control-Allow-Origin": "*" }
        });
      }

      if (Date.now() > row.expires_at) {
        return new Response(JSON.stringify({ success: false, reason: "expired" }), {
          headers: { "Access-Control-Allow-Origin": "*" }
        });
      }

      if (row.otp !== otp) {
        return new Response(JSON.stringify({ success: false }), {
          headers: { "Access-Control-Allow-Origin": "*" }
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Access-Control-Allow-Origin": "*" }
      });
    }

    return new Response("Invalid action");
  }
};
