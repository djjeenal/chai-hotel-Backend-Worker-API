export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response("OK", { headers: corsHeaders });
    }

    // Home test
    if (url.pathname === "/") {
      return new Response("Backend Live 🚀", { headers: corsHeaders });
    }

    // Register
    if (url.pathname === "/register" && request.method === "POST") {
      const { name, email, password } = await request.json();

      try {
        await env.DB.prepare(
          "INSERT INTO users (name,email,password) VALUES (?,?,?)"
        ).bind(name, email, password).run();

        return new Response(
          JSON.stringify({ success: true, message: "Registered" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch {
        return new Response(
          JSON.stringify({ success: false, message: "User exists" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Login
    if (url.pathname === "/login" && request.method === "POST") {
      const { email, password } = await request.json();

      const user = await env.DB.prepare(
        "SELECT * FROM users WHERE email=? AND password=?"
      ).bind(email, password).first();

      if (!user) {
        return new Response(
          JSON.stringify({ success: false, message: "Invalid login" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, user }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  }
};
