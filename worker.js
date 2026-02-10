// ---------- AUTH ME (FINAL WORKING VERSION) ----------
if (path === "/auth/me" && request.method === "GET") {
  const auth = request.headers.get("Authorization");

  if (!auth || !auth.startsWith("Bearer ")) {
    return json(
      { success: false, message: "Missing Authorization header" },
      401
    );
  }

  try {
    // 1️⃣ Bearer hatao
    const token = auth.replace("Bearer ", "").trim();

    // 2️⃣ Token split karo (payload.secret)
    const parts = token.split(".");
    if (parts.length !== 2) {
      return json(
        { success: false, message: "Invalid token format" },
        401
      );
    }

    const payloadBase64 = parts[0];
    const secret = parts[1];

    // 3️⃣ Secret verify
    if (secret !== env.JWT_SECRET) {
      return json(
        { success: false, message: "Invalid token secret" },
        401
      );
    }

    // 4️⃣ Payload decode
    const payloadJson = atob(payloadBase64);
    const payload = JSON.parse(payloadJson);

    // 5️⃣ Expiry check (IMPORTANT)
    if (Date.now() > payload.exp) {
      return json(
        { success: false, message: "Token expired" },
        401
      );
    }

    // 6️⃣ User fetch from DB
    const user = await env.DB.prepare(
      `SELECT id, email FROM users WHERE id = ?`
    ).bind(payload.user_id).first();

    if (!user) {
      return json(
        { success: false, message: "User not found" },
        401
      );
    }

    // ✅ SUCCESS
    return json({
      success: true,
      user
    });

  } catch (err) {
    return json(
      { success: false, message: "Token decode failed" },
      401
    );
  }
}
