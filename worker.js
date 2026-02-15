export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    try {
      const url = new URL(request.url);

      if (url.pathname === "/send-otp" && request.method === "POST") {
        const body = await request.json();
        const email = body.email;

        if (!email) {
          return json({ error: "Email required" }, 400);
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        await env.DB.prepare(
          "INSERT INTO otp_codes (email, otp, expires_at) VALUES (?, ?, ?)"
        )
          .bind(email, otp, Date.now() + 5 * 60 * 1000)
          .run();

        // ✅ BREVO EMAIL भेजो
        await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": env.BREVO_API_KEY,
          },
          body: JSON.stringify({
            sender: {
              name: "Chai Hotel",
              email: "no-reply@chaihotel.xyz"
            },
            to: [{ email }],
            subject: "Your OTP Code",
            htmlContent: `<h2>Your OTP: ${otp}</h2>`
          }),
        });

        return json({ success: true });
      }

      return json({ error: "Not found" }, 404);
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
