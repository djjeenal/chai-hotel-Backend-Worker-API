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

    // =========================
    // SEND OTP ✅
    // =========================
    if (path === "/auth/send-otp" && request.method === "POST") {
      try {
        const body = await request.json();
        const email = (body.email || "").trim();

        if (!email)
          return json({ success: false, message: "Email required" }, 400);

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expires = Date.now() + 5 * 60 * 1000;

        await env.DB.prepare(
          `INSERT OR REPLACE INTO otp_codes (email, otp, expires_at, created_at)
           VALUES (?, ?, ?, ?)`
        )
          .bind(email, otp, expires, new Date().toISOString())
          .run();

        return json({ success: true, message: "OTP sent", otp });
      } catch (e) {
        return json({ success: false, error: e.message }, 500);
      }
    }

    // =========================
    // VERIFY OTP + REGISTER ✅
    // =========================
    if (path === "/auth/verify-otp" && request.method === "POST") {
      try {
        const body = await request.json();

        const email = (body.email || "").trim();
        const password = (body.password || "").toString().trim();
        const otp = (body.otp || "").toString().trim();

        if (!email || !password || !otp)
          return json({ success: false, message: "Missing fields" }, 400);

        const record = await env.DB.prepare(
          `SELECT otp, expires_at FROM otp_codes WHERE email = ?`
        )
          .bind(email)
          .first();

        if (!record)
          return json({ success: false, message: "No OTP found" }, 400);

        const dbOtp = (record.otp || "").toString().trim();

        if (Date.now() > Number(record.expires_at))
          return json({ success: false, message: "OTP expired" }, 400);

        if (dbOtp !== otp)
          return json({ success: false, message: "Wrong OTP" }, 400);

        // Check existing user
        const existingUser = await env.DB.prepare(
          `SELECT id FROM users WHERE email = ?`
        )
          .bind(email)
          .first();

        if (existingUser)
          return json({
            success: false,
            message: "Account already exists. Please login.",
          });

        // Create user
        const result = await env.DB.prepare(
          `INSERT INTO users (email, password_hash, is_verified, created_at)
           VALUES (?, ?, 1, ?)`
        )
          .bind(email, password, new Date().toISOString())
          .run();

        // Delete OTP after success ✅
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
          token,
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
        const body = await request.json();
        const email = (body.email || "").trim();
        const password = (body.password || "").toString().trim();

        const user = await env.DB.prepare(
          `SELECT id FROM users WHERE email = ? AND password_hash = ?`
        )
          .bind(email, password)
          .first();

        if (!user)
          return json({ success: false, message: "Invalid login" }, 401);

        const payload = {
          user_id: user.id,
          email,
          exp: Date.now() + 24 * 60 * 60 * 1000,
        };

        const token = makeToken(payload);

        return json({ success: true, message: "Login successful", token });
      } catch (e) {
        return json({ success: false, error: e.message }, 500);
      }
    }

    // =========================
    // TOKEN CHECK (/auth/me) ✅
    // =========================
    if (path === "/auth/me" && request.method === "GET") {
      const auth = request.headers.get("Authorization");

      if (!auth)
        return json({ success: false, message: "No token" }, 401);

      const token = auth.replace("Bearer ", "");
      const data = readToken(token);

      if (!data)
        return json({ success: false, message: "Invalid token" }, 401);

      if (Date.now() > data.exp)
        return json({ success: false, message: "Token expired" }, 401);

      return json({ success: true, user: data });
    }

    return json({ success: false, message: "Not found" }, 404);
  },
};
