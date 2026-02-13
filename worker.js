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

    const getUserFromRequest = (request) => {
      const auth = request.headers.get("Authorization");
      if (!auth) return null;

      const token = auth.replace("Bearer ", "");
      const data = readToken(token);

      if (!data) return null;
      if (Date.now() > data.exp) return null;

      return data;
    };

    // =========================
    // SEND OTP
    // =========================
    if (path === "/auth/send-otp" && request.method === "POST") {
      try {
        const body = await request.json();
        const email = (body.email || "").trim();

        if (!email)
          return json({ success: false, message: "Email required" }, 400);

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
    // VERIFY OTP + REGISTER
    // =========================
    if (path === "/auth/verify-otp" && request.method === "POST") {
      try {
        const body = await request.json();

        const email = (body.email || "").trim();
        const password = (body.password || "").trim();
        const otp = (body.otp || "").trim();

        if (!email || !password || !otp)
          return json({ success: false, message: "Missing fields" }, 400);

        const record = await env.DB.prepare(
          `SELECT otp, expires_at FROM otp_codes WHERE email = ?`
        )
          .bind(email)
          .first();

        if (!record)
          return json({ success: false, message: "No OTP found" }, 400);

        if (Date.now() > Number(record.expires_at))
          return json({ success: false, message: "OTP expired" }, 400);

        if ((record.otp || "").trim() !== otp)
          return json({ success: false, message: "Wrong OTP" }, 400);

        const result = await env.DB.prepare(
          `INSERT INTO users (email, password_hash, is_verified, created_at)
           VALUES (?, ?, 1, ?)`
        )
          .bind(email, password, new Date().toISOString())
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

        return json({ success: true, message: "Account created", token });
      } catch (e) {
        return json({ success: false, error: e.message }, 500);
      }
    }

    // =========================
    // LOGIN
    // =========================
    if (path === "/auth/login" && request.method === "POST") {
      try {
        const body = await request.json();
        const email = (body.email || "").trim();
        const password = (body.password || "").trim();

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
    // TOKEN CHECK
    // =========================
    if (path === "/auth/me" && request.method === "GET") {
      const user = getUserFromRequest(request);

      if (!user)
        return json({ success: false, message: "Invalid / Expired token" }, 401);

      return json({ success: true, user });
    }

    // =========================
    // GET MENU
    // =========================
    if (path === "/menu" && request.method === "GET") {
      try {
        const items = await env.DB.prepare(
          `SELECT * FROM menu_items WHERE is_active = 1 ORDER BY id DESC`
        ).all();

        return json({ success: true, items: items.results });
      } catch (e) {
        return json({ success: false, error: e.message }, 500);
      }
    }

    // =========================
    // CREATE ORDER
    // =========================
    if (path === "/order/create" && request.method === "POST") {
      try {
        const user = getUserFromRequest(request);

        if (!user)
          return json({ success: false, message: "Unauthorized" }, 401);

        const body = await request.json();
        const items = body.items || [];

        if (!items.length)
          return json({ success: false, message: "No items" }, 400);

        let total = 0;

        const orderRes = await env.DB.prepare(
          `INSERT INTO orders (user_id, total, status, created_at)
           VALUES (?, 0, 'PENDING', ?)`
        )
          .bind(user.user_id, new Date().toISOString())
          .run();

        const orderId = orderRes.meta.last_row_id;

        for (const item of items) {
          const price = Number(item.price);
          const qty = Number(item.qty);

          total += price * qty;

          await env.DB.prepare(
            `INSERT INTO order_items (order_id, item_id, name, price, qty)
             VALUES (?, ?, ?, ?, ?)`
          )
            .bind(orderId, item.item_id, item.name, price, qty)
            .run();
        }

        await env.DB.prepare(`UPDATE orders SET total = ? WHERE id = ?`)
          .bind(total, orderId)
          .run();

        return json({ success: true, message: "Order placed", total });
      } catch (e) {
        return json({ success: false, error: e.message }, 500);
      }
    }

    // =========================
    // MY ORDERS
    // =========================
    if (path === "/order/my-orders" && request.method === "GET") {
      try {
        const user = getUserFromRequest(request);

        if (!user)
          return json({ success: false, message: "Unauthorized" }, 401);

        const orders = await env.DB.prepare(
          `SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC`
        )
          .bind(user.user_id)
          .all();

        return json({ success: true, orders: orders.results });
      } catch (e) {
        return json({ success: false, error: e.message }, 500);
      }
    }

    return json({ success: false, message: "Not found" }, 404);
  },
};
