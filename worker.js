export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ================= CORS =================
    if (request.method === "OPTIONS") {
      return new Response("", {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }

    // ================= CREATE RAZORPAY ORDER =================
    if (url.pathname === "/create-order" && request.method === "POST") {
      const { amount } = await request.json();

      const auth = btoa(
        env.RAZORPAY_KEY_ID + ":" + env.RAZORPAY_SECRET_KEY
      );

      const rpRes = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          "Authorization": "Basic " + auth,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          amount: amount * 100,
          currency: "INR",
          receipt: "chai_" + Date.now()
        })
      });

      const order = await rpRes.json();

      return new Response(JSON.stringify(order), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    // ================= RAZORPAY WEBHOOK =================
    if (url.pathname === "/razorpay-webhook" && request.method === "POST") {

      const body = await request.text();
      const signature = request.headers.get("x-razorpay-signature");
      const secret = env.RAZORPAY_WEBHOOK_SECRET;

      const enc = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        enc.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );

      const hash = await crypto.subtle.sign(
        "HMAC",
        key,
        enc.encode(body)
      );

      const expectedSignature = Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");

      if (expectedSignature !== signature) {
        return new Response("Invalid signature", { status: 400 });
      }

      const data = JSON.parse(body);

      if (data.event === "payment.captured") {
        const p = data.payload.payment.entity;

        await env.DB.prepare(
          `INSERT INTO payments 
          (payment_id, order_id, amount, status, method)
          VALUES (?, ?, ?, ?, ?)`
        )
        .bind(
          p.id,
          p.order_id,
          p.amount / 100,
          p.status,
          p.method
        )
        .run();
      }

      return new Response("Webhook saved");
    }

    // ================= ADMIN PAYMENTS =================
    if (url.pathname === "/admin/payments") {
      const { results } = await env.DB.prepare(
        "SELECT * FROM payments ORDER BY id DESC"
      ).all();

      return new Response(JSON.stringify(results), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    return new Response("Chai Hotel Backend Running 🚀");
  }
};
