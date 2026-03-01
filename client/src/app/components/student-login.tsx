import { useState } from "react";
import { studentPermissionsStore } from "@/app/data/student-permissions-data";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Mail, Lock, AlertCircle, ArrowLeft } from "lucide-react";
import logo from "../assets/logo.png";

interface StudentLoginProps {
  onLoginSuccess: (studentEmail: string) => void;
  onBackToRoleSelection: () => void;
}

export function StudentLogin({ onLoginSuccess, onBackToRoleSelection }: StudentLoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // Simulate loading
    setTimeout(() => {
      // Check if student exists and is approved
      const students = studentPermissionsStore.getAllStudents();
      const student = students.find((s) => s.email.toLowerCase() === email.toLowerCase());

      if (!student) {
        setError("Your email is not approved. Please contact your teacher to get access.");
        setIsLoading(false);
        return;
      }

      if (student.status === "blocked") {
        setError("Your account has been blocked. Please contact your teacher.");
        setIsLoading(false);
        return;
      }

      if (student.status === "pending") {
        setError("Your account is pending approval. Please wait for teacher approval.");
        setIsLoading(false);
        return;
      }

      // Student is approved, allow login
      onLoginSuccess(student.email);
      setIsLoading(false);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 bg-white border border-slate-200 rounded-xl">
        {/* Back Button */}
        <button
          onClick={onBackToRoleSelection}
          className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-slate-900 rounded-xl flex items-center justify-center mx-auto mb-4">
            <img src={logo} alt="Logo" className="w-12 h-12" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Student Login</h1>
          <p className="text-sm text-slate-600">Access your study materials and quizzes</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
            <div className="relative">
              <Mail className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@example.com"
                required
                className="w-full pl-11 pr-4 py-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
            <div className="relative">
              <Lock className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-11 pr-4 py-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        {/* Info Message */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-800">
            <strong>Note:</strong> Only students approved by your teacher can login. Contact your teacher if you don't have access.
          </p>
        </div>

        {/* Demo Account Info */}
        <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
          <p className="text-xs font-semibold text-slate-700 mb-2">Demo Account:</p>
          <div className="space-y-1 text-xs text-slate-600">
            <p>✅ <strong>Email:</strong> emily.johnson@student.edu</p>
            <p className="text-xs text-slate-500 mt-2">Password: any (demo only)</p>
          </div>
        </div>
      </Card>
    </div>
  );
}