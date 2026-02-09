/****************************************************
 * FULL AUTH SYSTEM – CLOUDFARE WORKER + D1
 * OTP + REGISTER + LOGIN + TOKEN + AUTH/ME
 ****************************************************/

const SECRET_KEY = "THIS_IS_A_VERY_LONG_RANDOM_SECRET_KEY_987654321";

/* ================= TOKEN SYSTEM ================= */

function createToken(payload) {
  const data = {
    user_id: payload.user_id,
    email: payload.email,
    exp: Date.now() + 1000 * 60 * 60 * 24 // 24 hours
  };

  const tokenString = JSON.stringify(data) + "." + SECRET_KEY;
  return btoa(tokenString);
}

function verifyToken(token) {
  try {
    const decoded = atob(token);
    const parts = decoded.split(".");

    if (parts.length !== 2) return null;
    if (parts[1] !== SECRET_KEY) return null;

    const data = JSON.parse(parts[0]);
    if (Date.now() > data.exp) return null;

    return data;
  } catch (e) {
    return null;
  }
}

/* ================= PASSWORD HASH ================= */

async function hashPassword(password) {
  const enc = new TextEncoder().encode(password);
  const hash = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

/* ================= RESPONSE HELPER ================= */

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*"
    }
  });
}

/* ================= MAIN WORKER ================= */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    /* ---------- AUTO CREATE TABLES ---------- */

    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE,
        password_hash TEXT,
        is_verified INTEGER
      )
    `).run();

    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS otps (
        email TEXT PRIMARY KEY,
        otp TEXT,
        created_at INTEGER
      )
    `).run();

    /* ---------- SEND OTP ---------- */
    if (path === "/auth/send-otp" && method === "POST") {
      const body = await request.json();
      const email = body.email;

      if (!email) {
        return jsonResponse({ success: false, message: "Email required" }, 400);
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      await env.DB.prepare(
        `INSERT OR REPLACE INTO otps (email, otp, created_at)
         VALUES (?, ?, ?)`
      ).bind(email, otp, Date.now()).run();

      return jsonResponse({
        success: true,
        message: "OTP generated (demo mode)",
        otp
      });
    }

    /* ---------- VERIFY OTP + REGISTER ---------- */
    if (path === "/auth/verify-otp" && method === "POST") {
      const body = await request.json();
      const { email, password, otp } = body;

      if (!email || !password || !otp) {
        return jsonResponse({ success: false, message: "Missing fields" }, 400);
      }

      const row = await env.DB.prepare(
        `SELECT otp FROM otps WHERE email = ?`
      ).bind(email).first();

      if (!row || row.otp !== otp) {
        return jsonResponse({ success: false, message: "Invalid OTP" }, 401);
      }

      const passwordHash = await hashPassword(password);

      await env.DB.prepare(
        `INSERT OR IGNORE INTO users (email, password_hash, is_verified)
         VALUES (?, ?, 1)`
      ).bind(email, passwordHash).run();

      await env.DB.prepare(
        `DELETE FROM otps WHERE email = ?`
      ).bind(email).run();

      return jsonResponse({
        success: true,
        message: "Account created & verified"
      });
    }

    /* ---------- LOGIN ---------- */
    if (path === "/auth/login" && method === "POST") {
      const body = await request.json();
      const { email, password } = body;

      if (!email || !password) {
        return jsonResponse({ success: false, message: "Missing credentials" }, 400);
      }

      const passwordHash = await hashPassword(password);

      const user = await env.DB.prepare(
        `SELECT id, email FROM users
         WHERE email = ? AND password_hash = ? AND is_verified = 1`
      ).bind(email, passwordHash).first();

      if (!user) {
        return jsonResponse({ success: false, message: "Invalid login" }, 401);
      }

      const token = createToken({
        user_id: user.id,
        email: user.email
      });

      return jsonResponse({
        success: true,
        user_id: user.id,
        token
      });
    }

    /* ---------- AUTH ME ---------- */
    if (path === "/auth/me" && method === "GET") {
      const authHeader = request.headers.get("Authorization");

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return jsonResponse({ success: false, message: "No token" }, 401);
      }

      const token = authHeader.replace("Bearer ", "");
      const data = verifyToken(token);

      if (!data) {
        return jsonResponse({ success: false, message: "Invalid token" }, 401);
      }

      return jsonResponse({
        success: true,
        user: {
          id: data.user_id,
          email: data.email
        }
      });
    }

    /* ---------- NOT FOUND ---------- */
    return jsonResponse({ success: false, message: "Route not found" }, 404);
  }
};
