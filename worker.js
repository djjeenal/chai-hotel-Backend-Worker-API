export default {
  async fetch(request, env) {

    const url = new URL(request.url);

    // CORS
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // -------- SEND OTP --------
    if (url.pathname === "/auth/send-otp" && request.method === "POST") {
      const { email } = await request.json();

      if (!email) {
        return new Response(
          JSON.stringify({ success: false, message: "Email required" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      console.log("OTP for", email, "is", otp);

      // ⚠️ Abhi email nahi bhej rahe (test step)
      return new Response(
        JSON.stringify({
          success: true,
          message: "OTP generated (check Worker logs)",
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response("Chai Hotel Backend Running ✅");
  },
};
