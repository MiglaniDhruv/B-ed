import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import multer from "multer";
import { storage } from "./storage.js";
import { getFirestore, getStorage } from "./firebase.js";
import { sendPasswordResetEmail } from "./email.js";
import { broadcastPush, saveFcmToken, removeFcmToken } from "./lib/fcm.js";
import {
  loginSchema,
  registerSchema,
  insertSubjectSchema,
  insertUnitSchema,
  insertStudyMaterialSchema,
  insertQuizSchema,
  insertQuestionSchema,
  insertNoticeSchema,
} from "../shared/schema.js";
import { z } from "zod";
import dotenv from "dotenv";
dotenv.config();
const JWT_SECRET =
  process.env.JWT_SECRET ||
  process.env.SESSION_SECRET ||
  crypto.randomBytes(32).toString("hex");
const sessionCache = new Map<string, string>();
// ─── Multer (memory storage for Firebase upload) ───────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only PDF files are allowed"));
  },
});

declare module "express-session" {
  interface SessionData {
    userId?: string;
    sessionToken?: string;
  }
}

// ─── requireAuth ──────────────────────────────────────────────────────────────
async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  try {
    const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET) as {
      userId?: string;
      studentId?: string;
      sessionToken?: string;
    };

    const userId = decoded.userId || decoded.studentId;
    const tokenSession = decoded.sessionToken;

    if (!userId || !tokenSession) {
      return res.status(401).json({ message: "Invalid token" });
    }

    // 🔥 1️⃣ Check cache first
    const cachedToken = sessionCache.get(userId);

    if (cachedToken) {
      if (cachedToken !== tokenSession) {
        return res.status(401).json({
          message: "Session expired. Logged in from another device.",
          code: "SESSION_INVALIDATED",
        });
      }

      req.session.userId = userId;
      return next();
    }

    // 🔥 2️⃣ If not in cache → check DB once
    const user =
      (await storage.getUser(userId)) || (await storage.getStudentById(userId));

    if (!user || (user as any).sessionToken !== tokenSession) {
      return res.status(401).json({
        message: "Session expired. Logged in from another device.",
        code: "SESSION_INVALIDATED",
      });
    }

    // Save to cache
    sessionCache.set(userId, tokenSession);

    req.session.userId = userId;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}
// ─── requireAdminAuth ─────────────────────────────────────────────────────────
function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET) as {
        userId?: string;
        studentId?: string;
        sessionToken?: string;
      };
      if (decoded.studentId && !decoded.userId)
        return res
          .status(403)
          .json({ message: "Students cannot access admin routes" });
      if (!decoded.userId)
        return res.status(401).json({ message: "Invalid token" });
      req.session.userId = decoded.userId;
      req.session.sessionToken = decoded.sessionToken;
      return next();
    } catch {
      return res.status(401).json({ message: "Invalid token" });
    }
  }
  if (!req.session.userId)
    return res.status(401).json({ message: "Not authenticated" });
  next();
}

// ─── requireValidSession ──────────────────────────────────────────────────────
// async function requireValidSession(
//   req: Request,
//   res: Response,
//   next: NextFunction,
// ) {
//   if (req.headers.authorization?.startsWith("Bearer ")) return next();

//   const userId = req.session.userId;
//   const sessionToken = req.session.sessionToken;
//   if (!userId || !sessionToken)
//     return res.status(401).json({ message: "Not authenticated" });

//   try {
//     let storedToken: string | null | undefined = null;
//     const user = await storage.getUser(userId);
//     if (user) {
//       storedToken = (user as any).sessionToken;
//     } else {
//       const student = await storage.getStudentById(userId);
//       if (student) storedToken = (student as any).sessionToken;
//     }
//     if (!storedToken || storedToken !== sessionToken) {
//       return res.status(401).json({
//         message:
//           "Session expired. Your account was logged in from another device.",
//         code: "SESSION_INVALIDATED",
//       });
//     }
//     next();
//   } catch {
//     return res.status(500).json({ message: "Session validation failed" });
//   }
// }

