export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const url = new URL(request.url);

    if (url.pathname !== "/password/send-otp") {
      return new Response("Not Found", { status: 404 });
    }

    try {
      console.log("OTP API HIT");

      const body = await request.json();
      const email = body.email;

      if (!email) {
        return new Response(
          JSON.stringify({ success: false, error: "Email required" }),
          { status: 400 }
        );
      }

      if (!env.BREVO_API_KEY) {
        throw new Error("BREVO_API_KEY missing");
      }

      if (!env.OTP_STORE) {
        throw new Error("OTP_STORE KV not connected");
      }

      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      // Save OTP in KV (10 minutes = 600 seconds)
      await env.OTP_STORE.put(
        `otp:${email}`,
        JSON.stringify({
          otp,
          createdAt: Date.now()
        }),
        { expirationTtl: 600 }
      );

      console.log("OTP saved in KV");

      // Send email via Brevo
      const brevoResponse = await fetch(
        "https://api.brevo.com/v3/smtp/email",
        {
          method: "POST",
          headers: {
            "api-key": env.BREVO_API_KEY,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            sender: {
              name: "Chai Hotel",
              email: "no-reply@chaihotel.xyz"
            },
            to: [{ email }],
            subject: "Your OTP Code - Chai Hotel",
            htmlContent: `
              <h2>Your OTP</h2>
              <p><b>${otp}</b></p>
              <p>This OTP is valid for 10 minutes.</p>
            `
          })
        }
      );

      const brevoText = await brevoResponse.text();
      console.log("Brevo response:", brevoText);

      if (!brevoResponse.ok) {
        throw new Error("Brevo email failed");
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "OTP sent successfully"
        }),
        { status: 200 }
      );

    } catch (err) {
      console.log("SERVER ERROR:", err.message);

      return new Response(
        JSON.stringify({
          success: false,
          error: err.message
        }),
        { status: 500 }
      );
    }
  }
};
