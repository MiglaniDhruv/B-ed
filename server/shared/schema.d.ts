import { z } from "zod";
export declare const loginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export declare const registerSchema: z.ZodObject<{
    username: z.ZodString;
    email: z.ZodString;
    password: z.ZodString;
    displayName: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
    username: string;
    displayName?: string | undefined;
}, {
    email: string;
    password: string;
    username: string;
    displayName?: string | undefined;
}>;
export interface Semester {
    id: number;
    number: number;
    name: string;
}
export declare const SEMESTERS: Semester[];
export interface User {
    id: string;
    username: string;
    email: string;
    password: string;
    displayName: string | null;
    avatarUrl: string | null;
    darkMode: boolean | null;
    phone: string | null;      // ✅ ADD THIS
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
export declare const insertSubjectSchema: z.ZodObject<{
    semesterNumber: z.ZodNumber;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    icon: z.ZodOptional<z.ZodString>;
    color: z.ZodOptional<z.ZodString>;
    order: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name: string;
    semesterNumber: number;
    description?: string | undefined;
    icon?: string | undefined;
    color?: string | undefined;
    order?: number | undefined;
}, {
    name: string;
    semesterNumber: number;
    description?: string | undefined;
    icon?: string | undefined;
    color?: string | undefined;
    order?: number | undefined;
}>;
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
export declare const insertUnitSchema: z.ZodObject<{
    subjectId: z.ZodString;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    order: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    subjectId: string;
    title: string;
    description?: string | undefined;
    order?: number | undefined;
}, {
    subjectId: string;
    title: string;
    description?: string | undefined;
    order?: number | undefined;
}>;
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
export declare const insertStudyMaterialSchema: z.ZodObject<{
    unitId: z.ZodString;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    type: z.ZodEnum<["pdf", "video", "link", "document"]>;
    url: z.ZodString;
    fileName: z.ZodOptional<z.ZodString>;
    fileSize: z.ZodOptional<z.ZodNumber>;
    order: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    url: string;
    type: "link" | "pdf" | "video" | "document";
    title: string;
    unitId: string;
    description?: string | undefined;
    order?: number | undefined;
    fileName?: string | undefined;
    fileSize?: number | undefined;
}, {
    url: string;
    type: "link" | "pdf" | "video" | "document";
    title: string;
    unitId: string;
    description?: string | undefined;
    order?: number | undefined;
    fileName?: string | undefined;
    fileSize?: number | undefined;
}>;
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
export declare const insertQuizSchema: z.ZodObject<{
    subjectId: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    duration: z.ZodOptional<z.ZodNumber>;
    totalMarks: z.ZodOptional<z.ZodNumber>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    subjectId: string;
    title: string;
    description?: string | undefined;
    duration?: number | undefined;
    totalMarks?: number | undefined;
    isActive?: boolean | undefined;
}, {
    title: string;
    description?: string | undefined;
    subjectId?: string | undefined;
    duration?: number | undefined;
    totalMarks?: number | undefined;
    isActive?: boolean | undefined;
}>;
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
export declare const insertQuestionSchema: z.ZodObject<{
    quizId: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    questionText: z.ZodString;
    options: z.ZodArray<z.ZodString, "many">;
    correctAnswer: z.ZodNumber;
    explanation: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    marks: z.ZodOptional<z.ZodNumber>;
    order: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    options: string[];
    quizId: string;
    questionText: string;
    correctAnswer: number;
    explanation: string;
    order?: number | undefined;
    marks?: number | undefined;
}, {
    options: string[];
    questionText: string;
    correctAnswer: number;
    order?: number | undefined;
    quizId?: string | undefined;
    explanation?: string | undefined;
    marks?: number | undefined;
}>;
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
export interface Notification {
    id: string;
    userId: string;
    title: string;
    message: string;
    type: string;
    read: boolean | null;
    createdAt: Date | null;
}
export declare const insertNoticeSchema: z.ZodObject<{
    title: z.ZodString;
    message: z.ZodString;
    expiresAt: z.ZodString;
    priority: z.ZodDefault<z.ZodOptional<z.ZodEnum<["normal", "important", "urgent"]>>>;
}, "strip", z.ZodTypeAny, {
    priority: "normal" | "important" | "urgent";
    message: string;
    title: string;
    expiresAt: string;
}, {
    message: string;
    title: string;
    expiresAt: string;
    priority?: "normal" | "important" | "urgent" | undefined;
}>;
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
//# sourceMappingURL=schema.d.ts.map