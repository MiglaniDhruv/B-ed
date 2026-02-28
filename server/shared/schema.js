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
export const SEMESTERS = [
    { id: 1, number: 1, name: "Semester 1" },
    { id: 2, number: 2, name: "Semester 2" },
    { id: 3, number: 3, name: "Semester 3" },
    { id: 4, number: 4, name: "Semester 4" },
];
// ─── Subject ──────────────────────────────────────────────────────────────────
export const insertSubjectSchema = z.object({
    semesterNumber: z.number().int().min(1).max(4),
    name: z.string().min(1, "Subject name is required"),
    description: z.string().optional(),
    icon: z.string().optional(),
    color: z.string().optional(),
    order: z.number().int().optional(),
});
// ─── Unit ─────────────────────────────────────────────────────────────────────
export const insertUnitSchema = z.object({
    subjectId: z.string().min(1, "Subject ID is required"),
    title: z.string().min(1, "Unit title is required"),
    description: z.string().optional(),
    order: z.number().int().optional(),
});
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
// ─── Quiz ─────────────────────────────────────────────────────────────────────
export const insertQuizSchema = z.object({
    subjectId: z.string().optional().default(""),
    title: z.string().min(1, "Quiz title is required"),
    description: z.string().optional(),
    duration: z.number().int().positive().optional(),
    totalMarks: z.number().int().positive().optional(),
    isActive: z.boolean().optional(),
});
// ─── Question ─────────────────────────────────────────────────────────────────
export const insertQuestionSchema = z.object({
    quizId: z.string().optional().default(""),
    questionText: z.string().min(1, "Question text is required"),
    options: z.array(z.string()).min(2, "At least 2 options required"),
    correctAnswer: z.number().int().min(0),
    explanation: z.string().optional().default(""),
    marks: z.number().int().positive().optional(),
    order: z.number().int().optional(),
});
// ─── Notice Board ─────────────────────────────────────────────────────────────
// Notices are admin-written announcements visible to all students.
// They auto-expire at expiresAt and disappear from student view.
export const insertNoticeSchema = z.object({
    title: z.string().min(1, "Title is required"),
    message: z.string().min(1, "Message is required"),
    expiresAt: z.string(), // ISO date string from frontend
    priority: z.enum(["normal", "important", "urgent"]).optional().default("normal"),
});
//# sourceMappingURL=schema.js.map