import { SEMESTERS } from "../shared/schema.js";
import type {
  User,
  InsertUser,
  Subject,
  InsertSubject,
  Unit,
  InsertUnit,
  StudyMaterial,
  InsertStudyMaterial,
  Quiz,
  InsertQuiz,
  Question,
  InsertQuestion,
  QuizAttempt,
  Notification,
  Semester,
  Notice,
  InsertNotice,
} from "../shared/schema.js";

import {
  UserModel,
  StudentModel,
  SubjectModel,
  UnitModel,
  StudyMaterialModel,
  QuizModel,
  QuestionModel,
  QuizQuestionModel,
  QuizAttemptModel,
  GlobalNotificationModel,
  NoticeModel,
  PasswordResetTokenModel,
  FcmTokenModel,
  type IStudent,
} from "./model/model.js";

// ─── In-Memory Cache ──────────────────────────────────────────────────────────
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class SimpleCache {
  private store = new Map<string, CacheEntry<any>>();

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    this.store.set(key, { data, expiresAt: Date.now() + ttlMs });
  }

  invalidate(...keys: string[]): void {
    keys.forEach((k) => this.store.delete(k));
  }

  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys())
      if (key.startsWith(prefix)) this.store.delete(key);
  }
}

const cache = new SimpleCache();

const TTL = {
  SUBJECTS: 10 * 60_000,
  UNITS: 10 * 60_000,
  MATERIALS: 10 * 60_000,
  SEMESTER_STATS: 5 * 60_000,
  QUIZZES: 5 * 60_000,
  STUDENTS: 3 * 60_000,
  NOTIFICATIONS: 2 * 60_000,
  ADMIN_STATS: 2 * 60_000,
  ANALYTICS: 2 * 60_000,
  USER: 5 * 60_000,
};

// ─── Student Type ─────────────────────────────────────────────────────────────
export interface Student {
  id: string;
  name: string;
  email: string;
  phone: string;
  password: string;
  enrollmentNumber: string;
  status: "pending" | "approved" | "blocked";
  sessionToken?: string | null;
  createdAt: Date | null;
  avatarUrl?: string;
}

// ─── Analytics Types ──────────────────────────────────────────────────────────
export interface QuizAnalytics {
  quizId: string;
  quizTitle: string;
  totalAttempts: number;
  averageScore: number;
  averagePercentage: number;
  highestScore: number;
  lowestScore: number;
  totalQuestions: number;
  leaderboard: Array<{
    rank: number;
    studentId: string;
    studentName: string;
    studentPhoto?: string | null;
    studentEmail: string;
    score: number;
    totalQuestions: number;
    percentage: number;
    timeTaken: number | null;
    submittedAt: Date | null;
  }>;
}

export interface QuestionWithQuizInfo extends Question {
  usedInQuizzes: Array<{
    quizId: string;
    quizTitle: string;
    quizSubjectId: string;
  }>;
}

