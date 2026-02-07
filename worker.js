export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method;

      // Allow only POST
      if (method !== "POST") {
        return json({ success: false, message: "Only POST allowed" }, 405);
      }

      const body = await request.json();

      /* ===============================
         1️⃣ SEND OTP
         =============================== */
      if (path === "/password/send-otp") {
        const { email } = body;
        if (!email) return json({ success: false, message: "Email required" }, 400);

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 5 * 60 * 1000;

        await env.DB.prepare(`
          INSERT INTO otp_codes (email, otp, expires_at)
          VALUES (?, ?, ?)
        `).bind(email, otp, expiresAt).run();

        return json({
          success: true,
          message: "OTP generated & saved",
          otp // ⚠️ real app में OTP hide रखना
        });
      }

      /* ===============================
         2️⃣ VERIFY OTP
         =============================== */
      if (path === "/password/verify-otp") {
        const { email, otp } = body;
        if (!email || !otp) {
          return json({ success: false, message: "Email & OTP required" }, 400);
        }

        const row = await env.DB.prepare(`
          SELECT * FROM otp_codes
          WHERE email = ? AND otp = ?
          ORDER BY id DESC LIMIT 1
        `).bind(email, otp).first();

        if (!row) {
          return json({ success: false, message: "Invalid OTP" }, 400);
        }

        if (Date.now() > row.expires_at) {
          return json({ success: false, message: "OTP expired" }, 400);
        }

        return json({ success: true, message: "OTP verified" });
      }

      /* ===============================
         3️⃣ PASSWORD RESET
         =============================== */
      if (path === "/password/reset") {
        const { email, newPassword } = body;
        if (!email || !newPassword) {
          return json({ success: false, message: "Email & newPassword required" }, 400);
        }

        await env.DB.prepare(`
          UPDATE users SET password = ?
          WHERE email = ?
        `).bind(newPassword, email).run();

        return json({ success: true, message: "Password reset successful" });
      }

      /* ===============================
         4️⃣ LOGIN
         =============================== */
      if (path === "/auth/login") {
        const { email, password } = body;
        if (!email || !password) {
          return json({ success: false, message: "Email & password required" }, 400);
        }

        const user = await env.DB.prepare(`
          SELECT * FROM users WHERE email = ?
        `).bind(email).first();

        if (!user) {
          return json({ success: false, message: "User not found" }, 404);
        }

        if (user.password !== password) {
          return json({ success: false, message: "Wrong password" }, 401);
        }

        return json({
          success: true,
          message: "Login successful",
          user: {
            id: user.id,
            email: user.email
          }
        });
      }

      // ❌ No route matched
      return json({ success: false, message: "Route not found" }, 404);

    } catch (err) {
      return json({ success: false, error: err.message }, 500);
    }
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
