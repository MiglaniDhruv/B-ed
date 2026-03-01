import { useState, useEffect, useRef } from 'react';
import { useAuth } from './auth-context';
import {
  api,
  studentApi,
  Student, Semester, Subject, Unit, StudyMaterial,
  Quiz, Question, QuestionWithQuizInfo, QuizAttempt, Notification,
} from './api';
import {
  cacheGet, cacheSet, cacheDelete, cacheDeletePrefix,
  cacheCleanExpired, getCacheSizeMB, CACHE_TTL,
} from './local-cache';

// Clean expired entries on module load
cacheCleanExpired();

// ─── Core hook: stale-while-revalidate ───────────────────────────────────────
function useCachedFetch<T>(
  cacheKey: string | null,
  fetcher: () => Promise<T>,
  ttlMs: number,
  deps: unknown[] = [],
) {
  const [data, setData] = useState<T | null>(() => {
    if (!cacheKey) return null;
    const cached = cacheGet<T>(cacheKey);
    return cached ? cached.data : null;
  });

  const [loading, setLoading] = useState<boolean>(() => {
    if (!cacheKey) return true;
    const cached = cacheGet<T>(cacheKey);
    return !cached;
  });

  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const fetch = async (force = false) => {
    if (!cacheKey) return;
    const cached = cacheGet<T>(cacheKey);

    if (cached && !cached.isStale && !force) {
      if (isMounted.current) { setData(cached.data); setLoading(false); }
      return;
    }

    if (cached?.isStale && isMounted.current) {
      setData(cached.data);
      setLoading(false);
    }

    try {
      if (!cached) setLoading(true);
      const fresh = await fetcher();
      if (isMounted.current) {
        setData(fresh);
        setError(null);
        cacheSet(cacheKey, fresh, ttlMs);
      }
    } catch (err: any) {
      if (isMounted.current) setError(err.message);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, [cacheKey, ...deps]);

  return { data, loading, error, refetch: () => fetch(true) };
}

// ─── Semesters ────────────────────────────────────────────────────────────────
export function useSemesters() {
  const { authVersion } = useAuth();
  const { data, loading, error, refetch } = useCachedFetch(
    'semesters',
    () => api.getSemesters(),
    CACHE_TTL.SEMESTERS,
    [authVersion],
  );
  return { semesters: data ?? [], loading, error, refetch };
}

// ─── Subjects ─────────────────────────────────────────────────────────────────
export function useSubjects(semesterNumber?: number) {
  const { authVersion } = useAuth();
  const cacheKey = semesterNumber != null ? `subjects_sem_${semesterNumber}` : 'subjects_all';

  const { data, loading, error, refetch } = useCachedFetch(
    cacheKey,
    () => semesterNumber != null ? api.getSubjectsBySemester(semesterNumber) : api.getSubjects(),
    CACHE_TTL.SUBJECTS,
    [authVersion, semesterNumber],
  );

  const createSubject = async (subjectData: Omit<Subject, 'id'>) => {
    const newSubject = await api.createSubject(subjectData);
    cacheDeletePrefix('subjects_');
    cacheDeletePrefix('semester_stats_');
    await refetch();
    return newSubject;
  };

  const updateSubject = async (id: string, subjectData: Partial<Subject>) => {
    const updated = await api.updateSubject(id, subjectData);
    cacheDeletePrefix('subjects_');
    cacheDeletePrefix('semester_stats_');
    await refetch();
    return updated;
  };

  const deleteSubject = async (id: string) => {
    await api.deleteSubject(id);
    cacheDeletePrefix('subjects_');
    cacheDeletePrefix('semester_stats_');
    await refetch();
  };

  return { subjects: data ?? [], loading, error, refetch, createSubject, updateSubject, deleteSubject };
}

// ─── Units ────────────────────────────────────────────────────────────────────
export function useUnits(subjectId: string | null) {
  const { authVersion } = useAuth();
  const cacheKey = subjectId ? `units_${subjectId}` : null;

  const { data, loading, error, refetch } = useCachedFetch(
    cacheKey,
    () => api.getUnitsBySubject(subjectId!),
    CACHE_TTL.UNITS,
    [authVersion, subjectId],
  );

  const createUnit = async (data: Omit<Unit, 'id'>) => {
    const newUnit = await api.createUnit(data);
    if (cacheKey) cacheDelete(cacheKey);
    cacheDeletePrefix('semester_stats_');
    await refetch();
    return newUnit;
  };

  const updateUnit = async (id: string, data: Partial<Unit>) => {
    const updated = await api.updateUnit(id, data);
    if (cacheKey) cacheDelete(cacheKey);
    await refetch();
    return updated;
  };

  const deleteUnit = async (id: string) => {
    await api.deleteUnit(id);
    if (cacheKey) cacheDelete(cacheKey);
    cacheDeletePrefix('semester_stats_');
    await refetch();
  };

  return { units: data ?? [], loading, error, refetch, createUnit, updateUnit, deleteUnit };
}

// ─── Study Materials ──────────────────────────────────────────────────────────
export function useStudyMaterials(unitId: string | null) {
  const { authVersion } = useAuth();
  const cacheKey = unitId ? `materials_${unitId}` : null;

  const { data, loading, error, refetch } = useCachedFetch(
    cacheKey,
    () => api.getStudyMaterialsByUnit(unitId!),
    CACHE_TTL.MATERIALS,
    [authVersion, unitId],
  );

  const createMaterial = async (matData: {
    unitId: string; title: string; description?: string;
    type: "pdf" | "video" | "link" | "document";
    url: string; fileName?: string; fileSize?: number; order?: number;
  }) => {
    const newMaterial = await api.createStudyMaterial(matData);
    if (cacheKey) cacheDelete(cacheKey);
    cacheDeletePrefix('semester_stats_');
    await refetch();
    return newMaterial;
  };

  const updateMaterial = async (id: string, matData: Partial<StudyMaterial>) => {
    const updated = await api.updateStudyMaterial(id, matData);
    if (cacheKey) cacheDelete(cacheKey);
    await refetch();
    return updated;
  };

  const deleteMaterial = async (id: string) => {
    await api.deleteStudyMaterial(id);
    if (cacheKey) cacheDelete(cacheKey);
    cacheDeletePrefix('semester_stats_');
    await refetch();
  };

  return { materials: data ?? [], loading, error, refetch, createMaterial, updateMaterial, deleteMaterial };
}

// ─── Quizzes (Admin) ──────────────────────────────────────────────────────────
export function useQuizzes() {
  const { authVersion } = useAuth();
  const { data, loading, error, refetch } = useCachedFetch(
    'quizzes_all',
    () => api.getQuizzes(),
    CACHE_TTL.QUIZZES,
    [authVersion],
  );

  const createQuiz = async (quizData: Omit<Quiz, 'id' | 'createdAt'>) => {
    const newQuiz = await api.createQuiz(quizData);
    cacheDelete('quizzes_all');
    await refetch();
    return newQuiz;
  };

  const updateQuiz = async (id: string, quizData: Partial<Quiz>) => {
    const updated = await api.updateQuiz(id, quizData);
    cacheDelete('quizzes_all');
    cacheDelete(`quiz_${id}`);
    await refetch();
    return updated;
  };

  const deleteQuiz = async (id: string) => {
    await api.deleteQuiz(id);
    cacheDelete('quizzes_all');
    cacheDelete(`quiz_${id}`);
    await refetch();
  };

  return { quizzes: data ?? [], loading, error, refetch, createQuiz, updateQuiz, deleteQuiz };
}

// ─── Quiz Questions (Student-facing) ──────────────────────────────────────────
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
    marks?: number; explanation?: string | null; quizId?: string; order?: number;
  }): Promise<QuestionWithQuizInfo> => {
    const { quizId: legacyQuizId, order: _order, ...bankData } = data;
    const created = await api.createQuestion(bankData);
    const targetQuizId = quizId ?? legacyQuizId;
    if (targetQuizId) await api.addQuestionToQuiz(targetQuizId, created.id);
    await fetchQuestions();
    return { ...created, usedInQuizzes: targetQuizId ? [{ quizId: targetQuizId, quizTitle: '', quizSubjectId: '' }] : [] };
  };

  const updateQuestion = async (id: string, data: { questionText?: string; options?: string[]; correctAnswer?: number; marks?: number; explanation?: string | null }): Promise<Question> => {
    const updated = await api.updateQuestion(id, data);
    await fetchQuestions();
    return updated;
  };

  const deleteQuestion = async (id: string): Promise<void> => { await api.deleteQuestion(id); await fetchQuestions(); };
  const addToQuiz = async (targetQuizId: string, questionId: string, order?: number): Promise<void> => { await api.addQuestionToQuiz(targetQuizId, questionId, order); await fetchQuestions(); };
  const removeFromQuiz = async (targetQuizId: string, questionId: string): Promise<void> => { await api.removeQuestionFromQuiz(targetQuizId, questionId); await fetchQuestions(); };
  const reorderInQuiz = async (targetQuizId: string, orderedQuestionIds: string[]): Promise<void> => { await api.reorderQuestionsInQuiz(targetQuizId, orderedQuestionIds); await fetchQuestions(); };

  return { questions, loading, error, refetch: fetchQuestions, createQuestion, updateQuestion, deleteQuestion, addToQuiz, removeFromQuiz, reorderInQuiz };
}

