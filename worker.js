export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ✅ Only POST allowed
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    // =========================
    // ✅ VERIFY OTP ROUTE
    // =========================
    if (url.pathname === "/password/verify-otp") {
      try {
        // ✅ Safe JSON parse
        let body;
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({
            success: false,
            message: "Invalid JSON body"
          }), { status: 400 });
        }

        const { email, otp } = body;

        // ✅ Validation
        if (!email || !otp) {
          return new Response(JSON.stringify({
            success: false,
            message: "Email and OTP required"
          }), { status: 400 });
        }

        // ✅ Fetch OTP from KV
        const stored = await env.OTP_STORE.get(email);
        if (!stored) {
          return new Response(JSON.stringify({
            success: false,
            message: "Invalid or expired OTP"
          }), { status: 400 });
        }

        const data = JSON.parse(stored);

        // ✅ Match OTP
        if (data.otp !== otp) {
          return new Response(JSON.stringify({
            success: false,
            message: "Invalid OTP"
          }), { status: 400 });
        }

        // ✅ Delete OTP after success
        await env.OTP_STORE.delete(email);

        return new Response(JSON.stringify({
          success: true,
          message: "OTP verified"
        }), { status: 200 });

      } catch (err) {
        return new Response(JSON.stringify({
          success: false,
          message: "Server error",
          error: err.message
        }), { status: 500 });
      }
    }

    // ❌ Fallback
    return new Response("Not Found", { status: 404 });
  }
};