// ─── IStorage Interface ───────────────────────────────────────────────────────
export interface IStorage {
  getSemesters(): Promise<Semester[]>;
  getSubjects(): Promise<Subject[]>;
  getSubjectById(id: string): Promise<Subject | undefined>;
  getSubjectsBySemester(semesterNumber: number): Promise<Subject[]>;
  createSubject(data: InsertSubject): Promise<Subject>;
  updateSubject(
    id: string,
    data: Partial<InsertSubject>,
  ): Promise<Subject | undefined>;
  deleteSubject(id: string): Promise<void>;
  getUnitsBySubject(subjectId: string): Promise<Unit[]>;
  getUnitById(id: string): Promise<Unit | undefined>;
  createUnit(data: InsertUnit): Promise<Unit>;
  updateUnit(id: string, data: Partial<InsertUnit>): Promise<Unit | undefined>;
  deleteUnit(id: string): Promise<void>;
  getStudyMaterialsByUnit(unitId: string): Promise<StudyMaterial[]>;
  getStudyMaterialById(id: string): Promise<StudyMaterial | undefined>;
  createStudyMaterial(data: InsertStudyMaterial): Promise<StudyMaterial>;
  updateStudyMaterial(
    id: string,
    data: Partial<InsertStudyMaterial>,
  ): Promise<StudyMaterial | undefined>;
  deleteStudyMaterial(id: string): Promise<void>;
  getAllQuizzes(): Promise<Quiz[]>;
  getQuizzesBySubject(subjectId: string): Promise<Quiz[]>;
  getQuizById(id: string): Promise<Quiz | undefined>;
  createQuiz(data: InsertQuiz): Promise<Quiz>;
  updateQuiz(id: string, data: Partial<InsertQuiz>): Promise<Quiz | undefined>;
  deleteQuiz(id: string): Promise<void>;
  getAllQuestions(): Promise<Question[]>;
  getQuestionById(id: string): Promise<Question | undefined>;
  createQuestion(
    data: Omit<InsertQuestion, "quizId" | "order">,
  ): Promise<Question>;
  updateQuestion(
    id: string,
    data: Partial<Omit<InsertQuestion, "quizId">>,
  ): Promise<Question | undefined>;
  deleteQuestion(id: string): Promise<void>;
  getQuestionsByQuiz(quizId: string): Promise<Question[]>;
  addQuestionToQuiz(
    quizId: string,
    questionId: string,
    order?: number,
  ): Promise<void>;
  removeQuestionFromQuiz(quizId: string, questionId: string): Promise<void>;
  reorderQuestionsInQuiz(
    quizId: string,
    orderedQuestionIds: string[],
  ): Promise<void>;
  getAllQuestionsWithQuizInfo(quizId?: string): Promise<QuestionWithQuizInfo[]>;
  createAttempt(
    data: Omit<QuizAttempt, "id" | "submittedAt">,
  ): Promise<QuizAttempt>;
  getAttemptsByUser(userId: string): Promise<(QuizAttempt & { quiz?: Quiz })[]>;
  getAttemptById(id: string): Promise<QuizAttempt | undefined>;
  getUserAttemptForQuiz(
    userId: string,
    quizId: string,
  ): Promise<QuizAttempt | undefined>;
  getQuizAnalytics(quizId: string): Promise<QuizAnalytics>;
  getNotifications(userId: string): Promise<Notification[]>;
  markNotificationRead(id: string, userId: string): Promise<void>;
  markAllNotificationsRead(userId: string): Promise<void>;
  clearAllNotifications(userId: string): Promise<void>;
  notifyAllStudents(
    title: string,
    message: string,
    type: string,
    link?: string | null,
  ): Promise<void>;
  getNotices(): Promise<Notice[]>;
  getActiveNotices(): Promise<Notice[]>;
  getNoticeById(id: string): Promise<Notice | undefined>;
  createNotice(data: InsertNotice): Promise<Notice>;
  updateNotice(
    id: string,
    data: Partial<InsertNotice>,
  ): Promise<Notice | undefined>;
  deleteNotice(id: string): Promise<void>;
  getAllStudentIds(): Promise<string[]>;
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(data: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;
  getAllUsers(): Promise<Omit<User, "password">[]>;
  updateUserSessionToken(id: string, sessionToken: string): Promise<void>;
  updateStudentSessionToken(
    id: string,
    sessionToken: string | null,
  ): Promise<void>;
  createPasswordResetToken(
    userId: string,
    token: string,
    expiresAt: Date,
  ): Promise<void>;
  getPasswordResetToken(token: string): Promise<
    | {
        id: string;
        userId: string;
        token: string;
        expiresAt: Date;
        used: boolean | null;
      }
    | undefined
  >;
  markTokenUsed(token: string): Promise<void>;
  getStudents(): Promise<Omit<Student, "password">[]>;
  getStudentsWithPasswords(): Promise<Student[]>;
  getStudentById(id: string): Promise<Student | undefined>;
  getStudentByEmail(email: string): Promise<Student | undefined>;
  getStudentByPhone(phone: string): Promise<Student | undefined>;
  createStudent(
    data: Omit<Student, "id" | "createdAt">,
    plainPassword?: string,
  ): Promise<Omit<Student, "password">>;
  createStudentsBulk(
    data: Array<Omit<Student, "id" | "createdAt"> & { plainPassword?: string }>,
  ): Promise<{ created: number; skipped: number }>;
  updateStudent(
    id: string,
    data: { name?: string; email?: string; phone?: string },
  ): Promise<Omit<Student, "password">>;
  updateStudentPassword(
    id: string,
    hashedPassword: string,
    plainPassword?: string,
  ): Promise<void>;
  updateStudentStatus(id: string, status: Student["status"]): Promise<void>;
  deleteStudent(id: string): Promise<void>;
  getAdminStats(): Promise<Record<string, number>>;
  getSemesterStats(semesterNumber: number): Promise<{
    subjectCount: number;
    chapterCount: number;
    materialCount: number;
  }>;
  // FCM
  saveFcmToken(userId: string, token: string): Promise<void>;
  removeFcmToken(token: string): Promise<void>;
  getAllFcmTokens(): Promise<string[]>;
}

// ─── MongoDB Implementation ───────────────────────────────────────────────────
export class MongoStorage implements IStorage {
  // ── Semesters ────────────────────────────────────────────────────────────────
  async getSemesters() {
    return SEMESTERS;
  }

  async getSemesterStats(semesterNumber: number) {
    const EXAM_PREP = 5;
    const cacheKey = `semester_stats_${semesterNumber}`;
    const cached = cache.get<{
      subjectCount: number;
      chapterCount: number;
      materialCount: number;
    }>(cacheKey);
    if (cached) return cached;

    const subjects = await this.getSubjectsBySemester(semesterNumber);
    if (subjects.length === 0) {
      const result = { subjectCount: 0, chapterCount: 0, materialCount: 0 };
      cache.set(cacheKey, result, TTL.SEMESTER_STATS);
      return result;
    }

    const subjectIds = subjects.map((s) => s.id);
    const units = await UnitModel.find({
      subjectId: { $in: subjectIds },
    }).lean();
    const unitIds = units.map((u) => String(u._id));

    const materialCount =
      unitIds.length > 0
        ? await StudyMaterialModel.countDocuments({ unitId: { $in: unitIds } })
        : 0;

    const result = {
      subjectCount: subjects.length,
      chapterCount: semesterNumber === EXAM_PREP ? 0 : units.length,
      materialCount,
    };
    cache.set(cacheKey, result, TTL.SEMESTER_STATS);
    return result;
  }

  // ── Subjects ─────────────────────────────────────────────────────────────────
  private docToSubject(doc: any): Subject {
    return {
      id: String(doc._id),
      semesterNumber: doc.semesterNumber,
      name: doc.name,
      description: doc.description || null,
      icon: doc.icon || null,
      color: doc.color || null,
      order: doc.order ?? null,
    };
  }

