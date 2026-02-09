// ---------- VERIFY OTP (FINAL CLEAR VERSION) ----------
if (path === "/auth/verify-otp" && request.method === "POST") {
  const { email, password, otp } = await request.json();

  if (!email || !password || !otp)
    return json({ success: false, message: "Missing data" }, 400);

  // OTP check
  const row = await env.DB.prepare(
    `SELECT otp FROM otps WHERE email = ?`
  ).bind(email).first();

  if (!row || row.otp !== otp)
    return json({ success: false, message: "Invalid OTP" }, 401);

  // Check user
  const existingUser = await env.DB.prepare(
    `SELECT id FROM users WHERE email = ?`
  ).bind(email).first();

  if (existingUser) {
    await env.DB.prepare(
      `UPDATE users SET is_verified = 1 WHERE email = ?`
    ).bind(email).run();

    return json({
      success: true,
      message: "User verified (already existed)"
    });
  }

  // New user
  const hash = await hashPassword(password);

  await env.DB.prepare(
    `INSERT INTO users (email, password_hash, is_verified)
     VALUES (?, ?, 1)`
  ).bind(email, hash).run();

  return json({
    success: true,
    message: "New account created & verified"
  });
}
