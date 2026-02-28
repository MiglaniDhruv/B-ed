import { getFirestore } from "./firebase.js";
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function generateId(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 20; i++)
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

function toDate(val: any): Date | null {
  if (!val) return null;
  if (val.toDate) return val.toDate();
  if (val instanceof Date) return val;
  return new Date(val);
}

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
    studentEmail: string;
    score: number;
    totalQuestions: number;
    percentage: number;
    timeTaken: number | null;
    submittedAt: Date | null;
  }>;
}

// ─── Shared-question types ────────────────────────────────────────────────────
export interface QuestionWithQuizInfo extends Question {
  usedInQuizzes: Array<{
    quizId: string;
    quizTitle: string;
    quizSubjectId: string;
  }>;
}

export interface QuizQuestionLink {
  id: string;
  quizId: string;
  questionId: string;
  order: number;
}

// ─── Interface ────────────────────────────────────────────────────────────────
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

  // ── Notifications ──────────────────────────────────────────────────────────
  getNotifications(userId: string): Promise<Notification[]>;
  markNotificationRead(id: string): Promise<void>;
  markAllNotificationsRead(userId: string): Promise<void>;
  clearAllNotifications(userId: string): Promise<void>;
  // Send in-app notification to all approved students
  notifyAllStudents(
    title: string,
    message: string,
    type: string,
  ): Promise<void>;

  // ── Notice Board ───────────────────────────────────────────────────────────
  getNotices(): Promise<Notice[]>; // all (for admin)
  getActiveNotices(): Promise<Notice[]>; // non-expired (for students)
  getNoticeById(id: string): Promise<Notice | undefined>;
  createNotice(data: InsertNotice): Promise<Notice>;
  updateNotice(
    id: string,
    data: Partial<InsertNotice>,
  ): Promise<Notice | undefined>;
  deleteNotice(id: string): Promise<void>;

  // ── FCM Tokens ─────────────────────────────────────────────────────────────
  getAllStudentIds(): Promise<string[]>;

  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(data: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;
  getAllUsers(): Promise<Omit<User, "password">[]>;

  updateUserSessionToken(id: string, sessionToken: string): Promise<void>;
  updateStudentSessionToken(id: string, sessionToken: string): Promise<void>;

  createPasswordResetToken(
    userId: string,
    token: string,
    expiresAt: Date,
  ): Promise<void>;
  getPasswordResetToken(
    token: string,
  ): Promise<
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
  getSemesterStats(
    semesterNumber: number,
  ): Promise<{
    subjectCount: number;
    chapterCount: number;
    materialCount: number;
  }>;
}

// ─── Firestore Implementation ─────────────────────────────────────────────────
export class FirestoreStorage implements IStorage {
  private get db() {
    return getFirestore();
  }

  // ── Doc mappers ───────────────────────────────────────────────────────────────
  private docToUser(id: string, data: any): User {
    return {
      id,
      username: data.username,
      email: data.email,
      password: data.password,
      phone: data.phone || null,
      displayName: data.displayName || null,
      avatarUrl: data.avatarUrl || null,
      darkMode: data.darkMode ?? null,
      createdAt: toDate(data.createdAt),
      sessionToken: data.sessionToken || null,
    } as any;
  }
  private docToSubject(id: string, data: any): Subject {
    return {
      id,
      semesterNumber: data.semesterNumber,
      name: data.name,
      description: data.description || null,
      icon: data.icon || null,
      color: data.color || null,
      order: data.order ?? null,
    };
  }
  private docToUnit(id: string, data: any): Unit {
    return {
      id,
      subjectId: data.subjectId,
      title: data.title,
      description: data.description || null,
      order: data.order ?? null,
    };
  }
  private docToMaterial(id: string, data: any): StudyMaterial {
    return {
      id,
      unitId: data.unitId,
      title: data.title,
      description: data.description || null,
      type: data.type || "pdf",
      url: data.url,
      fileName: data.fileName || null,
      fileSize: data.fileSize || null,
      uploadedAt: toDate(data.uploadedAt),
      order: data.order ?? null,
    };
  }
  private docToQuiz(id: string, data: any): Quiz {
    return {
      id,
      subjectId: data.subjectId,
      title: data.title,
      description: data.description || null,
      duration: data.duration ?? null,
      totalMarks: data.totalMarks ?? null,
      isActive: data.isActive ?? null,
      allowReview: data.allowReview ?? false,
      createdAt: toDate(data.createdAt),
    };
  }
  private docToQuestion(id: string, data: any): Question {
    return {
      id,
      quizId: data.quizId ?? null,
      questionText: data.questionText,
      options: data.options,
      correctAnswer: data.correctAnswer,
      explanation: data.explanation || null,
      marks: data.marks ?? null,
      order: data.order ?? null,
    };
  }
  private docToAttempt(id: string, data: any): QuizAttempt {
    return {
      id,
      userId: data.userId,
      quizId: data.quizId,
      answers: data.answers || {},
      score: data.score ?? null,
      totalQuestions: data.totalQuestions ?? null,
      timeTaken: data.timeTaken ?? null,
      submittedAt: toDate(data.submittedAt),
    };
  }
  private docToNotification(id: string, data: any): Notification {
    return {
      id,
      userId: data.userId,
      title: data.title,
      message: data.message,
      type: data.type || "info",
      read: data.read ?? null,
      createdAt: toDate(data.createdAt),
    };
  }
  private docToStudent(id: string, data: any): Student {
    return {
      id,
      name: data.name || "",
      email: data.email || "",
      phone: data.phone || "",
      password: data.password || "",
      enrollmentNumber: data.enrollmentNumber || "",
      status: data.status || "pending",
      sessionToken: data.sessionToken || null,
      createdAt: toDate(data.createdAt),
    };
  }
  private docToLink(id: string, data: any): QuizQuestionLink {
    return {
      id,
      quizId: data.quizId,
      questionId: data.questionId,
      order: data.order ?? 0,
    };
  }
  private docToNotice(id: string, data: any): Notice {
    return {
      id,
      title: data.title,
      message: data.message,
      priority: data.priority || "normal",
      createdAt: toDate(data.createdAt),
      expiresAt: toDate(data.expiresAt),
    };
  }

