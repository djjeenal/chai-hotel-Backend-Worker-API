export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }

    // SEND OTP (DEMO)
    if (url.pathname === "/auth/send-otp") {
      const body = await request.json();
      const email = body.email;

      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      console.log(`OTP for ${email} is ${otp}`);

      return new Response(
        JSON.stringify({
          success: true,
          message: "OTP generated (demo mode)",
          email,
          otp
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        }
      );
    }

    // VERIFY OTP + CREATE USER
    if (url.pathname === "/auth/verify-otp") {
      const body = await request.json();
      const { email, password, otp } = body;

      if (!email || !password || !otp) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Email, password and OTP required"
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      await env.DB.prepare(
        "INSERT INTO users (email, password_hash) VALUES (?, ?)"
      ).bind(email, password).run();

      return new Response(
        JSON.stringify({
          success: true,
          message: "Account created successfully"
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        }
      );
    }

    return new Response("Not Found", { status: 404 });
  }
};
