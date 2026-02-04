export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;

    // 🔍 DEBUG (Observability ke liye)
    console.log("PATH:", url.pathname, "METHOD:", method);

    // ===============================
    // SEND OTP ROUTE
    // ===============================
    if (
      url.pathname.startsWith("/password/send-otp") &&
      method === "POST"
    ) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "OTP route hit successfully"
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // ===============================
    // DEFAULT FALLBACK
    // ===============================
    return new Response(
      JSON.stringify({
        error: "Route not found",
        path: url.pathname,
        method: method
      }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};
