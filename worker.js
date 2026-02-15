export default {
  async fetch(request, env) {

    const url = new URL(request.url)

    // ✅ CORS FIX
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }

    if (request.method === "OPTIONS") {
      return new Response("OK", { headers: corsHeaders })
    }

    // ✅ Root Test
    if (url.pathname === "/") {
      return Response.json({ success: true, message: "Backend working" }, { headers: corsHeaders })
    }

    // ✅ Send OTP
    if (url.pathname === "/auth/register") {
      return Response.json({ success: true, otp: "123456" }, { headers: corsHeaders })
    }

    // ✅ Verify OTP
    if (url.pathname === "/auth/verify") {
      const body = await request.json()

      if (body.otp === "123456") {
        return Response.json({ success: true }, { headers: corsHeaders })
      }

      return Response.json({ success: false, message: "Invalid OTP" }, { headers: corsHeaders })
    }

    return Response.json({ success:false, message:"Not found" }, { status:404, headers:corsHeaders })
  }
}
