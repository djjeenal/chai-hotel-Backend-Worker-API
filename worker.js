export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // -------------------------------
    // 🔹 SEND OTP ROUTE
    // -------------------------------
    if (url.pathname === "/password/send-otp" && request.method === "POST") {
      try {
        const { email } = await request.json();

        if (!email) {
          return new Response(JSON.stringify({
            success: false,
            message: "Email required"
          }), { status: 400 });
        }

        // 🔢 Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // ⏱️ Expiry: 10 minutes
        const expiresAt = Date.now() + 10 * 60 * 1000;

        // 🗄️ Save / overwrite OTP in D1
        await env.DB.prepare(`
          INSERT INTO otp_codes (email, otp, expires_at)
          VALUES (?, ?, ?)
          ON CONFLICT(email) DO UPDATE SET
            otp = excluded.otp,
            expires_at = excluded.expires_at
        `).bind(email, otp, expiresAt).run();

        return new Response(JSON.stringify({
          success: true,
          message: "OTP generated & saved ✅",
          otp // ⚠️ production me REMOVE kar dena
        }), { status: 200 });

      } catch (err) {
        return new Response(JSON.stringify({
          success: false,
          message: "Server error (send-otp)"
        }), { status: 500 });
      }
    }

    // -------------------------------
    // 🔹 VERIFY OTP ROUTE
    // -------------------------------
    if (url.pathname === "/password/verify-otp" && request.method === "POST") {
      try {
        const { email, otp } = await request.json();

        if (!email || !otp) {
          return new Response(JSON.stringify({
            success: false,
            message: "Email & OTP required"
          }), { status: 400 });
        }

        const row = await env.DB.prepare(`
          SELECT otp, expires_at FROM otp_codes WHERE email = ?
        `).bind(email).first();

        if (!row) {
          return new Response(JSON.stringify({
            success: false,
            message: "OTP not found"
          }), { status: 400 });
        }

        if (row.otp !== otp) {
          return new Response(JSON.stringify({
            success: false,
            message: "Invalid OTP"
          }), { status: 400 });
        }

        if (Date.now() > row.expires_at) {
          return new Response(JSON.stringify({
            success: false,
            message: "OTP expired"
          }), { status: 400 });
        }

        // 🗑️ Delete OTP after success
        await env.DB.prepare(`
          DELETE FROM otp_codes WHERE email = ?
        `).bind(email).run();

        return new Response(JSON.stringify({
          success: true,
          message: "OTP verified successfully ✅"
        }), { status: 200 });

      } catch (err) {
        return new Response(JSON.stringify({
          success: false,
          message: "Server error (verify-otp)"
        }), { status: 500 });
      }
    }

    // -------------------------------
    // ❌ FALLBACK
    // -------------------------------
    return new Response("Not Found", { status: 404 });
  }
};
