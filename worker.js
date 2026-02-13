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
      try { return JSON.parse(atob(token)); }
      catch { return null; }
    };

    async function hashPassword(password) {
      const enc = new TextEncoder().encode(password);
      const hash = await crypto.subtle.digest("SHA-256", enc);
      return [...new Uint8Array(hash)]
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
    }

    // =========================
    // SEND OTP
    // =========================
    if (path === "/auth/send-otp" && request.method === "POST") {
      const { email } = await request.json();
      if (!email) return json({ success:false, message:"Email required" }, 400);

      const otp = Math.floor(100000 + Math.random()*900000).toString();
      const expires = Date.now() + 5*60*1000;

      await env.DB.prepare(
        `INSERT OR REPLACE INTO otp_codes (email, otp, expires_at, created_at)
         VALUES (?, ?, ?, ?)`
      ).bind(email.trim(), otp, expires, new Date().toISOString()).run();

      return json({ success:true, message:"OTP sent", otp }); // remove otp later
    }

    // =========================
    // VERIFY OTP + REGISTER
    // =========================
    if (path === "/auth/verify-otp" && request.method === "POST") {
      const { email, password, otp } = await request.json();
      if (!email || !password || !otp)
        return json({ success:false, message:"Missing fields" }, 400);

      const record = await env.DB.prepare(
        `SELECT otp, expires_at FROM otp_codes WHERE email = ?`
      ).bind(email.trim()).first();

      if (!record) return json({ success:false, message:"No OTP found" });

      if (Date.now() > Number(record.expires_at))
        return json({ success:false, message:"OTP expired" });

      if (record.otp !== otp)
        return json({ success:false, message:"Wrong OTP" });

      const existing = await env.DB.prepare(
        `SELECT id FROM users WHERE email = ?`
      ).bind(email.trim()).first();

      if (existing)
        return json({ success:false, message:"Account already exists" });

      const hash = await hashPassword(password);

      const result = await env.DB.prepare(
        `INSERT INTO users (email, password_hash, is_verified, created_at)
         VALUES (?, ?, 1, ?)`
      ).bind(email.trim(), hash, new Date().toISOString()).run();

      await env.DB.prepare(`DELETE FROM otp_codes WHERE email = ?`)
        .bind(email.trim()).run();

      const token = makeToken({
        user_id: result.meta.last_row_id,
        email,
        exp: Date.now() + 24*60*60*1000
      });

      return json({ success:true, message:"Account created", token });
    }

    // =========================
    // LOGIN
    // =========================
    if (path === "/auth/login" && request.method === "POST") {
      const { email, password } = await request.json();
      if (!email || !password)
        return json({ success:false, message:"Missing credentials" }, 400);

      const hash = await hashPassword(password);

      const user = await env.DB.prepare(
        `SELECT id FROM users WHERE email = ? AND password_hash = ?`
      ).bind(email.trim(), hash).first();

      if (!user)
        return json({ success:false, message:"Invalid login" }, 401);

      const token = makeToken({
        user_id: user.id,
        email,
        exp: Date.now() + 24*60*60*1000
      });

      return json({ success:true, message:"Login success", token });
    }

    // =========================
    // TOKEN CHECK
    // =========================
    if (path === "/auth/me" && request.method === "GET") {
      const auth = request.headers.get("Authorization");
      if (!auth) return json({ success:false }, 401);

      const token = auth.replace("Bearer ", "");
      const data = readToken(token);

      if (!data || Date.now() > data.exp)
        return json({ success:false }, 401);

      return json({ success:true, user:data });
    }

    // =========================
    // MENU LIST (PUBLIC)
    // =========================
    if (path === "/menu" && request.method === "GET") {
      const items = await env.DB.prepare(
        `SELECT * FROM menu_items WHERE is_active = 1`
      ).all();

      return json({ success:true, items: items.results });
    }

    // =========================
    // CREATE ORDER
    // =========================
    if (path === "/orders/create" && request.method === "POST") {
      const auth = request.headers.get("Authorization");
      if (!auth) return json({ success:false }, 401);

      const token = auth.replace("Bearer ", "");
      const user = readToken(token);
      if (!user) return json({ success:false }, 401);

      const { items } = await request.json();
      if (!items || !items.length)
        return json({ success:false, message:"No items" });

      let total = 0;

      const order = await env.DB.prepare(
        `INSERT INTO orders (user_id, total, status, created_at)
         VALUES (?, ?, 'PENDING', ?)`
      ).bind(user.user_id, 0, new Date().toISOString()).run();

      const orderId = order.meta.last_row_id;

      for (const i of items) {
        const menuItem = await env.DB.prepare(
          `SELECT * FROM menu_items WHERE id = ?`
        ).bind(i.item_id).first();

        if (!menuItem) continue;

        const lineTotal = menuItem.price * i.qty;
        total += lineTotal;

        await env.DB.prepare(
          `INSERT INTO order_items (order_id, item_id, name, price, qty)
           VALUES (?, ?, ?, ?, ?)`
        ).bind(orderId, menuItem.id, menuItem.name, menuItem.price, i.qty).run();
      }

      await env.DB.prepare(
        `UPDATE orders SET total = ? WHERE id = ?`
      ).bind(total, orderId).run();

      return json({ success:true, order_id: orderId, total });
    }

    return json({ success:false, message:"Route not found" }, 404);
  },
};
