export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Test Route
    if (url.pathname === "/test") {
      return Response.json({ success: true, message: "Backend working" });
    }

    // Register
    if (url.pathname === "/auth/register" && request.method === "POST") {
      const body = await request.json();
      const { email, password } = body;

      if (!email || !password) {
        return Response.json({ success: false, message: "Missing fields" });
      }

      await env.DB.prepare(
        "INSERT INTO users (email, password_hash) VALUES (?, ?)"
      )
        .bind(email, password)
        .run();

      return Response.json({ success: true });
    }

    return Response.json({ success: false, message: "Not found" }, { status: 404 });
  },
};
