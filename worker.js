if (path === "/auth/me" && request.method === "GET") {
  const auth = request.headers.get("Authorization");

  if (!auth || !auth.startsWith("Bearer ")) {
    return json({ success: false, message: "No token" }, 401);
  }

  const token = auth.replace("Bearer ", "").trim();

  try {
    // 🔑 Decode base64 token
    const decoded = atob(token);

    const [payload, secret] = decoded.split(".");

    if (secret !== env.JWT_SECRET) {
      return json({ success: false, message: "Invalid token" }, 401);
    }

    const data = JSON.parse(payload);

    // ⏰ expiry check
    if (Date.now() > data.exp) {
      return json({ success: false, message: "Token expired" }, 401);
    }

    return json({
      success: true,
      user: {
        id: data.user_id,
        email: data.email
      }
    });

  } catch (err) {
    return json({ success: false, message: "Token parse failed" }, 401);
  }
}
