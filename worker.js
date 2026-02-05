export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const url = new URL(request.url);

    if (url.pathname === "/password/send-otp") {
      try {
        const { email } = await request.json();

        if (!email) {
          return new Response(
            JSON.stringify({ success: false, error: "Email required" }),
            { status: 400 }
          );
        }

        const otp = Math.floor(100000 + Math.random() * 900000);

        const brevoRes = await fetch(
          "https://api.brevo.com/v3/smtp/email",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "api-key": env.BREVO_API_KEY
            },
            body: JSON.stringify({
              sender: {
                name: "Chai Hotel",
                email: "no-reply@chaihotel.xyz"
              },
              to: [{ email }],
              subject: "Your OTP for Chai Hotel",
              htmlContent: `
                <h2>Chai Hotel OTP</h2>
                <p>Your OTP is:</p>
                <h1>${otp}</h1>
                <p>Valid for 10 minutes</p>
              `
            })
          }
        );

        const data = await brevoRes.json();

        return new Response(
          JSON.stringify({
            success: true,
            message: "OTP sent",
            brevo: data
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      } catch (e) {
        return new Response(
          JSON.stringify({ success: false, error: e.message }),
          { status: 500 }
        );
      }
    }

    return new Response("Not Found", { status: 404 });
  }
};
