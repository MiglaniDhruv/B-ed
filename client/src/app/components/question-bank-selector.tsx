import { useState } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Search, BookOpen, Check, Loader2 } from "lucide-react";
import { useAdminQuestions } from "../lib/hooks";
import type { Question } from "../lib/api";

// ─── Helper: parse subject/difficulty from explanation JSON ───────────────────
function parseMetadata(explanation: string | null): {
  subject?: string;
  difficulty?: string;
} {
  if (!explanation) return {};
  try {
    const parsed = JSON.parse(explanation);
    if (typeof parsed === "object" && parsed !== null) return parsed;
    return {};
  } catch {
    return {};
  }
}

interface QuestionBankSelectorProps {
  onSelectQuestions: (questions: Question[]) => void;
  onCancel: () => void;
  disabledQuestionIds?: Set<string>; // 👈 add karo
}
export function QuestionBankSelector({
  onSelectQuestions,
  onCancel,
  disabledQuestionIds = new Set(),
}: QuestionBankSelectorProps) {
  // ✅ All questions fetched from API — no localStorage
  const { questions, loading, error } = useAdminQuestions();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterSubject, setFilterSubject] = useState("all");
  const [filterDifficulty, setFilterDifficulty] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const difficulties = ["easy", "medium", "hard"];

  // Enrich questions with subject/difficulty from explanation metadata
  const enriched = questions.map((q) => ({
    ...q,
    subject: parseMetadata(q.explanation).subject || "General",
    difficulty: parseMetadata(q.explanation).difficulty || "easy",
  }));

  const subjects = Array.from(new Set(enriched.map((q) => q.subject)));

  const filtered = enriched.filter((q) => {
    const matchesSearch = q.questionText
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesSubject =
      filterSubject === "all" || q.subject === filterSubject;
    const matchesDifficulty =
      filterDifficulty === "all" || q.difficulty === filterDifficulty;
    return matchesSearch && matchesSubject && matchesDifficulty;
  });

  const toggleSelect = (id: string) => {
    if (disabledQuestionIds.has(id)) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((q) => q.id)));
    }
  };

  const handleConfirm = () => {
    const selected = questions.filter((q) => selectedIds.has(q.id));
    onSelectQuestions(selected);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400 mr-2" />
        <span className="text-slate-600">Loading question bank…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-red-600 text-sm">
          Failed to load questions: {error}
        </p>
        <Button onClick={onCancel} className="mt-4">
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Select from Question Bank
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            {selectedIds.size} of {filtered.length} selected
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={onCancel}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedIds.size === 0}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm disabled:opacity-50"
          >
            Add {selectedIds.size > 0 ? `(${selectedIds.size})` : ""} Questions
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
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
        <div className="flex gap-3">
          <select
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            className="px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
          >
            <option value="all">All Subjects</option>
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
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
      </div>

      {/* Select all row */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between mb-3 px-1">
          <button
            onClick={toggleSelectAll}
            className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
          >
            {selectedIds.size === filtered.length
              ? "Deselect all"
              : `Select all (${filtered.length})`}
          </button>
          <span className="text-xs text-slate-400">
            {filtered.length} question{filtered.length !== 1 ? "s" : ""} shown
          </span>
        </div>
      )}

      {/* Questions list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-xl bg-white">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-900 mb-1">
              No questions found
            </h3>
            <p className="text-sm text-slate-500">
              {questions.length === 0
                ? "Add questions in the Question Bank tab first"
                : "Try adjusting your search or filters"}
            </p>
          </div>
        ) : (
          filtered.map((question) => {
            const isSelected = selectedIds.has(question.id);
            return (
              <Card
                key={question.id}
                onClick={() => toggleSelect(question.id)}
                className={`p-4 border rounded-lg transition-all ${
                  disabledQuestionIds.has(question.id)
                    ? "border-slate-200 bg-slate-100 opacity-50 cursor-not-allowed" // 👈 disabled style
                    : isSelected
                      ? "border-slate-900 bg-slate-50 cursor-pointer"
                      : "border-slate-200 bg-white hover:border-slate-300 cursor-pointer"
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                      isSelected
                        ? "bg-slate-900 border-slate-900"
                        : "border-slate-300 bg-white"
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Badges */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs font-medium rounded">
                        {question.subject}
                      </span>
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
                          {question.marks} mark
                          {question.marks !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>

                    {/* Question text */}
                    <p className="text-sm font-medium text-slate-900 mb-2">
                      {question.questionText}
                    </p>

                    {/* Options */}
                    <div className="space-y-1">
                      {question.options.map((optText, idx) => (
                        <div
                          key={idx}
                          className={`text-xs px-3 py-1.5 rounded ${
                            idx === question.correctAnswer
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-slate-50 text-slate-600"
                          }`}
                        >
                          {String.fromCharCode(65 + idx)}. {optText}
                          {idx === question.correctAnswer && (
                            <span className="ml-2 font-semibold">✓</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Sticky bottom bar when items selected */}
      {selectedIds.size > 0 && (
        <div className="sticky bottom-4 mt-6 flex justify-center">
          <div className="bg-slate-900 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-4">
            <span className="text-sm font-medium">
              {selectedIds.size} question{selectedIds.size !== 1 ? "s" : ""}{" "}
              selected
            </span>
            <Button
              onClick={handleConfirm}
              className="bg-white text-slate-900 hover:bg-slate-100 px-4 py-1.5 rounded-lg text-sm font-medium"
            >
              Add to Quiz
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
