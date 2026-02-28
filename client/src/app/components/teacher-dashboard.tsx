import { useState, useEffect } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { QuestionBankView } from "./question-bank-view";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { QuizBuilder } from "./quiz-builder";
import type { QuizData } from "./quiz-builder";
import { QuestionBankSelector } from "./question-bank-selector";
import { QuizDetailsForm } from "./quiz-details-form";
import { AddCustomQuestion } from "./add-custom-question";
import { MaterialsHierarchy } from "./materials-hierarchy";
import { NoticeBoardPage } from "./notice-board";
import {
  Plus,
  Trash2,
  FileText,
  Library,
  ArrowLeft,
  LogOut,
  Timer,
  GraduationCap,
  Shield,
  Grid3x3,
  ClipboardList,
  Upload,
  Calendar,
  Loader2,
  BarChart2,
  Trophy,
  Users,
  TrendingUp,
  Clock,
  Award,
  Medal,
  Megaphone,
} from "lucide-react";
import { StudentPermissions } from "./student-permissions";
import { Zap } from "lucide-react";
import { AppHeader } from "./app-header";
import { TabNavigation } from "./tab-navigation";
import { useQuizzes, useAdminQuestions } from "../lib/hooks";
import { api } from "../lib/api";
import type { Question, Quiz } from "../lib/api";

interface LeaderboardEntry {
  rank: number;
  studentId: string;
  studentName: string;
  studentEmail: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  timeTaken: number | null;
  submittedAt: string | null;
}

interface QuizAnalytics {
  quizId: string;
  quizTitle: string;
  totalAttempts: number;
  averageScore: number;
  averagePercentage: number;
  highestScore: number;
  lowestScore: number;
  totalQuestions: number;
  leaderboard: LeaderboardEntry[];
}

interface TeacherDashboardProps {
  onBack: () => void;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-lg">🥇</span>;
  if (rank === 2) return <span className="text-lg">🥈</span>;
  if (rank === 3) return <span className="text-lg">🥉</span>;
  return (
    <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center">
      {rank}
    </span>
  );
}

