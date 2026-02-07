export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ===== SEND OTP =====
    if (url.pathname === "/password/send-otp" && request.method === "POST") {
      const { email } = await request.json();
      if (!email) {
        return Response.json({ success: false, message: "Email required" }, { status: 400 });
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 10 * 60 * 1000;

      await env.DB.prepare(
        "INSERT INTO otp_codes (email, otp, expires_at) VALUES (?, ?, ?)"
      ).bind(email, otp, expiresAt).run();

      return Response.json({
        success: true,
        message: "OTP generated",
        otp
      });
    }

    // ===== VERIFY OTP =====
    if (url.pathname === "/password/verify-otp" && request.method === "POST") {
      const { email, otp } = await request.json();
      if (!email || !otp) {
        return Response.json({ success: false, message: "Email & OTP required" }, { status: 400 });
      }

      const row = await env.DB.prepare(
        "SELECT * FROM otp_codes WHERE email = ? ORDER BY id DESC LIMIT 1"
      ).bind(email).first();

      if (!row || row.otp !== otp || row.expires_at < Date.now()) {
        return Response.json({ success: false, message: "Invalid or expired OTP" }, { status: 400 });
      }

      return Response.json({ success: true, message: "OTP verified" });
    }

    // ===== PASSWORD RESET =====
    if (url.pathname === "/password/reset" && request.method === "POST") {
      const { email, newPassword } = await request.json();
      if (!email || !newPassword) {
        return Response.json(
          { success: false, message: "Email & newPassword required" },
          { status: 400 }
        );
      }

      await env.DB.prepare(
        "UPDATE users SET password = ? WHERE email = ?"
      ).bind(newPassword, email).run();

      return Response.json({
        success: true,
        message: "Password reset successful"
      });
    }

    return new Response("Not Found", { status: 404 });
  }
};
