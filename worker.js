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

      if (!payload || Date.now() > payload.exp) return null;

      return payload;
    };

    // =========================
    // TEST
    // =========================

    if (path === "/test") {
      return json({ success: true, message: "Backend working" });
    }

    // =========================
    // REGISTER
    // =========================

    if (path === "/auth/register" && request.method === "POST") {
      const { email, password } = await request.json();

      const hashed = await hashPassword(password);

      try {
        const result = await env.DB.prepare(
          `INSERT INTO users (email, password_hash)
           VALUES (?, ?)`
        ).bind(email, hashed).run();

        const token = makeToken({
          user_id: result.meta.last_row_id,
          email,
          exp: Date.now() + 86400000,
        });

        return json({ success: true, token });
      } catch (e) {
        return json({ success: false, message: "User exists" });
      }
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
        exp: Date.now() + 86400000,
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
        "SELECT id FROM users WHERE id = ? AND password_hash = ?"
      ).bind(session.user_id, oldHash).first();

      if (!user) return json({ success: false, message: "Wrong password" });

      await env.DB.prepare(
        "UPDATE users SET password_hash = ? WHERE id = ?"
      ).bind(newHash, session.user_id).run();

      return json({ success: true });
    }

    // =========================
    // CREATE ORDER
    // =========================

    if (path === "/orders/create" && request.method === "POST") {
      const session = await getUserFromToken();
      if (!session) return json({ success: false, message: "Unauthorized" });

      const { items } = await request.json();

      let total = 0;

      for (const item of items) {
        total += item.price * item.qty;
      }

      const order = await env.DB.prepare(
        `INSERT INTO orders (user_id, total, status, created_at)
         VALUES (?, ?, 'PENDING', ?)`
      ).bind(session.user_id, total, Date.now()).run();

      const order_id = order.meta.last_row_id;

      for (const item of items) {
        await env.DB.prepare(
          `INSERT INTO order_items (order_id, item_id, name, price, qty)
           VALUES (?, ?, ?, ?, ?)`
        ).bind(order_id, item.item_id, item.name, item.price, item.qty).run();
      }

      return json({ success: true, order_id, total });
    }

    // =========================
    // MY ORDERS
    // =========================

    if (path === "/orders/my-orders" && request.method === "GET") {
      const session = await getUserFromToken();
      if (!session) return json({ success: false, message: "Unauthorized" });

      const orders = await env.DB.prepare(
        "SELECT * FROM orders WHERE user_id = ?"
      ).bind(session.user_id).all();

      return json({ success: true, orders: orders.results });
    }

    // =========================
    // ORDER DETAILS
    // =========================

    if (path === "/order/details" && request.method === "GET") {
      const id = url.searchParams.get("id");

      const items = await env.DB.prepare(
        "SELECT * FROM order_items WHERE order_id = ?"
      ).bind(id).all();

      return json({ success: true, items: items.results });
    }

    return json({ success: false, message: "Not found" }, 404);
  },
};
