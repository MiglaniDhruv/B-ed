import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { api, studentApi, User, Student } from "./api";

interface AuthContextType {
  user: User | null;
  student: Student | null;
  loading: boolean;
  authReady: boolean;
  authVersion: number;
  login: (email: string, password: string) => Promise<void>;
  studentLogin: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [authVersion, setAuthVersion] = useState(0);

  useEffect(() => {
    checkAuth();
  }, []);

  const isNetworkError = (message: string) =>
    message === "Failed to fetch" ||
    message.includes("NetworkError") ||
    message.includes("ERR_NETWORK") ||
    message.includes("ERR_INTERNET_DISCONNECTED") ||
    message.includes("timeout") ||
    message.includes("aborted");

  const checkAuth = async () => {
    try {
      // ── Restore admin/user session ─────────────────────────────────────────
      // api reads its own 'auth_token' from localStorage in its constructor.
      const userToken = api.getToken();
      if (userToken) {
        const { user } = await api.getMe();
        setUser(user);
        return; // admin session found — done
      }

      // ── Restore student session ────────────────────────────────────────────
      // studentApi reads its own 'student_auth_token' from localStorage.
      // We do NOT call /api/auth/me for students — we restore from saved data.
      const studentToken = studentApi.getToken();
      if (studentToken) {
        const savedStudent = localStorage.getItem("student_data");
        if (savedStudent) {
          try {
            setStudent(JSON.parse(savedStudent));
          } catch {
            // ignore parse errors — clear bad data
            studentApi.setToken(null);
            localStorage.removeItem("student_data");
          }
        }
      }
    } catch (error: any) {
      const message = error?.message ?? "";
      if (isNetworkError(message)) {
        console.warn("Auth check skipped — network unavailable:", message);
      } else {
        console.error("Auth check failed:", message);
        // Clear only admin token on failure
        api.setToken(null);
        setUser(null);
      }
    } finally {
      setLoading(false);
      setAuthReady(true);
      setAuthVersion((v) => v + 1);
    }
  };

  // ── Admin login ────────────────────────────────────────────────────────────
  // Uses `api` (AdminApiClient) — token stored under 'auth_token'
  const login = async (email: string, password: string) => {
    // api.login() internally calls setToken which writes to 'auth_token'
    const { user } = await api.login(email, password);

    // Clear any lingering student session — they can't both be active
    studentApi.setToken(null);
    localStorage.removeItem("student_data");

    setStudent(null);
    setUser(user);
    setAuthReady(true);
    setAuthVersion((v) => v + 1);
  };

  // ── Student login ──────────────────────────────────────────────────────────
  // Uses `studentApi` (StudentApiClient) — token stored under 'student_auth_token'
  const studentLogin = async (identifier: string, password: string) => {
    // studentApi.studentLogin() internally calls setToken which writes to 'student_auth_token'
    const { student } = await studentApi.studentLogin(identifier, password);
    localStorage.setItem("student_data", JSON.stringify(student));

    // Clear any lingering admin session
    api.setToken(null);

    setUser(null);
    setStudent(student);
    setAuthReady(true);
    setAuthVersion((v) => v + 1);
  };

  // ── Logout (both) ──────────────────────────────────────────────────────────
  const logout = async () => {
    try {
      if (user) await api.logout();
      else if (student) await studentApi.logout();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      // Clear both tokens to be safe
      api.setToken(null);
      studentApi.setToken(null);
      localStorage.removeItem("student_data");
      setUser(null);
      setStudent(null);
      setAuthReady(false);
      setAuthVersion((v) => v + 1);
    }
  };

  // ── Refresh admin user ─────────────────────────────────────────────────────
  const refreshUser = async () => {
    try {
      const { user } = await api.getMe();
      setUser(user);
    } catch (error: any) {
      const message = error?.message ?? "";
      if (isNetworkError(message)) {
        console.warn("User refresh skipped — network unavailable:", message);
      } else {
        console.error("Failed to refresh user:", message);
        api.setToken(null);
        setUser(null);
        setStudent(null);
        setAuthReady(false);
        setAuthVersion((v) => v + 1);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        student,
        loading,
        authReady,
        authVersion,
        login,
        studentLogin,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
