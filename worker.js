export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ✅ OTP VERIFY ROUTE
    if (url.pathname === "/password/verify-otp" && request.method === "POST") {
      try {
        const body = await request.json();
        const { email, otp } = body;

        // 1️⃣ Validation
        if (!email || !otp) {
          return new Response(JSON.stringify({
            success: false,
            message: "Email and OTP required"
          }), { status: 400 });
        }

        // 2️⃣ OTP fetch from KV
        const stored = await env.OTP_STORE.get(email);
        if (!stored) {
          return new Response(JSON.stringify({
            success: false,
            message: "Invalid or expired OTP"
          }), { status: 400 });
        }

        const data = JSON.parse(stored);

        // 3️⃣ OTP match check
        if (data.otp !== otp) {
          return new Response(JSON.stringify({
            success: false,
            message: "Invalid OTP"
          }), { status: 400 });
        }

        // 4️⃣ OTP verified → delete OTP
        await env.OTP_STORE.delete(email);

        // 5️⃣ Success
        return new Response(JSON.stringify({
          success: true,
          message: "OTP verified"
        }), { status: 200 });

      } catch (err) {
        return new Response(JSON.stringify({
          success: false,
          message: "Server error"
        }), { status: 500 });
      }
    }

    // ❌ Fallback
    return new Response("Not Found", { status: 404 });
  }
};
