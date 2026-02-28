import dotenv from "dotenv";
dotenv.config();
import express from "express";
import type { Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes.js";
import { seedDatabase } from "./seed.js";
import { initFirebase } from "./firebase.js";
import * as fs from "fs";
import * as path from "path";
import cors from "cors";
const app = express();
//  cors = cors();
app.use(cors({
      origin: "https://kachhli.duckdns.org",
      credentials: true,
    }));

// function setupCors(app: express.Application) {
//   app.use(
//     cors({
//       origin: "http://localhost:3000",
//       credentials: true,
//     })
//   );
// }
const log = console.log;

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

function setupCors(app: express.Application) {
  app.use((req, res, next) => {
    const origins = new Set<string>();

    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }

    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }

    if (process.env.ALLOWED_ORIGINS) {
      process.env.ALLOWED_ORIGINS.split(",").forEach((d) => {
        origins.add(d.trim());
      });
    }

    const origin = req.header("origin");
    const isLocalhost =
      origin?.startsWith("https://kachhli.duckdns.org") ||
      origin?.startsWith("http://127.0.0.1:");

    if (origin && (origins.has(origin) || isLocalhost)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS",
      );
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.header("Access-Control-Allow-Credentials", "true");
    }

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }

    next();
  });
}

function setupBodyParsing(app: express.Application) {
  app.use((req, res, next) => {
    // Skip body parsing for multipart so multer can handle it directly
    if (req.headers["content-type"]?.startsWith("multipart/form-data")) {
      return next();
    }
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    })(req, res, next);
  });

  app.use((req, res, next) => {
    if (req.headers["content-type"]?.startsWith("multipart/form-data")) {
      return next();
    }
    express.urlencoded({ extended: false })(req, res, next);
  });
}

function setupRequestLogging(app: express.Application) {
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, unknown> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      if (!path.startsWith("/api")) return;
      const duration = Date.now() - start;
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }
      log(logLine);
    });

    next();
  });
}

function getAppName(): string {
  return "B.Ed Portal";
}

function serveExpoManifest(platform: string, res: Response) {
  const manifestPath = path.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json",
  );

  if (!fs.existsSync(manifestPath)) {
    return res
      .status(404)
      .json({ error: `Manifest not found for platform: ${platform}` });
  }

  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");

  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
}

function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName,
}: {
  req: Request;
  res: Response;
  landingPageTemplate: string;
  appName: string;
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;

  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);

  const html = landingPageTemplate
    .replace(/BASE_URL_PLACEHOLDER/g, baseUrl)
    .replace(/EXPS_URL_PLACEHOLDER/g, expsUrl)
    .replace(/APP_NAME_PLACEHOLDER/g, appName);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}

function configureExpoAndLanding(app: express.Application) {
  const templatePath = path.join(
    process.cwd(),
    "templates",
    "landing-page.html",
  );
  const landingPageTemplate = fs.readFileSync(templatePath, "utf-8");
  const appName = getAppName();

  log("Serving static Expo files with dynamic manifest routing");

  app.use((req: Request, res: Response, next: NextFunction) => {
    // CRITICAL: Never intercept /api routes — let them fall through to Express handlers
    if (req.path.startsWith("/api")) return next();
    if (req.path.startsWith("/admin")) return next();
    if (req.path !== "/" && req.path !== "/manifest") return next();

    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      return serveExpoManifest(platform, res);
    }

    if (req.path === "/") {
      return serveLandingPage({ req, res, landingPageTemplate, appName });
    }

    next();
  });

  app.use("/assets", express.static(path.resolve(process.cwd(), "assets")));

  // IMPORTANT: Do NOT use a catch-all static serve here — it will intercept
  // API routes that haven't been registered yet. Static files are served last.
  app.use(express.static(path.resolve(process.cwd(), "static-build")));

  log("Expo routing: Checking expo-platform header on / and /manifest");
}

function serveAdminPanel(app: express.Application) {
  const adminDistPath = path.resolve(process.cwd(), "admin-dist");

  // 1️⃣ First: Forgot & Reset routes
  app.get("/admin/forgot-password", (_req, res) => {
    res.send(getForgotPasswordPage());
  });

  app.get("/admin/reset-password", (_req, res) => {
    res.send(getResetPasswordPage());
  });

  // 2️⃣ Then: Static files
  if (fs.existsSync(adminDistPath)) {
    app.use("/admin", express.static(adminDistPath));

    // 3️⃣ SPA fallback LAST
    app.get("/admin/*", (_req, res) => {
      res.sendFile(path.resolve(adminDistPath, "index.html"));
    });
  }
}

function getForgotPasswordPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Forgot Password - B.Ed Admin</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', system-ui, -apple-system, sans-serif; background: #f1f5f9; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 16px; }
    .container { width: 100%; max-width: 420px; }
    .logo-box { width: 64px; height: 64px; background: linear-gradient(135deg, #3B82F6, #9333EA); border-radius: 14px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; }
    .logo-box svg { width: 32px; height: 32px; fill: white; }
    h1 { text-align: center; color: #0f172a; font-size: 22px; font-weight: 700; margin-bottom: 6px; }
    .subtitle { text-align: center; color: #64748b; font-size: 14px; margin-bottom: 28px; line-height: 1.5; }
    .card { background: #fff; border-radius: 16px; padding: 28px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
    label { display: block; font-size: 14px; font-weight: 500; color: #334155; margin-bottom: 6px; }
    .input-wrap { position: relative; margin-bottom: 20px; }
    .input-wrap svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); width: 18px; height: 18px; fill: #94a3b8; }
    input { width: 100%; height: 46px; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0 12px 0 40px; font-size: 15px; color: #0f172a; outline: none; transition: border-color .2s; }
    input:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
    .btn { width: 100%; height: 46px; border: none; border-radius: 10px; background: linear-gradient(135deg, #3B82F6, #9333EA); color: #fff; font-size: 15px; font-weight: 600; cursor: pointer; transition: opacity .2s; }
    .btn:hover { opacity: 0.92; }
    .btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .msg { padding: 12px; border-radius: 8px; font-size: 14px; margin-bottom: 16px; display: none; }
    .msg.error { background: #fef2f2; color: #dc2626; display: block; }
    .msg.success { background: #f0fdf4; color: #16a34a; display: block; }
    .back-link { display: block; text-align: center; margin-top: 20px; color: #3b82f6; font-size: 14px; text-decoration: none; font-weight: 500; }
    .back-link:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo-box">
      <svg viewBox="0 0 24 24"><path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"/></svg>
    </div>
    <h1>Forgot Password</h1>
    <p class="subtitle">Enter the email address associated with your admin account and we'll send you a reset link.</p>
    <div class="card">
      <div id="msg" class="msg"></div>
      <form id="form">
        <label for="email">Email Address</label>
        <div class="input-wrap">
          <svg viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
          <input type="email" id="email" placeholder="admin@example.com" required>
        </div>
        <button type="submit" class="btn" id="submitBtn">Send Reset Link</button>
      </form>
      <a href="/admin" class="back-link">Back to Login</a>
    </div>
  </div>
  <script>
    const form = document.getElementById('form');
    const msg = document.getElementById('msg');
    const submitBtn = document.getElementById('submitBtn');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      msg.className = 'msg';
      msg.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';
      try {
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: document.getElementById('email').value }),
        });
        const data = await res.json();
        if (!res.ok) {
          msg.className = 'msg error';
          msg.textContent = data.message;
        } else {
          msg.className = 'msg success';
          msg.textContent = 'If that email exists in our system, a password reset link has been sent. Please check your inbox.';
          form.reset();
        }
      } catch {
        msg.className = 'msg error';
        msg.textContent = 'Something went wrong. Please try again.';
      }
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send Reset Link';
    });
  </script>
</body>
</html>`;
}

function getResetPasswordPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Password - B.Ed Admin</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', system-ui, -apple-system, sans-serif; background: #f1f5f9; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 16px; }
    .container { width: 100%; max-width: 420px; }
    .logo-box { width: 64px; height: 64px; background: linear-gradient(135deg, #3B82F6, #9333EA); border-radius: 14px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; }
    .logo-box svg { width: 32px; height: 32px; fill: white; }
    h1 { text-align: center; color: #0f172a; font-size: 22px; font-weight: 700; margin-bottom: 6px; }
    .subtitle { text-align: center; color: #64748b; font-size: 14px; margin-bottom: 28px; line-height: 1.5; }
    .card { background: #fff; border-radius: 16px; padding: 28px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
    label { display: block; font-size: 14px; font-weight: 500; color: #334155; margin-bottom: 6px; margin-top: 14px; }
    label:first-of-type { margin-top: 0; }
    .input-wrap { position: relative; margin-bottom: 4px; }
    .input-wrap svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); width: 18px; height: 18px; fill: #94a3b8; }
    input { width: 100%; height: 46px; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0 12px 0 40px; font-size: 15px; color: #0f172a; outline: none; transition: border-color .2s; }
    input:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
    .btn { width: 100%; height: 46px; border: none; border-radius: 10px; background: linear-gradient(135deg, #3B82F6, #9333EA); color: #fff; font-size: 15px; font-weight: 600; cursor: pointer; margin-top: 20px; transition: opacity .2s; }
    .btn:hover { opacity: 0.92; }
    .btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .msg { padding: 12px; border-radius: 8px; font-size: 14px; margin-bottom: 16px; display: none; }
    .msg.error { background: #fef2f2; color: #dc2626; display: block; }
    .msg.success { background: #f0fdf4; color: #16a34a; display: block; }
    .back-link { display: block; text-align: center; margin-top: 20px; color: #3b82f6; font-size: 14px; text-decoration: none; font-weight: 500; }
    .back-link:hover { text-decoration: underline; }
    .hint { font-size: 12px; color: #94a3b8; margin-top: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo-box">
      <svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM12 17c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z"/></svg>
    </div>
    <h1>Reset Password</h1>
    <p class="subtitle">Enter your new password below.</p>
    <div class="card">
      <div id="msg" class="msg"></div>
      <form id="form">
        <label for="password">New Password</label>
        <div class="input-wrap">
          <svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM12 17c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z"/></svg>
          <input type="password" id="password" placeholder="New password" required minlength="6">
        </div>
        <p class="hint">Must be at least 6 characters</p>
        <label for="confirmPassword">Confirm Password</label>
        <div class="input-wrap">
          <svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM12 17c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z"/></svg>
          <input type="password" id="confirmPassword" placeholder="Confirm new password" required minlength="6">
        </div>
        <button type="submit" class="btn" id="submitBtn">Reset Password</button>
      </form>
      <a href="/admin" class="back-link">Back to Login</a>
    </div>
  </div>
  <script>
    const form = document.getElementById('form');
    const msg = document.getElementById('msg');
    const submitBtn = document.getElementById('submitBtn');
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (!token) {
      msg.className = 'msg error';
      msg.textContent = 'Invalid reset link. Please request a new password reset.';
      submitBtn.disabled = true;
    }
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pw = document.getElementById('password').value;
      const cpw = document.getElementById('confirmPassword').value;
      if (pw !== cpw) {
        msg.className = 'msg error';
        msg.textContent = 'Passwords do not match.';
        return;
      }
      msg.className = 'msg';
      msg.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Resetting...';
      try {
        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, newPassword: pw }),
        });
        const data = await res.json();
        if (!res.ok) {
          msg.className = 'msg error';
          msg.textContent = data.message;
        } else {
          msg.className = 'msg success';
          msg.textContent = 'Password reset successfully! Redirecting to login...';
          form.style.display = 'none';
          setTimeout(() => { window.location.href = '/admin'; }, 2000);
        }
      } catch {
        msg.className = 'msg error';
        msg.textContent = 'Something went wrong. Please try again.';
      }
      submitBtn.disabled = false;
      submitBtn.textContent = 'Reset Password';
    });
  </script>
</body>
</html>`;
}

function setupErrorHandler(app: express.Application) {
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    const error = err as {
      status?: number;
      statusCode?: number;
      message?: string;
    };
    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) return next(err);
    return res.status(status).json({ message });
  });
}
(async () => {
  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);

  try {
    initFirebase();
    log("Firebase initialized");
    await seedDatabase();
    log("Database seeded");
  } catch (err) {
    console.error("Seed/Firebase error:", err);
  }

  // ORDER MATTERS
  const server = await registerRoutes(app);
  serveAdminPanel(app);
  configureExpoAndLanding(app);
  setupErrorHandler(app);

  // 🔥 CLEAN PORT CONFIG (NO REPLIT)
  const port = parseInt(process.env.PORT || "5000", 10);

  server.listen(port, () => {
    console.log(`Backend running on http://localhost:${port}`);
  });
})();
