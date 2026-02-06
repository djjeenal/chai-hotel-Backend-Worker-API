export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/password/send-otp") {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Route working ✅"
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200
        }
      );
    }

    return new Response("Not Found", { status: 404 });
  }
};
