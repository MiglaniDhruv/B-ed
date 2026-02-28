import { useState } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import {
  Search,
  Trash2,
  BookOpen,
  Plus,
  X,
  Edit2,
  Loader2,
} from "lucide-react";
import { useAdminQuestions } from "../lib/hooks";
import type { Question } from "../lib/api";

interface OptionForm {
  text: string;
  isCorrect: boolean;
}

interface FormData {
  questionText: string;
  options: OptionForm[];
  marks: number;
  difficulty: string;
}

const EMPTY_FORM: FormData = {
  questionText: "",
  options: [
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
  ],
  marks: 1,
  difficulty: "easy",
};

const difficulties = ["easy", "medium", "hard"];

export function QuestionBankView() {
  const {
    questions,
    loading,
    error,
    createQuestion,
    updateQuestion,
    deleteQuestion,
  } = useAdminQuestions();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState("all");
  const [isAdding, setIsAdding] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setIsAdding(false);
    setEditingQuestion(null);
  };

  const handleEdit = (question: Question) => {
    const optionForms: OptionForm[] = [
      ...question.options.map((text, idx) => ({
        text,
        isCorrect: idx === question.correctAnswer,
      })),
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
    ].slice(0, 4);

    setFormData({
      questionText: question.questionText,
      options: optionForms,
      marks: question.marks || 1,
      difficulty: parseMetadata(question.explanation).difficulty || "easy",
    });
    setEditingQuestion(question);
    setIsAdding(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSave = async () => {
    if (!formData.questionText.trim()) {
      alert("Please enter a question");
      return;
    }
    const filledOptions = formData.options.filter((o) => o.text.trim());
    if (filledOptions.length < 2) {
      alert("Please add at least 2 options");
      return;
    }
    if (!filledOptions.some((o) => o.isCorrect)) {
      alert("Please mark at least one correct answer");
      return;
    }

    const correctIndex = filledOptions.findIndex((o) => o.isCorrect);
    const metadata = JSON.stringify({ difficulty: formData.difficulty });

    setSaving(true);
    try {
      if (editingQuestion) {
        await updateQuestion(editingQuestion.id, {
          questionText: formData.questionText.trim(),
          options: filledOptions.map((o) => o.text),
          correctAnswer: correctIndex,
          marks: formData.marks,
          explanation: metadata,
        });
      } else {
        await createQuestion({
          quizId: "bank",
          questionText: formData.questionText.trim(),
          options: filledOptions.map((o) => o.text),
          correctAnswer: correctIndex,
          marks: formData.marks,
          explanation: metadata,
          order: questions.length + 1,
        });
      }
      resetForm();
    } catch (err) {
      console.error(err);
      alert("Failed to save question.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this question?")) return;
    try {
      await deleteQuestion(id);
    } catch {
      alert("Failed to delete question");
    }
  };

  const enriched = questions.map((q) => ({
    ...q,
    difficulty: parseMetadata(q.explanation).difficulty || "easy",
  }));

  const filtered = enriched.filter((q) => {
    const matchesSearch = q.questionText
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesDifficulty =
      filterDifficulty === "all" || q.difficulty === filterDifficulty;
    return matchesSearch && matchesDifficulty;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400 mr-2" />
        <span className="text-slate-600">Loading questions…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-red-600 text-sm">
          Failed to load questions: {error}
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-slate-900">Question Bank</h2>
          <p className="text-sm text-slate-600 mt-0.5">
            {questions.length}{" "}
            {questions.length === 1 ? "question" : "questions"} in your
            collection
          </p>
        </div>
        <Button
          onClick={() => setIsAdding(true)}
          className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 rounded-lg flex items-center gap-2 transition-colors flex-shrink-0 text-sm"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Question</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search questions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
          />
        </div>
        <select
          value={filterDifficulty}
          onChange={(e) => setFilterDifficulty(e.target.value)}
          className="px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
        >
          <option value="all">All Difficulties</option>
          {difficulties.map((d) => (
            <option key={d} value={d}>
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Add / Edit Form */}
      {isAdding && (
        <Card className="p-5 bg-white border border-slate-200 rounded-lg mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-900">
              {editingQuestion ? "Edit Question" : "Add New Question"}
            </h3>
            <button
              onClick={resetForm}
              className="p-1 hover:bg-slate-100 rounded transition-colors"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Question Text
              </label>
              <textarea
                value={formData.questionText}
                onChange={(e) =>
                  setFormData({ ...formData, questionText: e.target.value })
                }
                placeholder="Enter your question here..."
                rows={3}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Options
              </label>
              <div className="space-y-2">
                {formData.options.map((option, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={option.isCorrect}
                      onChange={(e) => {
                        const newOptions = [...formData.options];
                        newOptions[idx] = {
                          ...newOptions[idx],
                          isCorrect: e.target.checked,
                        };
                        setFormData({ ...formData, options: newOptions });
                      }}
                      className="w-4 h-4 text-slate-900 border-slate-300 rounded focus:ring-slate-900 flex-shrink-0"
                    />
                    <input
                      type="text"
                      value={option.text}
                      onChange={(e) => {
                        const newOptions = [...formData.options];
                        newOptions[idx] = {
                          ...newOptions[idx],
                          text: e.target.value,
                        };
                        setFormData({ ...formData, options: newOptions });
                      }}
                      placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Check the box to mark correct answer(s)
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Marks
                </label>
                <input
                  type="number"
                  value={formData.marks}
                  onChange={(e) =>
                    setFormData({ ...formData, marks: Number(e.target.value) })
                  }
                  min="1"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Difficulty
                </label>
                <select
                  value={formData.difficulty}
                  onChange={(e) =>
                    setFormData({ ...formData, difficulty: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                >
                  {difficulties.map((d) => (
                    <option key={d} value={d}>
                      {d.charAt(0).toUpperCase() + d.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingQuestion ? "Update Question" : "Add Question"}
              </Button>
              <Button
                onClick={resetForm}
                disabled={saving}
                className="px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-lg transition-colors"
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Questions List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-xl bg-white">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-900 mb-1">
              No questions found
            </h3>
            <p className="text-sm text-slate-500">
              {questions.length === 0
                ? "Add your first question to get started"
                : "Try adjusting your search or filters"}
            </p>
          </div>
        ) : (
          filtered.map((question) => (
            <Card
              key={question.id}
              className="p-4 bg-white border border-slate-200 hover:border-slate-300 rounded-lg transition-all"
            >
              <div className="flex items-start gap-3">
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded ${
                        question.difficulty === "hard"
                          ? "bg-red-100 text-red-700"
                          : question.difficulty === "medium"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-green-100 text-green-700"
                      }`}
                    >
                      {question.difficulty.charAt(0).toUpperCase() +
                        question.difficulty.slice(1)}
                    </span>
                    {question.marks && (
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded">
                        {question.marks} mark{question.marks !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-slate-900 mb-3">
                    {question.questionText}
                  </p>
                  <div className="space-y-1.5">
                    {question.options.map((optText, idx) => (
                      <div
                        key={idx}
                        className={`text-xs px-3 py-2 rounded ${
                          idx === question.correctAnswer
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-slate-50 text-slate-600"
                        }`}
                      >
                        {String.fromCharCode(65 + idx)}. {optText}
                        {idx === question.correctAnswer && (
                          <span className="ml-2 font-semibold">✓ Correct</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* ✅ Actions — always visible on mobile, no opacity-0 */}
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => handleEdit(question)}
                    title="Edit"
                    className="p-2 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4 text-blue-600" />
                  </button>
                  <button
                    onClick={() => handleDelete(question.id)}
                    title="Delete"
                    className="p-2 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function parseMetadata(explanation?: string | null): { difficulty?: string } {
  if (!explanation) return {};

  try {
    const parsed = JSON.parse(explanation);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed;
    }
    return {};
  } catch {
    return {};
  }
}