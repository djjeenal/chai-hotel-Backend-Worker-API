export default {
  async fetch(request, env) {

    // ✅ CORS (VERY IMPORTANT)
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    const url = new URL(request.url);

    // ✅ SEND OTP
    if (url.pathname === "/send-otp" && request.method === "POST") {
      try {
        const { email } = await request.json();

        if (!email) {
          return Response.json({ success: false, error: "Email required" });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // ✅ Save OTP in KV (5 min)
        await env.OTP_KV.put(email, otp, { expirationTtl: 300 });

        // ✅ Send Email via Brevo
        const res = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": env.BREVO_API_KEY,
          },
          body: JSON.stringify({
            sender: {
              name: "Chai Hotel",
              email: "no-reply@chaihotel.xyz", // MUST MATCH VERIFIED
            },
            to: [{ email }],
            subject: "Your OTP Code",
            htmlContent: `<h2>Your OTP: ${otp}</h2>`,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          return Response.json({ success: false, error: data });
        }

        return Response.json({ success: true });

      } catch (err) {
        return Response.json({ success: false, error: err.toString() });
      }
    }

    // ✅ VERIFY OTP
    if (url.pathname === "/verify-otp" && request.method === "POST") {
      try {
        const { email, otp } = await request.json();

        const savedOtp = await env.OTP_KV.get(email);

        if (savedOtp === otp) {
          return Response.json({ success: true });
        } else {
          return Response.json({ success: false });
        }

      } catch (err) {
        return Response.json({ success: false, error: err.toString() });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
};