  async getSubjects() {
    const cached = cache.get<Subject[]>("subjects_all");
    if (cached) return cached;
    const docs = await SubjectModel.find()
      .sort({ semesterNumber: 1, order: 1 })
      .lean();
    const result = docs.map((d) => this.docToSubject(d));
    cache.set("subjects_all", result, TTL.SUBJECTS);
    return result;
  }

  async getSubjectById(id: string) {
    const cached = cache.get<Subject>(`subject_${id}`);
    if (cached) return cached;
    const doc = await SubjectModel.findById(id).lean();
    if (!doc) return undefined;
    const result = this.docToSubject(doc);
    cache.set(`subject_${id}`, result, TTL.SUBJECTS);
    return result;
  }

  async getSubjectsBySemester(semesterNumber: number) {
    const cacheKey = `subjects_sem_${semesterNumber}`;
    const cached = cache.get<Subject[]>(cacheKey);
    if (cached) return cached;
    const docs = await SubjectModel.find({ semesterNumber })
      .sort({ order: 1 })
      .lean();
    const result = docs.map((d) => this.docToSubject(d));
    cache.set(cacheKey, result, TTL.SUBJECTS);
    return result;
  }

  async createSubject(data: InsertSubject) {
    const doc = await SubjectModel.create(data);
    cache.invalidate("subjects_all", `subjects_sem_${data.semesterNumber}`);
    cache.invalidatePrefix("semester_stats_");
    return this.docToSubject(doc.toObject());
  }

  async updateSubject(id: string, data: Partial<InsertSubject>) {
    const doc = await SubjectModel.findByIdAndUpdate(id, data, {
      new: true,
    }).lean();
    if (!doc) return undefined;
    cache.invalidate("subjects_all", `subject_${id}`);
    cache.invalidatePrefix("subjects_sem_");
    cache.invalidatePrefix("semester_stats_");
    return this.docToSubject(doc);
  }

  async deleteSubject(id: string) {
    const units = await UnitModel.find({ subjectId: id }).lean();
    for (const u of units) await this.deleteUnit(String(u._id));
    await SubjectModel.findByIdAndDelete(id);
    cache.invalidate("subjects_all", `subject_${id}`);
    cache.invalidatePrefix("subjects_sem_");
    cache.invalidatePrefix("semester_stats_");
  }

  // ── Units ────────────────────────────────────────────────────────────────────
  private docToUnit(doc: any): Unit {
    return {
      id: String(doc._id),
      subjectId: doc.subjectId,
      title: doc.title,
      description: doc.description || null,
      order: doc.order ?? null,
    };
  }

  async getUnitsBySubject(subjectId: string) {
    const cacheKey = `units_${subjectId}`;
    const cached = cache.get<Unit[]>(cacheKey);
    if (cached) return cached;
    const docs = await UnitModel.find({ subjectId }).sort({ order: 1 }).lean();
    const result = docs.map((d) => this.docToUnit(d));
    cache.set(cacheKey, result, TTL.UNITS);
    return result;
  }

  async getUnitById(id: string) {
    const cached = cache.get<Unit>(`unit_${id}`);
    if (cached) return cached;
    const doc = await UnitModel.findById(id).lean();
    if (!doc) return undefined;
    const result = this.docToUnit(doc);
    cache.set(`unit_${id}`, result, TTL.UNITS);
    return result;
  }

  async createUnit(data: InsertUnit) {
    const doc = await UnitModel.create(data);
    cache.invalidate(`units_${data.subjectId}`);
    cache.invalidatePrefix("semester_stats_");
    return this.docToUnit(doc.toObject());
  }

  async updateUnit(id: string, data: Partial<InsertUnit>) {
    const doc = await UnitModel.findByIdAndUpdate(id, data, {
      new: true,
    }).lean();
    if (!doc) return undefined;
    cache.invalidate(`unit_${id}`, `units_${doc.subjectId}`);
    return this.docToUnit(doc);
  }

  async deleteUnit(id: string) {
    await StudyMaterialModel.deleteMany({ unitId: id });
    await UnitModel.findByIdAndDelete(id);
    cache.invalidate(`unit_${id}`);
    cache.invalidatePrefix("units_");
    cache.invalidatePrefix("materials_");
    cache.invalidatePrefix("semester_stats_");
  }

  // ── Study Materials ───────────────────────────────────────────────────────────
  private docToMaterial(doc: any): StudyMaterial {
    return {
      id: String(doc._id),
      unitId: doc.unitId,
      title: doc.title,
      description: doc.description || null,
      type: doc.type || "pdf",
      url: doc.url,
      fileName: doc.fileName || null,
      fileSize: doc.fileSize || null,
      uploadedAt: doc.uploadedAt || null,
      order: doc.order ?? null,
    };
  }

  async getStudyMaterialsByUnit(unitId: string) {
    const cacheKey = `materials_${unitId}`;
    const cached = cache.get<StudyMaterial[]>(cacheKey);
    if (cached) return cached;
    const docs = await StudyMaterialModel.find({ unitId })
      .sort({ order: 1 })
      .lean();
    const result = docs.map((d) => this.docToMaterial(d));
    cache.set(cacheKey, result, TTL.MATERIALS);
    return result;
  }

