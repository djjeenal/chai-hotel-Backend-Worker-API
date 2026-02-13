export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" },
      });

    const makeToken = (payload) => btoa(JSON.stringify(payload));

    const readToken = (token) => {
      try {
        return JSON.parse(atob(token));
      } catch {
        return null;
      }
    };

    async function hashPassword(password) {
      const enc = new TextEncoder().encode(password);
      const hash = await crypto.subtle.digest("SHA-256", enc);
      return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
    }

    // =========================
    // SEND OTP (RATE LIMITED) ✅
    // =========================
    if (path === "/auth/send-otp" && request.method === "POST") {
      try {
        const { email } = await request.json();
        if (!email)
          return json({ success: false, message: "Email required" }, 400);

        // 🔥 RATE LIMIT CHECK (60 sec per email)
        const existing = await env.DB.prepare(
          `SELECT created_at FROM otp_codes WHERE email = ?`
        ).bind(email).first();

        if (existing) {
          const last = new Date(existing.created_at).getTime();
          const diff = Date.now() - last;

          if (diff < 60000) {
            return json({
              success: false,
              message: "Please wait before requesting OTP again"
            }, 429);
          }
        }

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
          message: "OTP generated",
          otp // remove later in production
        });
      } catch (e) {
        return json({ success: false, error: e.message }, 500);
      }
    }

    // =========================
    // VERIFY OTP + REGISTER ✅
    // =========================
    if (path === "/auth/verify-otp" && request.method === "POST") {
      try {
        const { email, password, otp } = await request.json();

        if (!email || !password || !otp)
          return json({ success: false, message: "Missing fields" }, 400);

        const record = await env.DB.prepare(
          `SELECT otp, expires_at FROM otp_codes WHERE email = ?`
        ).bind(email).first();

        if (!record)
          return json({ success: false, message: "No OTP found" }, 400);

        if (Date.now() > record.expires_at)
          return json({ success: false, message: "OTP expired" }, 400);

        if (record.otp !== otp)
          return json({ success: false, message: "Wrong OTP" }, 400);

        const existingUser = await env.DB.prepare(
          `SELECT id FROM users WHERE email = ?`
        ).bind(email).first();

        if (existingUser)
          return json({
            success: false,
            message: "Account already exists. Please login."
          });

        const hash = await hashPassword(password);

        const result = await env.DB.prepare(
          `INSERT INTO users (email, password_hash, is_verified, created_at)
           VALUES (?, ?, 1, ?)`
        )
          .bind(email, hash, new Date().toISOString())
          .run();

        await env.DB.prepare(`DELETE FROM otp_codes WHERE email = ?`)
          .bind(email)
          .run();

        const payload = {
          user_id: result.meta.last_row_id,
          email,
          exp: Date.now() + 24 * 60 * 60 * 1000,
        };

        const token = makeToken(payload);

        return json({
          success: true,
          message: "Account created",
          token
        });

      } catch (e) {
        return json({ success: false, error: e.message }, 500);
      }
    }

    // =========================
    // LOGIN ✅
    // =========================
    if (path === "/auth/login" && request.method === "POST") {
      try {
        const { email, password } = await request.json();

        const hash = await hashPassword(password);

        const user = await env.DB.prepare(
          `SELECT id FROM users WHERE email = ? AND password_hash = ?`
        ).bind(email, hash).first();

        if (!user)
          return json({ success: false, message: "Invalid login" }, 401);

        const payload = {
          user_id: user.id,
          email,
          exp: Date.now() + 24 * 60 * 60 * 1000,
        };

        const token = makeToken(payload);

        return json({ success: true, token });

      } catch (e) {
        return json({ success: false, error: e.message }, 500);
      }
    }

    // =========================
    // CHANGE PASSWORD ✅🔥
    // =========================
    if (path === "/auth/change-password" && request.method === "POST") {
      try {
        const auth = request.headers.get("Authorization");
        if (!auth)
          return json({ success: false, message: "No token" }, 401);

        const token = auth.replace("Bearer ", "");
        const session = readToken(token);

        if (!session || Date.now() > session.exp)
          return json({ success: false, message: "Invalid session" }, 401);

        const { oldPassword, newPassword } = await request.json();

        if (!oldPassword || !newPassword)
          return json({ success: false, message: "Missing fields" }, 400);

        const oldHash = await hashPassword(oldPassword);

        const user = await env.DB.prepare(
          `SELECT id FROM users WHERE id = ? AND password_hash = ?`
        ).bind(session.user_id, oldHash).first();

        if (!user)
          return json({ success: false, message: "Old password incorrect" });

        const newHash = await hashPassword(newPassword);

        await env.DB.prepare(
          `UPDATE users SET password_hash = ? WHERE id = ?`
        ).bind(newHash, session.user_id).run();

        return json({
          success: true,
          message: "Password changed successfully"
        });

      } catch (e) {
        return json({ success: false, error: e.message }, 500);
      }
    }

    // =========================
    // TOKEN CHECK ✅
    // =========================
    if (path === "/auth/me" && request.method === "GET") {
      const auth = request.headers.get("Authorization");
      if (!auth) return json({ success: false }, 401);

      const token = auth.replace("Bearer ", "");
      const data = readToken(token);

      if (!data || Date.now() > data.exp)
        return json({ success: false }, 401);

      return json({ success: true, user: data });
    }

    return json({ success: false, message: "Not found" }, 404);
  },
};
