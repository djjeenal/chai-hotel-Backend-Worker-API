export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      if (url.pathname === "/password/send-otp" && request.method === "POST") {
        const body = await request.json();
        const email = body.email;

        if (!email) {
          return new Response(
            JSON.stringify({ success: false, message: "Email required" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        // OTP generate (6 digit)
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Save OTP in KV (10 min expiry)
        await env.OTP_STORE.put(
          `otp:${email}`,
          otp,
          { expirationTtl: 600 } // 10 minutes
        );

        return new Response(
          JSON.stringify({
            success: true,
            message: "OTP generated & saved ✅",
            otp: otp   // ⚠️ test ke liye visible
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response("Not Found", { status: 404 });

    } catch (err) {
      return new Response(
        JSON.stringify({ success: false, error: err.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }
};