  async getStudyMaterialById(id: string) {
    const doc = await StudyMaterialModel.findById(id).lean();
    return doc ? this.docToMaterial(doc) : undefined;
  }

  async createStudyMaterial(data: InsertStudyMaterial) {
    const doc = await StudyMaterialModel.create(data);
    cache.invalidate(`materials_${data.unitId}`);
    cache.invalidatePrefix("semester_stats_");
    return this.docToMaterial(doc.toObject());
  }

  async updateStudyMaterial(id: string, data: Partial<InsertStudyMaterial>) {
    const doc = await StudyMaterialModel.findByIdAndUpdate(id, data, {
      new: true,
    }).lean();
    if (!doc) return undefined;
    cache.invalidate(`materials_${doc.unitId}`);
    return this.docToMaterial(doc);
  }

  async deleteStudyMaterial(id: string) {
    const doc = await StudyMaterialModel.findById(id).lean();
    if (doc) {
      cache.invalidate(`materials_${doc.unitId}`);
      cache.invalidatePrefix("semester_stats_");
    }
    await StudyMaterialModel.findByIdAndDelete(id);
  }

  // ── Quizzes ──────────────────────────────────────────────────────────────────
  private docToQuiz(doc: any): Quiz {
    return {
      id: String(doc._id),
      subjectId: doc.subjectId || "",
      title: doc.title,
      description: doc.description || null,
      duration: doc.duration ?? null,
      totalMarks: doc.totalMarks ?? null,
      isActive: doc.isActive ?? false,
      allowReview: doc.allowReview ?? false,
      createdAt: doc.createdAt || null,
    };
  }

  async getAllQuizzes() {
    const cached = cache.get<Quiz[]>("quizzes_all");
    if (cached) return cached;
    const docs = await QuizModel.find().sort({ createdAt: -1 }).lean();
    const result = docs.map((d) => this.docToQuiz(d));
    cache.set("quizzes_all", result, TTL.QUIZZES);
    return result;
  }

  async getQuizzesBySubject(subjectId: string) {
    const docs = await QuizModel.find({ subjectId }).lean();
    return docs.map((d) => this.docToQuiz(d));
  }

  async getQuizById(id: string) {
    const cached = cache.get<Quiz>(`quiz_${id}`);
    if (cached) return cached;
    const doc = await QuizModel.findById(id).lean();
    if (!doc) return undefined;
    const result = this.docToQuiz(doc);
    cache.set(`quiz_${id}`, result, TTL.QUIZZES);
    return result;
  }

  async createQuiz(data: InsertQuiz) {
    const doc = await QuizModel.create({
      ...data,
      isActive: data.isActive ?? false,
    });
    cache.invalidate("quizzes_all");
    return this.docToQuiz(doc.toObject());
  }

  async updateQuiz(id: string, data: Partial<InsertQuiz>) {
    const doc = await QuizModel.findByIdAndUpdate(id, data, {
      new: true,
    }).lean();
    if (!doc) return undefined;
    cache.invalidate("quizzes_all", `quiz_${id}`);
    return this.docToQuiz(doc);
  }

  async deleteQuiz(id: string) {
    await QuizQuestionModel.deleteMany({ quizId: id });
    await QuizAttemptModel.deleteMany({ quizId: id });
    await QuizModel.findByIdAndDelete(id);
    cache.invalidate("quizzes_all", `quiz_${id}`);
  }

  // ── Questions ────────────────────────────────────────────────────────────────
  private docToQuestion(doc: any): Question {
    return {
      id: String(doc._id),
      quizId: doc.quizId ?? null,
      questionText: doc.questionText,
      options: doc.options || [],
      correctAnswer: doc.correctAnswer,
      explanation: doc.explanation || null,
      marks: doc.marks ?? null,
      order: doc.order ?? null,
      createdAt: doc.createdAt || null,
    };
  }

  async getAllQuestions() {
    const docs = await QuestionModel.find().sort({ createdAt: 1 }).lean();
    return docs.map((d) => this.docToQuestion(d));
  }

  async getQuestionById(id: string) {
    const doc = await QuestionModel.findById(id).lean();
    return doc ? this.docToQuestion(doc) : undefined;
  }

  async createQuestion(data: Omit<InsertQuestion, "quizId" | "order">) {
    const doc = await QuestionModel.create({
      ...data,
      marks: data.marks ?? 1,
      order: 0,
    });
    return this.docToQuestion(doc.toObject());
  }

  async updateQuestion(
    id: string,
    data: Partial<Omit<InsertQuestion, "quizId">>,
  ) {
    const doc = await QuestionModel.findByIdAndUpdate(id, data, {
      new: true,
    }).lean();
    return doc ? this.docToQuestion(doc) : undefined;
  }

  async deleteQuestion(id: string) {
    await QuizQuestionModel.deleteMany({ questionId: id });
    await QuestionModel.findByIdAndDelete(id);
  }

  // ── Quiz ↔ Question join ──────────────────────────────────────────────────────
  async getQuestionsByQuiz(quizId: string) {
    const links = await QuizQuestionModel.find({ quizId })
      .sort({ order: 1 })
      .lean();
    if (links.length === 0) return [];
    const questionIds = links.map((l) => l.questionId);
    const questions = await QuestionModel.find({
      _id: { $in: questionIds },
    }).lean();
    const qMap = new Map(
      questions.map((q) => [String(q._id), this.docToQuestion(q)]),
    );
    return links
      .map((l) => qMap.get(l.questionId))
      .filter((q): q is Question => !!q);
  }