// ─── Quiz Attempts (Student) ──────────────────────────────────────────────────
export function useQuizAttempts() {
  const { authVersion } = useAuth();
  const { data, loading, error, refetch } = useCachedFetch(
    'my_attempts',
    () => studentApi.getMyAttempts(),
    CACHE_TTL.ATTEMPTS,
    [authVersion],
  );
  return { attempts: data ?? [], loading, error, refetch };
}

// ─── Notifications ────────────────────────────────────────────────────────────
export function useNotifications() {
  const { authVersion, user, student } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const markAsRead = async (id: string) => { await client.markNotificationRead(id); await fetchNotifications(); };
  const markAllAsRead = async () => { await client.markAllNotificationsRead(); await fetchNotifications(); };
  const clearAll = async () => { await client.clearAllNotifications(); await fetchNotifications(); };

  const unreadCount = notifications.filter(n => !n.read).length;
  return { notifications, unreadCount, loading, error, refetch: fetchNotifications, markAsRead, markAllAsRead, clearAll };
}

// ─── Students (Admin) ─────────────────────────────────────────────────────────
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

  const createStudent = async (data: { name: string; email: string; phone: string; password: string }): Promise<Student> => {
    const student = await api.createStudent(data);
    await fetchStudents();
    return student;
  };

  const createStudentsBulk = async (students: { name: string; email: string; phone: string; password: string }[]) => {
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

  return { students, loading, error, refetch: fetchStudents, createStudent, createStudentsBulk, updateStudent, resetStudentPassword, updateStudentStatus, deleteStudent, statusCounts };
}

// ─── Cache stats (optional — show in settings/debug screen) ──────────────────
export function useCacheStats() {
  const sizeMB = getCacheSizeMB();
  return {
    sizeMB: Math.round(sizeMB * 100) / 100,
    sizeText: sizeMB < 1 ? `${Math.round(sizeMB * 1024)} KB` : `${sizeMB.toFixed(2)} MB`,
  };
}