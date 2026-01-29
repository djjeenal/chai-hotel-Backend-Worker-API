// =======================
// RAZORPAY CREATE ORDER API
// =======================
if (url.pathname === "/create-order" && request.method === "POST") {
  const body = await request.json();
  const amount = Number(body.amount) * 100; // INR → Paise

  // ✅ Your Razorpay Keys (Already Replaced)
  const razorpayKey = "rzp_live_S6Aqa8MhufQ4e6";

  // ⚠️ Razorpay Secret Key (replace only this value)
  const razorpaySecret = "lxXdhP6FDUxBSiDqJQTmdb9V";

  // Basic Auth
  const auth = btoa(razorpayKey + ":" + razorpaySecret);

  // Create Order in Razorpay
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