  async addQuestionToQuiz(quizId: string, questionId: string, order?: number) {
    const existing = await QuizQuestionModel.findOne({ quizId, questionId });
    if (existing) return;
    let linkOrder = order;
    if (linkOrder === undefined) {
      const count = await QuizQuestionModel.countDocuments({ quizId });
      linkOrder = count;
    }
    await QuizQuestionModel.create({ quizId, questionId, order: linkOrder });
  }

  async removeQuestionFromQuiz(quizId: string, questionId: string) {
    await QuizQuestionModel.deleteMany({ quizId, questionId });
  }

  async reorderQuestionsInQuiz(quizId: string, orderedQuestionIds: string[]) {
    const ops = orderedQuestionIds.map((questionId, index) =>
      QuizQuestionModel.updateOne({ quizId, questionId }, { order: index }),
    );
    await Promise.all(ops);
  }

  async getAllQuestionsWithQuizInfo(
    quizId?: string,
  ): Promise<QuestionWithQuizInfo[]> {
    const questions = quizId
      ? await this.getQuestionsByQuiz(quizId)
      : await this.getAllQuestions();
    if (questions.length === 0) return [];

    const questionIds = questions.map((q) => q.id);
    const links = await QuizQuestionModel.find({
      questionId: { $in: questionIds },
    }).lean();

    const quizIds = [...new Set(links.map((l) => l.quizId))];
    const quizzes = await QuizModel.find({ _id: { $in: quizIds } }).lean();
    const quizMap = new Map(
      quizzes.map((q) => [String(q._id), this.docToQuiz(q)]),
    );

    const questionToQuizIds = new Map<string, string[]>();
    for (const link of links) {
      const arr = questionToQuizIds.get(link.questionId) ?? [];
      arr.push(link.quizId);
      questionToQuizIds.set(link.questionId, arr);
    }

    return questions.map(
      (q): QuestionWithQuizInfo => ({
        ...q,
        usedInQuizzes: (questionToQuizIds.get(q.id) ?? [])
          .map((qzId) => {
            const quiz = quizMap.get(qzId);
            return quiz
              ? {
                  quizId: qzId,
                  quizTitle: quiz.title,
                  quizSubjectId: quiz.subjectId,
                }
              : null;
          })
          .filter(
            (
              x,
            ): x is {
              quizId: string;
              quizTitle: string;
              quizSubjectId: string;
            } => x !== null,
          ),
      }),
    );
  }

  // ── Attempts ─────────────────────────────────────────────────────────────────
  private docToAttempt(doc: any): QuizAttempt {
    return {
      id: String(doc._id),
      userId: doc.userId,
      quizId: doc.quizId,
      answers: doc.answers || {},
      score: doc.score ?? null,
      totalQuestions: doc.totalQuestions ?? null,
      timeTaken: doc.timeTaken ?? null,
      submittedAt: doc.submittedAt || null,
    };
  }

  // ✅ FIX: null → 0/undefined to match Mongoose schema types
  async createAttempt(data: Omit<QuizAttempt, "id" | "submittedAt">) {
    const doc = await QuizAttemptModel.create({
      quizId: data.quizId,
      userId: data.userId,
      answers: data.answers ?? {},
      score: data.score ?? 0,
      totalQuestions: data.totalQuestions ?? 0,
      timeTaken: data.timeTaken ?? undefined,
      submittedAt: new Date(),
    });
    cache.invalidate(`attempt_${data.userId}_${data.quizId}`);
    return this.docToAttempt(doc.toObject());
  }

  async getAttemptsByUser(userId: string) {
    const docs = await QuizAttemptModel.find({ userId })
      .sort({ submittedAt: -1 })
      .lean();
    const attempts = docs.map((d) => this.docToAttempt(d));
    const quizzes = await Promise.all(
      attempts.map((a) => this.getQuizById(a.quizId)),
    );
    return attempts.map((a, i) => ({ ...a, quiz: quizzes[i] || undefined }));
  }

  async getAttemptById(id: string) {
    const doc = await QuizAttemptModel.findById(id).lean();
    return doc ? this.docToAttempt(doc) : undefined;
  }

  async getUserAttemptForQuiz(userId: string, quizId: string) {
    const cacheKey = `attempt_${userId}_${quizId}`;
    const cached = cache.get<QuizAttempt | null>(cacheKey);
    if (cached !== null && cached !== undefined) return cached;
    if (cached === null) return undefined;

    const doc = await QuizAttemptModel.findOne({ userId, quizId }).lean();
    if (!doc) {
      cache.set(cacheKey, null, 10_000);
      return undefined;
    }
    const attempt = this.docToAttempt(doc);
    cache.set(cacheKey, attempt, 30_000);
    return attempt;
  }