  // ── Semesters ─────────────────────────────────────────────────────────────────
  async getSemesters() {
    return SEMESTERS;
  }

  async getSemesterStats(
    semesterNumber: number,
  ): Promise<{
    subjectCount: number;
    chapterCount: number;
    materialCount: number;
  }> {
    const subjects = await this.getSubjectsBySemester(semesterNumber);
    if (subjects.length === 0)
      return { subjectCount: 0, chapterCount: 0, materialCount: 0 };
    let chapterCount = 0;
    let materialCount = 0;
    for (const subject of subjects) {
      const units = await this.getUnitsBySubject(subject.id);
      chapterCount += units.length;
      for (const unit of units) {
        const mats = await this.db
          .collection("studyMaterials")
          .where("unitId", "==", unit.id)
          .count()
          .get();
        materialCount += mats.data().count;
      }
    }
    return { subjectCount: subjects.length, chapterCount, materialCount };
  }

  // ── Subjects ──────────────────────────────────────────────────────────────────
  async getSubjects() {
    const snap = await this.db.collection("subjects").get();
    return snap.docs
      .map((d) => this.docToSubject(d.id, d.data()))
      .sort(
        (a, b) =>
          a.semesterNumber - b.semesterNumber ||
          (a.order ?? 0) - (b.order ?? 0),
      );
  }
  async getSubjectById(id: string) {
    const doc = await this.db.collection("subjects").doc(id).get();
    return doc.exists ? this.docToSubject(doc.id, doc.data()) : undefined;
  }
  async getSubjectsBySemester(semesterNumber: number) {
    const snap = await this.db
      .collection("subjects")
      .where("semesterNumber", "==", semesterNumber)
      .get();
    return snap.docs
      .map((d) => this.docToSubject(d.id, d.data()))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }
  async createSubject(data: InsertSubject) {
    const id = generateId();
    const doc: any = {
      semesterNumber: data.semesterNumber,
      name: data.name,
      order: data.order ?? 0,
    };
    if (data.description) doc.description = data.description;
    if (data.icon) doc.icon = data.icon;
    if (data.color) doc.color = data.color;
    await this.db.collection("subjects").doc(id).set(doc);
    return this.docToSubject(id, doc);
  }
  async updateSubject(id: string, data: Partial<InsertSubject>) {
    const ref = this.db.collection("subjects").doc(id);
    if (!(await ref.get()).exists) return undefined;
    await ref.update(data as any);
    return this.docToSubject(id, (await ref.get()).data());
  }
  async deleteSubject(id: string) {
    const units = await this.db
      .collection("units")
      .where("subjectId", "==", id)
      .get();
    for (const u of units.docs) await this.deleteUnit(u.id);
    await this.db.collection("subjects").doc(id).delete();
  }

