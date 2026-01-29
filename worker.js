export default {
  async fetch(request, env) {

    const url = new URL(request.url);

    // CORS
    if (request.method === "OPTIONS") {
      return new Response("", {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }

    // ===== CREATE RAZORPAY ORDER =====
    if (url.pathname === "/create-order" && request.method === "POST") {

      const { amount } = await request.json();

      const razorpayKey = env.RAZORPAY_SECRET_KEY;

      const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          "Authorization": "Basic " + btoa(razorpayKey + ":"),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          amount: amount * 100,
          currency: "INR"
        })
      });

      const orderData = await orderRes.json();

      return new Response(JSON.stringify(orderData), {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json"
        }
      });
    }

    // ===== PAYMENT WEBHOOK =====
    if (url.pathname === "/razorpay-webhook" && request.method === "POST") {

      const secret = env.RAZORPAY_WEBHOOK_SECRET;
      const body = await request.text();
      const signature = request.headers.get("x-razorpay-signature");

      const crypto = await import("crypto");
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(body)
        .digest("hex");

      if (signature !== expectedSignature) {
        return new Response("Invalid signature", { status: 400 });
      }

      // Payment verified
      return new Response("OK");
    }

    return new Response("Chai Hotel Backend Running 🚀");
  }
}
