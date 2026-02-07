export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // =========================
    // SEND OTP
    // =========================
    if (url.pathname === "/password/send-otp" && request.method === "POST") {
      try {
        const { email } = await request.json();
        if (!email) {
          return json({ success: false, message: "Email required" }, 400);
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 10 * 60 * 1000; // 10 min

        await env.DB.prepare(`
          INSERT OR REPLACE INTO otp_codes (email, otp, expires_at)
          VALUES (?, ?, ?)
        `).bind(email, otp, expiresAt).run();

        // 👉 Production me yahan email bhejna
        return json({
          success: true,
          message: "OTP sent to email"
          // otp intentionally hidden
        });
      } catch (e) {
        return json({ success: false, message: "Server error" }, 500);
      }
    }

    // =========================
    // VERIFY OTP
    // =========================
    if (url.pathname === "/password/verify-otp" && request.method === "POST") {
      try {
        const { email, otp } = await request.json();
        if (!email || !otp) {
          return json({ success: false, message: "Email & OTP required" }, 400);
        }

        const row = await env.DB.prepare(
          "SELECT otp, expires_at FROM otp_codes WHERE email = ?"
        ).bind(email).first();

        if (!row) {
          return json({ success: false, message: "Invalid OTP" }, 400);
        }

        if (Date.now() > row.expires_at) {
          await env.DB.prepare(
            "DELETE FROM otp_codes WHERE email = ?"
          ).bind(email).run();
          return json({ success: false, message: "OTP expired" }, 400);
        }

        if (row.otp !== otp) {
          return json({ success: false, message: "Invalid OTP" }, 400);
        }

        return json({ success: true, message: "OTP verified" });
      } catch {
        return json({ success: false, message: "Server error" }, 500);
      }
    }

    // =========================
    // RESET PASSWORD (FINAL STEP)
    // =========================
    if (url.pathname === "/password/reset" && request.method === "POST") {
      try {
        const { email, new_password } = await request.json();
        if (!email || !new_password) {
          return json({ success: false, message: "Email & password required" }, 400);
        }

        // 🔒 Simple hash (Cloudflare compatible)
        const encoder = new TextEncoder();
        const data = encoder.encode(new_password);
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        const hash = [...new Uint8Array(hashBuffer)]
          .map(b => b.toString(16).padStart(2, "0"))
          .join("");

        await env.DB.prepare(`
          INSERT OR REPLACE INTO users (email, password_hash, updated_at)
          VALUES (?, ?, ?)
        `).bind(email, hash, Date.now()).run();

        // OTP cleanup
        await env.DB.prepare(
          "DELETE FROM otp_codes WHERE email = ?"
        ).bind(email).run();

        return json({
          success: true,
          message: "Password reset successful"
        });
      } catch {
        return json({ success: false, message: "Server error" }, 500);
      }
    }

    return new Response("Not Found", { status: 404 });
  }
};

// ===== Helper =====
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