  // ── Units ─────────────────────────────────────────────────────────────────────
  async getUnitsBySubject(subjectId: string) {
    const snap = await this.db
      .collection("units")
      .where("subjectId", "==", subjectId)
      .get();
    return snap.docs
      .map((d) => this.docToUnit(d.id, d.data()))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }
  async getUnitById(id: string) {
    const doc = await this.db.collection("units").doc(id).get();
    return doc.exists ? this.docToUnit(doc.id, doc.data()) : undefined;
  }
  async createUnit(data: InsertUnit) {
    const id = generateId();
    const doc: any = {
      subjectId: data.subjectId,
      title: data.title,
      order: data.order ?? 0,
    };
    if (data.description) doc.description = data.description;
    await this.db.collection("units").doc(id).set(doc);
    return this.docToUnit(id, doc);
  }
  async updateUnit(id: string, data: Partial<InsertUnit>) {
    const ref = this.db.collection("units").doc(id);
    if (!(await ref.get()).exists) return undefined;
    await ref.update(data as any);
    return this.docToUnit(id, (await ref.get()).data());
  }
  async deleteUnit(id: string) {
    const mats = await this.db
      .collection("studyMaterials")
      .where("unitId", "==", id)
      .get();
    const batch = this.db.batch();
    mats.docs.forEach((d) => batch.delete(d.ref));
    if (!mats.empty) await batch.commit();
    await this.db.collection("units").doc(id).delete();
  }

  // ── Study Materials ───────────────────────────────────────────────────────────
  async getStudyMaterialsByUnit(unitId: string) {
    const snap = await this.db
      .collection("studyMaterials")
      .where("unitId", "==", unitId)
      .get();
    return snap.docs
      .map((d) => this.docToMaterial(d.id, d.data()))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }
  async getStudyMaterialById(id: string) {
    const doc = await this.db.collection("studyMaterials").doc(id).get();
    return doc.exists ? this.docToMaterial(doc.id, doc.data()) : undefined;
  }
  async createStudyMaterial(data: InsertStudyMaterial) {
    const id = generateId();
    const now = new Date();
    const doc: any = {
      unitId: data.unitId,
      title: data.title,
      type: data.type,
      url: data.url,
      uploadedAt: now,
      order: data.order ?? 0,
    };
    if (data.description) doc.description = data.description;
    if (data.fileName) doc.fileName = data.fileName;
    if (data.fileSize) doc.fileSize = data.fileSize;
    await this.db.collection("studyMaterials").doc(id).set(doc);
    return this.docToMaterial(id, doc);
  }
  async updateStudyMaterial(id: string, data: Partial<InsertStudyMaterial>) {
    const ref = this.db.collection("studyMaterials").doc(id);
    if (!(await ref.get()).exists) return undefined;
    await ref.update(data as any);
    return this.docToMaterial(id, (await ref.get()).data());
  }
  async deleteStudyMaterial(id: string) {
    await this.db.collection("studyMaterials").doc(id).delete();
  }

  // ── Quizzes ───────────────────────────────────────────────────────────────────
  async getAllQuizzes() {
    const snap = await this.db
      .collection("quizzes")
      .orderBy("createdAt", "desc")
      .get();
    return snap.docs.map((d) => this.docToQuiz(d.id, d.data()));
  }
  async getQuizzesBySubject(subjectId: string) {
    const snap = await this.db
      .collection("quizzes")
      .where("subjectId", "==", subjectId)
      .get();
    return snap.docs.map((d) => this.docToQuiz(d.id, d.data()));
  }
  async getQuizById(id: string) {
    const doc = await this.db.collection("quizzes").doc(id).get();
    return doc.exists ? this.docToQuiz(doc.id, doc.data()) : undefined;
  }
  async createQuiz(data: InsertQuiz) {
    const id = generateId();
    const now = new Date();
    const doc: any = {
      subjectId: data.subjectId ?? "",
      title: data.title,
      isActive: data.isActive ?? true,
      allowReview: data.allowReview ?? false, 
      createdAt: now,
    };
    if (data.description) doc.description = data.description;
    if (data.duration) doc.duration = data.duration;
    if (data.totalMarks) doc.totalMarks = data.totalMarks;
    await this.db.collection("quizzes").doc(id).set(doc);
    return this.docToQuiz(id, doc);
  }
  async updateQuiz(id: string, data: Partial<InsertQuiz>) {
    const ref = this.db.collection("quizzes").doc(id);
    if (!(await ref.get()).exists) return undefined;
    await ref.update(data as any);
    return this.docToQuiz(id, (await ref.get()).data());
  }
  async deleteQuiz(id: string) {
    const links = await this.db
      .collection("quizQuestions")
      .where("quizId", "==", id)
      .get();
    const b1 = this.db.batch();
    links.docs.forEach((d) => b1.delete(d.ref));
    if (!links.empty) await b1.commit();
    const attempts = await this.db
      .collection("quizAttempts")
      .where("quizId", "==", id)
      .get();
    const b2 = this.db.batch();
    attempts.docs.forEach((d) => b2.delete(d.ref));
    if (!attempts.empty) await b2.commit();
    await this.db.collection("quizzes").doc(id).delete();
  }

