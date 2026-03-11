import mongoose, { Schema, Document, Model } from "mongoose";

// ─── Helper: auto-generate short random ID (like Firestore) ──────────────────
function generateId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 20; i++)
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

// ─── USER ─────────────────────────────────────────────────────────────────────
export interface IUser extends Omit<Document, '_id'> {
  _id: string;
  username: string;
  email: string;
  password: string;
  displayName: string | null;
  avatarUrl: string | null;
  darkMode: boolean;
  phone: string | null;
  sessionToken: string | null;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    _id: { type: String, default: generateId },
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    displayName: { type: String, default: null },
    avatarUrl: { type: String, default: null },
    darkMode: { type: Boolean, default: false },
    phone: { type: String, default: null },
    sessionToken: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, _id: false }
);

export const UserModel: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema, "users");

// ─── STUDENT ──────────────────────────────────────────────────────────────────
export interface IStudent extends Omit<Document, '_id'> {
  _id: string;
  name: string;
  email: string;
  phone: string;
  password: string;
  plainPassword: string | null;
  enrollmentNumber: string;
  status: "pending" | "approved" | "blocked";
  sessionToken: string | null;
  createdAt: Date;
}

const StudentSchema = new Schema<IStudent>(
  {
    _id: { type: String, default: generateId },
    name: { type: String, required: true, trim: true },
    email: { type: String, default: "", lowercase: true, trim: true },
    phone: { type: String, default: "", trim: true },
    password: { type: String, required: true },
    plainPassword: { type: String, default: null },
    enrollmentNumber: { type: String, required: true },
    status: { type: String, enum: ["pending", "approved", "blocked"], default: "pending" },
    sessionToken: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, _id: false }
);

StudentSchema.index({ email: 1 });
StudentSchema.index({ phone: 1 });

export const StudentModel: Model<IStudent> =
  mongoose.models.Student || mongoose.model<IStudent>("Student", StudentSchema, "students");

// ─── SUBJECT ──────────────────────────────────────────────────────────────────
export interface ISubject extends Omit<Document, '_id'> {
  _id: string;
  semesterNumber: number;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  order: number;
}

const SubjectSchema = new Schema<ISubject>(
  {
    _id: { type: String, default: generateId },
    semesterNumber: { type: Number, required: true, min: 1, max: 5 },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    icon: { type: String, default: null },
    color: { type: String, default: null },
    order: { type: Number, default: 0 },
  },
  { _id: false }
);

SubjectSchema.index({ semesterNumber: 1 });

export const SubjectModel: Model<ISubject> =
  mongoose.models.Subject || mongoose.model<ISubject>("Subject", SubjectSchema, "subjects");

// ─── UNIT ─────────────────────────────────────────────────────────────────────
export interface IUnit extends Omit<Document, '_id'> {
  _id: string;
  subjectId: string;
  title: string;
  description: string | null;
  order: number;
}

const UnitSchema = new Schema<IUnit>(
  {
    _id: { type: String, default: generateId },
    subjectId: { type: String, required: true, ref: "Subject" },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    order: { type: Number, default: 0 },
  },
  { _id: false }
);

UnitSchema.index({ subjectId: 1 });

export const UnitModel: Model<IUnit> =
  mongoose.models.Unit || mongoose.model<IUnit>("Unit", UnitSchema, "units");

// ─── STUDY MATERIAL ───────────────────────────────────────────────────────────
export interface IStudyMaterial extends Omit<Document, '_id'> {
  _id: string;
  unitId: string;
  title: string;
  description: string | null;
  type: "pdf" | "video" | "link" | "document";
  url: string;
  fileName: string | null;
  fileSize: number | null;
  order: number;
  uploadedAt: Date;
}

