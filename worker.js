export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ---------- SEND OTP ----------
    if (url.pathname === "/password/send-otp" && request.method === "POST") {
      try {
        const { email } = await request.json();
        if (!email) {
          return json({ success: false, message: "Email required" }, 400);
        }

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const now = Math.floor(Date.now() / 1000);
        const expiresAt = now + 600; // 10 minutes

        // Delete old OTP
        await env.DB.prepare(
          "DELETE FROM otp_codes WHERE email = ?"
        ).bind(email).run();

        // Insert new OTP
        await env.DB.prepare(
          "INSERT INTO otp_codes (email, otp, expires_at, created_at) VALUES (?, ?, ?, ?)"
        ).bind(email, otp, expiresAt, now).run();

        // ⚠️ YAHAN EMAIL SERVICE LAGANI HAI (Brevo)
        // Abhi test ke liye OTP return kar rahe hain

        return json({
          success: true,
          message: "OTP generated & saved ✅",
          otp // test ke liye
        });

      } catch (err) {
        return json({ success: false, message: "Server error" }, 500);
      }
    }

    // ---------- VERIFY OTP ----------
    if (url.pathname === "/password/verify-otp" && request.method === "POST") {
      try {
        const { email, otp } = await request.json();
        if (!email || !otp) {
          return json({ success: false, message: "Email & OTP required" }, 400);
        }

        const now = Math.floor(Date.now() / 1000);

        const row = await env.DB.prepare(
          "SELECT * FROM otp_codes WHERE email = ?"
        ).bind(email).first();

        if (!row) {
          return json({ success: false, message: "OTP not found" }, 400);
        }

        if (row.otp !== otp) {
          return json({ success: false, message: "Invalid OTP" }, 400);
        }

        if (row.expires_at < now) {
          return json({ success: false, message: "OTP expired" }, 400);
        }

        // OTP success → delete
        await env.DB.prepare(
          "DELETE FROM otp_codes WHERE email = ?"
        ).bind(email).run();

        return json({
          success: true,
          message: "OTP verified successfully ✅"
        });

      } catch (err) {
        return json({ success: false, message: "Server error" }, 500);
      }
    }

    return new Response("Not Found", { status: 404 });
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
