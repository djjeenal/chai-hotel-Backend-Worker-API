export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ===============================
    // SEND OTP
    // ===============================
    if (url.pathname === "/password/send-otp" && request.method === "POST") {
      const { email } = await request.json();

      if (!email) {
        return new Response(JSON.stringify({ error: "Email required" }), { status: 400 });
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

      await env.OTP_STORE.put(
        `otp:${email}`,
        JSON.stringify({ otp, expiresAt }),
        { expirationTtl: 600 } // 10 min TTL
      );

      // ---- Brevo Email ----
      const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": env.BREVO_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender: { email: "no-reply@chaihotel.xyz", name: "Chai Hotel" },
          to: [{ email }],
          subject: "Your OTP Code - Chai Hotel",
          htmlContent: `
            <h2>Your OTP Code</h2>
            <p><b>${otp}</b></p>
            <p>This OTP is valid for 10 minutes.</p>
          `,
        }),
      });

      if (!brevoRes.ok) {
        return new Response(JSON.stringify({ error: "Email failed" }), { status: 500 });
      }

      return new Response(JSON.stringify({ success: true, message: "OTP sent" }));
    }

    // ===============================
    // VERIFY OTP
    // ===============================
    if (url.pathname === "/password/verify-otp" && request.method === "POST") {
      const { email, otp } = await request.json();

      if (!email || !otp) {
        return new Response(JSON.stringify({ error: "Email & OTP required" }), { status: 400 });
      }

      const data = await env.OTP_STORE.get(`otp:${email}`);

      if (!data) {
        return new Response(JSON.stringify({ error: "OTP expired or not found" }), { status: 400 });
      }

      const parsed = JSON.parse(data);

      if (Date.now() > parsed.expiresAt) {
        await env.OTP_STORE.delete(`otp:${email}`);
        return new Response(JSON.stringify({ error: "OTP expired" }), { status: 400 });
      }

      if (parsed.otp !== otp) {
        return new Response(JSON.stringify({ error: "Invalid OTP" }), { status: 400 });
      }

      await env.OTP_STORE.delete(`otp:${email}`);

      return new Response(JSON.stringify({ success: true, message: "OTP verified" }));
    }

    return new Response("Not Found", { status: 404 });
  },
};
