import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { SplashScreen } from "./components/SplashScreen";
import { TeacherDashboard } from "./components/teacher-dashboard";
import { StudentDashboard } from "./components/student-dashboard";
import { LoginPage } from "./components/login-page";
import { seedDemoData } from "./data/demo-data-seeder";
import { AuthProvider, useAuth } from "./lib/auth-context";
import { useEffect } from "react";

// ─── Protected Route ──────────────────────────────────────────────────────────
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <SplashScreen />;
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// ─── Login ────────────────────────────────────────────────────────────────────
function LoginRoute() {
  const navigate = useNavigate();

  return (
    <LoginPage
      onTeacherLogin={() => navigate("/teacher")}
      onStudentLogin={(email) =>
        navigate(`/student?email=${encodeURIComponent(email)}`)
      }
    />
  );
}

// ─── Teacher ──────────────────────────────────────────────────────────────────
function TeacherRoute() {
  const navigate = useNavigate();
  return (
    <ProtectedRoute>
      <TeacherDashboard onBack={() => navigate("/")} />
    </ProtectedRoute>
  );
}

// ─── Student ──────────────────────────────────────────────────────────────────
function StudentRoute() {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const email = params.get("email") || "";

  return (
    <ProtectedRoute>
      <StudentDashboard studentEmail={email} onLogout={() => navigate("/")} />
    </ProtectedRoute>
  );
}

// ─── App Content ──────────────────────────────────────────────────────────────
function AppContent() {
  const { authReady } = useAuth();

  useEffect(() => {
    seedDemoData();
  }, []);

  // ✅ Show splash screen while auth is initializing
  if (!authReady) return <SplashScreen />;

  return (
    <Routes>
      <Route path="/" element={<LoginRoute />} />
      <Route path="/teacher/*" element={<TeacherRoute />} />
      <Route path="/student" element={<StudentRoute />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}
