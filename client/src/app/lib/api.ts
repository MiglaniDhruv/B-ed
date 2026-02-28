// API Configuration and Service Layer
const API_BASE_URL = 'https://kachhli.duckdns.org' ;

// ─── Types ────────────────────────────────────────────────────────────────────
export interface User {
  id: string; username: string; email: string; phone: string | null;
  displayName: string | null; avatarUrl: string | null; darkMode: boolean | null; createdAt: Date | null;
}
export interface Student {
  id: string; name: string; email: string; phone: string; password: string;
  enrollmentNumber: string; status: "pending" | "approved" | "blocked"; createdAt: Date | null;
}
export interface Semester { id: number; number: number; name: string; }
export interface Subject {
  id: string; semesterNumber: number; name: string; description: string | null;
  icon: string | null; color: string | null; order: number | null;
}
export interface Unit { id: string; subjectId: string; title: string; description: string | null; order: number | null; }
export interface StudyMaterial {
  id: string; unitId: string; title: string; description: string | null;
  type: "pdf" | "video" | "link" | "document"; url: string; fileName: string | null;
  fileSize: number | null; uploadedAt: Date | null; order: number | null;
}
export interface Quiz {
  id: string; subjectId: string; title: string; description: string | null;
  duration: number | null; totalMarks: number | null; isActive: boolean | null;
  allowReview: boolean | null; // ← NEW: controls if students can review answers after quiz
  createdAt: Date | null;
}
export interface Question {
  id: string; quizId: string | null; questionText: string; options: string[];
  correctAnswer?: number; explanation: string | null; marks: number | null; order: number | null;
}
export interface QuestionWithQuizInfo extends Question {
  usedInQuizzes: Array<{ quizId: string; quizTitle: string; quizSubjectId: string }>;
}
export interface QuizAttempt {
  id: string; userId: string; quizId: string; answers: Record<string, number>;
  score: number | null; timeTaken: number | null; submittedAt: Date | null; quiz?: Quiz;
}
export interface Notification {
  id: string; userId: string; title: string; message: string; type: string;
  read: boolean | null; createdAt: Date | null;
}
export interface Notice {
  id: string; title: string; message: string;
  priority: "normal" | "important" | "urgent";
  createdAt: string | null; expiresAt: string | null;
}

// ─── Base API Client ──────────────────────────────────────────────────────────
class ApiClient {
  private token: string | null = null;
  private readonly tokenKey: string;

  constructor(tokenKey: string) {
    this.tokenKey = tokenKey;
    if (typeof localStorage !== 'undefined') this.token = localStorage.getItem(tokenKey);
  }

