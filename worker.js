export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      // =========================
      // SEND OTP
      // =========================
      if (url.pathname === "/password/send-otp" && request.method === "POST") {
        const { email } = await request.json();

        if (!email) {
          return new Response(JSON.stringify({
            success: false,
            message: "Email required"
          }), { status: 400 });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const now = Date.now();
        const expiresAt = now + 10 * 60 * 1000; // 10 minutes

        // 🔥 D1 DATABASE INSERT (IMPORTANT LINE)
        await env.DB.prepare(`
          INSERT INTO otp_codes (email, otp, expires_at, created_at)
          VALUES (?, ?, ?, ?)
        `).bind(email, otp, expiresAt, now).run();

        return new Response(JSON.stringify({
          success: true,
          message: "OTP generated & saved",
          otp: otp   // ⚠️ testing ke liye, production me remove
        }), { status: 200 });
      }

      // =========================
      // VERIFY OTP
      // =========================
      if (url.pathname === "/password/verify-otp" && request.method === "POST") {
        const { email, otp } = await request.json();

        if (!email || !otp) {
          return new Response(JSON.stringify({
            success: false,
            message: "Email & OTP required"
          }), { status: 400 });
        }

        // 🔥 D1 DATABASE SELECT
        const result = await env.DB.prepare(`
          SELECT * FROM otp_codes
          WHERE email = ?
          ORDER BY created_at DESC
          LIMIT 1
        `).bind(email).first();

        if (!result) {
          return new Response(JSON.stringify({
            success: false,
            message: "OTP not found"
          }), { status: 400 });
        }

        if (result.otp !== otp) {
          return new Response(JSON.stringify({
            success: false,
            message: "Invalid OTP"
          }), { status: 400 });
        }

        if (Date.now() > result.expires_at) {
          return new Response(JSON.stringify({
            success: false,
            message: "OTP expired"
          }), { status: 400 });
        }

        // OTP used → delete
        await env.DB.prepare(`
          DELETE FROM otp_codes WHERE email = ?
        `).bind(email).run();

        return new Response(JSON.stringify({
          success: true,
          message: "OTP verified"
        }), { status: 200 });
      }

      // =========================
      // FALLBACK
      // =========================
      return new Response("Not Found", { status: 404 });

    } catch (err) {
      return new Response(JSON.stringify({
        success: false,
        error: err.message
      }), { status: 500 });
    }
  }
};
