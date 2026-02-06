export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const url = new URL(request.url);

    // ✅ SEND OTP API
    if (url.pathname === "/password/send-otp") {
      try {
        const body = await request.json();
        const email = body.email;

        if (!email) {
          return Response.json({ success: false, error: "Email required" }, { status: 400 });
        }

        // 🔢 Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000);

        // 📩 Send OTP via Brevo
        const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
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
            to: [
              { email: email }
            ],
            subject: "Your OTP Code - Chai Hotel",
            htmlContent: `
              <div style="font-family:Arial">
                <h2>Chai Hotel OTP</h2>
                <p>Your OTP is:</p>
                <h1 style="letter-spacing:3px">${otp}</h1>
                <p>This OTP is valid for 10 minutes.</p>
              </div>
            `
          })
        });

        if (!brevoResponse.ok) {
          const err = await brevoResponse.text();
          return Response.json({
            success: false,
            error: "Brevo email failed",
            details: err
          }, { status: 500 });
        }

        // ✅ SUCCESS (OTP generated & email sent)
        return Response.json({
          success: true,
          message: "OTP sent successfully",
          otp_debug: otp // ⚠️ testing ke baad hata dena
        });

      } catch (err) {
        return Response.json({
          success: false,
          error: "Server error",
          details: err.message
        }, { status: 500 });
      }
    }

    return new Response("Not Found", { status: 404 });
  }
};
