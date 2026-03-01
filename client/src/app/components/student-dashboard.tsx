import { useState } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { FileText, ClipboardList, LogOut, BookOpen } from "lucide-react";
import { AppHeader } from "./app-header";
import { TabNavigation } from "./tab-navigation";

interface StudentDashboardProps {
  studentEmail: string;
  onLogout: () => void;
}

export function StudentDashboard({ studentEmail, onLogout }: StudentDashboardProps) {
  const [activeTab, setActiveTab] = useState<"materials" | "quizzes">("materials");

  const tabs = [
    { id: "materials", label: "Study Materials", icon: FileText },
    { id: "quizzes", label: "Quizzes", icon: ClipboardList },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <AppHeader
        title="Student Dashboard"
        subtitle={studentEmail}
        actions={
          <Button
            onClick={onLogout}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </Button>
        }
      >
        <TabNavigation tabs={tabs} activeTab={activeTab} onTabChange={(tab) => setActiveTab(tab as any)} />
      </AppHeader>

      {/* Content */}
      <div className="max-w-[1400px] mx-auto px-6 lg:px-8 py-8">
        {activeTab === "materials" && (
          <div>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900">Study Materials</h2>
              <p className="text-sm text-slate-600 mt-1">Access your course materials and resources</p>
            </div>

            <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-xl bg-white">
              <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-900 mb-1">No materials available yet</h3>
              <p className="text-sm text-slate-500">Your teacher will upload study materials soon</p>
            </div>
          </div>
        )}

        {activeTab === "quizzes" && (
          <div>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900">Quizzes</h2>
              <p className="text-sm text-slate-600 mt-1">Take quizzes and track your progress</p>
            </div>

            <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-xl bg-white">
              <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-900 mb-1">No quizzes available yet</h3>
              <p className="text-sm text-slate-500">Your teacher will create quizzes soon</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}