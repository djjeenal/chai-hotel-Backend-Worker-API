export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // =====================
    // LOGIN API
    // =====================
    if (url.pathname === "/auth/login" && request.method === "POST") {
      try {
        const { email, password } = await request.json();

        if (!email || !password) {
          return new Response(JSON.stringify({
            success: false,
            message: "Email and password required"
          }), { headers: corsHeaders });
        }

        const user = await env.DB
          .prepare("SELECT id, email, password FROM users WHERE email = ?")
          .bind(email)
          .first();

        if (!user || user.password !== password) {
          return new Response(JSON.stringify({
            success: false,
            message: "Invalid email or password"
          }), { headers: corsHeaders });
        }

        return new Response(JSON.stringify({
          success: true,
          message: "Login successful",
          user: {
            id: user.id,
            email: user.email
          }
        }), { headers: corsHeaders });

      } catch (err) {
        return new Response(JSON.stringify({
          success: false,
          message: "Server error"
        }), { headers: corsHeaders });
      }
    }

    // =====================
    // DEFAULT
    // =====================
    return new Response(JSON.stringify({
      success: false,
      message: "API not found"
    }), { headers: corsHeaders });
  }
};