export async function registerRoutes(app: Express): Promise<Server> {
  app.set("trust proxy", 1);

  // ─── Session middleware ────────────────────────────────────────────────────
  // NOTE: PDF upload route is registered AFTER session so requireAdminAuth
  // can access req.session if needed, but JWT path works without session too.
  app.use(
    session({
      secret:
        process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex"),
      resave: false,
      saveUninitialized: false,
      proxy: true,
      cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      },
    }),
  );

  // ========== PDF UPLOAD TO FIREBASE STORAGE ==========
  // IMPORTANT: This must be registered AFTER session but uses multer directly
  // (bypasses express.json body parser via the multipart content-type check in index.ts)
  app.post(
    "/api/admin/upload-pdf",
    requireAdminAuth,
    upload.single("file"),
    async (req: Request, res: Response) => {
      try {
        const file = req.file;
        if (!file) return res.status(400).json({ message: "No file provided" });

        const bucket = getStorage();
        const originalName = (req.body.fileName || file.originalname).replace(
          /[^a-zA-Z0-9._-]/g,
          "_",
        );
        const fileName = `study-materials/${Date.now()}_${originalName}`;
        const fileRef = bucket.file(fileName);

        await fileRef.save(file.buffer, {
          metadata: {
            contentType: "application/pdf",
            contentDisposition: "inline",
          },
        });

        // Make publicly accessible so anyone with the URL can view it
        await fileRef.makePublic();

        const url = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
        res.json({ url });
      } catch (err: any) {
        console.error("PDF upload error:", err);
        res.status(500).json({ message: err.message || "Upload failed" });
      }
    },
  );

  // ========== USER MANAGEMENT ==========
  app.post(
    "/api/admin/users",
    requireAdminAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        const data = registerSchema.parse(req.body);
        const existingEmail = await storage.getUserByEmail(data.email);
        if (existingEmail)
          return res.status(400).json({ message: "Email already registered" });
        const existingUsername = await storage.getUserByUsername(data.username);
        if (existingUsername)
          return res.status(400).json({ message: "Username already taken" });
        const hashedPassword = await bcrypt.hash(data.password, 12);
        const user = await storage.createUser({
          ...data,
          password: hashedPassword,
          phone: (data as any).phone || null,
          displayName: data.displayName || data.username,
        });
        const { password: _, ...safeUser } = user;
        res.json({ user: safeUser });
      } catch (err) {
        if (err instanceof z.ZodError)
          return res.status(400).json({ message: err.errors[0].message });
        res.status(500).json({ message: "Failed to create user" });
      }
    },
  );

  app.put(
    "/api/admin/users/:id/reset-password",
    requireAdminAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        const { newPassword } = req.body;
        if (!newPassword || newPassword.length < 6)
          return res
            .status(400)
            .json({ message: "Password must be at least 6 characters" });
        const hashedPassword = await bcrypt.hash(newPassword, 12);
        const user = await storage.updateUser(req.params.id, {
          password: hashedPassword,
        } as any);
        if (!user) return res.status(404).json({ message: "User not found" });
        res.json({ success: true });
      } catch {
        res.status(500).json({ message: "Password reset failed" });
      }
    },
  );

  app.delete(
    "/api/admin/users/:id",
    requireAdminAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        await storage.deleteUser(req.params.id);
        res.json({ success: true });
      } catch {
        res.status(500).json({ message: "Failed to delete user" });
      }
    },
  );

  // ========== AUTHENTICATION ==========
  app.post("/api/auth/login", async (req, res) => {
    try {
      const data = loginSchema.parse(req.body);
      const user = await storage.getUserByEmail(data.email);
      if (!user)
        return res.status(401).json({ message: "Invalid email or password" });
      const valid = await bcrypt.compare(data.password, user.password);
      if (!valid)
        return res.status(401).json({ message: "Invalid email or password" });
      const sessionToken = crypto.randomBytes(32).toString("hex");
      await storage.updateUserSessionToken(user.id, sessionToken);
      sessionCache.set(user.id, sessionToken);
      req.session.userId = user.id;
      req.session.sessionToken = sessionToken;
      const token = jwt.sign({ userId: user.id, sessionToken }, JWT_SECRET, {
        expiresIn: "30d",
      });
      const { password: _, ...safeUser } = user;
      res.json({ user: safeUser, token });
    } catch (err) {
      if (err instanceof z.ZodError)
        return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ message: "Email is required" });
      const user = await storage.getUserByEmail(email);
      if (!user)
        return res.json({
          message: "If that email exists, a reset link has been sent.",
          resetLink: null, // 👈 add karo
        });
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await storage.createPasswordResetToken(user.id, token, expiresAt);
      const protocol =
        req.header("x-forwarded-proto") || req.protocol || "https";
      const host = req.header("x-forwarded-host") || req.get("host");
      const resetLink = `${protocol}://${host}/admin/reset-password?token=${token}`;
      const sent = await sendPasswordResetEmail(email, resetLink);
      if (!sent)
        return res.status(500).json({ message: "Failed to send reset email." });
      res.json({
        message: "If that email exists, a reset link has been sent.",
        resetLink: resetLink, // ✅
      });
    } catch {
      res.status(500).json({ message: "Something went wrong" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword)
        return res
          .status(400)
          .json({ message: "Token and new password are required" });
      if (newPassword.length < 6)
        return res
          .status(400)
          .json({ message: "Password must be at least 6 characters" });
      const resetToken = await storage.getPasswordResetToken(token);
      if (!resetToken)
        return res
          .status(400)
          .json({ message: "Invalid or expired reset link" });
      if (resetToken.used)
        return res
          .status(400)
          .json({ message: "This reset link has already been used" });
      if (new Date() > resetToken.expiresAt)
        return res.status(400).json({ message: "This reset link has expired" });
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      await storage.updateUser(resetToken.userId, {
        password: hashedPassword,
      } as any);
      await storage.markTokenUsed(token);
      res.json({ message: "Password has been reset successfully" });
    } catch {
      res.status(500).json({ message: "Something went wrong" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => res.json({ message: "Logged out" }));
  });

  app.get("/api/auth/me", async (req, res) => {
    let userId = req.session.userId;
    const authHeader = req.headers.authorization;
    if (!userId && authHeader?.startsWith("Bearer ")) {
      try {
        const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET) as {
          userId?: string;
          studentId?: string;
        };
        userId = decoded.userId || decoded.studentId;
      } catch {
        return res.status(401).json({ message: "Invalid token" });
      }
    }
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(userId);
    if (user) {
      const { password: _, ...safeUser } = user;
      return res.json({ user: safeUser });
    }
    const student = await storage.getStudentById(userId);
    if (student) {
      const { password: _, ...safeStudent } = student;
      return res.json({
        user: {
          ...safeStudent,
          username: safeStudent.name || safeStudent.email,
          displayName: safeStudent.name,
        },
      });
    }
    return res.status(401).json({ message: "User not found" });
  });

  app.put(
    "/api/auth/profile",
    requireAdminAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        const user = await storage.updateUser(req.session.userId!, {
          displayName: req.body.displayName,
          phone: req.body.phone,
          darkMode: req.body.darkMode,
        });
        if (!user) return res.status(404).json({ message: "User not found" });
        const { password: _, ...safeUser } = user;
        res.json({ user: safeUser });
      } catch {
        res.status(500).json({ message: "Update failed" });
      }
    },
  );

  // ========== FCM TOKEN ==========
  app.post(
    "/api/student/fcm-token",
    requireAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        const { token } = req.body;
        if (!token)
          return res.status(400).json({ message: "FCM token required" });
        await saveFcmToken(req.session.userId!, token);
        res.json({ success: true });
      } catch (err) {
        console.error("FCM token save error:", err);
        res.status(500).json({ message: "Failed to save FCM token" });
      }
    },
  );

  app.delete(
    "/api/student/fcm-token",
    requireAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        const { token } = req.body;
        if (token) await removeFcmToken(token);
        res.json({ success: true });
      } catch {
        res.status(500).json({ message: "Failed to remove FCM token" });
      }
    },
  );

  // ========== STUDENT AUTH ==========
  app.post("/api/student/login", async (req, res) => {
    try {
      const { identifier, password } = req.body;
      if (!identifier || !password)
        return res
          .status(400)
          .json({ message: "Email/phone and password are required" });
      let student = await storage.getStudentByEmail(identifier);
      if (!student) student = await storage.getStudentByPhone(identifier);
      if (!student)
        return res.status(401).json({ message: "Invalid credentials" });
      if (student.status === "blocked")
        return res.status(403).json({
          message: "Your account has been blocked. Contact your teacher.",
        });
      if (student.status === "pending")
        return res.status(403).json({
          message: "Your account is pending approval. Contact your teacher.",
        });
      const valid = await bcrypt.compare(password, student.password);
      if (!valid)
        return res.status(401).json({ message: "Invalid credentials" });
      const sessionToken = crypto.randomBytes(32).toString("hex");
      await storage.updateStudentSessionToken(student.id, sessionToken);
      sessionCache.set(student.id, sessionToken);
      const token = jwt.sign(
        { studentId: student.id, sessionToken },
        JWT_SECRET,
        { expiresIn: "30d" },
      );
      const { password: _, ...safeStudent } = student;
      res.json({ student: safeStudent, token });
    } catch {
      res.status(500).json({ message: "Login failed" });
    }
  });

  // ========== STUDENT MANAGEMENT ==========
  app.get(
    "/api/admin/students",
    requireAdminAuth,
    // requireValidSession,
    async (_req, res) => {
      try {
        res.json(await storage.getStudents());
      } catch {
        res.status(500).json({ message: "Failed to fetch students" });
      }
    },
  );

  app.get(
    "/api/admin/students/with-passwords",
    requireAdminAuth,
    // requireValidSession,
    async (_req, res) => {
      try {
        res.json(await storage.getStudentsWithPasswords());
      } catch (err) {
        console.error("with-passwords error:", err);
        res.status(500).json({ message: "Failed to fetch students" });
      }
    },
  );

  app.post(
    "/api/admin/students/bulk",
    requireAdminAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        const { students } = req.body as {
          students: {
            name: string;
            email: string;
            phone: string;
            password: string;
          }[];
        };
        if (!Array.isArray(students) || students.length === 0)
          return res.status(400).json({ message: "No students provided" });
        const prepared = await Promise.all(
          students.map(async (s) => ({
            name: s.name || s.email.split("@")[0],
            email: s.email,
            phone: s.phone || "",
            password: await bcrypt.hash(s.password, 12),
            plainPassword: s.password,
            enrollmentNumber: `ENR${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
            status: "approved" as const,
          })),
        );
        const result = await storage.createStudentsBulk(prepared);
        res.json({ success: true, ...result });
      } catch (err) {
        console.error("Bulk import error:", err);
        res.status(500).json({ message: "Bulk import failed" });
      }
    },
  );

  app.post(
    "/api/admin/students",
    requireAdminAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        const { name, email, phone, password } = req.body;
        if (!email || !password)
          return res
            .status(400)
            .json({ message: "Email and password are required" });
        if (password.length < 6)
          return res
            .status(400)
            .json({ message: "Password must be at least 6 characters" });
        const existing = await storage.getStudentByEmail(email);
        if (existing)
          return res
            .status(400)
            .json({ message: "A student with this email already exists" });
        if (phone) {
          const existingPhone = await storage.getStudentByPhone(phone);
          if (existingPhone)
            return res
              .status(400)
              .json({ message: "A student with this phone already exists" });
        }
        const hashedPassword = await bcrypt.hash(password, 12);
        const student = await storage.createStudent(
          {
            name: name || email.split("@")[0],
            email,
            phone: phone || "",
            password: hashedPassword,
            enrollmentNumber: `ENR${Date.now()}`,
            status: "approved",
          },
          password,
        );
        res.json(student);
      } catch (err) {
        console.error("Create student error:", err);
        res.status(500).json({ message: "Failed to create student" });
      }
    },
  );

  app.put(
    "/api/admin/students/:id/reset-password",
    requireAdminAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        const { newPassword } = req.body;
        if (!newPassword || newPassword.length < 6)
          return res
            .status(400)
            .json({ message: "Password must be at least 6 characters" });
        const student = await storage.getStudentById(req.params.id);
        if (!student)
          return res.status(404).json({ message: "Student not found" });
        const hashedPassword = await bcrypt.hash(newPassword, 12);
        await storage.updateStudentPassword(
          req.params.id,
          hashedPassword,
          newPassword,
        );
        res.json({ success: true });
      } catch (err) {
        console.error("Reset password error:", err);
        res.status(500).json({ message: "Password reset failed" });
      }
    },
  );

  app.put(
    "/api/admin/students/:id",
    requireAdminAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        const { name, email, phone } = req.body;
        if (!email)
          return res.status(400).json({ message: "Email is required" });
        const student = await storage.updateStudent(req.params.id, {
          name,
          email,
          phone,
        });
        res.json(student);
      } catch (err: any) {
        res
          .status(500)
          .json({ message: err.message || "Failed to update student" });
      }
    },
  );

  app.put(
    "/api/admin/students/:id/status",
    requireAdminAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        const { status } = req.body;
        if (!["pending", "approved", "blocked"].includes(status))
          return res.status(400).json({ message: "Invalid status" });
        await storage.updateStudentStatus(req.params.id, status);
        res.json({ success: true });
      } catch {
        res.status(500).json({ message: "Failed to update student status" });
      }
    },
  );

  app.delete(
    "/api/admin/students/:id",
    requireAdminAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        await storage.deleteStudent(req.params.id);
        res.json({ success: true });
      } catch {
        res.status(500).json({ message: "Failed to delete student" });
      }
    },
  );

  // ========== SEMESTERS ==========
  app.get(
    "/api/semesters",
    requireAuth,
    // requireValidSession,
    async (_req, res) => {
      try {
        const semesters = [
          { id: 1, title: "Semester 1", number: 1 },
          { id: 2, title: "Semester 2", number: 2 },
          { id: 3, title: "Semester 3", number: 3 },
          { id: 4, title: "Semester 4", number: 4 },
        ];
        const semestersWithCounts = await Promise.all(
          semesters.map(async (sem) => {
            const stats = await storage.getSemesterStats(sem.number);
            return { ...sem, ...stats };
          }),
        );
        res.json(semestersWithCounts);
      } catch (err) {
        console.error("Get semesters error:", err);
        res.status(500).json({ message: "Failed to fetch semesters" });
      }
    },
  );

  app.get(
    "/api/semesters/:semesterNumber/subjects",
    requireAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        const semesterNumber = parseInt(req.params.semesterNumber);
        if (isNaN(semesterNumber) || semesterNumber < 1 || semesterNumber > 4)
          return res
            .status(400)
            .json({ message: "Invalid semester number. Must be 1-4." });
        res.json(await storage.getSubjectsBySemester(semesterNumber));
      } catch (err) {
        console.error("Get subjects by semester error:", err);
        res.status(500).json({ message: "Failed to fetch subjects" });
      }
    },
  );

  // ========== SUBJECTS ==========
  app.get(
    "/api/subjects",
    requireAuth,
    // requireValidSession,
    async (_req, res) => {
      try {
        res.json(await storage.getSubjects());
      } catch {
        res.status(500).json({ message: "Failed to fetch subjects" });
      }
    },
  );
  app.get(
    "/api/subjects/:id",
    requireAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        const subject = await storage.getSubjectById(req.params.id);
        if (!subject)
          return res.status(404).json({ message: "Subject not found" });
        res.json(subject);
      } catch {
        res.status(500).json({ message: "Failed to fetch subject" });
      }
    },
  );
  app.post(
    "/api/admin/subjects",
    requireAdminAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        const data = insertSubjectSchema.parse(req.body);
        if (data.semesterNumber < 1 || data.semesterNumber > 4)
          return res
            .status(400)
            .json({ message: "Semester number must be between 1 and 4" });
        res.json(await storage.createSubject(data));
      } catch (err) {
        if (err instanceof z.ZodError)
          return res.status(400).json({ message: err.errors[0].message });
        res.status(500).json({ message: "Failed to create subject" });
      }
    },
  );
  app.put(
    "/api/admin/subjects/:id",
    requireAdminAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        const data = insertSubjectSchema.partial().parse(req.body);
        if (
          data.semesterNumber !== undefined &&
          (data.semesterNumber < 1 || data.semesterNumber > 4)
        )
          return res
            .status(400)
            .json({ message: "Semester number must be between 1 and 4" });
        const subject = await storage.updateSubject(req.params.id, data);
        if (!subject)
          return res.status(404).json({ message: "Subject not found" });
        res.json(subject);
      } catch (err) {
        if (err instanceof z.ZodError)
          return res.status(400).json({ message: err.errors[0].message });
        res.status(500).json({ message: "Failed to update subject" });
      }
    },
  );
  app.delete(
    "/api/admin/subjects/:id",
    requireAdminAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        await storage.deleteSubject(req.params.id);
        res.json({ success: true });
      } catch {
        res.status(500).json({ message: "Failed to delete subject" });
      }
    },
  );
  app.get(
    "/api/subjects/:id/units",
    requireAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        res.json(await storage.getUnitsBySubject(req.params.id));
      } catch {
        res.status(500).json({ message: "Failed to fetch chapters" });
      }
    },
  );
  app.get(
    "/api/categories/:id/units",
    requireAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        res.json(await storage.getUnitsBySubject(req.params.id));
      } catch {
        res.status(500).json({ message: "Failed to fetch chapters" });
      }
    },
  );

  // ========== UNITS ==========
  app.post(
    "/api/admin/units",
    requireAdminAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        res.json(await storage.createUnit(insertUnitSchema.parse(req.body)));
      } catch (err) {
        if (err instanceof z.ZodError)
          return res.status(400).json({ message: err.errors[0].message });
        res.status(500).json({ message: "Failed to create chapter" });
      }
    },
  );
  app.put(
    "/api/admin/units/:id",
    requireAdminAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        const unit = await storage.updateUnit(
          req.params.id,
          insertUnitSchema.partial().parse(req.body),
        );
        if (!unit)
          return res.status(404).json({ message: "Chapter not found" });
        res.json(unit);
      } catch (err) {
        if (err instanceof z.ZodError)
          return res.status(400).json({ message: err.errors[0].message });
        res.status(500).json({ message: "Failed to update chapter" });
      }
    },
  );
  app.delete(
    "/api/admin/units/:id",
    requireAdminAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        await storage.deleteUnit(req.params.id);
        res.json({ success: true });
      } catch {
        res.status(500).json({ message: "Failed to delete chapter" });
      }
    },
  );

  // ========== STUDY MATERIALS ==========
  app.get(
    "/api/study-materials",
    requireAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        const unitId = req.query.unitId as string | undefined;
        if (unitId)
          return res.json(await storage.getStudyMaterialsByUnit(unitId));
        res.json([]);
      } catch {
        res.status(500).json({ message: "Failed to fetch study materials" });
      }
    },
  );
  app.get(
    "/api/units/:id/materials",
    requireAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        res.json(await storage.getStudyMaterialsByUnit(req.params.id));
      } catch {
        res.status(500).json({ message: "Failed to fetch materials" });
      }
    },
  );

  app.post(
    "/api/admin/study-materials",
    requireAdminAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        const data = insertStudyMaterialSchema.parse(req.body);
        const mat = await storage.createStudyMaterial(data);

        Promise.all([
          storage.notifyAllStudents(
            "📚 New Study Material",
            `"${mat.title}" has been added. Check it out!`,
            "material",
          ),
          broadcastPush(
            "📚 New Study Material",
            `"${mat.title}" has been added. Check it out!`,
            { type: "material", materialId: mat.id },
          ),
        ]).catch((err) => console.error("Notification error (material):", err));

        res.json(mat);
      } catch (err) {
        if (err instanceof z.ZodError)
          return res.status(400).json({ message: err.errors[0].message });
        console.error("Create material error:", err);
        res.status(500).json({ message: "Failed to create study material" });
      }
    },
  );

  app.put(
    "/api/admin/study-materials/:id",
    requireAdminAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        const mat = await storage.updateStudyMaterial(
          req.params.id,
          insertStudyMaterialSchema.partial().parse(req.body),
        );
        if (!mat)
          return res.status(404).json({ message: "Study material not found" });
        res.json(mat);
      } catch (err) {
        if (err instanceof z.ZodError)
          return res.status(400).json({ message: err.errors[0].message });
        res.status(500).json({ message: "Failed to update study material" });
      }
    },
  );
  app.delete(
    "/api/admin/study-materials/:id",
    requireAdminAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        await storage.deleteStudyMaterial(req.params.id);
        res.json({ success: true });
      } catch {
        res.status(500).json({ message: "Failed to delete study material" });
      }
    },
  );

  // ========== QUIZZES ==========
  app.get(
    "/api/quizzes",
    requireAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        const quizList = await storage.getAllQuizzes();
        const authHeader = req.headers.authorization;
        let isStudent = false;
        if (authHeader?.startsWith("Bearer ")) {
          try {
            const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET) as {
              userId?: string;
              studentId?: string;
            };
            isStudent = !!decoded.studentId && !decoded.userId;
          } catch {}
        }
        res.json(
          isStudent ? quizList.filter((q) => q.isActive === true) : quizList,
        );
      } catch {
        res.status(500).json({ message: "Failed to fetch quizzes" });
      }
    },
  );
  app.get(
    "/api/quizzes/:id",
    requireAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        const quiz = await storage.getQuizById(req.params.id);
        if (!quiz) return res.status(404).json({ message: "Quiz not found" });
        res.json(quiz);
      } catch {
        res.status(500).json({ message: "Failed to fetch quiz" });
      }
    },
  );
  app.get(
    "/api/quizzes/:id/questions",
    requireAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        const qs = await storage.getQuestionsByQuiz(req.params.id);
        res.json(qs.map(({ correctAnswer, ...q }) => q));
      } catch {
        res.status(500).json({ message: "Failed to fetch questions" });
      }
    },
  );
  app.get(
    "/api/quizzes/:id/check-attempt",
    requireAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        const existing = await storage.getUserAttemptForQuiz(
          req.session.userId!,
          req.params.id,
        );
        res.json({ attempted: !!existing, attempt: existing || null });
      } catch {
        res.status(500).json({ message: "Failed to check attempt" });
      }
    },
  );
  app.post(
    "/api/quizzes/:id/submit",
    requireAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        const quizId = req.params.id;
        const userId = req.session.userId!;
        const existing = await storage.getUserAttemptForQuiz(userId, quizId);
        if (existing)
          return res.status(400).json({
            message: "You have already attempted this quiz.",
            code: "ALREADY_ATTEMPTED",
            attempt: existing,
          });
        const { answers, timeTaken } = req.body;
        const allQuestions = await storage.getQuestionsByQuiz(quizId);
        if (allQuestions.length === 0)
          return res
            .status(400)
            .json({ message: "This quiz has no questions." });
        let score = 0;
        for (const q of allQuestions) {
          if (answers[q.id] === q.correctAnswer) score++;
        }
        const attempt = await storage.createAttempt({
          userId,
          quizId,
          score,
          totalQuestions: allQuestions.length,
          answers,
          timeTaken,
        });
        res.json({
          attempt,
          correctAnswers: Object.fromEntries(
            allQuestions.map((q) => [q.id, q.correctAnswer]),
          ),
        });
      } catch (err) {
        console.error("Submit quiz error:", err);
        res.status(500).json({ message: "Submit failed" });
      }
    },
  );

  app.post(
    "/api/admin/quizzes",
    requireAdminAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        const data = insertQuizSchema.parse(req.body);
        const quiz = await storage.createQuiz({ ...data, isActive: false });
        // if (quiz.isActive) {
        //   Promise.all([
        //     storage.notifyAllStudents(
        //       "📝 New Quiz Available",
        //       `"${quiz.title}" is now available. Attempt it before the deadline!`,
        //       "quiz",
        //     ),
        //     broadcastPush(
        //       "📝 New Quiz Available",
        //       `"${quiz.title}" is now available!`,
        //       { type: "quiz", quizId: quiz.id },
        //     ),
        //   ]).catch((err) =>
        //     console.error("Notification error (quiz create):", err),
        //   );
        // }
        res.json(quiz);
      } catch (err) {
        if (err instanceof z.ZodError)
          return res.status(400).json({ message: err.errors[0].message });
        res.status(500).json({ message: "Failed to create quiz" });
      }
    },
  );

  app.put(
    "/api/admin/quizzes/:id",
    requireAdminAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        const data = insertQuizSchema.partial().parse(req.body);
        const oldQuiz = await storage.getQuizById(req.params.id);
        const quiz = await storage.updateQuiz(req.params.id, data);
        if (!quiz) return res.status(404).json({ message: "Quiz not found" });
        if (!oldQuiz?.isActive && quiz.isActive) {
          Promise.all([
            storage.notifyAllStudents(
              "📝 New Quiz Available",
              `"${quiz.title}" is now available. Attempt it now!`,
              "quiz",
            ),
            broadcastPush(
              "📝 New Quiz Available",
              `"${quiz.title}" is now available!`,
              { type: "quiz", quizId: quiz.id },
            ),
          ]).catch((err) =>
            console.error("Notification error (quiz publish):", err),
          );
        }
        res.json(quiz);
      } catch (err) {
        if (err instanceof z.ZodError)
          return res.status(400).json({ message: err.errors[0].message });
        res.status(500).json({ message: "Failed to update quiz" });
      }
    },
  );

  app.delete(
    "/api/admin/quizzes/:id",
    requireAdminAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        await storage.deleteQuiz(req.params.id);
        res.json({ success: true });
      } catch {
        res.status(500).json({ message: "Failed to delete quiz" });
      }
    },
  );

  // ========== QUESTIONS ==========
  app.get(
    "/api/admin/questions",
    requireAdminAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        const quizId = req.query.quizId as string | undefined;
        const withQuizInfo = req.query.withQuizInfo === "true";
        if (withQuizInfo)
          return res.json(await storage.getAllQuestionsWithQuizInfo(quizId));
        if (quizId) return res.json(await storage.getQuestionsByQuiz(quizId));
        res.json(await storage.getAllQuestions());
      } catch {
        res.status(500).json({ message: "Failed to fetch questions" });
      }
    },
  );
  app.post(
    "/api/admin/questions",
    requireAdminAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        // console.log('req.body', req.body)
        res.json(
          await storage.createQuestion(insertQuestionSchema.parse(req.body)),
        );
      } catch (err) {
        if (err instanceof z.ZodError)
          return res.status(400).json({ message: err.errors[0].message });
        res.status(500).json({ message: "Failed to create question" });
      }
    },
  );
  app.put(
    "/api/admin/questions/:id",
    requireAdminAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        const q = await storage.updateQuestion(
          req.params.id,
          insertQuestionSchema.partial().parse(req.body),
        );
        if (!q) return res.status(404).json({ message: "Question not found" });
        res.json(q);
      } catch (err) {
        if (err instanceof z.ZodError)
          return res.status(400).json({ message: err.errors[0].message });
        res.status(500).json({ message: "Failed to update question" });
      }
    },
  );
  app.delete(
    "/api/admin/questions/:id",
    requireAdminAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        await storage.deleteQuestion(req.params.id);
        res.json({ success: true });
      } catch {
        res.status(500).json({ message: "Failed to delete question" });
      }
    },
  );

  // ========== QUIZ ↔ QUESTION JOIN ==========
  app.post(
    "/api/admin/quizzes/:quizId/questions",
    requireAdminAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        const demo = await storage.addQuestionToQuiz(
          req.params.quizId,
          req.body.questionId,
          req.body.order,
        );
        res.json({ success: true });
      } catch {
        res.status(500).json({ message: "Failed to add question to quiz" });
      }
    },
  );
  app.delete(
    "/api/admin/quizzes/:quizId/questions/:questionId",
    requireAdminAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        await storage.removeQuestionFromQuiz(
          req.params.quizId,
          req.params.questionId,
        );
        res.json({ success: true });
      } catch {
        res
          .status(500)
          .json({ message: "Failed to remove question from quiz" });
      }
    },
  );
  app.put(
    "/api/admin/quizzes/:quizId/questions/reorder",
    requireAdminAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        await storage.reorderQuestionsInQuiz(
          req.params.quizId,
          req.body.orderedQuestionIds,
        );
        res.json({ success: true });
      } catch {
        res.status(500).json({ message: "Failed to reorder questions" });
      }
    },
  );

  // ========== QUIZ ANALYTICS ==========
  app.get(
    "/api/admin/quizzes/:id/analytics",
    requireAdminAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        const analytics = await storage.getQuizAnalytics(req.params.id);
        res.json(analytics);
      } catch (err: any) {
        if (err.message === "Quiz not found")
          return res.status(404).json({ message: "Quiz not found" });
        console.error("Analytics error:", err);
        res.status(500).json({ message: "Failed to fetch analytics" });
      }
    },
  );

  // ========== NOTICE BOARD ==========
  app.get(
    "/api/admin/notices",
    requireAdminAuth,
    // requireValidSession,
    async (_req, res) => {
      try {
        res.json(await storage.getNotices());
      } catch {
        res.status(500).json({ message: "Failed to fetch notices" });
      }
    },
  );

  app.post(
    "/api/admin/notices",
    requireAdminAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        const raw = insertNoticeSchema.parse(req.body);
        const data = { ...raw, expiresAt: new Date(raw.expiresAt) };
        const notice = await storage.createNotice(data);
        Promise.all([
          storage.notifyAllStudents(
            `📢 Notice: ${notice.title}`,
            notice.message,
            "notice",
          ),
          broadcastPush(`📢 Notice: ${notice.title}`, notice.message, {
            type: "notice",
            noticeId: notice.id,
          }),
        ]).catch((err) => console.error("Notification error (notice):", err));
        res.json(notice);
      } catch (err) {
        if (err instanceof z.ZodError)
          return res.status(400).json({ message: err.errors[0].message });
        res.status(500).json({ message: "Failed to create notice" });
      }
    },
  );

  app.put(
    "/api/admin/notices/:id",
    requireAdminAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        const raw = insertNoticeSchema.partial().parse(req.body);
        const data: any = { ...raw };
        if (raw.expiresAt) data.expiresAt = new Date(raw.expiresAt);
        const notice = await storage.updateNotice(req.params.id, data);
        if (!notice)
          return res.status(404).json({ message: "Notice not found" });
        res.json(notice);
      } catch (err) {
        if (err instanceof z.ZodError)
          return res.status(400).json({ message: err.errors[0].message });
        res.status(500).json({ message: "Failed to update notice" });
      }
    },
  );

  app.delete(
    "/api/admin/notices/:id",
    requireAdminAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        await storage.deleteNotice(req.params.id);
        res.json({ success: true });
      } catch {
        res.status(500).json({ message: "Failed to delete notice" });
      }
    },
  );

  app.get(
    "/api/notices",
    requireAuth,
    // requireValidSession,
    async (_req, res) => {
      try {
        res.json(await storage.getActiveNotices());
      } catch {
        res.status(500).json({ message: "Failed to fetch notices" });
      }
    },
  );

  // ========== ATTEMPTS & NOTIFICATIONS ==========
  app.get(
    "/api/attempts",
    requireAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        res.json(await storage.getAttemptsByUser(req.session.userId!));
      } catch {
        res.status(500).json({ message: "Failed to fetch attempts" });
      }
    },
  );
  app.get(
    "/api/notifications",
    requireAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        res.json(await storage.getNotifications(req.session.userId!));
      } catch {
        res.status(500).json({ message: "Failed to fetch notifications" });
      }
    },
  );
  app.put(
    "/api/notifications/:id/read",
    requireAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        await storage.markNotificationRead(req.params.id);
        res.json({ success: true });
      } catch {
        res.status(500).json({ message: "Failed to mark notification" });
      }
    },
  );
  app.put(
    "/api/notifications/read-all",
    requireAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        await storage.markAllNotificationsRead(req.session.userId!);
        res.json({ success: true });
      } catch {
        res.status(500).json({ message: "Failed to mark all notifications" });
      }
    },
  );
  app.delete(
    "/api/notifications/clear-all",
    requireAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        await storage.clearAllNotifications(req.session.userId!);
        res.json({ success: true });
      } catch {
        res.status(500).json({ message: "Failed to clear notifications" });
      }
    },
  );

  // ========== ADMIN STATS & USERS ==========
  app.get(
    "/api/admin/stats",
    requireAdminAuth,
    // requireValidSession,
    async (_req, res) => {
      try {
        res.json(await storage.getAdminStats());
      } catch {
        res.status(500).json({ message: "Failed to fetch stats" });
      }
    },
  );
  app.get(
    "/api/admin/users",
    requireAdminAuth,
    // requireValidSession,
    async (_req, res) => {
      try {
        res.json(await storage.getAllUsers());
      } catch {
        res.status(500).json({ message: "Failed to fetch users" });
      }
    },
  );

  // ========== QUIZ MAINTENANCE ==========
  app.post(
    "/api/admin/quizzes/:quizId/sync-questions",
    requireAdminAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        const db = getFirestore();
        const { quizId } = req.params;
        const quiz = await storage.getQuizById(quizId);
        if (!quiz) return res.status(404).json({ message: "Quiz not found" });
        let questionIds: string[] = req.body.questionIds ?? [];
        if (questionIds.length === 0)
          questionIds = (await storage.getAllQuestions()).map((q) => q.id);
        if (questionIds.length === 0)
          return res.json({
            success: true,
            linked: 0,
            skipped: 0,
            message: "No questions found to link.",
          });
        const existingSnap = await db
          .collection("quizQuestions")
          .where("quizId", "==", quizId)
          .get();
        const alreadyLinked = new Set(
          existingSnap.docs.map((d) => d.data().questionId as string),
        );
        const currentMaxOrder = existingSnap.empty
          ? -1
          : Math.max(...existingSnap.docs.map((d) => d.data().order ?? 0));
        let linked = 0,
          skipped = 0,
          order = currentMaxOrder + 1;
        for (const questionId of questionIds) {
          if (alreadyLinked.has(questionId)) {
            skipped++;
            continue;
          }
          await db
            .collection("quizQuestions")
            .add({ quizId, questionId, order });
          order++;
          linked++;
        }
        res.json({
          success: true,
          linked,
          skipped,
          total: questionIds.length,
          message: `Linked ${linked} questions to quiz "${quiz.title}". ${skipped} were already linked.`,
        });
      } catch (err: any) {
        console.error("sync-questions error:", err);
        res
          .status(500)
          .json({ message: err.message || "Failed to sync questions" });
      }
    },
  );

  app.get(
    "/api/admin/quizzes/:quizId/sync-status",
    requireAdminAuth,
    // requireValidSession,
    async (req, res) => {
      try {
        const db = getFirestore();
        const { quizId } = req.params;
        const quiz = await storage.getQuizById(quizId);
        if (!quiz) return res.status(404).json({ message: "Quiz not found" });
        const [allQs, linksSnap] = await Promise.all([
          storage.getAllQuestions(),
          db.collection("quizQuestions").where("quizId", "==", quizId).get(),
        ]);
        const linkedIds = new Set(
          linksSnap.docs.map((d) => d.data().questionId as string),
        );
        const unlinked = allQs.filter((q) => !linkedIds.has(q.id));
        res.json({
          quizId,
          quizTitle: quiz.title,
          totalQuestionsInBank: allQs.length,
          linkedToThisQuiz: linkedIds.size,
          notLinked: unlinked.length,
          unlinkedQuestionIds: unlinked.map((q) => q.id),
        });
      } catch (err: any) {
        res
          .status(500)
          .json({ message: err.message || "Failed to get sync status" });
      }
    },
  );

  const httpServer = createServer(app);
  return httpServer;
}
