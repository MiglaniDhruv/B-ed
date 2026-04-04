import dotenv from "dotenv";
dotenv.config();

import express from "express";
import type { Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes.js";
import { seedDatabase } from "./seed.js";
import cors from "cors";
import * as fs from "fs";
import * as path from "path";
import { connectDB } from "./config/db.js";
import admin from "firebase-admin";


const app = express();
const log = console.log;

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  cors({
    origin: [
      "https://kachhli.duckdns.org",
      "http://192.168.29.36:3000",
      "http://localhost:3000",
      "http://localhost:5000",
      "http://localhost:5173",
      "http://localhost:8081",
    ],
    credentials: true,
  }),
);

function setupCors(app: express.Application) {
  app.use((req, res, next) => {
    const origins = new Set<string>();
    if (process.env.REPLIT_DEV_DOMAIN)
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) =>
        origins.add(`https://${d.trim()}`),
      );
    }
    if (process.env.ALLOWED_ORIGINS) {
      process.env.ALLOWED_ORIGINS.split(",").forEach((d) =>
        origins.add(d.trim()),
      );
    }
    const origin = req.header("origin");
    const isLocalhost =
      origin?.startsWith("http://192.168.29.36:5000") ||
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
    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
  });
}

function setupBodyParsing(app: express.Application) {
  app.use((req, res, next) => {
    if (req.headers["content-type"]?.startsWith("multipart/form-data"))
      return next();
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    })(req, res, next);
  });
  app.use((req, res, next) => {
    if (req.headers["content-type"]?.startsWith("multipart/form-data"))
      return next();
    express.urlencoded({ extended: false })(req, res, next);
  });
}

function setupRequestLogging(app: express.Application) {
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, unknown> | undefined;
    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
      if (!path.startsWith("/api")) return;
      const duration = Date.now() - start;
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse)
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      if (logLine.length > 80) logLine = logLine.slice(0, 79) + "…";
      log(logLine);
    });
    next();
  });
}

function serveAdminPanel(app: express.Application) {
  const adminDistPath = path.resolve(process.cwd(), "admin-dist");
  app.get("/admin/forgot-password", (_req, res) => {
    res.send(getForgotPasswordPage());
  });
  app.get("/admin/reset-password", (_req, res) => {
    res.send(getResetPasswordPage());
  });
  if (fs.existsSync(adminDistPath)) {
    app.use("/admin", express.static(adminDistPath));
    app.get("/admin/*", (_req, res) => {
      res.sendFile(path.resolve(adminDistPath, "index.html"));
    });
  }
}

function getForgotPasswordPage(): string {
  return `<!DOCTYPE html><html><head><title>Forgot Password</title></head><body>
  <script>window.location.href="/admin";</script></body></html>`;
}

function getResetPasswordPage(): string {
  return `<!DOCTYPE html><html><head><title>Reset Password</title></head><body>
  <script>window.location.href="/admin";</script></body></html>`;
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

  // ✅ STEP 1: Connect MongoDB
  try {
    await connectDB();
    log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err);
    process.exit(1);
  }


  // ✅ STEP 3: Seed database
  try {
    await seedDatabase();
    log("✅ Database seeded");
  } catch (err) {
    console.error("Seed error:", err);
  }

  const server = await registerRoutes(app);
  serveAdminPanel(app);
  setupErrorHandler(app);

  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(port, "0.0.0.0", () => {
    console.log(`🚀 Backend running on http://localhost:${port}`);
  });
})();
