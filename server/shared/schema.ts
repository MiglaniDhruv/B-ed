import { z } from "zod";

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  displayName: z.string().optional(),
});

// ─── Semester (hardcoded 1–4, no Firestore collection) ───────────────────────
export interface Semester {
  id: number;
  number: number;
  name: string;
}

export const SEMESTERS: Semester[] = [
  { id: 1, number: 1, name: "Semester 1" },
  { id: 2, number: 2, name: "Semester 2" },
  { id: 3, number: 3, name: "Semester 3" },
  { id: 4, number: 4, name: "Semester 4" },
];

// ─── User ─────────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  username: string;
  email: string;
  password: string;
  displayName: string | null;
  avatarUrl: string | null;
  darkMode: boolean | null;
  phone: string | null;        // ✅ ADD THIS
  createdAt: Date | null;
}

export interface InsertUser {
  phone: string;
  username: string;
  email: string;
  password: string;
  displayName?: string;
  avatarUrl?: string;
  darkMode?: boolean;
}

// ─── Subject ──────────────────────────────────────────────────────────────────
export const insertSubjectSchema = z.object({
  semesterNumber: z.number().int().min(1).max(4),
  name: z.string().min(1, "Subject name is required"),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  order: z.number().int().optional(),
});

export interface Subject {
  id: string;
  semesterNumber: number;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  order: number | null;
}

export interface InsertSubject {
  semesterNumber: number;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  order?: number;
}

// ─── Unit ─────────────────────────────────────────────────────────────────────
export const insertUnitSchema = z.object({
  subjectId: z.string().min(1, "Subject ID is required"),
  title: z.string().min(1, "Unit title is required"),
  description: z.string().optional(),
  order: z.number().int().optional(),
});

export interface Unit {
  id: string;
  subjectId: string;
  title: string;
  description: string | null;
  order: number | null;
}

export interface InsertUnit {
  subjectId: string;
  title: string;
  description?: string;
  order?: number;
}

// ─── Study Material ───────────────────────────────────────────────────────────
export const insertStudyMaterialSchema = z.object({
  unitId: z.string().min(1, "Unit ID is required"),
  title: z.string().min(1, "Material title is required"),
  description: z.string().optional(),
  type: z.enum(["pdf", "video", "link", "document"]),
  url: z.string().url("Invalid URL"),
  fileName: z.string().optional(),
  fileSize: z.number().optional(),
  order: z.number().int().optional(),
});

export interface StudyMaterial {
  id: string;
  unitId: string;
  title: string;
  description: string | null;
  type: "pdf" | "video" | "link" | "document";
  url: string;
  fileName: string | null;
  fileSize: number | null;
  uploadedAt: Date | null;
  order: number | null;
}

export interface InsertStudyMaterial {
  unitId: string;
  title: string;
  description?: string;
  type: "pdf" | "video" | "link" | "document";
  url: string;
  fileName?: string;
  fileSize?: number;
  order?: number;
}

// ─── Quiz ─────────────────────────────────────────────────────────────────────
export const insertQuizSchema = z.object({
  subjectId: z.string().optional().default(""),
  title: z.string().min(1, "Quiz title is required"),
  description: z.string().optional(),
  duration: z.number().int().positive().optional(),
  totalMarks: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});

export interface Quiz {
  id: string;
  subjectId: string;
  title: string;
  description: string | null;
  duration: number | null;
  totalMarks: number | null;
  isActive: boolean | null;
  createdAt: Date | null;
}

export interface InsertQuiz {
  subjectId?: string;
  title: string;
  description?: string;
  duration?: number;
  totalMarks?: number;
  isActive?: boolean;
}

// ─── Question ─────────────────────────────────────────────────────────────────
export const insertQuestionSchema = z.object({
  quizId: z.string().optional().default(""),
  questionText: z.string().min(1, "Question text is required"),
  options: z.array(z.string()).min(2, "At least 2 options required"),
  correctAnswer: z.number().int().min(0),
  // explanation: z.string().optional().default(""),
  marks: z.number().int().positive().optional(),
  order: z.number().int().optional(),
});

export interface Question {
  id: string;
  quizId: string;
  questionText: string;
  options: string[];
  correctAnswer?: number;
  explanation: string | null;
  marks: number | null;
  order: number | null;
}

export interface InsertQuestion {
  quizId?: string;
  questionText: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  marks?: number;
  order?: number;
}

// ─── Quiz Attempt ─────────────────────────────────────────────────────────────
export interface QuizAttempt {
  id: string;
  quizId: string;
  userId: string;
  answers: Record<string, number>;
  score: number | null;
  totalQuestions: number | null;
  timeTaken: number | null;
  submittedAt: Date | null;
}

// ─── Notification ─────────────────────────────────────────────────────────────
export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string; // "quiz" | "material" | "notice" | "info"
  read: boolean | null;
  createdAt: Date | null;
}

// ─── Notice Board ─────────────────────────────────────────────────────────────
// Notices are admin-written announcements visible to all students.
// They auto-expire at expiresAt and disappear from student view.
export const insertNoticeSchema = z.object({
  title: z.string().min(1, "Title is required"),
  message: z.string().min(1, "Message is required"),
  expiresAt: z.string(), // ISO date string from frontend
  priority: z.enum(["normal", "important", "urgent"]).optional().default("normal"),
});

export interface Notice {
  id: string;
  title: string;
  message: string;
  priority: "normal" | "important" | "urgent";
  createdAt: Date | null;
  expiresAt: Date | null;
}

export interface InsertNotice {
  title: string;
  message: string;
  expiresAt: Date;
  priority?: "normal" | "important" | "urgent";
}