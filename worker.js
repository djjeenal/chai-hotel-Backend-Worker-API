export default {
  async fetch(request, env, ctx) {

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {

      // ✅ TEST ROUTE
      if (path === "/test") {
        return json({ success: true, message: "Backend working" });
      }

      // ✅ REGISTER
      if (path === "/auth/register" && request.method === "POST") {
        const body = await request.json();
        const { email, password } = body;

        if (!email || !password) {
          return json({ success: false, message: "Missing fields" }, 400);
        }

        await env.DB.prepare(
          "INSERT INTO users (email, password_hash) VALUES (?, ?)"
        ).bind(email, password).run();

        return json({ success: true });
      }

      // ✅ LOGIN
      if (path === "/auth/login" && request.method === "POST") {
        const body = await request.json();
        const { email, password } = body;

        const user = await env.DB.prepare(
          "SELECT * FROM users WHERE email = ?"
        ).bind(email).first();

        if (!user || user.password_hash !== password) {
          return json({ success: false, message: "Invalid credentials" }, 401);
        }

        const token = btoa(JSON.stringify({
          user_id: user.id,
          email: user.email,
          exp: Date.now() + 7 * 24 * 60 * 60 * 1000
        }));

        return json({ success: true, token });
      }

      // ✅ CREATE ORDER
      if (path === "/orders/create" && request.method === "POST") {

        const auth = request.headers.get("Authorization");
        if (!auth) return json({ success: false, message: "No token" }, 401);

        const token = JSON.parse(atob(auth.split(" ")[1]));
        if (token.exp < Date.now()) {
          return json({ success: false, message: "Token expired" }, 401);
        }

        const body = await request.json();
        const items = body.items || [];

        if (!items.length) {
          return json({ success: false, message: "Empty order" }, 400);
        }

        let total = 0;
        for (const item of items) {
          total += item.price * item.qty;
        }

        const order = await env.DB.prepare(
          "INSERT INTO orders (user_id, total, status, created_at) VALUES (?, ?, 'PENDING', ?)"
        ).bind(token.user_id, total, Date.now()).run();

        const orderId = order.meta.last_row_id;

        for (const item of items) {
          await env.DB.prepare(
            "INSERT INTO order_items (order_id, item_id, name, price, qty) VALUES (?, ?, ?, ?, ?)"
          ).bind(orderId, item.item_id, item.name, item.price, item.qty).run();
        }

        return json({ success: true, order_id: orderId, total });
      }

      // ✅ MY ORDERS
      if (path === "/orders/my-orders") {

        const auth = request.headers.get("Authorization");
        if (!auth) return json({ success: false, message: "No token" }, 401);

        const token = JSON.parse(atob(auth.split(" ")[1]));
        if (token.exp < Date.now()) {
          return json({ success: false, message: "Token expired" }, 401);
        }

        const orders = await env.DB.prepare(
          "SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC"
        ).bind(token.user_id).all();

        return json({ success: true, orders: orders.results });
      }

      return json({ success: false, message: "Not found" }, 404);

    } catch (err) {
      return json({
        success: false,
        message: err.message
      }, 500);
    }
  }
};
