// ================= CONFIG =================
const SECRET_KEY = "CHANGE_THIS_TO_RANDOM_SECRET";

// ================= TOKEN =================
function createToken(payload) {
  const data = {
    ...payload,
    exp: Date.now() + 1000 * 60 * 60 * 24 // 24 hours
  };
  return btoa(JSON.stringify(data) + "." + SECRET_KEY);
}

function verifyToken(token) {
  try {
    const decoded = atob(token);
    const [json, secret] = decoded.split(".");
    if (secret !== SECRET_KEY) return null;

    const data = JSON.parse(json);
    if (Date.now() > data.exp) return null;

    return data;
  } catch {
    return null;
  }
}

// ================= WORKER =================
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

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

    // ================= SEND OTP =================
    if (path === "/auth/send-otp" && request.method === "POST") {
      const { email } = await request.json();
      if (!email)
        return json({ success: false, message: "Email required" }, 400);

      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS otps (
          email TEXT PRIMARY KEY,
          otp TEXT
        )
      `).run();

      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      await env.DB.prepare(
        `INSERT OR REPLACE INTO otps (email, otp) VALUES (?, ?)`
      ).bind(email, otp).run();

      return json({
        success: true,
        message: "OTP generated (demo)",
        otp
      });
    }

    // ================= VERIFY OTP (FINAL FIX) =================
    if (path === "/auth/verify-otp" && request.method === "POST") {
      const { email, password, otp } = await request.json();

      if (!email || !password || !otp)
        return json({ success: false, message: "Missing data" }, 400);

      const row = await env.DB.prepare(
        `SELECT otp FROM otps WHERE email = ?`
      ).bind(email).first();

      if (!row || row.otp !== otp)
        return json({ success: false, message: "Invalid OTP" }, 401);

      const existingUser = await env.DB.prepare(
        `SELECT id FROM users WHERE email = ?`
      ).bind(email).first();

      if (existingUser) {
        await env.DB.prepare(
          `UPDATE users SET is_verified = 1 WHERE email = ?`
        ).bind(email).run();

        await env.DB.prepare(
          `DELETE FROM otps WHERE email = ?`
        ).bind(email).run();

        return json({
          success: true,
          message: "User already exists & verified"
        });
      }

      const hash = await hashPassword(password);

      await env.DB.prepare(
        `INSERT INTO users (email, password_hash, is_verified)
         VALUES (?, ?, 1)`
      ).bind(email, hash).run();

      await env.DB.prepare(
        `DELETE FROM otps WHERE email = ?`
      ).bind(email).run();

      return json({
        success: true,
        message: "Account created & verified"
      });
    }

    // ================= LOGIN =================
    if (path === "/auth/login" && request.method === "POST") {
      const { email, password } = await request.json();
      if (!email || !password)
        return json({ success: false, message: "Missing data" }, 400);

      const hash = await hashPassword(password);

      const user = await env.DB.prepare(`
        SELECT id FROM users
        WHERE email = ? AND password_hash = ? AND is_verified = 1
      `).bind(email, hash).first();

      if (!user)
        return json({ success: false, message: "Invalid login" }, 401);

      const token = createToken({
        user_id: user.id,
        email
      });

      return json({
        success: true,
        user_id: user.id,
        token
      });
    }

    // ================= AUTH ME =================
    if (path === "/auth/me" && request.method === "GET") {
      const auth = request.headers.get("Authorization");

      if (!auth || !auth.startsWith("Bearer "))
        return json({ success: false, message: "No token" }, 401);

      const token = auth.replace("Bearer ", "");
      const data = verifyToken(token);

      if (!data)
        return json({ success: false, message: "Invalid token" }, 401);

      return json({
        success: true,
        user: {
          id: data.user_id,
          email: data.email
        }
      });
    }

    return json({ success: false, message: "Route not found" }, 404);
  },
};
