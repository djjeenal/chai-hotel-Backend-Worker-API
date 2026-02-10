if (path === "/auth/login" && request.method === "POST") {
  const body = await request.json();
  const email = body.email;
  const password = body.password;

  const enc = new TextEncoder().encode(password);
  const hashBuf = await crypto.subtle.digest("SHA-256", enc);
  const password_hash = [...new Uint8Array(hashBuf)]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  const user = await env.DB.prepare(
    "SELECT id FROM users WHERE email = ? AND password_hash = ? AND is_verified = 1"
  ).bind(email, password_hash).first();

  if (!user) {
    return new Response(JSON.stringify({ success: false }), { status: 401 });
  }

  const token = btoa(JSON.stringify({
    uid: user.id,
    email: email,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000
  }) + "." + env.JWT_SECRET);

  return new Response(JSON.stringify({ success: true, token }), {
    headers: { "Content-Type": "application/json" }
  });
}