  // ── Analytics ────────────────────────────────────────────────────────────────
  async getQuizAnalytics(quizId: string): Promise<QuizAnalytics> {
    const cacheKey = `analytics_${quizId}`;
    const cached = cache.get<QuizAnalytics>(cacheKey);
    if (cached) return cached;

    const quiz = await this.getQuizById(quizId);
    if (!quiz) throw new Error("Quiz not found");

    const [attemptDocs, questions] = await Promise.all([
      QuizAttemptModel.find({ quizId }).lean(),
      this.getQuestionsByQuiz(quizId),
    ]);
    const attempts = attemptDocs.map((d) => this.docToAttempt(d));
    const totalQuestions = questions.length;

    if (attempts.length === 0) {
      const result: QuizAnalytics = {
        quizId,
        quizTitle: quiz.title,
        totalAttempts: 0,
        averageScore: 0,
        averagePercentage: 0,
        highestScore: 0,
        lowestScore: 0,
        totalQuestions,
        leaderboard: [],
      };
      cache.set(cacheKey, result, TTL.ANALYTICS);
      return result;
    }

    const studentIds = [...new Set(attempts.map((a) => a.userId))];
    const studentDocs = await StudentModel.find({
      _id: { $in: studentIds },
    }).lean();
    const studentMap = new Map(studentDocs.map((s) => [String(s._id), s]));

    const entries = attempts.map((attempt) => {
      const student = studentMap.get(attempt.userId);
      const score = attempt.score ?? 0;
      const total = (attempt.totalQuestions ?? totalQuestions) || 1;
      const percentage = Math.round((score / total) * 100);
      return {
        studentId: attempt.userId,
        studentName: student?.name ?? "Unknown Student",
        studentEmail: student?.email ?? "",
        studentPhoto: (student as any)?.avatarUrl ?? null,
        score,
        totalQuestions: total,
        percentage,
        timeTaken: attempt.timeTaken ?? null,
        submittedAt: attempt.submittedAt,
      };
    });

    entries.sort((a, b) =>
      b.score !== a.score
        ? b.score - a.score
        : (a.timeTaken ?? Infinity) - (b.timeTaken ?? Infinity),
    );

    const scores = entries.map((e) => e.score);
    const result: QuizAnalytics = {
      quizId,
      quizTitle: quiz.title,
      totalAttempts: attempts.length,
      averageScore:
        Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) /
        10,
      averagePercentage: Math.round(
        entries.reduce((a, b) => a + b.percentage, 0) / entries.length,
      ),
      highestScore: Math.max(...scores),
      lowestScore: Math.min(...scores),
      totalQuestions,
      leaderboard: entries.map((e, i) => ({ rank: i + 1, ...e })),
    };

    cache.set(cacheKey, result, TTL.ANALYTICS);
    return result;
  }

  // ── Notifications ─────────────────────────────────────────────────────────────
  // 1. Update docToNotification to include link
  private docToNotification(doc: any, userId: string): Notification {
    return {
      id: String(doc._id),
      userId,
      title: doc.title,
      message: doc.message,
      type: doc.type || "info",
      read: (doc.readBy ?? []).includes(userId),
      createdAt: doc.createdAt || null,
      link: doc.link ?? null, // ✅ add this
    };
  }

  // 2. Update notifyAllStudents signature
  async notifyAllStudents(
    title: string,
    message: string,
    type: string,
    link?: string | null,
  ) {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await GlobalNotificationModel.create({
      title,
      message,
      type,
      readBy: [],
      clearedBy: [],
      expiresAt,
      link: link ?? null, // ✅ add this
    });
    cache.invalidatePrefix("notifications_");
  }

  async markAllNotificationsRead(userId: string) {
    await GlobalNotificationModel.updateMany(
      { clearedBy: { $ne: userId } },
      { $addToSet: { readBy: userId } },
    );
    cache.invalidate(`notifications_${userId}`);
  }

  async clearAllNotifications(userId: string) {
    await GlobalNotificationModel.updateMany(
      {},
      { $addToSet: { clearedBy: userId, readBy: userId } },
    );
    cache.invalidate(`notifications_${userId}`);
  }

  // ── Notices ───────────────────────────────────────────────────────────────────
  private docToNotice(doc: any): Notice {
    return {
      id: String(doc._id),
      title: doc.title,
      message: doc.message,
      priority: doc.priority || "normal",
      createdAt: doc.createdAt || null,
      expiresAt: doc.expiresAt || null,
      link: doc.link ?? null, // ✅ add this
    };
  }

  async getNotices() {
    const docs = await NoticeModel.find().sort({ createdAt: -1 }).lean();
    return docs.map((d) => this.docToNotice(d));
  }

