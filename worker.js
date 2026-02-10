export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // ---------- HELPERS ----------
    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" }
      });

    // ---------- JWT HELPERS ----------
    const base64url = (input) =>
      btoa(input)
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");

    async function signJWT(payload, secret) {
      const header = { alg: "HS256", typ: "JWT" };
      const enc = new TextEncoder();

      const headerEncoded = base64url(JSON.stringify(header));
      const payloadEncoded = base64url(JSON.stringify(payload));
      const data = `${headerEncoded}.${payloadEncoded}`;

      const key = await crypto.subtle.importKey(
        "raw",
        enc.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );

      const signature = await crypto.subtle.sign(
        "HMAC",
        key,
        enc.encode(data)
      );

      const sigEncoded = base64url(
        String.fromCharCode(...new Uint8Array(signature))
      );

      return `${data}.${sigEncoded}`;
    }

    async function verifyJWT(token, secret) {
      try {
        const [header, payload, signature] = token.split(".");
        if (!header || !payload || !signature) return null;

        const enc = new TextEncoder();
        const data = `${header}.${payload}`;

        const key = await crypto.subtle.importKey(
          "raw",
          enc.encode(secret),
          { name: "HMAC", hash: "SHA-256" },
          false,
          ["verify"]
        );

        const sigBytes = Uint8Array.from(
          atob(signature.replace(/-/g, "+").replace(/_/g, "/")),
          (c) => c.charCodeAt(0)
        );

        const valid = await crypto.subtle.verify(
          "HMAC",
          key,
          sigBytes,
          enc.encode(data)
        );

        if (!valid) return null;

        const decoded = JSON.parse(
          atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
        );

        if (decoded.exp < Date.now()) return null;

        return decoded;
      } catch {
        return null;
      }
    }

    // ---------- PASSWORD ----------
    async function hashPassword(password) {
      const data = new TextEncoder().encode(password);
      const hash = await crypto.subtle.digest("SHA-256", data);
      return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
    }

    // ---------- ROUTES ----------

    // 1️⃣ SEND OTP
    if (path === "/auth/send-otp" && request.method === "POST") {
      const { email } = await request.json();
      if (!email) return json({ success: false }, 400);

      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      await env.DB.prepare(
        `INSERT INTO otps (email, otp)
         VALUES (?, ?)
         ON CONFLICT(email) DO UPDATE SET otp = ?`
      ).bind(email, otp, otp).run();

      return json({ success: true, otp }); // dev mode
    }

    // 2️⃣ VERIFY OTP (CREATE OR VERIFY USER)
    if (path === "/auth/verify-otp" && request.method === "POST") {
      const { email, password, otp } = await request.json();
      if (!email || !password || !otp)
        return json({ success: false }, 400);

      const row = await env.DB.prepare(
        `SELECT otp FROM otps WHERE email = ?`
      ).bind(email).first();

      if (!row || row.otp !== otp)
        return json({ success: false, message: "Invalid OTP" }, 401);

      const existing = await env.DB.prepare(
        `SELECT id FROM users WHERE email = ?`
      ).bind(email).first();

      if (!existing) {
        const hash = await hashPassword(password);
        await env.DB.prepare(
          `INSERT INTO users (email, password_hash, is_verified)
           VALUES (?, ?, 1)`
        ).bind(email, hash).run();
      } else {
        await env.DB.prepare(
          `UPDATE users SET is_verified = 1 WHERE email = ?`
        ).bind(email).run();
      }

      await env.DB.prepare(
        `DELETE FROM otps WHERE email = ?`
      ).bind(email).run();

      return json({ success: true });
    }

    // 3️⃣ LOGIN
    if (path === "/auth/login" && request.method === "POST") {
      const { email, password } = await request.json();
      if (!email || !password)
        return json({ success: false }, 400);

      const user = await env.DB.prepare(
        `SELECT id, password_hash, is_verified
         FROM users WHERE email = ?`
      ).bind(email).first();

      if (!user || !user.is_verified)
        return json({ success: false }, 401);

      const hash = await hashPassword(password);
      if (hash !== user.password_hash)
        return json({ success: false }, 401);

      const token = await signJWT(
        {
          user_id: user.id,
          email,
          exp: Date.now() + 24 * 60 * 60 * 1000
        },
        env.JWT_SECRET
      );

      return json({ success: true, token });
    }

    // 4️⃣ AUTH ME
    if (path === "/auth/me" && request.method === "GET") {
      const auth = request.headers.get("Authorization");
      if (!auth || !auth.startsWith("Bearer "))
        return json({ success: false }, 401);

      const token = auth.slice(7);
      const data = await verifyJWT(token, env.JWT_SECRET);
      if (!data)
        return json({ success: false }, 401);

      return json({
        success: true,
        user: {
          id: data.user_id,
          email: data.email
        }
      });
    }

    return json({ success: false, message: "Not Found" }, 404);
  }
};
