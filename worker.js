export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json",
    };

    // ---------------- SEND OTP ----------------
    if (url.pathname === "/auth/send-otp" && request.method === "POST") {
      const { email } = await request.json();
      if (!email) {
        return new Response(JSON.stringify({ error: "Email required" }), { status: 400, headers });
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      await env.DB.prepare(
        "INSERT OR REPLACE INTO opts (email, otp) VALUES (?, ?)"
      ).bind(email, otp).run();

      // ⚠️ Dev purpose only
      return new Response(JSON.stringify({ success: true, otp }), { headers });
    }

    // ---------------- VERIFY OTP ----------------
    if (url.pathname === "/auth/verify-otp" && request.method === "POST") {
      const { email, password, otp } = await request.json();

      if (!email || !password || !otp) {
        return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400, headers });
      }

      const row = await env.DB.prepare(
        "SELECT otp FROM opts WHERE email = ?"
      ).bind(email).first();

      if (!row || row.otp !== otp) {
        return new Response(JSON.stringify({ error: "Invalid OTP" }), { status: 401, headers });
      }

      const hash = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(password)
      );
      const password_hash = [...new Uint8Array(hash)]
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");

      await env.DB.prepare(
        "INSERT OR REPLACE INTO users (email, password_hash, is_verified) VALUES (?, ?, 1)"
      ).bind(email, password_hash).run();

      return new Response(JSON.stringify({ success: true }), { headers });
    }

    // ---------------- LOGIN ----------------
    if (url.pathname === "/auth/login" && request.method === "POST") {
      const { email, password } = await request.json();

      if (!email || !password) {
        return new Response(JSON.stringify({ error: "Missing credentials" }), { status: 400, headers });
      }

      const hash = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(password)
      );
      const password_hash = [...new Uint8Array(hash)]
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");

      const user = await env.DB.prepare(
        "SELECT id FROM users WHERE email = ? AND password_hash = ? AND is_verified = 1"
      ).bind(email, password_hash).first();

      if (!user) {
        return new Response(JSON.stringify({ error: "Invalid login" }), { status: 401, headers });
      }

      const token = btoa(JSON.stringify({
        user_id: user.id,
        email,
        exp: Date.now() + 7 * 24 * 60 * 60 * 1000
      }));

      return new Response(JSON.stringify({ success: true, token }), { headers });
    }

    // ---------------- AUTH ME ----------------
    if (url.pathname === "/auth/me" && request.method === "GET") {
      const auth = request.headers.get("Authorization");
      if (!auth || !auth.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
      }

      const token = auth.replace("Bearer ", "");
      const data = JSON.parse(atob(token));

      return new Response(JSON.stringify({ success: true, user: data }), { headers });
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
  }
};