const StudyMaterialSchema = new Schema<IStudyMaterial>(
  {
    _id: { type: String, default: generateId },
    unitId: { type: String, required: true, ref: "Unit" },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    type: { type: String, enum: ["pdf", "video", "link", "document"], default: "pdf" },
    url: { type: String, required: true },
    fileName: { type: String, default: null },
    fileSize: { type: Number, default: null },
    order: { type: Number, default: 0 },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

StudyMaterialSchema.index({ unitId: 1 });

export const StudyMaterialModel: Model<IStudyMaterial> =
  mongoose.models.StudyMaterial ||
  mongoose.model<IStudyMaterial>("StudyMaterial", StudyMaterialSchema, "studyMaterials");

// ─── QUIZ ─────────────────────────────────────────────────────────────────────
export interface IQuiz extends Omit<Document, '_id'> {
  _id: string;
  subjectId: string;
  title: string;
  description: string | null;
  duration: number | null;
  totalMarks: number | null;
  isActive: boolean;
  allowReview: boolean;
  createdAt: Date;
}

const QuizSchema = new Schema<IQuiz>(
  {
    _id: { type: String, default: generateId },
    subjectId: { type: String, default: "" },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    duration: { type: Number, default: null },
    totalMarks: { type: Number, default: null },
    isActive: { type: Boolean, default: false },
    allowReview: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

export const QuizModel: Model<IQuiz> =
  mongoose.models.Quiz || mongoose.model<IQuiz>("Quiz", QuizSchema, "quizzes");

// ─── QUESTION ─────────────────────────────────────────────────────────────────
export interface IQuestion extends Omit<Document, '_id'> {
  _id: string;
  questionText: string;
  options: string[];
  correctAnswer: number;
  explanation: string | null;
  marks: number;
  order: number;
  createdAt: Date;
}

const QuestionSchema = new Schema<IQuestion>(
  {
    _id: { type: String, default: generateId },
    questionText: { type: String, required: true },
    options: [{ type: String }],
    correctAnswer: { type: Number, required: true },
    explanation: { type: String, default: null },
    marks: { type: Number, default: 1 },
    order: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

export const QuestionModel: Model<IQuestion> =
  mongoose.models.Question || mongoose.model<IQuestion>("Question", QuestionSchema, "questions");

// ─── QUIZ-QUESTION LINK (join table) ──────────────────────────────────────────
export interface IQuizQuestion extends Omit<Document, '_id'> {
  _id: string;
  quizId: string;
  questionId: string;
  order: number;
}

const QuizQuestionSchema = new Schema<IQuizQuestion>(
  {
    _id: { type: String, default: generateId },
    quizId: { type: String, required: true, ref: "Quiz" },
    questionId: { type: String, required: true, ref: "Question" },
    order: { type: Number, default: 0 },
  },
  { _id: false }
);

QuizQuestionSchema.index({ quizId: 1 });
QuizQuestionSchema.index({ questionId: 1 });
QuizQuestionSchema.index({ quizId: 1, questionId: 1 }, { unique: true });

export const QuizQuestionModel: Model<IQuizQuestion> =
  mongoose.models.QuizQuestion ||
  mongoose.model<IQuizQuestion>("QuizQuestion", QuizQuestionSchema, "quizQuestions");

// ─── QUIZ ATTEMPT ─────────────────────────────────────────────────────────────
export interface IQuizAttempt extends Omit<Document, '_id'> {
  _id: string;
  quizId: string;
  userId: string;
  answers: Record<string, number>;
  score: number;
  totalQuestions: number;
  timeTaken: number | null;
  submittedAt: Date;
}

const QuizAttemptSchema = new Schema<IQuizAttempt>(
  {
    _id: { type: String, default: generateId },
    quizId: { type: String, required: true, ref: "Quiz" },
    userId: { type: String, required: true },
    answers: { type: Schema.Types.Mixed, default: {} },
    score: { type: Number, default: 0 },
    totalQuestions: { type: Number, default: 0 },
    timeTaken: { type: Number, default: null },
    submittedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

QuizAttemptSchema.index({ userId: 1 });
QuizAttemptSchema.index({ quizId: 1 });
QuizAttemptSchema.index({ userId: 1, quizId: 1 });

export const QuizAttemptModel: Model<IQuizAttempt> =
  mongoose.models.QuizAttempt ||
  mongoose.model<IQuizAttempt>("QuizAttempt", QuizAttemptSchema, "quizAttempts");

// ─── GLOBAL NOTIFICATION ─────────────────────────────────────────────────────
export interface IGlobalNotification extends Omit<Document, '_id'> {
  _id: string;
  title: string;
  message: string;
  type: string;
  readBy: string[];
  clearedBy: string[];
  createdAt: Date;
  expiresAt: Date;
}

const GlobalNotificationSchema = new Schema<IGlobalNotification>(
  {
    _id: { type: String, default: generateId },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, default: "info" },
    readBy: [{ type: String }],
    clearedBy: [{ type: String }],
    createdAt: { type: Date, default: Date.now },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  },
  { _id: false }
);

GlobalNotificationSchema.index({ expiresAt: 1 });

export const GlobalNotificationModel: Model<IGlobalNotification> =
  mongoose.models.GlobalNotification ||
  mongoose.model<IGlobalNotification>(
    "GlobalNotification",
    GlobalNotificationSchema,
    "globalNotifications"
  );

// ─── NOTICE ───────────────────────────────────────────────────────────────────
export interface INotice extends Omit<Document, '_id'> {
  _id: string;
  title: string;
  message: string;
  priority: "normal" | "important" | "urgent";
  createdAt: Date;
  expiresAt: Date;
}

const NoticeSchema = new Schema<INotice>(
  {
    _id: { type: String, default: generateId },
    title: { type: String, required: true },
    message: { type: String, required: true },
    priority: { type: String, enum: ["normal", "important", "urgent"], default: "normal" },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  { _id: false }
);

export const NoticeModel: Model<INotice> =
  mongoose.models.Notice || mongoose.model<INotice>("Notice", NoticeSchema, "notices");

// ─── PASSWORD RESET TOKEN ─────────────────────────────────────────────────────
export interface IPasswordResetToken extends Omit<Document, '_id'> {
  _id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}

const PasswordResetTokenSchema = new Schema<IPasswordResetToken>(
  {
    _id: { type: String, default: generateId },
    userId: { type: String, required: true },
    token: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    used: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

PasswordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PasswordResetTokenModel: Model<IPasswordResetToken> =
  mongoose.models.PasswordResetToken ||
  mongoose.model<IPasswordResetToken>(
    "PasswordResetToken",
    PasswordResetTokenSchema,
    "passwordResetTokens"
  );

// ─── FCM TOKEN ────────────────────────────────────────────────────────────────
export interface IFcmToken extends Omit<Document, '_id'> {
  _id: string;
  userId: string;
  token: string;
  createdAt: Date;
}

const FcmTokenSchema = new Schema<IFcmToken>(
  {
    _id: { type: String, default: generateId },
    userId: { type: String, required: true },
    token: { type: String, required: true, unique: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

FcmTokenSchema.index({ userId: 1 });

export const FcmTokenModel: Model<IFcmToken> =
  mongoose.models.FcmToken ||
  mongoose.model<IFcmToken>("FcmToken", FcmTokenSchema, "fcmTokens");