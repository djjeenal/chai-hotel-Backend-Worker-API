// ---------- VERIFY OTP (FIXED VERSION) ----------
if (path === "/auth/verify-otp" && request.method === "POST") {
  const { email, password, otp } = await request.json();

  if (!email || !password || !otp)
    return json({ success: false, message: "Missing data" }, 400);

  // 1️⃣ OTP check
  const row = await env.DB.prepare(
    `SELECT otp FROM otps WHERE email = ?`
  ).bind(email).first();

  if (!row || row.otp !== otp) {
    return json({ success: false, message: "Invalid OTP" }, 401);
  }

  // 2️⃣ Check user already exists?
  const existingUser = await env.DB.prepare(
    `SELECT id FROM users WHERE email = ?`
  ).bind(email).first();

  if (existingUser) {
    await env.DB.prepare(
      `UPDATE users SET is_verified = 1 WHERE email = ?`
    ).bind(email).run();

    return json({
      success: true,
      message: "User already exists & verified"
    });
  }

  // 3️⃣ New user create
  const hash = await hashPassword(password);

  await env.DB.prepare(
    `INSERT INTO users (email, password_hash, is_verified)
     VALUES (?, ?, 1)`
  ).bind(email, hash).run();

  return json({
    success: true,
    message: "Account created & verified"
  });
}
