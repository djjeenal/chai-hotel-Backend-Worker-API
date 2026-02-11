export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" },
      });

    // SEND OTP ✅ FIXED
    if (path === "/auth/send-otp" && request.method === "POST") {
      try {
        const { email } = await request.json();

        if (!email)
          return json({ success: false, message: "Email required" }, 400);

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expires = Date.now() + 5 * 60 * 1000;

        await env.DB.prepare(
          `INSERT OR REPLACE INTO otp_codes (email, otp, expires_at, created_at)
           VALUES (?, ?, ?, ?)`
        )
          .bind(email, otp, expires, new Date().toISOString())
          .run();

        return json({
          success: true,
          otp: otp, // testing only
        });
      } catch (e) {
        return json({ success: false, error: e.message }, 500);
      }
    }

    return json({ error: "Not found" }, 404);
  },
};