  setToken(token: string | null) {
    this.token = token;
    if (typeof localStorage !== 'undefined') {
      if (token) localStorage.setItem(this.tokenKey, token);
      else localStorage.removeItem(this.tokenKey);
    }
  }
  getToken() { return this.token; }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: HeadersInit = { 'Content-Type': 'application/json', ...options.headers };
    if (this.token) (headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`;

    const isGet = !options.method || options.method === 'GET';
    const sep = endpoint.includes('?') ? '&' : '?';
    const url = isGet
      ? `${API_BASE_URL}${endpoint}${sep}_t=${Date.now()}`
      : `${API_BASE_URL}${endpoint}`;

    const response = await fetch(url, { ...options, headers, credentials: 'include' });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Network error' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }
    return response.json();
  }
}

// ─── Admin API Client ─────────────────────────────────────────────────────────
class AdminApiClient extends ApiClient {
  constructor() { super('auth_token'); }

  // Auth
  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    const result = await this.request<{ user: User; token: string }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    this.setToken(result.token);
    return result;
  }
  async logout(): Promise<void> { await this.request('/api/auth/logout', { method: 'POST' }); this.setToken(null); }
  async getMe(): Promise<{ user: User }> { return this.request('/api/auth/me'); }
  async updateProfile(data: { displayName?: string; phone?: string; darkMode?: boolean }): Promise<{ user: User }> {
    return this.request('/api/auth/profile', { method: 'PUT', body: JSON.stringify(data) });
  }

  // Students
  async getStudents(): Promise<Student[]> { return this.request('/api/admin/students/with-passwords'); }
  async createStudent(data: { name: string; email: string; phone: string; password: string }): Promise<Student> {
    return this.request('/api/admin/students', { method: 'POST', body: JSON.stringify(data) });
  }
  async createStudentsBulk(students: { name: string; email: string; phone: string; password: string }[]): Promise<{ success: boolean; created: number; skipped: number }> {
    return this.request('/api/admin/students/bulk', { method: 'POST', body: JSON.stringify({ students }) });
  }
  async updateStudent(id: string, data: { name?: string; email?: string; phone?: string }): Promise<Student> {
    return this.request(`/api/admin/students/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async resetStudentPassword(id: string, newPassword: string): Promise<{ success: boolean }> {
    return this.request(`/api/admin/students/${id}/reset-password`, { method: 'PUT', body: JSON.stringify({ newPassword }) });
  }
  async updateStudentStatus(id: string, status: Student['status']): Promise<{ success: boolean }> {
    return this.request(`/api/admin/students/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
  }
  async deleteStudent(id: string): Promise<{ success: boolean }> { return this.request(`/api/admin/students/${id}`, { method: 'DELETE' }); }

  // Semesters / Subjects / Units / Materials
  async getSemesters(): Promise<Semester[]> { return this.request('/api/semesters'); }
  async getSubjects(): Promise<Subject[]> { return this.request('/api/subjects'); }
  async getSubjectById(id: string): Promise<Subject> { return this.request(`/api/subjects/${id}`); }
  async getSubjectsBySemester(semesterNumber: number): Promise<Subject[]> { return this.request(`/api/semesters/${semesterNumber}/subjects`); }
  async createSubject(data: Omit<Subject, 'id'>): Promise<Subject> { return this.request('/api/admin/subjects', { method: 'POST', body: JSON.stringify(data) }); }
  async updateSubject(id: string, data: Partial<Subject>): Promise<Subject> { return this.request(`/api/admin/subjects/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
  async deleteSubject(id: string): Promise<{ success: boolean }> { return this.request(`/api/admin/subjects/${id}`, { method: 'DELETE' }); }
  async getUnitsBySubject(subjectId: string): Promise<Unit[]> { return this.request(`/api/subjects/${subjectId}/units`); }
  async createUnit(data: Omit<Unit, 'id'>): Promise<Unit> { return this.request('/api/admin/units', { method: 'POST', body: JSON.stringify(data) }); }
  async updateUnit(id: string, data: Partial<Unit>): Promise<Unit> { return this.request(`/api/admin/units/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
  async deleteUnit(id: string): Promise<{ success: boolean }> { return this.request(`/api/admin/units/${id}`, { method: 'DELETE' }); }
  async getStudyMaterialsByUnit(unitId: string): Promise<StudyMaterial[]> { return this.request(`/api/units/${unitId}/materials`); }
  async createStudyMaterial(data: { unitId: string; title: string; description?: string; type: "pdf" | "video" | "link" | "document"; url: string; fileName?: string; fileSize?: number; order?: number }): Promise<StudyMaterial> {
    return this.request('/api/admin/study-materials', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateStudyMaterial(id: string, data: Partial<StudyMaterial>): Promise<StudyMaterial> { return this.request(`/api/admin/study-materials/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
  async deleteStudyMaterial(id: string): Promise<{ success: boolean }> { return this.request(`/api/admin/study-materials/${id}`, { method: 'DELETE' }); }

  // Quizzes
  async getQuizzes(): Promise<Quiz[]> { return this.request('/api/quizzes'); }
  async getQuizById(id: string): Promise<Quiz> { return this.request(`/api/quizzes/${id}`); }
  async getQuizQuestions(quizId: string): Promise<Question[]> { return this.request(`/api/quizzes/${quizId}/questions`); }
  async createQuiz(data: Omit<Quiz, 'id' | 'createdAt'>): Promise<Quiz> { return this.request('/api/admin/quizzes', { method: 'POST', body: JSON.stringify(data) }); }
  async updateQuiz(id: string, data: Partial<Quiz>): Promise<Quiz> { return this.request(`/api/admin/quizzes/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
  async deleteQuiz(id: string): Promise<{ success: boolean }> { return this.request(`/api/admin/quizzes/${id}`, { method: 'DELETE' }); }
  async getQuizAnalytics(id: string): Promise<{
    quizId: string; quizTitle: string; totalAttempts: number; averageScore: number;
    averagePercentage: number; highestScore: number; lowestScore: number; totalQuestions: number;
    leaderboard: Array<{ rank: number; studentId: string; studentName: string; studentEmail: string; score: number; totalQuestions: number; percentage: number; timeTaken: number | null; submittedAt: string | null }>;
  }> { return this.request(`/api/admin/quizzes/${id}/analytics`); }

  // Questions
  async getAllQuestions(quizId?: string): Promise<Question[]> {
    const query = quizId ? `?quizId=${quizId}` : '';
    return this.request(`/api/admin/questions${query}`);
  }
  async getAllQuestionsWithQuizInfo(quizId?: string): Promise<QuestionWithQuizInfo[]> {
    const params = new URLSearchParams({ withQuizInfo: 'true' });
    if (quizId) params.set('quizId', quizId);
    return this.request(`/api/admin/questions?${params}`);
  }
  async createQuestion(data: { questionText: string; options: string[]; correctAnswer: number; marks?: number; explanation?: string | null }): Promise<Question> {
    return this.request('/api/admin/questions', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateQuestion(id: string, data: { questionText?: string; options?: string[]; correctAnswer?: number; marks?: number; explanation?: string | null }): Promise<Question> {
    return this.request(`/api/admin/questions/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async deleteQuestion(id: string): Promise<{ success: boolean }> { return this.request(`/api/admin/questions/${id}`, { method: 'DELETE' }); }
  async addQuestionToQuiz(quizId: string, questionId: string, order?: number): Promise<{ success: boolean }> {
    return this.request(`/api/admin/quizzes/${quizId}/questions`, { method: 'POST', body: JSON.stringify({ questionId, order }) });
  }
  async removeQuestionFromQuiz(quizId: string, questionId: string): Promise<{ success: boolean }> {
    return this.request(`/api/admin/quizzes/${quizId}/questions/${questionId}`, { method: 'DELETE' });
  }
  async reorderQuestionsInQuiz(quizId: string, orderedQuestionIds: string[]): Promise<{ success: boolean }> {
    return this.request(`/api/admin/quizzes/${quizId}/questions/reorder`, { method: 'PUT', body: JSON.stringify({ orderedQuestionIds }) });
  }

  // Notifications
  async getNotifications(): Promise<Notification[]> { return this.request('/api/notifications'); }
  async markNotificationRead(id: string): Promise<{ success: boolean }> { return this.request(`/api/notifications/${id}/read`, { method: 'PUT' }); }
  async markAllNotificationsRead(): Promise<{ success: boolean }> { return this.request('/api/notifications/read-all', { method: 'PUT' }); }
  async clearAllNotifications(): Promise<{ success: boolean }> { return this.request('/api/notifications/clear-all', { method: 'DELETE' }); }

  // ── Notice Board ───────────────────────────────────────────────────────────
  async getNotices(): Promise<Notice[]> { return this.request('/api/admin/notices'); }
  async createNotice(data: { title: string; message: string; priority: string; expiresAt: string }): Promise<Notice> {
    return this.request('/api/admin/notices', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateNotice(id: string, data: Partial<{ title: string; message: string; priority: string; expiresAt: string }>): Promise<Notice> {
    return this.request(`/api/admin/notices/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async deleteNotice(id: string): Promise<{ success: boolean }> { return this.request(`/api/admin/notices/${id}`, { method: 'DELETE' }); }

  // Admin
  async getAllUsers(): Promise<Omit<User, 'password'>[]> { return this.request('/api/admin/users'); }
  async createUser(data: { username: string; email: string; password: string; phone?: string; displayName?: string }): Promise<{ user: User }> {
    return this.request('/api/admin/users', { method: 'POST', body: JSON.stringify(data) });
  }
  async resetUserPassword(userId: string, newPassword: string): Promise<{ success: boolean }> {
    return this.request(`/api/admin/users/${userId}/reset-password`, { method: 'PUT', body: JSON.stringify({ newPassword }) });
  }
  async deleteUser(userId: string): Promise<{ success: boolean }> { return this.request(`/api/admin/users/${userId}`, { method: 'DELETE' }); }
  async getAdminStats(): Promise<Record<string, number>> { return this.request('/api/admin/stats'); }
}

// ─── Student API Client ───────────────────────────────────────────────────────
class StudentApiClient extends ApiClient {
  constructor() { super('student_auth_token'); }

  async studentLogin(identifier: string, password: string): Promise<{ student: Student; token: string }> {
    const result = await this.request<{ student: Student; token: string }>('/api/student/login', { method: 'POST', body: JSON.stringify({ identifier, password }) });
    this.setToken(result.token);
    return result;
  }
  async logout(): Promise<void> { try { await this.request('/api/auth/logout', { method: 'POST' }); } catch { } this.setToken(null); }

  async getQuizzes(): Promise<Quiz[]> { return this.request('/api/quizzes'); }
  async getQuizById(id: string): Promise<Quiz> { return this.request(`/api/quizzes/${id}`); }
  async getQuizQuestions(quizId: string): Promise<Question[]> { return this.request(`/api/quizzes/${quizId}/questions`); }
  async checkQuizAttempt(quizId: string): Promise<{ attempted: boolean; attempt: QuizAttempt | null }> { return this.request(`/api/quizzes/${quizId}/check-attempt`); }
  async submitQuiz(quizId: string, data: { answers: Record<string, number>; timeTaken: number }): Promise<{ attempt: QuizAttempt; correctAnswers: Record<string, number> }> {
    return this.request(`/api/quizzes/${quizId}/submit`, { method: 'POST', body: JSON.stringify(data) });
  }
  async getMyAttempts(): Promise<QuizAttempt[]> { return this.request('/api/attempts'); }
  async getSemesters(): Promise<Semester[]> { return this.request('/api/semesters'); }
  async getSubjects(): Promise<Subject[]> { return this.request('/api/subjects'); }
  async getSubjectById(id: string): Promise<Subject> { return this.request(`/api/subjects/${id}`); }
  async getSubjectsBySemester(semesterNumber: number): Promise<Subject[]> { return this.request(`/api/semesters/${semesterNumber}/subjects`); }
  async getUnitsBySubject(subjectId: string): Promise<Unit[]> { return this.request(`/api/subjects/${subjectId}/units`); }
  async getStudyMaterialsByUnit(unitId: string): Promise<StudyMaterial[]> { return this.request(`/api/units/${unitId}/materials`); }
  async getNotifications(): Promise<Notification[]> { return this.request('/api/notifications'); }
  async markNotificationRead(id: string): Promise<{ success: boolean }> { return this.request(`/api/notifications/${id}/read`, { method: 'PUT' }); }
  async markAllNotificationsRead(): Promise<{ success: boolean }> { return this.request('/api/notifications/read-all', { method: 'PUT' }); }
  async clearAllNotifications(): Promise<{ success: boolean }> { return this.request('/api/notifications/clear-all', { method: 'DELETE' }); }
  async getActiveNotices(): Promise<Notice[]> { return this.request('/api/notices'); }
}

// ─── Exports ──────────────────────────────────────────────────────────────────
export const api = new AdminApiClient();
export const studentApi = new StudentApiClient();