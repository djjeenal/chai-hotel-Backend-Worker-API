export default {
  async fetch(request, env) {

    const url = new URL(request.url);

    // ===== CORS =====
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
      const keySecret = env.RAZORPAY_SECRET_KEY;

      const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          "Authorization": "Basic " + btoa(keySecret + ":"),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          amount: amount * 100,
          currency: "INR"
        })
      });

      const data = await orderRes.json();

      return new Response(JSON.stringify(data), {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json"
        }
      });
    }

    // ===== RAZORPAY WEBHOOK VERIFY =====
    if (url.pathname === "/razorpay-webhook" && request.method === "POST") {

      const secret = env.RAZORPAY_WEBHOOK_SECRET;
      const body = await request.text();
      const signature = request.headers.get("x-razorpay-signature");

      // --- Web Crypto HMAC ---
      const enc = new TextEncoder();
      const keyData = enc.encode(secret);

      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );

      const signatureData = await crypto.subtle.sign(
        "HMAC",
        cryptoKey,
        enc.encode(body)
      );

      const expectedSignature = Array.from(new Uint8Array(signatureData))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");

      if (expectedSignature !== signature) {
        return new Response("Invalid signature", { status: 400 });
      }

      return new Response("Payment Verified ✅");
    }

    return new Response("Chai Hotel Backend Running 🚀");
  }
}