function formatTime(seconds: number | null): string {
  if (seconds === null) return "—";
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function scoreColor(pct: number) {
  return pct >= 70
    ? "text-green-600"
    : pct >= 40
      ? "text-yellow-600"
      : "text-red-500";
}

function scoreBg(pct: number) {
  return pct >= 70
    ? "bg-green-50 border-green-200"
    : pct >= 40
      ? "bg-yellow-50 border-yellow-200"
      : "bg-red-50 border-red-200";
}

export function TeacherDashboard({ onBack }: TeacherDashboardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const pathTab = location.pathname.split("/teacher/")[1] || "dashboard";
  const activeTab = pathTab || "dashboard";
  const setActiveTab = (tab: string) =>
    navigate(tab === "dashboard" ? "/teacher" : `/teacher/${tab}`);

  const [showAddQuiz, setShowAddQuiz] = useState(false);
  const [showQuizBuilder, setShowQuizBuilder] = useState(false);
  const [showQuestionBankSelector, setShowQuestionBankSelector] =
    useState(false);
  const [showQuizDetailsForm, setShowQuizDetailsForm] = useState(false);
  const [showAddCustomQuestion, setShowAddCustomQuestion] = useState(false);
  const [selectedQuestionsForQuiz, setSelectedQuestionsForQuiz] = useState<
    Question[]
  >([]);
  const [isSavingQuiz, setIsSavingQuiz] = useState(false);

  const [analyticsQuiz, setAnalyticsQuiz] = useState<Quiz | null>(null);
  const [analytics, setAnalytics] = useState<QuizAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  const [pendingStudents, setPendingStudents] = useState(0);
  const [totalStudents, setTotalStudents] = useState(0);
  const [totalMaterials, setTotalMaterials] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);

  const {
    quizzes = [],
    loading: quizzesLoading,
    updateQuiz,
    deleteQuiz,
    refetch: refetchQuizzes,
  } = useQuizzes();
  const { questions = [] } = useAdminQuestions();

  const totalQuizzes = quizzes?.length || 0;
  const publishedQuizzes = quizzes?.filter((q) => q.isActive).length || 0;
  const totalQuestions = questions?.length || 0;

  useEffect(() => {
    const fetchStats = async () => {
      setStatsLoading(true);
      try {
        const stats = await api.getAdminStats();
        setTotalMaterials(stats.materials ?? 0);
        const students = await api.getStudents();
        setTotalStudents(students.length);
        setPendingStudents(
          students.filter((s: any) => s.status === "pending").length,
        );
      } catch (err) {
        console.error("Failed to fetch dashboard stats:", err);
      } finally {
        setStatsLoading(false);
      }
    };
    fetchStats();
  }, []);

  const handleViewAnalytics = async (quiz: Quiz) => {
    setAnalyticsQuiz(quiz);
    setAnalytics(null);
    setAnalyticsError(null);
    setAnalyticsLoading(true);
    try {
      setAnalytics(await api.getQuizAnalytics(quiz.id));
    } catch (err: any) {
      setAnalyticsError(err.message || "Failed to load analytics");
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const handleCloseAnalytics = () => {
    setAnalyticsQuiz(null);
    setAnalytics(null);
    setAnalyticsError(null);
  };
  const handleCancelBuilder = () => {
    setShowQuizBuilder(false);
    refetchQuizzes();
  };

  const handleStartQuizCreation = (
    method: "builder" | "questionBank" | "custom",
  ) => {
    if (method === "builder") setShowQuizBuilder(true);
    else if (method === "questionBank") setShowQuestionBankSelector(true);
    else if (method === "custom") setShowAddCustomQuestion(true);
    setShowAddQuiz(false);
  };

  const handleQuizBuilderComplete = async (_quizData: QuizData) => {
    setShowQuizBuilder(false);
    refetchQuizzes();
  };

  const handleQuestionsSelected = (qs: Question[]) => {
    setSelectedQuestionsForQuiz(qs);
    setShowQuestionBankSelector(false);
    setShowQuizDetailsForm(true);
  };

  // ── KEY FIX 1: allowReview is now correctly passed to api.createQuiz
  // ── KEY FIX 2: quiz is created ONLY here — never earlier in the flow
  // ── KEY FIX 3: defined at top level (not inside inner component) so state is never stale
  const handleQuizDetailsComplete = async (quizDetails: {
    title: string;
    description: string;
    duration: number;
    subjectId: string;
    allowReview: boolean;
  }) => {
    if (isSavingQuiz) return; // prevent double-submit
    setIsSavingQuiz(true);
    try {
      const totalMarks = selectedQuestionsForQuiz.reduce(
        (sum, q) => sum + (q.marks ?? 1),
        0,
      );

      // Quiz is created exactly once, only when teacher clicks "Create Quiz"
      const newQuiz = await api.createQuiz({
        subjectId: quizDetails.subjectId || "",
        title: quizDetails.title,
        description: quizDetails.description || null,
        duration: quizDetails.duration,
        totalMarks,
        allowReview: quizDetails.allowReview, // ← was missing before — this is what controlled the review button
        isActive: false,
      } as any);

      // Link selected questions to the quiz
      for (const q of selectedQuestionsForQuiz) {
        try {
          await api.addQuestionToQuiz(newQuiz.id, q.id);
        } catch (err) {
          console.warn("Failed to link question", q.id, err);
        }
      }

      refetchQuizzes();
      setShowQuizDetailsForm(false);
      setSelectedQuestionsForQuiz([]);
    } catch (err: any) {
      alert(`Failed to create quiz: ${err?.message ?? "Unknown error"}`);
    } finally {
      setIsSavingQuiz(false);
    }
  };

  const handleCancelQuizDetails = () => {
    setShowQuizDetailsForm(false);
    setSelectedQuestionsForQuiz([]);
  };

  const handlePublishQuiz = async (id: string) => {
    try {
      await updateQuiz(id, { isActive: true });
    } catch {
      alert("Failed to publish quiz");
    }
  };

  const handleUnpublishQuiz = async (id: string) => {
    try {
      await updateQuiz(id, { isActive: false });
    } catch {
      alert("Failed to unpublish quiz");
    }
  };

  const handleDeleteQuiz = async (id: string) => {
    if (!confirm("Delete this quiz?")) return;
    try {
      await deleteQuiz(id);
    } catch {
      alert("Failed to delete quiz");
    }
  };

  const tabs = [
    { id: "dashboard", label: "Overview", icon: Grid3x3 },
    { id: "materials", label: "Materials", icon: FileText },
    { id: "quizzes", label: "Quizzes", icon: ClipboardList },
    { id: "question-bank", label: "Question Bank", icon: Library },
    { id: "notices", label: "Notice Board", icon: Megaphone },
    { id: "students", label: "Students", icon: Shield, badge: pendingStudents },
  ];

  // ── render functions (not inner components) to avoid stale closure bugs ──

  const renderAnalyticsView = () => {
    if (!analyticsQuiz) return null;
    return (
      <div>
        <button
          onClick={handleCloseAnalytics}
          className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Quizzes
        </button>
        <div className="flex items-center gap-3 mb-1">
          <BarChart2 className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-slate-900">Quiz Analytics</h2>
        </div>
        <p className="text-sm text-slate-600 mb-8 ml-9">
          {analyticsQuiz.title}
        </p>
        {analyticsLoading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-7 h-7 animate-spin text-blue-500 mr-3" />
            <span className="text-slate-600">Loading analytics…</span>
          </div>
        )}
        {analyticsError && (
          <div className="text-center py-16 border-2 border-dashed border-red-200 rounded-xl bg-red-50">
            <p className="text-red-600 font-medium">{analyticsError}</p>
            <button
              onClick={() => handleViewAnalytics(analyticsQuiz)}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        )}
        {!analyticsLoading && !analyticsError && analytics && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              {[
                {
                  icon: Users,
                  color: "blue",
                  label: "Total Attempts",
                  value: analytics.totalAttempts,
                },
                {
                  icon: TrendingUp,
                  color: "purple",
                  label: "Average Score",
                  value: `${analytics.averagePercentage}%`,
                },
                {
                  icon: Trophy,
                  color: "green",
                  label: "Highest Score",
                  value: `${analytics.highestScore}/${analytics.totalQuestions}`,
                },
                {
                  icon: Award,
                  color: "orange",
                  label: "Lowest Score",
                  value: `${analytics.lowestScore}/${analytics.totalQuestions}`,
                },
              ].map(({ icon: Icon, color, label, value }) => (
                <Card
                  key={label}
                  className="p-4 bg-white border border-slate-200 rounded-xl"
                >
                  <div
                    className={`w-8 h-8 bg-${color}-50 rounded-lg flex items-center justify-center mb-2`}
                  >
                    <Icon className={`w-4 h-4 text-${color}-600`} />
                  </div>
                  <div className="text-xl font-bold text-slate-900 mb-0.5">
                    {value}
                  </div>
                  <div className="text-xs text-slate-500">{label}</div>
                </Card>
              ))}
            </div>
            {analytics.totalAttempts > 0 && (
              <Card className="p-5 bg-white border border-slate-200 rounded-xl mb-6">
                <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-slate-400" /> Class
                  Performance
                </h3>
                {[
                  { label: "Average", pct: analytics.averagePercentage },
                  {
                    label: "Highest",
                    pct:
                      analytics.totalQuestions > 0
                        ? Math.round(
                            (analytics.highestScore /
                              analytics.totalQuestions) *
                              100,
                          )
                        : 0,
                  },
                ].map(({ label, pct }) => (
                  <div key={label} className="flex items-center gap-3 mb-2">
                    <span className="text-xs text-slate-400 w-16">{label}</span>
                    <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-yellow-500" : "bg-red-400"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span
                      className={`text-sm font-semibold w-12 text-right ${scoreColor(pct)}`}
                    >
                      {pct}%
                    </span>
                  </div>
                ))}
              </Card>
            )}
            <Card className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <Medal className="w-5 h-5 text-yellow-500" />
                <h3 className="text-base font-semibold text-slate-900">
                  Student Leaderboard
                </h3>
                <span className="ml-auto text-xs text-slate-400">
                  {analytics.totalAttempts} student
                  {analytics.totalAttempts !== 1 ? "s" : ""}
                </span>
              </div>
              {analytics.totalAttempts === 0 ? (
                <div className="py-16 text-center">
                  <Users className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">
                    No students have attempted this quiz yet.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  <div className="hidden md:grid grid-cols-[40px_1fr_120px_100px_100px] gap-4 px-6 py-2 bg-slate-50 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    <span>#</span>
                    <span>Student</span>
                    <span className="text-center">Score</span>
                    <span className="text-center">Time</span>
                    <span className="text-center">Date</span>
                  </div>
                  {analytics.leaderboard.map((entry) => (
                    <div
                      key={entry.studentId}
                      className={`px-4 md:px-6 py-4 flex flex-col md:grid md:grid-cols-[40px_1fr_120px_100px_100px] gap-2 md:gap-4 md:items-center transition-colors hover:bg-slate-50 ${entry.rank <= 3 ? "bg-gradient-to-r from-yellow-50/40 to-transparent" : ""}`}
                    >
                      <div className="flex items-center justify-start md:justify-center">
                        <RankBadge rank={entry.rank} />
                      </div>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-sm font-semibold">
                            {entry.studentName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {entry.studentName}
                          </p>
                          <p className="text-xs text-slate-400 truncate">
                            {entry.studentEmail}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-start md:justify-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border ${scoreBg(entry.percentage)} ${scoreColor(entry.percentage)}`}
                        >
                          {entry.score}/{entry.totalQuestions}{" "}
                          <span className="text-xs font-normal opacity-70">
                            ({entry.percentage}%)
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center justify-start md:justify-center gap-1 text-sm text-slate-500">
                        <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{formatTime(entry.timeTaken)}</span>
                      </div>
                      <div className="text-xs text-slate-400 md:text-center">
                        {entry.submittedAt
                          ? new Date(entry.submittedAt).toLocaleDateString(
                              "en-US",
                              { month: "short", day: "numeric" },
                            )
                          : "—"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    );
  };

  const renderQuizzesPage = () => {
    if (analyticsQuiz) return renderAnalyticsView();

    if (showQuizBuilder)
      return (
        <div>
          <button
            onClick={handleCancelBuilder}
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Quizzes
          </button>
          <h2 className="text-2xl font-bold text-slate-900 mb-1">
            Create New Quiz
          </h2>
          <p className="text-sm text-slate-600 mb-6">
            Build your quiz with custom questions
          </p>
          <QuizBuilder
            onComplete={handleQuizBuilderComplete}
            onCancel={handleCancelBuilder}
            editingQuiz={null}
            editingQuestions={[]}
          />
        </div>
      );

    if (showQuestionBankSelector)
      return (
        <div>
          <button
            onClick={() => setShowQuestionBankSelector(false)}
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Quizzes
          </button>
          <h2 className="text-2xl font-bold text-slate-900 mb-1">
            Select Questions from Bank
          </h2>
          <QuestionBankSelector
            onSelectQuestions={handleQuestionsSelected}
            onCancel={() => setShowQuestionBankSelector(false)}
          />
        </div>
      );

    if (showQuizDetailsForm)
      return (
        <div>
          <button
            onClick={handleCancelQuizDetails}
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Quizzes
          </button>
          <h2 className="text-2xl font-bold text-slate-900 mb-1">
            Quiz Details
          </h2>
          <QuizDetailsForm
            selectedQuestions={selectedQuestionsForQuiz}
            onComplete={handleQuizDetailsComplete}
            onCancel={handleCancelQuizDetails}
            isSaving={isSavingQuiz}
          />
        </div>
      );

    if (showAddCustomQuestion)
      return (
        <div>
          <button
            onClick={() => setShowAddCustomQuestion(false)}
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Quizzes
          </button>
          <h2 className="text-2xl font-bold text-slate-900 mb-1">
            Add Custom Question
          </h2>
          <AddCustomQuestion
            onComplete={() => setShowAddCustomQuestion(false)}
            onCancel={() => setShowAddCustomQuestion(false)}
          />
        </div>
      );

    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Quizzes</h2>
            <p className="text-sm text-slate-600 mt-0.5">
              Create and manage your quizzes
            </p>
          </div>
          <Button
            onClick={() => setShowAddQuiz(true)}
            className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Create Quiz</span>
            <span className="sm:hidden">Create</span>
          </Button>
        </div>

        {showAddQuiz && (
          <Card className="p-5 bg-white border border-slate-200 rounded-xl mb-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-900">
                Choose Quiz Creation Method
              </h3>
              <button
                onClick={() => setShowAddQuiz(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  method: "builder" as const,
                  icon: Zap,
                  color: "blue",
                  title: "Quick Builder",
                  desc: "Create questions on the fly",
                },
                {
                  method: "questionBank" as const,
                  icon: Library,
                  color: "purple",
                  title: "From Question Bank",
                  desc: "Select from existing questions",
                },
                {
                  method: "custom" as const,
                  icon: Plus,
                  color: "green",
                  title: "Add to Bank First",
                  desc: "Add a custom question to your bank",
                },
              ].map(({ method, icon: Icon, color, title, desc }) => (
                <button
                  key={method}
                  onClick={() => handleStartQuizCreation(method)}
                  className="p-4 border-2 border-slate-200 hover:border-slate-900 rounded-xl transition-all group text-left"
                >
                  <div
                    className={`w-10 h-10 bg-${color}-50 group-hover:bg-${color}-100 rounded-lg flex items-center justify-center mb-3`}
                  >
                    <Icon className={`w-5 h-5 text-${color}-600`} />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-900 mb-1">
                    {title}
                  </h4>
                  <p className="text-xs text-slate-500">{desc}</p>
                </button>
              ))}
            </div>
          </Card>
        )}

        {quizzesLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400 mr-2" />
            <span className="text-slate-600">Loading quizzes…</span>
          </div>
        ) : quizzes.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-xl bg-white">
            <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-900 mb-1">
              No quizzes yet
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Create your first quiz to get started
            </p>
            <Button
              onClick={() => setShowAddQuiz(true)}
              className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-lg"
            >
              <Plus className="w-4 h-4 mr-2" /> Create Quiz
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {quizzes.map((quiz) => (
              <Card
                key={quiz.id}
                className="p-4 bg-white border border-slate-200 hover:border-slate-300 rounded-xl transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-sm font-semibold text-slate-900">
                        {quiz.title}
                      </h3>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${quiz.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}
                      >
                        {quiz.isActive ? "Published" : "Draft"}
                      </span>
                      {/* Bonus: show a badge when review is enabled so teacher knows at a glance */}
                      {quiz.allowReview && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                          Review On
                        </span>
                      )}
                    </div>
                    {quiz.description && (
                      <p className="text-xs text-slate-600 mb-2 line-clamp-1">
                        {quiz.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                      {quiz.duration && (
                        <div className="flex items-center gap-1">
                          <Timer className="w-3 h-3" />
                          <span>{quiz.duration} min</span>
                        </div>
                      )}
                      {quiz.totalMarks && (
                        <div className="flex items-center gap-1">
                          <ClipboardList className="w-3 h-3" />
                          <span>{quiz.totalMarks} marks</span>
                        </div>
                      )}
                      {quiz.createdAt && (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>
                            {new Date(quiz.createdAt).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              },
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleViewAnalytics(quiz)}
                      title="View analytics"
                      className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors"
                    >
                      <BarChart2 className="w-4 h-4" />
                    </button>
                    {!quiz.isActive ? (
                      <Button
                        onClick={() => handlePublishQuiz(quiz.id)}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs"
                      >
                        Publish
                      </Button>
                    ) : (
                      <Button
                        onClick={() => handleUnpublishQuiz(quiz.id)}
                        className="bg-slate-600 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg text-xs"
                      >
                        Unpublish
                      </Button>
                    )}
                    <button
                      onClick={() => handleDeleteQuiz(quiz.id)}
                      title="Delete quiz"
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderDashboardPage = () => (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900">Dashboard Overview</h2>
        <p className="text-sm text-slate-600 mt-0.5">
          Monitor your teaching activities and student engagement
        </p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          {
            icon: FileText,
            color: "blue",
            label: "Study Materials",
            value: totalMaterials,
            loading: statsLoading,
          },
          {
            icon: ClipboardList,
            color: "green",
            label: "Published Quizzes",
            value: `${publishedQuizzes}/${totalQuizzes}`,
            loading: quizzesLoading,
          },
          {
            icon: Library,
            color: "purple",
            label: "Question Bank",
            value: totalQuestions,
            loading: false,
          },
          {
            icon: GraduationCap,
            color: "orange",
            label: "Total Students",
            value: totalStudents,
            loading: statsLoading,
          },
        ].map(({ icon: Icon, color, label, value, loading: l }) => (
          <Card
            key={label}
            className="p-4 bg-white border border-slate-200 rounded-xl"
          >
            <div
              className={`w-9 h-9 bg-${color}-50 rounded-lg flex items-center justify-center mb-3`}
            >
              <Icon className={`w-5 h-5 text-${color}-600`} />
            </div>
            {l ? (
              <Loader2 className="w-5 h-5 animate-spin text-slate-400 mb-1" />
            ) : (
              <div className="text-xl font-bold text-slate-900 mb-0.5">
                {value}
              </div>
            )}
            <div className="text-xs text-slate-500 leading-tight">{label}</div>
          </Card>
        ))}
      </div>
      <div className="mb-2">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              tab: "materials",
              icon: Upload,
              color: "blue",
              title: "Upload Material",
              desc: "Add new study resources",
            },
            {
              tab: "quizzes",
              icon: Plus,
              color: "green",
              title: "Create Quiz",
              desc: "Build a new assessment",
              extra: () => setShowAddQuiz(true),
            },
            {
              tab: "notices",
              icon: Megaphone,
              color: "yellow",
              title: "Post Notice",
              desc: "Announce to students",
            },
            {
              tab: "students",
              icon: Shield,
              color: "orange",
              title: "Manage Students",
              desc: "Review access requests",
            },
          ].map(({ tab, icon: Icon, color, title, desc, extra }) => (
            <Card
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                extra?.();
              }}
              className="p-4 bg-white border border-slate-200 hover:border-slate-300 rounded-xl cursor-pointer transition-all group hover:shadow-md"
            >
              <div
                className={`w-9 h-9 bg-${color}-50 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}
              >
                <Icon className={`w-4 h-4 text-${color}-600`} />
              </div>
              <h4 className="text-xs font-semibold text-slate-900 mb-0.5">
                {title}
              </h4>
              <p className="text-xs text-slate-500 leading-tight hidden sm:block">
                {desc}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader
        title="Teacher Dashboard"
        actions={
          <Button
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors text-sm"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        }
      >
        <TabNavigation
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </AppHeader>
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-5 md:py-8">
        <Routes>
          <Route path="/" element={renderDashboardPage()} />
          <Route
            path="/materials"
            element={<MaterialsHierarchy key="materials" />}
          />
          <Route path="/quizzes" element={renderQuizzesPage()} />
          <Route
            path="/question-bank"
            element={<QuestionBankView key="question-bank" />}
          />
          <Route path="/notices" element={<NoticeBoardPage key="notices" />} />
          <Route
            path="/students"
            element={<StudentPermissions key="students" />}
          />
        </Routes>
      </div>
    </div>
  );
}