  async getNotifications(userId: string) {
    const cacheKey = `notifications_${userId}`;
    const cached = cache.get<Notification[]>(cacheKey);
    if (cached) return cached;

    const docs = await GlobalNotificationModel.find({
      clearedBy: { $ne: userId },
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const result = docs.map((d) => this.docToNotification(d, userId));
    cache.set(cacheKey, result, TTL.NOTIFICATIONS);
    return result;
  }

  async markNotificationRead(id: string, userId: string) {
    await GlobalNotificationModel.findByIdAndUpdate(id, {
      $addToSet: { readBy: userId },
    });
    cache.invalidate(`notifications_${userId}`);
  }

  async getActiveNotices() {
    const now = new Date();
    const docs = await NoticeModel.find({ expiresAt: { $gt: now } }).lean();
    const priorityOrder: Record<string, number> = {
      urgent: 0,
      important: 1,
      normal: 2,
    };
    return docs
      .map((d) => this.docToNotice(d))
      .sort((a, b) => {
        const pa = priorityOrder[a.priority] ?? 2;
        const pb = priorityOrder[b.priority] ?? 2;
        if (pa !== pb) return pa - pb;
        return (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0);
      });
  }

  async getNoticeById(id: string) {
    const doc = await NoticeModel.findById(id).lean();
    return doc ? this.docToNotice(doc) : undefined;
  }

  async createNotice(data: InsertNotice) {
    const doc = await NoticeModel.create(data);
    return this.docToNotice(doc.toObject());
  }

  async updateNotice(id: string, data: Partial<InsertNotice>) {
    const doc = await NoticeModel.findByIdAndUpdate(id, data, {
      new: true,
    }).lean();
    return doc ? this.docToNotice(doc) : undefined;
  }

  async deleteNotice(id: string) {
    await NoticeModel.findByIdAndDelete(id);
  }

  // ── FCM Tokens ────────────────────────────────────────────────────────────────
  async getAllStudentIds() {
    const docs = await StudentModel.find({ status: "approved" }, "_id").lean();
    return docs.map((d) => String(d._id));
  }

  async saveFcmToken(userId: string, token: string) {
    await FcmTokenModel.updateOne(
      { token },
      { userId, token },
      { upsert: true },
    );
  }

  async removeFcmToken(token: string) {
    await FcmTokenModel.deleteOne({ token });
  }

  async getAllFcmTokens() {
    const docs = await FcmTokenModel.find().lean();
    return docs.map((d) => d.token);
  }

  // ── Users ────────────────────────────────────────────────────────────────────
  private docToUser(doc: any): User {
    return {
      id: String(doc._id),
      username: doc.username,
      email: doc.email,
      password: doc.password,
      displayName: doc.displayName || null,
      avatarUrl: doc.avatarUrl || null,
      darkMode: doc.darkMode ?? false,
      phone: doc.phone || null,
      createdAt: doc.createdAt || null,
      sessionToken: doc.sessionToken || null,
    } as any;
  }

  async getUser(id: string) {
    const cacheKey = `user_${id}`;
    const cached = cache.get<User>(cacheKey);
    if (cached) return cached;
    const doc = await UserModel.findById(id).lean();
    if (!doc) return undefined;
    const result = this.docToUser(doc);
    cache.set(cacheKey, result, TTL.USER);
    return result;
  }

  async getUserByEmail(email: string) {
    const doc = await UserModel.findOne({ email: email.toLowerCase() }).lean();
    return doc ? this.docToUser(doc) : undefined;
  }

  async getUserByUsername(username: string) {
    const doc = await UserModel.findOne({ username }).lean();
    return doc ? this.docToUser(doc) : undefined;
  }

  async createUser(data: InsertUser) {
    const doc = await UserModel.create(data);
    return this.docToUser(doc.toObject());
  }

  async updateUser(id: string, data: Partial<User>) {
    const { id: _, ...updateData } = data as any;
    const doc = await UserModel.findByIdAndUpdate(id, updateData, {
      new: true,
    }).lean();
    if (!doc) return undefined;
    cache.invalidate(`user_${id}`);
    return this.docToUser(doc);
  }

  async deleteUser(id: string) {
    await Promise.all([
      QuizAttemptModel.deleteMany({ userId: id }),
      PasswordResetTokenModel.deleteMany({ userId: id }),
      UserModel.findByIdAndDelete(id),
    ]);
    cache.invalidate(`user_${id}`);
  }

  async getAllUsers() {
    const docs = await UserModel.find().sort({ createdAt: -1 }).lean();
    return docs.map((doc) => ({
      id: String(doc._id),
      username: doc.username,
      email: doc.email,
      phone: doc.phone || null,
      displayName: doc.displayName || null,
      avatarUrl: doc.avatarUrl || null,
      darkMode: doc.darkMode ?? null,
      createdAt: doc.createdAt || null,
    }));
  }

  async updateUserSessionToken(id: string, sessionToken: string) {
    await UserModel.findByIdAndUpdate(id, { sessionToken });
    cache.invalidate(`user_${id}`);
  }

  async updateStudentSessionToken(id: string, sessionToken: string | null) {
    await StudentModel.findByIdAndUpdate(id, { sessionToken });
    cache.invalidate(`student_${id}`);
  }

  // ── Password Reset ────────────────────────────────────────────────────────────
  async createPasswordResetToken(
    userId: string,
    token: string,
    expiresAt: Date,
  ) {
    await PasswordResetTokenModel.deleteMany({ userId, used: false });
    await PasswordResetTokenModel.create({
      userId,
      token,
      expiresAt,
      used: false,
    });
  }

  async getPasswordResetToken(token: string) {
    const doc = await PasswordResetTokenModel.findOne({ token }).lean();
    if (!doc) return undefined;
    return {
      id: String(doc._id),
      userId: doc.userId,
      token: doc.token,
      expiresAt: doc.expiresAt,
      used: doc.used ?? null,
    };
  }

  async markTokenUsed(token: string) {
    await PasswordResetTokenModel.updateOne({ token }, { used: true });
  }

  // ── Students ──────────────────────────────────────────────────────────────────
  private docToStudent(doc: any): Student {
    return {
      id: String(doc._id),
      name: doc.name || "",
      email: doc.email || "",
      phone: doc.phone || "",
      password: doc.password || "",
      enrollmentNumber: doc.enrollmentNumber || "",
      status: doc.status || "pending",
      sessionToken: doc.sessionToken || null,
      createdAt: doc.createdAt || null,
      avatarUrl: doc.avatarUrl || null,
    };
  }
  async getStudents() {
    const cached = cache.get<Omit<Student, "password">[]>("students_list");
    if (cached) return cached;
    const docs = await StudentModel.find().sort({ createdAt: -1 }).lean();
    const result = docs.map((d) => {
      const { password, sessionToken, ...rest } = this.docToStudent(d);
      return rest;
    });
    cache.set("students_list", result, TTL.STUDENTS);
    return result;
  }

  async getStudentsWithPasswords() {
    const docs = await StudentModel.find().sort({ createdAt: -1 }).lean();
    return docs.map((d) => ({
      id: String(d._id),
      name: d.name || "",
      email: d.email || "",
      phone: d.phone && !String(d.phone).includes("@") ? String(d.phone) : "",
      password: (d as any).plainPassword || "",
      enrollmentNumber: d.enrollmentNumber || "",
      status: (d.status || "pending") as Student["status"],
      sessionToken: d.sessionToken || null,
      createdAt: d.createdAt || null,
    }));
  }

  async getStudentById(id: string) {
    const cacheKey = `student_${id}`;
    const cached = cache.get<Student>(cacheKey);
    if (cached) return cached;
    const doc = await StudentModel.findById(id).lean();
    if (!doc) return undefined;
    const result = this.docToStudent(doc);
    if (result.status !== "blocked") cache.set(cacheKey, result, TTL.STUDENTS);
    return result;
  }

  async getStudentByEmail(email: string) {
    if (!email) return undefined;
    const doc = await StudentModel.findOne({
      email: email.toLowerCase(),
    }).lean();
    return doc ? this.docToStudent(doc) : undefined;
  }

  async getStudentByPhone(phone: string) {
    if (!phone) return undefined;
    const doc = await StudentModel.findOne({ phone }).lean();
    return doc ? this.docToStudent(doc) : undefined;
  }

  async createStudent(
    data: Omit<Student, "id" | "createdAt">,
    plainPassword?: string,
  ) {
    const doc = await StudentModel.create({
      ...data,
      ...(plainPassword ? { plainPassword } : {}),
    });
    cache.invalidate("students_list");
    const { password, sessionToken, ...rest } = this.docToStudent(
      doc.toObject(),
    );
    return rest;
  }

  async createStudentsBulk(
    data: Array<Omit<Student, "id" | "createdAt"> & { plainPassword?: string }>,
  ) {
    let created = 0,
      skipped = 0;
    for (const s of data) {
      const [byEmail, byPhone] = await Promise.all([
        s.email ? this.getStudentByEmail(s.email) : Promise.resolve(undefined),
        s.phone ? this.getStudentByPhone(s.phone) : Promise.resolve(undefined),
      ]);
      if (byEmail || byPhone) {
        skipped++;
        continue;
      }
      const { plainPassword, ...studentData } = s;
      await this.createStudent(studentData, plainPassword);
      created++;
    }
    cache.invalidate("students_list");
    return { created, skipped };
  }

  async updateStudent(id: string, data: Partial<IStudent>) {
    const doc = await StudentModel.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true },
    ).lean();

    if (!doc) throw new Error("Student not found");

    cache.invalidate("students_list", `student_${id}`);

    const { password, sessionToken, ...rest } = this.docToStudent(doc);
    return rest;
  }

