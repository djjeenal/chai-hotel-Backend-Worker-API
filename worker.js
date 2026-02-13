export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" },
      });

    // =========================
    // Helpers
    // =========================

    const hashPassword = async (password) => {
      const data = new TextEncoder().encode(password);
      const hash = await crypto.subtle.digest("SHA-256", data);
      return btoa(String.fromCharCode(...new Uint8Array(hash)));
    };

    const makeToken = (payload) => btoa(JSON.stringify(payload));

    const readToken = (token) => {
      try {
        return JSON.parse(atob(token));
      } catch {
        return null;
      }
    };

    const getUserFromToken = async () => {
      const auth = request.headers.get("Authorization");
      if (!auth) return null;

      const token = auth.replace("Bearer ", "");
      const payload = readToken(token);
      if (!payload) return null;

      if (Date.now() > payload.exp) return null;

      // Check blacklist
      const blacklisted = await env.DB.prepare(
        "SELECT token FROM sessions WHERE token = ?"
      ).bind(token).first();

      if (blacklisted) return null;

      return { token, payload };
    };

    // =========================
    // RATE LIMIT (basic)
    // =========================

    const rateLimit = async (key, limit = 5, windowMs = 60000) => {
      const now = Date.now();

      const record = await env.DB.prepare(
        "SELECT count, expires_at FROM rate_limits WHERE key = ?"
      ).bind(key).first();

      if (!record) {
        await env.DB.prepare(
          "INSERT INTO rate_limits (key, count, expires_at) VALUES (?, ?, ?)"
        ).bind(key, 1, now + windowMs).run();
        return false;
      }

      if (now > record.expires_at) {
        await env.DB.prepare(
          "UPDATE rate_limits SET count = 1, expires_at = ? WHERE key = ?"
        ).bind(now + windowMs, key).run();
        return false;
      }

      if (record.count >= limit) return true;

      await env.DB.prepare(
        "UPDATE rate_limits SET count = count + 1 WHERE key = ?"
      ).bind(key).run();

      return false;
    };

    // =========================
    // SEND OTP
    // =========================

    if (path === "/auth/send-otp" && request.method === "POST") {
      const { email } = await request.json();

      if (await rateLimit(`otp:${email}`))
        return json({ success: false, message: "Too many requests" }, 429);

      const existingUser = await env.DB.prepare(
        "SELECT id FROM users WHERE email = ?"
      ).bind(email).first();

      if (existingUser)
        return json({ success: false, message: "Account already exists" });

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = Date.now() + 5 * 60 * 1000;

      await env.DB.prepare(
        `INSERT OR REPLACE INTO otp_codes (email, otp, expires_at, created_at)
         VALUES (?, ?, ?, ?)`
      ).bind(email, otp, expires, new Date().toISOString()).run();

      return json({ success: true, otp });
    }

    // =========================
    // RESEND OTP
    // =========================

    if (path === "/auth/resend-otp" && request.method === "POST") {
      const { email } = await request.json();

      if (await rateLimit(`resend:${email}`, 2, 30000))
        return json({ success: false, message: "Wait before retry" });

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = Date.now() + 5 * 60 * 1000;

      await env.DB.prepare(
        `INSERT OR REPLACE INTO otp_codes (email, otp, expires_at, created_at)
         VALUES (?, ?, ?, ?)`
      ).bind(email, otp, expires, new Date().toISOString()).run();

      return json({ success: true, otp });
    }

    // =========================
    // VERIFY OTP + REGISTER
    // =========================

    if (path === "/auth/verify-otp" && request.method === "POST") {
      const { email, password, otp } = await request.json();

      const record = await env.DB.prepare(
        "SELECT otp, expires_at FROM otp_codes WHERE email = ?"
      ).bind(email).first();

      if (!record) return json({ success: false, message: "No OTP found" });

      if (Date.now() > record.expires_at)
        return json({ success: false, message: "OTP expired" });

      if (record.otp !== otp)
        return json({ success: false, message: "Wrong OTP" });

      const hashed = await hashPassword(password);

      const result = await env.DB.prepare(
        `INSERT INTO users (email, password_hash, is_verified, created_at)
         VALUES (?, ?, 1, ?)`
      ).bind(email, hashed, new Date().toISOString()).run();

      await env.DB.prepare("DELETE FROM otp_codes WHERE email = ?")
        .bind(email).run();

      const payload = {
        user_id: result.meta.last_row_id,
        email,
        exp: Date.now() + 15 * 60 * 1000,
      };

      const refresh = makeToken({
        email,
        exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
        type: "refresh",
      });

      return json({ success: true, token: makeToken(payload), refresh });
    }

    // =========================
    // LOGIN
    // =========================

    if (path === "/auth/login" && request.method === "POST") {
      const { email, password } = await request.json();

      const hashed = await hashPassword(password);

      const user = await env.DB.prepare(
        "SELECT id FROM users WHERE email = ? AND password_hash = ?"
      ).bind(email, hashed).first();

      if (!user) return json({ success: false, message: "Invalid login" });

      const token = makeToken({
        user_id: user.id,
        email,
        exp: Date.now() + 15 * 60 * 1000,
      });

      const refresh = makeToken({
        email,
        exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
        type: "refresh",
      });

      return json({ success: true, token, refresh });
    }

    // =========================
    // REFRESH TOKEN
    // =========================

    if (path === "/auth/refresh" && request.method === "POST") {
      const { refresh } = await request.json();
      const data = readToken(refresh);

      if (!data || data.type !== "refresh" || Date.now() > data.exp)
        return json({ success: false, message: "Invalid refresh" });

      const token = makeToken({
        email: data.email,
        exp: Date.now() + 15 * 60 * 1000,
      });

      return json({ success: true, token });
    }

    // =========================
    // CHANGE PASSWORD
    // =========================

    if (path === "/auth/change-password" && request.method === "POST") {
      const session = await getUserFromToken();
      if (!session) return json({ success: false, message: "Unauthorized" });

      const { old_password, new_password } = await request.json();

      const oldHash = await hashPassword(old_password);
      const newHash = await hashPassword(new_password);

      const user = await env.DB.prepare(
        "SELECT id FROM users WHERE email = ? AND password_hash = ?"
      ).bind(session.payload.email, oldHash).first();

      if (!user)
        return json({ success: false, message: "Wrong old password" });

      await env.DB.prepare(
        "UPDATE users SET password_hash = ? WHERE id = ?"
      ).bind(newHash, user.id).run();

      return json({ success: true, message: "Password updated" });
    }

    // =========================
    // LOGOUT
    // =========================

    if (path === "/auth/logout" && request.method === "POST") {
      const session = await getUserFromToken();
      if (!session) return json({ success: false });

      await env.DB.prepare(
        "INSERT INTO sessions (token) VALUES (?)"
      ).bind(session.token).run();

      return json({ success: true });
    }

    return json({ success: false, message: "Not found" }, 404);
  },
};
