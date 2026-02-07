export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // -----------------------------
    // 1️⃣ SEND OTP
    // -----------------------------
    if (url.pathname === "/password/send-otp" && request.method === "POST") {
      try {
        const { email } = await request.json();
        if (!email) {
          return json({ success: false, message: "Email required" }, 400);
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // save OTP in D1
        await env.DB.prepare(
          `INSERT INTO otp_codes (email, otp, created_at)
           VALUES (?, ?, datetime('now'))
           ON CONFLICT(email)
           DO UPDATE SET otp = ?, created_at = datetime('now')`
        ).bind(email, otp, otp).run();

        return json({
          success: true,
          message: "OTP generated & saved",
          otp // ⚠️ prod me ye mat bhejna
        });
      } catch (e) {
        return json({ success: false, message: "Server error" }, 500);
      }
    }

    // -----------------------------
    // 2️⃣ VERIFY OTP
    // -----------------------------
    if (url.pathname === "/password/verify-otp" && request.method === "POST") {
      try {
        const { email, otp } = await request.json();
        if (!email || !otp) {
          return json({ success: false, message: "Email & OTP required" }, 400);
        }

        const row = await env.DB.prepare(
          `SELECT otp FROM otp_codes WHERE email = ?`
        ).bind(email).first();

        if (!row || row.otp !== otp) {
          return json({ success: false, message: "Invalid OTP" }, 400);
        }

        return json({ success: true, message: "OTP verified" });
      } catch (e) {
        return json({ success: false, message: "Server error" }, 500);
      }
    }

    // -----------------------------
    // 3️⃣ PASSWORD RESET ✅
    // -----------------------------
    if (url.pathname === "/password/reset" && request.method === "POST") {
      try {
        const { email, newPassword } = await request.json();
        if (!email || !newPassword) {
          return json(
            { success: false, message: "Email & newPassword required" },
            400
          );
        }

        // check user exists
        const user = await env.DB.prepare(
          `SELECT id FROM users WHERE email = ?`
        ).bind(email).first();

        if (!user) {
          return json({ success: false, message: "User not found" }, 404);
        }

        // update password
        await env.DB.prepare(
          `UPDATE users SET password = ? WHERE email = ?`
        ).bind(newPassword, email).run();

        // delete OTP after reset
        await env.DB.prepare(
          `DELETE FROM otp_codes WHERE email = ?`
        ).bind(email).run();

        return json({
          success: true,
          message: "Password reset successful ✅"
        });
      } catch (e) {
        return json({ success: false, message: "Server error" }, 500);
      }
    }

    return new Response("Not Found", { status: 404 });
  }
};

// helper
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