  async updateStudentPassword(
    id: string,
    hashedPassword: string,
    plainPassword?: string,
  ) {
    const update: any = { password: hashedPassword };
    if (plainPassword) update.plainPassword = plainPassword;
    await StudentModel.findByIdAndUpdate(id, update);
    cache.invalidate(`student_${id}`);
  }

  async updateStudentStatus(id: string, status: Student["status"]) {
    await StudentModel.findByIdAndUpdate(id, { status });
    cache.invalidate("students_list", `student_${id}`);
    if (status === "blocked") cache.invalidatePrefix(`attempt_${id}_`);
  }

  async deleteStudent(id: string) {
    await StudentModel.findByIdAndDelete(id);
    cache.invalidate("students_list", `student_${id}`);
    cache.invalidatePrefix(`attempt_${id}_`);
  }

  // ── Admin Stats ───────────────────────────────────────────────────────────────
  async getAdminStats() {
    const cached = cache.get<Record<string, number>>("admin_stats");
    if (cached) return cached;

    const [
      users,
      subjects,
      chapters,
      quizzes,
      questions,
      materials,
      attempts,
      students,
      notices,
      allQuizzes,
    ] = await Promise.all([
      UserModel.countDocuments(),
      SubjectModel.countDocuments(),
      UnitModel.countDocuments(),
      QuizModel.countDocuments(),
      QuestionModel.countDocuments(),
      StudyMaterialModel.countDocuments(),
      QuizAttemptModel.countDocuments(),
      StudentModel.countDocuments(),
      NoticeModel.countDocuments(),
      this.getAllQuizzes(),
    ]);

    const result = {
      users,
      subjects,
      chapters,
      quizzes,
      questions,
      materials,
      attempts,
      students,
      notices,
      activeQuizzes: allQuizzes.filter((q) => q.isActive).length,
      totalQuizTime: allQuizzes.reduce((sum, q) => sum + (q.duration || 0), 0),
    };

    cache.set("admin_stats", result, TTL.ADMIN_STATS);
    return result;
  }
}

export const storage = new MongoStorage();
