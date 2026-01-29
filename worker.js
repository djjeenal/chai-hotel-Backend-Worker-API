export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }

    // =====================
    // CREATE RAZORPAY ORDER
    // =====================
    if (url.pathname === "/create-order" && request.method === "POST") {
      const body = await request.json();
      const amount = Number(body.amount) * 100; // INR → paise

      const razorpayKey = "rzp_live_S6Aqa8MhufQ4e6";

      // 🔴 Razorpay Secret Key stored in Cloudflare Variable
      const razorpaySecret = env.RAZORPAY_SECRET_KEY;

      const auth = btoa(razorpayKey + ":" + razorpaySecret);

      const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          "Authorization": "Basic " + auth,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          amount: amount,
          currency: "INR",
          receipt: "chai_order_" + Date.now()
        })
      });

      const orderData = await orderRes.json();

      return new Response(JSON.stringify({
        order_id: orderData.id,
        amount: orderData.amount,
        key: razorpayKey
      }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    // =====================
    // Default Route
    // =====================
    return new Response("Chai Hotel Backend Running ✅");
  }
}