  // ── Bank-level Question CRUD ──────────────────────────────────────────────────
  async getAllQuestions(): Promise<Question[]> {
    const snap = await this.db.collection("questions").get();
    return snap.docs
      .map((d) => this.docToQuestion(d.id, d.data()))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }
  async getQuestionById(id: string): Promise<Question | undefined> {
    const doc = await this.db.collection("questions").doc(id).get();
    return doc.exists ? this.docToQuestion(doc.id, doc.data()) : undefined;
  }
  async createQuestion(
    data: Omit<InsertQuestion, "quizId" | "order">,
  ): Promise<Question> {
    const id = generateId();
    const doc: any = {
      questionText: data.questionText,
      options: data.options,
      correctAnswer: data.correctAnswer,
      marks: data.marks ?? 1,
      order: 0,
    };
    if (data.explanation) doc.explanation = data.explanation;
    await this.db.collection("questions").doc(id).set(doc);
    return this.docToQuestion(id, doc);
  }
  async updateQuestion(
    id: string,
    data: Partial<Omit<InsertQuestion, "quizId">>,
  ): Promise<Question | undefined> {
    const ref = this.db.collection("questions").doc(id);
    if (!(await ref.get()).exists) return undefined;
    await ref.update(data as any);
    return this.docToQuestion(id, (await ref.get()).data());
  }
  async deleteQuestion(id: string): Promise<void> {
    const links = await this.db
      .collection("quizQuestions")
      .where("questionId", "==", id)
      .get();
    const batch = this.db.batch();
    links.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(this.db.collection("questions").doc(id));
    await batch.commit();
  }

