export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // -------- SEND OTP --------
    if (path === "/auth/send-otp" && request.method === "POST") {
      const { email } = await request.json();
      if (!email) {
        return json({ success: false, message: "Email required" }, 400);
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = Date.now() + 10 * 60 * 1000; // 10 minutes

      globalThis.OTP_STORE = globalThis.OTP_STORE || {};
      globalThis.OTP_STORE[email] = { otp, expires };

      console.log(`OTP for ${email} is ${otp}`);

      return json({
        success: true,
        message: "OTP generated (check Worker logs)",
      });
    }

    // -------- VERIFY OTP + CREATE USER --------
    if (path === "/auth/verify-otp" && request.method === "POST") {
      const { email, password, otp } = await request.json();

      if (!email || !password || !otp) {
        return json({ success: false, message: "All fields required" }, 400);
      }

      const record = globalThis.OTP_STORE?.[email];
      if (!record) {
        return json({ success: false, message: "OTP not found" }, 400);
      }

      if (Date.now() > record.expires) {
        delete globalThis.OTP_STORE[email];
        return json({ success: false, message: "OTP expired" }, 400);
      }

      if (record.otp !== otp) {
        return json({ success: false, message: "Invalid OTP" }, 400);
      }

      // hash password
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const password_hash = hashArray
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");

      try {
        await env.DB.prepare(
          "INSERT INTO users (email, password_hash) VALUES (?, ?)"
        )
          .bind(email, password_hash)
          .run();
      } catch (e) {
        return json({ success: false, message: "User already exists" }, 400);
      }

      delete globalThis.OTP_STORE[email];

      return json({
        success: true,
        message: "Account created successfully",
      });
    }

    return json({ success: false, message: "Not found" }, 404);
  },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
