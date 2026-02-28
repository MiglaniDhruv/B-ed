import { useState, useEffect } from 'react';
import { useAuth } from './auth-context';
import {
  api,
  studentApi,
  Student, Semester, Subject, Unit, StudyMaterial,
  Quiz, Question, QuestionWithQuizInfo, QuizAttempt, Notification,
} from './api';

// ─── Semesters ────────────────────────────────────────────────────────────────
export function useSemesters() {
  const { authVersion } = useAuth();
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSemesters = async () => {
    try {
      setLoading(true);
      const data = await api.getSemesters();
      setSemesters(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSemesters(); }, [authVersion]);
  return { semesters, loading, error, refetch: fetchSemesters };
}

// ─── Subjects ─────────────────────────────────────────────────────────────────
export function useSubjects(semesterNumber?: number) {
  const { authVersion } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubjects = async () => {
    try {
      setLoading(true);
      const data = semesterNumber
        ? await api.getSubjectsBySemester(semesterNumber)
        : await api.getSubjects();
      setSubjects(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSubjects(); }, [authVersion, semesterNumber]);

  const createSubject = async (data: Omit<Subject, 'id'>) => {
    const newSubject = await api.createSubject(data);
    await fetchSubjects();
    return newSubject;
  };

  const updateSubject = async (id: string, data: Partial<Subject>) => {
    const updated = await api.updateSubject(id, data);
    await fetchSubjects();
    return updated;
  };

  const deleteSubject = async (id: string) => {
    await api.deleteSubject(id);
    await fetchSubjects();
  };

  return { subjects, loading, error, refetch: fetchSubjects, createSubject, updateSubject, deleteSubject };
}

// ─── Units ────────────────────────────────────────────────────────────────────
export function useUnits(subjectId: string | null) {
  const { authVersion } = useAuth();
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUnits = async () => {
    if (!subjectId) { setUnits([]); setLoading(false); return; }
    try {
      setLoading(true);
      const data = await api.getUnitsBySubject(subjectId);
      setUnits(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUnits(); }, [authVersion, subjectId]);

  const createUnit = async (data: Omit<Unit, 'id'>) => {
    const newUnit = await api.createUnit(data);
    await fetchUnits();
    return newUnit;
  };

  const updateUnit = async (id: string, data: Partial<Unit>) => {
    const updated = await api.updateUnit(id, data);
    await fetchUnits();
    return updated;
  };

  const deleteUnit = async (id: string) => {
    await api.deleteUnit(id);
    await fetchUnits();
  };

  return { units, loading, error, refetch: fetchUnits, createUnit, updateUnit, deleteUnit };
}

// ─── Study Materials ──────────────────────────────────────────────────────────
export function useStudyMaterials(unitId: string | null) {
  const { authVersion } = useAuth();
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMaterials = async () => {
    if (!unitId) { setMaterials([]); setLoading(false); return; }
    try {
      setLoading(true);
      const data = await api.getStudyMaterialsByUnit(unitId);
      setMaterials(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMaterials(); }, [authVersion, unitId]);

  const createMaterial = async (data: {
    unitId: string; title: string; description?: string;
    type: "pdf" | "video" | "link" | "document";
    url: string; fileName?: string; fileSize?: number; order?: number;
  }) => {
    const newMaterial = await api.createStudyMaterial(data);
    await fetchMaterials();
    return newMaterial;
  };

  const updateMaterial = async (id: string, data: Partial<StudyMaterial>) => {
    const updated = await api.updateStudyMaterial(id, data);
    await fetchMaterials();
    return updated;
  };

  const deleteMaterial = async (id: string) => {
    await api.deleteStudyMaterial(id);
    await fetchMaterials();
  };

  return { materials, loading, error, refetch: fetchMaterials, createMaterial, updateMaterial, deleteMaterial };
}

// ─── Quizzes (Admin) ──────────────────────────────────────────────────────────
// Uses `api` (AdminApiClient) — only for teacher/admin dashboard
export function useQuizzes() {
  const { authVersion } = useAuth();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuizzes = async () => {
    try {
      setLoading(true);
      const data = await api.getQuizzes();
      setQuizzes(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchQuizzes(); }, [authVersion]);

  const createQuiz = async (data: Omit<Quiz, 'id' | 'createdAt'>) => {
    const newQuiz = await api.createQuiz(data);
    await fetchQuizzes();
    return newQuiz;
  };

  const updateQuiz = async (id: string, data: Partial<Quiz>) => {
    const updated = await api.updateQuiz(id, data);
    await fetchQuizzes();
    return updated;
  };

  const deleteQuiz = async (id: string) => {
    await api.deleteQuiz(id);
    await fetchQuizzes();
  };

  return { quizzes, loading, error, refetch: fetchQuizzes, createQuiz, updateQuiz, deleteQuiz };
}

// ─── Quiz Questions (Student-facing) ──────────────────────────────────────────
// Uses `studentApi` — student token, never admin token
export function useQuizQuestions(quizId: string | null) {
  const { authVersion } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuestions = async () => {
    if (!quizId) { setQuestions([]); setLoading(false); return; }
    try {
      setLoading(true);
      const data = await studentApi.getQuizQuestions(quizId);
      setQuestions(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchQuestions(); }, [authVersion, quizId]);
  return { questions, loading, error, refetch: fetchQuestions };
}

// ─── Admin Questions ──────────────────────────────────────────────────────────
// Uses `api` (AdminApiClient)
export function useAdminQuestions(quizId?: string) {
  const { authVersion } = useAuth();
  const [questions, setQuestions] = useState<QuestionWithQuizInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const data = await api.getAllQuestionsWithQuizInfo(quizId);
      setQuestions(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchQuestions(); }, [authVersion, quizId]);

  const createQuestion = async (data: {
    questionText: string; options: string[]; correctAnswer: number;
    marks?: number; explanation?: string | null;
    quizId?: string; order?: number;
  }): Promise<QuestionWithQuizInfo> => {
    const { quizId: legacyQuizId, order: _order, ...bankData } = data;
    const created = await api.createQuestion(bankData);
    const targetQuizId = quizId ?? legacyQuizId;
    if (targetQuizId) {
      await api.addQuestionToQuiz(targetQuizId, created.id);
    }
    await fetchQuestions();
    return {
      ...created,
      usedInQuizzes: targetQuizId
        ? [{ quizId: targetQuizId, quizTitle: '', quizSubjectId: '' }]
        : [],
    };
  };

  const updateQuestion = async (id: string, data: {
    questionText?: string; options?: string[]; correctAnswer?: number;
    marks?: number; explanation?: string | null;
  }): Promise<Question> => {
    const updated = await api.updateQuestion(id, data);
    await fetchQuestions();
    return updated;
  };

  const deleteQuestion = async (id: string): Promise<void> => {
    await api.deleteQuestion(id);
    await fetchQuestions();
  };

  const addToQuiz = async (targetQuizId: string, questionId: string, order?: number): Promise<void> => {
    await api.addQuestionToQuiz(targetQuizId, questionId, order);
    await fetchQuestions();
  };

  const removeFromQuiz = async (targetQuizId: string, questionId: string): Promise<void> => {
    await api.removeQuestionFromQuiz(targetQuizId, questionId);
    await fetchQuestions();
  };

  const reorderInQuiz = async (targetQuizId: string, orderedQuestionIds: string[]): Promise<void> => {
    await api.reorderQuestionsInQuiz(targetQuizId, orderedQuestionIds);
    await fetchQuestions();
  };

  return {
    questions, loading, error, refetch: fetchQuestions,
    createQuestion, updateQuestion, deleteQuestion,
    addToQuiz, removeFromQuiz, reorderInQuiz,
  };
}

// ─── Quiz Attempts (Student) ──────────────────────────────────────────────────
// Uses `studentApi` — student token, NEVER admin token
export function useQuizAttempts() {
  const { authVersion } = useAuth();
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAttempts = async () => {
    try {
      setLoading(true);
      const data = await studentApi.getMyAttempts();
      setAttempts(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAttempts(); }, [authVersion]);
  return { attempts, loading, error, refetch: fetchAttempts };
}

// ─── Notifications ────────────────────────────────────────────────────────────
// Works for both admin and student — picks the right client based on who's logged in
export function useNotifications() {
  const { authVersion, user, student } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use studentApi if a student is logged in, otherwise api (admin)
  const client = student ? studentApi : api;

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const data = await client.getNotifications();
      setNotifications(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNotifications(); }, [authVersion]);

  const markAsRead = async (id: string) => {
    await client.markNotificationRead(id);
    await fetchNotifications();
  };

  const markAllAsRead = async () => {
    await client.markAllNotificationsRead();
    await fetchNotifications();
  };

  const clearAll = async () => {
    await client.clearAllNotifications();
    await fetchNotifications();
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  return { notifications, unreadCount, loading, error, refetch: fetchNotifications, markAsRead, markAllAsRead, clearAll };
}

// ─── Students (Admin) ─────────────────────────────────────────────────────────
// Uses `api` (AdminApiClient) — admin only
export function useStudents() {
  const { authVersion } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStudents = async (): Promise<Student[]> => {
    try {
      setLoading(true);
      const data = await api.getStudents();
      setStudents(data);
      setError(null);
      return data;
    } catch (err: any) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStudents(); }, [authVersion]);

  const createStudent = async (data: {
    name: string; email: string; phone: string; password: string;
  }): Promise<Student> => {
    const student = await api.createStudent(data);
    await fetchStudents();
    return student;
  };

  const createStudentsBulk = async (students: {
    name: string; email: string; phone: string; password: string;
  }[]) => {
    const result = await api.createStudentsBulk(students);
    await fetchStudents();
    return result;
  };

  const updateStudent = async (id: string, data: { name?: string; email?: string; phone?: string }) => {
    const updated = await api.updateStudent(id, data);
    await fetchStudents();
    return updated;
  };

  const resetStudentPassword = async (id: string, newPassword: string) => {
    await api.resetStudentPassword(id, newPassword);
    await fetchStudents();
  };

  const updateStudentStatus = async (id: string, status: Student['status']) => {
    await api.updateStudentStatus(id, status);
    await fetchStudents();
  };

  const deleteStudent = async (id: string) => {
    await api.deleteStudent(id);
    await fetchStudents();
  };

  const statusCounts = {
    total: students.length,
    approved: students.filter(s => s.status === 'approved').length,
    pending: students.filter(s => s.status === 'pending').length,
    blocked: students.filter(s => s.status === 'blocked').length,
  };

  return {
    students, loading, error, refetch: fetchStudents,
    createStudent, createStudentsBulk,
    updateStudent, resetStudentPassword,
    updateStudentStatus, deleteStudent,
    statusCounts,
  };
}