export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // ---------- HELPERS ----------
    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" },
      });

    async function hashPassword(password) {
      const enc = new TextEncoder().encode(password);
      const hash = await crypto.subtle.digest("SHA-256", enc);
      return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
    }

    // ---------- SEND OTP ----------
    if (path === "/auth/send-otp" && request.method === "POST") {
      const { email } = await request.json();
      if (!email) return json({ success: false, message: "Email required" }, 400);

      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      await env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS otps (
          email TEXT PRIMARY KEY,
          otp TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
      ).run();

      await env.DB.prepare(
        `INSERT OR REPLACE INTO otps (email, otp) VALUES (?, ?)`
      ).bind(email, otp).run();

      // DEMO MODE RESPONSE
      return json({
        success: true,
        message: "OTP generated (demo mode)",
        email,
        otp
      });
    }

    // ---------- VERIFY OTP + CREATE ACCOUNT ----------
    if (path === "/auth/verify-otp" && request.method === "POST") {
      const { email, password, otp } = await request.json();
      if (!email || !password || !otp)
        return json({ success: false, message: "Missing fields" }, 400);

      const savedOtp = await env.DB.prepare(
        `SELECT otp FROM otps WHERE email = ?`
      ).bind(email).first();

      if (!savedOtp || savedOtp.otp !== otp)
        return json({ success: false, message: "Invalid OTP" }, 401);

      const existing = await env.DB.prepare(
        `SELECT id FROM users WHERE email = ?`
      ).bind(email).first();

      if (existing)
        return json({ success: false, message: "Email already registered" }, 409);

      const passwordHash = await hashPassword(password);

      await env.DB.prepare(
        `INSERT INTO users (email, password_hash, is_verified)
         VALUES (?, ?, 1)`
      ).bind(email, passwordHash).run();

      await env.DB.prepare(`DELETE FROM otps WHERE email = ?`)
        .bind(email).run();

      return json({
        success: true,
        message: "Account created & verified successfully"
      });
    }

    // ---------- LOGIN ----------
    if (path === "/auth/login" && request.method === "POST") {
      const { email, password } = await request.json();
      if (!email || !password)
        return json({ success: false, message: "Missing credentials" }, 400);

      const passwordHash = await hashPassword(password);

      const user = await env.DB.prepare(
        `SELECT id FROM users
         WHERE email = ? AND password_hash = ? AND is_verified = 1`
      ).bind(email, passwordHash).first();

      if (!user)
        return json({ success: false, message: "Invalid login" }, 401);

      return json({
        success: true,
        message: "Login successful",
        user_id: user.id
      });
    }

    return json({ success: false, message: "Route not found" }, 404);
  },
};
