import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from "react";
import { api, studentApi, User, Student } from "./api";

// ─── Inactivity timeout: 5 minutes ───────────────────────────────────────────
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

// ─── Activity events to track ─────────────────────────────────────────────────
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "click",
];

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

  // ─── Refs ──────────────────────────────────────────────────────────────────
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionPollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const isLoggedIn = useRef(false); // track login state without stale closures

  // ─── helpers ───────────────────────────────────────────────────────────────
  const isNetworkError = (message: string) =>
    message === "Failed to fetch" ||
    message.includes("NetworkError") ||
    message.includes("ERR_NETWORK") ||
    message.includes("ERR_INTERNET_DISCONNECTED") ||
    message.includes("timeout") ||
    message.includes("aborted");

  // ─── Core clear-all-state ─────────────────────────────────────────────────
  const clearSession = useCallback(() => {
    api.setToken(null);
    studentApi.setToken(null);
    localStorage.removeItem("student_data");
    setUser(null);
    setStudent(null);
    setAuthReady(false);
    setAuthVersion((v) => v + 1);
    isLoggedIn.current = false;
  }, []);

  // ─── Inactivity logout ────────────────────────────────────────────────────
  const resetInactivityTimer = useCallback(() => {
    if (!isLoggedIn.current) return;
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(async () => {
      if (!isLoggedIn.current) return;
      console.log("Logging out due to inactivity");
      try {
        if (api.getToken()) await api.logout();
        else if (studentApi.getToken()) await studentApi.logout();
      } catch {}
      clearSession();
      alert("You have been logged out due to 5 minutes of inactivity.");
    }, INACTIVITY_TIMEOUT_MS);
  }, [clearSession]);

  const startActivityTracking = useCallback(() => {
    resetInactivityTimer();
    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, resetInactivityTimer, { passive: true }),
    );
  }, [resetInactivityTimer]);

  const stopActivityTracking = useCallback(() => {
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
      inactivityTimer.current = null;
    }
    ACTIVITY_EVENTS.forEach((event) =>
      window.removeEventListener(event, resetInactivityTimer),
    );
  }, [resetInactivityTimer]);

  // ─── Session polling (detect logout from another device) ──────────────────
  // Polls /api/auth/me every 30 seconds — if SESSION_INVALIDATED is returned,
  // the user logged in from another device and this session is kicked.
  const startSessionPolling = useCallback(() => {
    if (sessionPollTimer.current) clearInterval(sessionPollTimer.current);
    sessionPollTimer.current = setInterval(async () => {
      if (!isLoggedIn.current) return;
      try {
        if (api.getToken()) {
          await api.getMe();
        } else if (studentApi.getToken()) {
          // Students don't have a /me endpoint — use a lightweight check
          // by calling getMe and catching the invalidation error
          await studentApi.getSemesters();
        }
      } catch (err: any) {
        const message = err?.message ?? "";
        if (
          message.includes("SESSION_INVALIDATED") ||
          message.includes("Session expired") ||
          message.includes("Logged in from another device") ||
          err?.code === "SESSION_INVALIDATED"
        ) {
          clearSession();
          alert(
            "You have been logged out because your account was logged in from another device.",
          );
        }
        // Ignore network errors — don't log out on flaky connections
      }
    }, 30_000); // poll every 30 seconds
  }, [clearSession]);

  const stopSessionPolling = useCallback(() => {
    if (sessionPollTimer.current) {
      clearInterval(sessionPollTimer.current);
      sessionPollTimer.current = null;
    }
  }, []);

  // ─── Start / stop everything when login state changes ─────────────────────
  const onLoginSuccess = useCallback(() => {
    isLoggedIn.current = true;
    startActivityTracking();
    startSessionPolling();
  }, [startActivityTracking, startSessionPolling]);

  const onLogout = useCallback(() => {
    isLoggedIn.current = false;
    stopActivityTracking();
    stopSessionPolling();
  }, [stopActivityTracking, stopSessionPolling]);

  // ─── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopActivityTracking();
      stopSessionPolling();
    };
  }, [stopActivityTracking, stopSessionPolling]);

  // ─── Intercept API 401 SESSION_INVALIDATED responses globally ─────────────
  // Patch fetch so any 401 with SESSION_INVALIDATED from ANY api call forces logout
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      if (response.status === 401 && isLoggedIn.current) {
        // Clone so we can read body without consuming it
        const clone = response.clone();
        try {
          const data = await clone.json();
          if (
            data?.code === "SESSION_INVALIDATED" ||
            data?.message?.includes("Session expired")
          ) {
            clearSession();
            onLogout();
            alert(
              "You have been logged out because your account was logged in from another device.",
            );
          }
        } catch {}
      }
      return response;
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, [clearSession, onLogout]);

  // ─── Initial auth check ───────────────────────────────────────────────────
  const checkAuth = async () => {
    try {
      const userToken = api.getToken();
      if (userToken) {
        const { user } = await api.getMe();
        setUser(user);
        onLoginSuccess();
        return;
      }

      const studentToken = studentApi.getToken();
      if (studentToken) {
        const savedStudent = localStorage.getItem("student_data");
        if (savedStudent) {
          try {
            setStudent(JSON.parse(savedStudent));
            onLoginSuccess();
          } catch {
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
        api.setToken(null);
        setUser(null);
      }
    } finally {
      setLoading(false);
      setAuthReady(true);
      setAuthVersion((v) => v + 1);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  // ─── Admin login ──────────────────────────────────────────────────────────
  const login = async (email: string, password: string) => {
    const { user } = await api.login(email, password);
    studentApi.setToken(null);
    localStorage.removeItem("student_data");
    setStudent(null);
    setUser(user);
    setAuthReady(true);
    setAuthVersion((v) => v + 1);
    onLoginSuccess();
  };

  // ─── Student login ────────────────────────────────────────────────────────
  const studentLogin = async (identifier: string, password: string) => {
    const { student } = await studentApi.studentLogin(identifier, password);
    localStorage.setItem("student_data", JSON.stringify(student));
    api.setToken(null);
    setUser(null);
    setStudent(student);
    setAuthReady(true);
    setAuthVersion((v) => v + 1);
    onLoginSuccess();
  };

  // ─── Logout ───────────────────────────────────────────────────────────────
  const logout = async () => {
    try {
      if (user) await api.logout();
      else if (student) await studentApi.logout();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      clearSession();
      onLogout();
    }
  };

  // ─── Refresh admin user ───────────────────────────────────────────────────
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
        clearSession();
        onLogout();
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
