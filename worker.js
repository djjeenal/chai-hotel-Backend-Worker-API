export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Allow only POST
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    // OTP route
    if (url.pathname === "/password/send-otp") {
      try {
        const body = await request.json();
        const email = body.email;

        if (!email) {
          return new Response(
            JSON.stringify({ success: false, message: "Email required" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000);

        // Send email via Brevo
        const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": env.BREVO_API_KEY   // 🔥 MOST IMPORTANT LINE
          },
          body: JSON.stringify({
            sender: {
              name: "Chai Hotel",
              email: "no-reply@chaihotel.xyz"
            },
            to: [{ email }],
            subject: "Your OTP Code",
            htmlContent: `<h2>Your OTP is: ${otp}</h2>`
          })
        });

        const brevoData = await brevoRes.json();

        return new Response(
          JSON.stringify({
            success: true,
            message: "OTP sent",
            brevo: brevoData
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );

      } catch (err) {
        return new Response(
          JSON.stringify({ success: false, error: err.message }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    return new Response("Route not found", { status: 404 });
  }
};
