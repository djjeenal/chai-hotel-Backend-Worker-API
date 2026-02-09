export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Allow only POST
    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, message: "POST method only" }),
        { status: 405, headers: { "Content-Type": "application/json" } }
      );
    }

    // ===== SEND OTP =====
    if (url.pathname === "/auth/send-otp") {
      try {
        const body = await request.json();
        const email = body.email;

        if (!email) {
          return new Response(
            JSON.stringify({ success: false, message: "Email required" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // (Future me yahin DB / KV me save karenge)
        // Abhi demo ke liye response me dikha rahe hain

        return new Response(
          JSON.stringify({
            success: true,
            message: "OTP generated (demo mode)",
            email: email,
            otp: otp
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            }
          }
        );
      } catch (err) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Invalid JSON body"
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // ===== DEFAULT =====
    return new Response(
      JSON.stringify({ success: false, message: "Route not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }
};
