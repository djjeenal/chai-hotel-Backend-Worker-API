export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // ===== Helpers =====
    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" },
      });

    const otpStore = globalThis.otpStore || (globalThis.otpStore = {});
    const userStore = globalThis.userStore || (globalThis.userStore = {});

    // ===== JWT helpers =====
    const base64url = (str) =>
      btoa(str).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

    const signJWT = async (payload) => {
      const header = { alg: "HS256", typ: "JWT" };
      const encHeader = base64url(JSON.stringify(header));
      const encPayload = base64url(JSON.stringify(payload));
      const data = `${encHeader}.${encPayload}`;

      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(env.JWT_SECRET),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );

      const signature = await crypto.subtle.sign(
        "HMAC",
        key,
        new TextEncoder().encode(data)
      );

      const sig = base64url(
        String.fromCharCode(...new Uint8Array(signature))
      );

      return `${data}.${sig}`;
    };

    const verifyJWT = async (token) => {
      try {
        const [h, p, s] = token.split(".");
        const data = `${h}.${p}`;

        const key = await crypto.subtle.importKey(
          "raw",
          new TextEncoder().encode(env.JWT_SECRET),
          { name: "HMAC", hash: "SHA-256" },
          false,
          ["verify"]
        );

        const sigBytes = Uint8Array.from(
          atob(s.replace(/-/g, "+").replace(/_/g, "/")),
          (c) => c.charCodeAt(0)
        );

        const valid = await crypto.subtle.verify(
          "HMAC",
          key,
          sigBytes,
          new TextEncoder().encode(data)
        );

        if (!valid) return null;
        return JSON.parse(atob(p));
      } catch {
        return null;
      }
    };

    // ===== ROUTES =====

    // 🔹 SEND OTP
    if (path === "/auth/send-otp" && method === "POST") {
      const { email } = await request.json();
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      otpStore[email] = otp;

      return json({ success: true, otp });
    }

    // 🔹 VERIFY OTP + SAVE PASSWORD
    if (path === "/auth/verify-otp" && method === "POST") {
      const { email, password, otp } = await request.json();

      if (otpStore[email] !== otp) {
        return json({ success: false, message: "Invalid OTP" }, 401);
      }

      userStore[email] = { email, password };
      delete otpStore[email];

      return json({ success: true });
    }

    // 🔹 LOGIN (THIS WAS FAILING EARLIER)
    if (path === "/auth/login" && method === "POST") {
      const { email, password } = await request.json();
      const user = userStore[email];

      if (!user || user.password !== password) {
        return json({ success: false, message: "Invalid login" }, 401);
      }

      const token = await signJWT({
        email,
        iat: Math.floor(Date.now() / 1000),
      });

      return json({ success: true, token });
    }

    // 🔹 AUTH ME
    if (path === "/auth/me" && method === "GET") {
      const auth = request.headers.get("Authorization");
      if (!auth || !auth.startsWith("Bearer ")) {
        return json({ success: false }, 401);
      }

      const token = auth.split(" ")[1];
      const payload = await verifyJWT(token);

      if (!payload) {
        return json({ success: false }, 401);
      }

      return json({
        success: true,
        user: {
          email: payload.email,
        },
      });
    }

    return json({ error: "Not found" }, 404);
  },
};
