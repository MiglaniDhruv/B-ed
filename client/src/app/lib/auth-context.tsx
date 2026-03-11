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

  const sessionPollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const isLoggedIn = useRef(false);

  // ─── Core clear-all-state ──────────────────────────────────────────────────
  const clearSession = useCallback(() => {
    api.setToken(null);
    studentApi.setToken(null);
    localStorage.removeItem("student_data");
    setUser(null);
    setStudent(null);
    setAuthVersion((v) => v + 1);
    isLoggedIn.current = false;
  }, []);

  // ─── Session polling ───────────────────────────────────────────────────────
  // OPTIMIZATION: replaced api.getMe() / studentApi.getSemesters() with
  // api.ping() / studentApi.ping(). The new /api/auth/ping endpoint reads
  // only from the server-side in-memory session cache — 0 Firestore reads
  // when the cache is warm (i.e. after the first login or request).
  //
  // With 200 students polling every 30s = 400 pings/min. Previously each
  // ping hit Firestore on cache miss; now they almost never hit Firestore.
  // Estimated read savings: ~400 reads/min = ~576,000 reads/day from polling.
  // const startSessionPolling = useCallback(() => {
  //   if (sessionPollTimer.current) clearInterval(sessionPollTimer.current);

  //   sessionPollTimer.current = setInterval(async () => {
  //     if (!isLoggedIn.current) return;

  //     const client = api.getToken() ? api : studentApi;
  //     if (!client.getToken()) return;

  //     try {
  //       const result = await client.ping();

  //       if (!result.ok) {
  //         const code = result.code ?? "";
  //         const isInvalidated =
  //           code === "SESSION_INVALIDATED" ||
  //           code.includes("SESSION_INVALIDATED") ||
  //           code.includes("Session expired") ||
  //           code.includes("Logged in from another device");

  //         const isBlocked = code === "ACCOUNT_BLOCKED";

  //         if (isInvalidated) {
  //           clearSession();
  //           alert(
  //             "You have been logged out because your account was logged in from another device.",
  //           );
  //         } else if (isBlocked) {
  //           clearSession();
  //           alert("Your account has been blocked. Contact your teacher.");
  //         }
  //         // Other errors (NOT_FOUND, INVALID_TOKEN) are treated as transient
  //       }
  //     } catch {
  //       // Network errors — ignore, don't logout on flaky connection
  //     }
  //   }, 30_000);
  // }, [clearSession]);
  // Replace 30_000 with 60_000 (1 minute instead of 30s)
  // AND add visibility check:

  const startSessionPolling = useCallback(() => {
    if (sessionPollTimer.current) clearInterval(sessionPollTimer.current);

    const doPoll = async () => {
      if (document.visibilityState === "hidden") return; 
      if (!isLoggedIn.current) return;

      const client = api.getToken() ? api : studentApi;
      if (!client.getToken()) return;

      try {
        const result = await client.ping();

        if (!result.ok) {
          const code = result.code ?? "";
          const isInvalidated =
            code === "SESSION_INVALIDATED" ||
            code.includes("SESSION_INVALIDATED") ||
            code.includes("Session expired") ||
            code.includes("Logged in from another device");

          const isBlocked = code === "ACCOUNT_BLOCKED";

          if (isInvalidated) {
            clearSession();
            alert(
              "You have been logged out because your account was logged in from another device.",
            );
          } else if (isBlocked) {
            clearSession();
            alert("Your account has been blocked. Contact your teacher.");
          }
          // Other errors — transient, ignore
        }
      } catch {
        // Network errors — ignore
      }
    };

    sessionPollTimer.current = setInterval(doPoll, 5 * 60 * 1000); // ✅ 5 min
  }, [clearSession]);
  const stopSessionPolling = useCallback(() => {
    if (sessionPollTimer.current) {
      clearInterval(sessionPollTimer.current);
      sessionPollTimer.current = null;
    }
  }, []);

  const onLoginSuccess = useCallback(() => {
    isLoggedIn.current = true;
    startSessionPolling();
  }, [startSessionPolling]);

  const onLogout = useCallback(() => {
    isLoggedIn.current = false;
    stopSessionPolling();
  }, [stopSessionPolling]);

  // ─── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopSessionPolling();
    };
  }, [stopSessionPolling]);

  // ─── Global fetch intercept — 401/403 pe auto logout ──────────────────────
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      if (response.status === 401 || response.status === 403) {
        const cloned = response.clone();
        try {
          const data = await cloned.json();
          if (
            data.code === "SESSION_INVALIDATED" ||
            data.code === "ACCOUNT_BLOCKED"
          ) {
            localStorage.removeItem("token");
            localStorage.removeItem("student_data");
            window.location.href = "/login";
          }
        } catch {
          // JSON parse fail — ignore
        }
      }
      return response;
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  // ─── Initial auth check ────────────────────────────────────────────────────
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
      const isNetwork =
        message === "Failed to fetch" ||
        message.includes("NetworkError") ||
        message.includes("ERR_NETWORK") ||
        message.includes("ERR_INTERNET_DISCONNECTED") ||
        message.includes("timeout") ||
        message.includes("aborted");

      if (isNetwork) {
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

  // ─── Admin login ───────────────────────────────────────────────────────────
  // const login = async (email: string, password: string) => {
  //   const { user } = await api.login(email, password);
  //   studentApi.setToken(null);
  //   localStorage.removeItem("student_data");
  //   setStudent(null);
  //   setUser(user);
  //   setAuthReady(true);
  //   setAuthVersion((v) => v + 1);
  //   onLoginSuccess();
  // };
  // In login():
  const login = async (email: string, password: string) => {
    const { user } = await api.login(email, password);
    studentApi.setToken(null);
    localStorage.removeItem("student_data");

    // Batch all state updates — React 18 auto-batches these in event handlers
    // but wrap in startTransition for safety:
    setStudent(null);
    setUser(user);
    setAuthReady(true);
    // Only ONE authVersion bump at the end:
    setAuthVersion((v) => v + 1);
    onLoginSuccess();
  };
  // ─── Student login ─────────────────────────────────────────────────────────
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

  // ─── Logout ────────────────────────────────────────────────────────────────
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

  // ─── Refresh admin user ────────────────────────────────────────────────────
  const refreshUser = async () => {
    try {
      const { user } = await api.getMe();
      setUser(user);
    } catch (error: any) {
      const message = error?.message ?? "";
      const isNetwork =
        message === "Failed to fetch" ||
        message.includes("NetworkError") ||
        message.includes("ERR_NETWORK") ||
        message.includes("ERR_INTERNET_DISCONNECTED") ||
        message.includes("timeout") ||
        message.includes("aborted");

      if (isNetwork) {
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