  // ── Quiz ↔ Question join ──────────────────────────────────────────────────────
  async getQuestionsByQuiz(quizId: string): Promise<Question[]> {
    const linksSnap = await this.db
      .collection("quizQuestions")
      .where("quizId", "==", quizId)
      .get();
    if (linksSnap.empty) return [];
    const links = linksSnap.docs
      .map((d) => this.docToLink(d.id, d.data()))
      .sort((a, b) => a.order - b.order);
    const questions = await this.fetchQuestionsByIds(
      links.map((l) => l.questionId),
    );
    return links
      .map((link) => questions.find((q) => q.id === link.questionId))
      .filter((q): q is Question => !!q);
  }
  async addQuestionToQuiz(
    quizId: string,
    questionId: string,
    order?: number,
  ): Promise<void> {
    const existing = await this.db
      .collection("quizQuestions")
      .where("quizId", "==", quizId)
      .where("questionId", "==", questionId)
      .limit(1)
      .get();
    if (!existing.empty) return;
    let linkOrder = order;
    if (linkOrder === undefined) {
      const allLinks = await this.db
        .collection("quizQuestions")
        .where("quizId", "==", quizId)
        .get();
      linkOrder = allLinks.empty
        ? 0
        : Math.max(
            ...allLinks.docs.map((d) => (d.data().order as number) ?? 0),
          ) + 1;
    }
    await this.db
      .collection("quizQuestions")
      .doc(generateId())
      .set({ quizId, questionId, order: linkOrder });
  }
  async removeQuestionFromQuiz(
    quizId: string,
    questionId: string,
  ): Promise<void> {
    const snap = await this.db
      .collection("quizQuestions")
      .where("quizId", "==", quizId)
      .where("questionId", "==", questionId)
      .get();
    const batch = this.db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    if (!snap.empty) await batch.commit();
  }
  async reorderQuestionsInQuiz(
    quizId: string,
    orderedQuestionIds: string[],
  ): Promise<void> {
    const linksSnap = await this.db
      .collection("quizQuestions")
      .where("quizId", "==", quizId)
      .get();
    const linkByQuestionId = new Map(
      linksSnap.docs.map((d) => [d.data().questionId as string, d.ref]),
    );
    const batch = this.db.batch();
    orderedQuestionIds.forEach((questionId, index) => {
      const ref = linkByQuestionId.get(questionId);
      if (ref) batch.update(ref, { order: index });
    });
    await batch.commit();
  }
  async getAllQuestionsWithQuizInfo(
    quizId?: string,
  ): Promise<QuestionWithQuizInfo[]> {
    const questions = quizId
      ? await this.getQuestionsByQuiz(quizId)
      : await this.getAllQuestions();
    if (questions.length === 0) return [];
    const questionIds = questions.map((q) => q.id);
    const allLinks: QuizQuestionLink[] = [];
    for (let i = 0; i < questionIds.length; i += 30) {
      const snap = await this.db
        .collection("quizQuestions")
        .where("questionId", "in", questionIds.slice(i, i + 30))
        .get();
      snap.docs.forEach((d) => allLinks.push(this.docToLink(d.id, d.data())));
    }
    const questionToQuizIds = new Map<string, string[]>();
    for (const link of allLinks) {
      const arr = questionToQuizIds.get(link.questionId) ?? [];
      arr.push(link.quizId);
      questionToQuizIds.set(link.questionId, arr);
    }
    const uniqueQuizIds = [...new Set(allLinks.map((l) => l.quizId))];
    const quizMap = new Map<string, Quiz>();
    for (let i = 0; i < uniqueQuizIds.length; i += 30) {
      const snap = await this.db
        .collection("quizzes")
        .where("__name__", "in", uniqueQuizIds.slice(i, i + 30))
        .get();
      snap.docs.forEach((d) =>
        quizMap.set(d.id, this.docToQuiz(d.id, d.data())),
      );
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

  private async fetchQuestionsByIds(ids: string[]): Promise<Question[]> {
    const results: Question[] = [];
    for (let i = 0; i < ids.length; i += 30) {
      const snap = await this.db
        .collection("questions")
        .where("__name__", "in", ids.slice(i, i + 30))
        .get();
      snap.docs.forEach((d) =>
        results.push(this.docToQuestion(d.id, d.data())),
      );
    }
    return results;
  }

  // ── Quiz Attempts ─────────────────────────────────────────────────────────────
  async createAttempt(data: Omit<QuizAttempt, "id" | "submittedAt">) {
    const id = generateId();
    const doc = { ...data, submittedAt: new Date() };
    await this.db.collection("quizAttempts").doc(id).set(doc);
    return this.docToAttempt(id, doc);
  }
  async getAttemptsByUser(userId: string) {
    const snap = await this.db
      .collection("quizAttempts")
      .where("userId", "==", userId)
      .get();
    const attempts = snap.docs
      .map((d) => this.docToAttempt(d.id, d.data()))
      .sort(
        (a, b) =>
          (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0),
      );
    const results = [];
    for (const a of attempts) {
      const quiz = await this.getQuizById(a.quizId);
      results.push({ ...a, quiz: quiz || undefined });
    }
    return results;
  }
  async getAttemptById(id: string) {
    const doc = await this.db.collection("quizAttempts").doc(id).get();
    return doc.exists ? this.docToAttempt(doc.id, doc.data()) : undefined;
  }
  async getUserAttemptForQuiz(userId: string, quizId: string) {
    const snap = await this.db
      .collection("quizAttempts")
      .where("userId", "==", userId)
      .where("quizId", "==", quizId)
      .limit(1)
      .get();
    return snap.empty
      ? undefined
      : this.docToAttempt(snap.docs[0].id, snap.docs[0].data());
  }

  // ── Quiz Analytics ────────────────────────────────────────────────────────────
  async getQuizAnalytics(quizId: string): Promise<QuizAnalytics> {
    const quiz = await this.getQuizById(quizId);
    if (!quiz) throw new Error("Quiz not found");
    const attemptsSnap = await this.db
      .collection("quizAttempts")
      .where("quizId", "==", quizId)
      .get();
    const attempts = attemptsSnap.docs.map((d) =>
      this.docToAttempt(d.id, d.data()),
    );
    const questions = await this.getQuestionsByQuiz(quizId);
    const totalQuestions = questions.length;
    if (attempts.length === 0) {
      return {
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
    }
    const studentIds = [...new Set(attempts.map((a) => a.userId))];
    const studentMap = new Map<string, Student>();
    for (const sid of studentIds) {
      const student = await this.getStudentById(sid);
      if (student) studentMap.set(sid, student);
    }
    const entries = attempts.map((attempt) => {
      const student = studentMap.get(attempt.userId);
      const score = attempt.score ?? 0;
      const total = (attempt.totalQuestions ?? totalQuestions) || 1;
      const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
      return {
        studentId: attempt.userId,
        studentName: student?.name ?? "Unknown Student",
        studentEmail: student?.email ?? "",
        score,
        totalQuestions: total,
        percentage,
        timeTaken: attempt.timeTaken ?? null,
        submittedAt: attempt.submittedAt,
      };
    });
    entries.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.timeTaken ?? Infinity) - (b.timeTaken ?? Infinity);
    });
    const leaderboard = entries.map((e, i) => ({ rank: i + 1, ...e }));
    const scores = entries.map((e) => e.score);
    return {
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
      leaderboard,
    };
  }

