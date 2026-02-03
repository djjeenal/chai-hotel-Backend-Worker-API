// ================================
// Chai Hotel Backend – FINAL WORKER
// ================================

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      // -------- Health Check --------
      if (url.pathname === "/" || url.pathname === "/health") {
        return json({
          status: "ok",
          message: "Chai Hotel Backend Running 🚀"
        });
      }

      // -------- SEND OTP --------
      if (url.pathname === "/password/send-otp" && request.method === "POST") {
        return await sendOtp(request, env);
      }

      // -------- VERIFY OTP --------
      if (url.pathname === "/password/verify-otp" && request.method === "POST") {
        return await verifyOtp(request, env);
      }

      // -------- REGISTER --------
      if (url.pathname === "/auth/register" && request.method === "POST") {
        return await registerUser(request, env);
      }

      // -------- LOGIN --------
      if (url.pathname === "/auth/login" && request.method === "POST") {
        return await loginUser(request, env);
      }

      return json({ error: "Route not found" }, 404);
    } catch (err) {
      return json({ error: err.message }, 500);
    }
  }
};

// ================================
// HELPERS
// ================================

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*"
    }
  });
}

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ================================
// SEND OTP
// ================================

async function sendOtp(request, env) {
  const body = await request.json();
  const email = body.email?.toLowerCase();

  if (!email) {
    return json({ error: "Email is required" }, 400);
  }

  const otp = generateOtp();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 min

  // Save OTP
  await env.DB.prepare(
    `INSERT INTO otps (email, otp, expires_at)
     VALUES (?, ?, ?)`
  ).bind(email, otp, expiresAt).run();

  // Send email via Brevo
  const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": env.BREVO_API_KEY
    },
    body: JSON.stringify({
      sender: {
        name: "Chai Hotel",
        email: "djjeenal@gmail.com"
      },
      to: [{ email }],
      subject: "Your OTP Code",
      htmlContent: `
        <h2>Chai Hotel OTP</h2>
        <p>Your OTP is:</p>
        <h1>${otp}</h1>
        <p>This OTP is valid for 5 minutes.</p>
      `
    })
  });

  if (!brevoRes.ok) {
    return json({ error: "Failed to send OTP email" }, 500);
  }

  return json({
    success: true,
    message: "OTP sent successfully"
  });
}

// ================================
// VERIFY OTP
// ================================

async function verifyOtp(request, env) {
  const { email, otp } = await request.json();

  if (!email || !otp) {
    return json({ error: "Email and OTP required" }, 400);
  }

  const row = await env.DB.prepare(
    `SELECT * FROM otps
     WHERE email = ? AND otp = ?
     ORDER BY id DESC LIMIT 1`
  ).bind(email.toLowerCase(), otp).first();

  if (!row) {
    return json({ error: "Invalid OTP" }, 400);
  }

  if (Date.now() > row.expires_at) {
    return json({ error: "OTP expired" }, 400);
  }

  return json({
    success: true,
    message: "OTP verified"
  });
}

// ================================
// REGISTER USER
// ================================

async function registerUser(request, env) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return json({ error: "Email & password required" }, 400);
  }

  await env.DB.prepare(
    `INSERT INTO users (email, password)
     VALUES (?, ?)`
  ).bind(email.toLowerCase(), password).run();

  return json({
    success: true,
    message: "User registered successfully"
  });
}

// ================================
// LOGIN USER
// ================================

async function loginUser(request, env) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return json({ error: "Email & password required" }, 400);
  }

  const user = await env.DB.prepare(
    `SELECT * FROM users
     WHERE email = ? AND password = ?`
  ).bind(email.toLowerCase(), password).first();

  if (!user) {
    return json({ error: "Invalid credentials" }, 401);
  }

  return json({
    success: true,
    message: "Login successful"
  });
}
