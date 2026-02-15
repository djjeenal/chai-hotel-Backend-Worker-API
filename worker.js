export default {
  async fetch(request, env) {

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    if (url.pathname === "/") {
      return Response.json(
        { success: true, message: "Backend working" },
        { headers: corsHeaders }
      );
    }

    if (request.method === "POST" && url.pathname === "/auth/send-otp") {
      const body = await request.json();
      const email = body.email;

      if (!email) {
        return Response.json(
          { success: false, message: "Email required" },
          { headers: corsHeaders }
        );
      }

      const otp = "123456";

      await env.DB.prepare(
        "INSERT OR REPLACE INTO otp (email, code) VALUES (?, ?)"
      ).bind(email, otp).run();

      return Response.json({ success: true }, { headers: corsHeaders });
    }

    if (request.method === "POST" && url.pathname === "/auth/verify-otp") {
      const body = await request.json();
      const { email, password, otp } = body;

      const row = await env.DB.prepare(
        "SELECT code FROM otp WHERE email = ?"
      ).bind(email).first();

      if (!row || row.code !== otp) {
        return Response.json(
          { success: false, message: "Invalid OTP" },
          { headers: corsHeaders }
        );
      }

      await env.DB.prepare(
        "INSERT INTO users (email, password) VALUES (?, ?)"
      ).bind(email, password).run();

      return Response.json(
        { success: true, token: "demo-token" },
        { headers: corsHeaders }
      );
    }

    return Response.json(
      { success: false, message: "Not found" },
      { status: 404, headers: corsHeaders }
    );
  }
};