  // ── Notifications ─────────────────────────────────────────────────────────────
  async getNotifications(userId: string) {
    const snap = await this.db
      .collection("notifications")
      .where("userId", "==", userId)
      .get();
    return snap.docs
      .map((d) => this.docToNotification(d.id, d.data()))
      .sort(
        (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
      );
  }
  async markNotificationRead(id: string) {
    await this.db.collection("notifications").doc(id).update({ read: true });
  }
  async markAllNotificationsRead(userId: string) {
    const snap = await this.db
      .collection("notifications")
      .where("userId", "==", userId)
      .get();
    const batch = this.db.batch();
    snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
    if (!snap.empty) await batch.commit();
  }
  async clearAllNotifications(userId: string) {
    const snap = await this.db
      .collection("notifications")
      .where("userId", "==", userId)
      .get();
    const batch = this.db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    if (!snap.empty) await batch.commit();
  }

  // Send in-app notification to every approved student
  async notifyAllStudents(
    title: string,
    message: string,
    type: string,
  ): Promise<void> {
    const snap = await this.db
      .collection("students")
      .where("status", "==", "approved")
      .get();
    const now = new Date();
    const batch = this.db.batch();
    snap.docs.forEach((d) => {
      const ref = this.db.collection("notifications").doc(generateId());
      batch.set(ref, {
        userId: d.id,
        title,
        message,
        type,
        read: false,
        createdAt: now,
      });
    });
    if (!snap.empty) await batch.commit();
  }

  // ── Notice Board ──────────────────────────────────────────────────────────────
  async getNotices(): Promise<Notice[]> {
    const snap = await this.db
      .collection("notices")
      .orderBy("createdAt", "desc")
      .get();
    return snap.docs.map((d) => this.docToNotice(d.id, d.data()));
  }

  async getActiveNotices(): Promise<Notice[]> {
    const now = new Date();
    const snap = await this.db.collection("notices").get();
    return snap.docs
      .map((d) => this.docToNotice(d.id, d.data()))
      .filter((n) => n.expiresAt && n.expiresAt > now)
      .sort((a, b) => {
        // urgent first, then important, then normal
        const priorityOrder = { urgent: 0, important: 1, normal: 2 };
        const pa = priorityOrder[a.priority] ?? 2;
        const pb = priorityOrder[b.priority] ?? 2;
        if (pa !== pb) return pa - pb;
        return (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0);
      });
  }

  async getNoticeById(id: string): Promise<Notice | undefined> {
    const doc = await this.db.collection("notices").doc(id).get();
    return doc.exists ? this.docToNotice(doc.id, doc.data()) : undefined;
  }

  async createNotice(data: InsertNotice): Promise<Notice> {
    const id = generateId();
    const now = new Date();
    const doc = {
      title: data.title,
      message: data.message,
      priority: data.priority || "normal",
      createdAt: now,
      expiresAt: data.expiresAt,
    };
    await this.db.collection("notices").doc(id).set(doc);
    return this.docToNotice(id, doc);
  }

  async updateNotice(
    id: string,
    data: Partial<InsertNotice>,
  ): Promise<Notice | undefined> {
    const ref = this.db.collection("notices").doc(id);
    if (!(await ref.get()).exists) return undefined;
    await ref.update(data as any);
    return this.docToNotice(id, (await ref.get()).data());
  }

  async deleteNotice(id: string): Promise<void> {
    await this.db.collection("notices").doc(id).delete();
  }

  // ── FCM Tokens / Student IDs ──────────────────────────────────────────────────
  async getAllStudentIds(): Promise<string[]> {
    const snap = await this.db
      .collection("students")
      .where("status", "==", "approved")
      .get();
    return snap.docs.map((d) => d.id);
  }

  // ── Users ─────────────────────────────────────────────────────────────────────
  async getUser(id: string) {
    const doc = await this.db.collection("users").doc(id).get();
    return doc.exists ? this.docToUser(doc.id, doc.data()) : undefined;
  }
  async getUserByEmail(email: string) {
    const snap = await this.db
      .collection("users")
      .where("email", "==", email)
      .limit(1)
      .get();
    return snap.empty
      ? undefined
      : this.docToUser(snap.docs[0].id, snap.docs[0].data());
  }
  async getUserByUsername(username: string) {
    const snap = await this.db
      .collection("users")
      .where("username", "==", username)
      .limit(1)
      .get();
    return snap.empty
      ? undefined
      : this.docToUser(snap.docs[0].id, snap.docs[0].data());
  }
  async createUser(data: InsertUser) {
    const id = generateId();
    const doc: any = {
      username: data.username,
      email: data.email,
      password: data.password,
      phone: data.phone || null,
      displayName: data.displayName || null,
      avatarUrl: data.avatarUrl || null,
      darkMode: data.darkMode ?? false,
      createdAt: new Date(),
    };
    await this.db.collection("users").doc(id).set(doc);
    return this.docToUser(id, doc);
  }
  async updateUser(id: string, data: Partial<User>) {
    const ref = this.db.collection("users").doc(id);
    if (!(await ref.get()).exists) return undefined;
    const { id: _, ...updateData } = data as any;
    await ref.update(updateData);
    return this.docToUser(id, (await ref.get()).data());
  }
  async deleteUser(id: string) {
    const [attempts, notifs, tokens] = await Promise.all([
      this.db.collection("quizAttempts").where("userId", "==", id).get(),
      this.db.collection("notifications").where("userId", "==", id).get(),
      this.db.collection("passwordResetTokens").where("userId", "==", id).get(),
    ]);
    const batch = this.db.batch();
    [...attempts.docs, ...notifs.docs, ...tokens.docs].forEach((d) =>
      batch.delete(d.ref),
    );
    if (!attempts.empty || !notifs.empty || !tokens.empty) await batch.commit();
    await this.db.collection("users").doc(id).delete();
  }
  async getAllUsers() {
    const snap = await this.db
      .collection("users")
      .orderBy("createdAt", "desc")
      .get();
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        username: data.username,
        email: data.email,
        phone: data.phone || null,
        displayName: data.displayName || null,
        avatarUrl: data.avatarUrl || null,
        darkMode: data.darkMode ?? null,
        createdAt: toDate(data.createdAt),
      };
    });
  }
  async updateUserSessionToken(
    id: string,
    sessionToken: string,
  ): Promise<void> {
    await this.db.collection("users").doc(id).update({ sessionToken });
  }
  async updateStudentSessionToken(
    id: string,
    sessionToken: string,
  ): Promise<void> {
    await this.db.collection("students").doc(id).update({ sessionToken });
  }

  // ── Password Reset ────────────────────────────────────────────────────────────
  async createPasswordResetToken(
    userId: string,
    token: string,
    expiresAt: Date,
  ) {
    const existing = await this.db
      .collection("passwordResetTokens")
      .where("userId", "==", userId)
      .where("used", "==", false)
      .get();
    const batch = this.db.batch();
    existing.docs.forEach((d) => batch.delete(d.ref));
    if (!existing.empty) await batch.commit();
    await this.db
      .collection("passwordResetTokens")
      .doc(generateId())
      .set({ userId, token, expiresAt, used: false, createdAt: new Date() });
  }
  async getPasswordResetToken(token: string) {
    const snap = await this.db
      .collection("passwordResetTokens")
      .where("token", "==", token)
      .limit(1)
      .get();
    if (snap.empty) return undefined;
    const doc = snap.docs[0];
    const data = doc.data();
    return {
      id: doc.id,
      userId: data.userId,
      token: data.token,
      expiresAt: toDate(data.expiresAt)!,
      used: data.used ?? null,
    };
  }
  async markTokenUsed(token: string) {
    const snap = await this.db
      .collection("passwordResetTokens")
      .where("token", "==", token)
      .limit(1)
      .get();
    if (!snap.empty) await snap.docs[0].ref.update({ used: true });
  }

  // ── Students ──────────────────────────────────────────────────────────────────
  async getStudents() {
    const snap = await this.db.collection("students").get();
    return snap.docs
      .map((d) => {
        const { password, sessionToken, ...rest } = this.docToStudent(
          d.id,
          d.data(),
        );
        return rest;
      })
      .sort(
        (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
      );
  }
  async getStudentsWithPasswords(): Promise<Student[]> {
    const snap = await this.db.collection("students").get();
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name || "",
          email: data.email || "",
          phone:
            data.phone && !String(data.phone).includes("@")
              ? String(data.phone)
              : "",
          password: data.plainPassword || "",
          enrollmentNumber: data.enrollmentNumber || "",
          status: (data.status || "pending") as Student["status"],
          sessionToken: data.sessionToken || null,
          createdAt: toDate(data.createdAt),
        };
      })
      .sort(
        (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
      );
  }
  async getStudentById(id: string) {
    const doc = await this.db.collection("students").doc(id).get();
    return doc.exists ? this.docToStudent(doc.id, doc.data()) : undefined;
  }
  async getStudentByEmail(email: string) {
    const snap = await this.db
      .collection("students")
      .where("email", "==", email)
      .limit(1)
      .get();
    return snap.empty
      ? undefined
      : this.docToStudent(snap.docs[0].id, snap.docs[0].data());
  }
  async getStudentByPhone(phone: string) {
    if (!phone) return undefined;
    const snap = await this.db
      .collection("students")
      .where("phone", "==", phone)
      .limit(1)
      .get();
    return snap.empty
      ? undefined
      : this.docToStudent(snap.docs[0].id, snap.docs[0].data());
  }
  async createStudent(
    data: Omit<Student, "id" | "createdAt">,
    plainPassword?: string,
  ) {
    const id = generateId();
    const doc: any = { ...data, createdAt: new Date() };
    if (plainPassword) doc.plainPassword = plainPassword;
    await this.db.collection("students").doc(id).set(doc);
    const { password, sessionToken, ...rest } = this.docToStudent(id, doc);
    return rest;
  }
  async createStudentsBulk(
    data: Array<Omit<Student, "id" | "createdAt"> & { plainPassword?: string }>,
  ) {
    let created = 0,
      skipped = 0;
    for (const s of data) {
      const [byEmail, byPhone] = await Promise.all([
        this.getStudentByEmail(s.email),
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
    return { created, skipped };
  }
  async updateStudent(
    id: string,
    data: { name?: string; email?: string; phone?: string },
  ) {
    const ref = this.db.collection("students").doc(id);
    if (!(await ref.get()).exists) throw new Error("Student not found");
    await ref.update(data as any);
    const { password, sessionToken, ...rest } = this.docToStudent(
      id,
      (await ref.get()).data(),
    );
    return rest;
  }
  async updateStudentPassword(
    id: string,
    hashedPassword: string,
    plainPassword?: string,
  ): Promise<void> {
    const update: any = { password: hashedPassword };
    if (plainPassword) update.plainPassword = plainPassword;
    await this.db.collection("students").doc(id).update(update);
  }
  async updateStudentStatus(id: string, status: Student["status"]) {
    await this.db.collection("students").doc(id).update({ status });
  }
  async deleteStudent(id: string) {
    await this.db.collection("students").doc(id).delete();
  }

  // ── Admin Stats ───────────────────────────────────────────────────────────────
  async getAdminStats() {
    const [
      usersSnap,
      subjectsSnap,
      unitsSnap,
      quizzesSnap,
      questionsSnap,
      matsSnap,
      attemptsSnap,
      studentsSnap,
      noticesSnap,
    ] = await Promise.all([
      this.db.collection("users").count().get(),
      this.db.collection("subjects").count().get(),
      this.db.collection("units").count().get(),
      this.db.collection("quizzes").count().get(),
      this.db.collection("questions").count().get(),
      this.db.collection("studyMaterials").count().get(),
      this.db.collection("quizAttempts").count().get(),
      this.db.collection("students").count().get(),
      this.db.collection("notices").count().get(),
    ]);
    const allQuizzes = await this.getAllQuizzes();
    return {
      users: usersSnap.data().count,
      subjects: subjectsSnap.data().count,
      chapters: unitsSnap.data().count,
      quizzes: quizzesSnap.data().count,
      questions: questionsSnap.data().count,
      materials: matsSnap.data().count,
      attempts: attemptsSnap.data().count,
      students: studentsSnap.data().count,
      notices: noticesSnap.data().count,
      activeQuizzes: allQuizzes.filter((q) => q.isActive).length,
      totalQuizTime: allQuizzes.reduce((sum, q) => sum + (q.duration || 0), 0),
    };
  }
}

export const storage = new FirestoreStorage();
