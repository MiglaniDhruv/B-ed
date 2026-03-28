import { useState, useEffect } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import logo from "../../assets/logo.png";
import {
  Search,
  Trash2,
  BookOpen,
  Plus,
  X,
  Edit2,
  Loader2,
  FileText,
  CheckSquare,
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

function parseMetadata(explanation?: string | null): { difficulty?: string } {
  if (!explanation) return {};
  try {
    const parsed = JSON.parse(explanation);
    if (typeof parsed === "object" && parsed !== null) return parsed;
    return {};
  } catch {
    return {};
  }
}

// ── PDF via print window — supports Gujarati, Hindi, English natively ─────────
function generatePrintPDF(selectedQuestions: Question[], logoBase64: string) {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>Quiz Paper</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: Arial, sans-serif;
            padding: 40px;
            color: #000;
            font-size: 13px;
            line-height: 1.7;
          }
          h1 {
            text-align: center;
            font-size: 20px;
            font-weight: 700;
            margin-bottom: 4px;
          }
          .meta {
            text-align: center;
            font-size: 11px;
            color: #555;
            margin-bottom: 20px;
          }
          hr { border: none; border-top: 1.5px solid #333; margin-bottom: 24px; }
          .question { margin-bottom: 22px; page-break-inside: avoid; }
          .question-text {
            font-weight: 600;
            font-size: 13px;
            margin-bottom: 8px;
          }
          .options { padding-left: 24px; }
          .option { margin-bottom: 4px; font-size: 12px; }

          /* Answer key page */
.answer-title { text-align: center; font-size: 18px; font-weight: 700; margin-bottom: 20px; }
.answer-row { font-size: 12px; margin-bottom: 6px; }
.answer-correct { font-weight: 600; color: #16a34a; }
          .answer-row { font-size: 12px; margin-bottom: 6px; }
          .answer-correct { font-weight: 600; color: #16a34a; }

          @media print {
            body { padding: 20px; }
          }
        </style>
      </head>
      <body>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
  <div></div>
  <h1 style="text-align: center; font-size: 20px; font-weight: 700; flex: 1;">Quiz Paper</h1>
  ${
    logoBase64
      ? `<img src="${logoBase64}" style="height: 56px; width: auto; object-fit: contain;" />`
      : `<div style="width: 56px;"></div>`
  }
</div>

        <hr />

        <!-- Questions -->
        ${selectedQuestions
          .map(
            (q, idx) => `
          <div class="question">
            <div class="question-text">
              ${idx + 1}. ${q.questionText}
            </div>
            <div class="options">
              ${q.options
                .map(
                  (opt, i) => `
                <div class="option">${String.fromCharCode(65 + i)}. ${opt}</div>
              `,
                )
                .join("")}
            </div>
          </div>
        `,
          )
          .join("")}

        <!-- Answer Key -->
        <div class="answer-page">
          <div class="answer-title">Answer Key</div>
          <hr />
          <div style="columns: 3; column-gap: 24px;">
            ${selectedQuestions
              .map((q, idx) => {
                const ansIdx = q.correctAnswer ?? 0;
                const letter = String.fromCharCode(65 + ansIdx);
                const text = q.options?.[ansIdx] ?? "";
                return `
                <div class="answer-row">
                  <span>${idx + 1}.</span>
                  <span class="answer-correct"> ${letter}. ${text}</span>
                </div>
              `;
              })
              .join("")}
          </div>
        </div>
      </body>
    </html>
  `;

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Please allow popups to download the PDF.");
    return;
  }
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  // Wait for fonts to load before printing
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 1000);
  };
}
function generateWordDoc(selectedQuestions: Question[], logoBase64: string) {
  const htmlContent = `
    <!DOCTYPE html>
    <html xmlns:o='urn:schemas-microsoft-com:office:office'
          xmlns:w='urn:schemas-microsoft-com:office:word'
          xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset="UTF-8" />
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 40px;
            color: #000;
            font-size: 13px;
            line-height: 1.7;
            background: #ffffff;
          }
          hr { border: none; border-top: 1.5px solid #333; margin-bottom: 24px; margin-top: 8px; }
          .question { margin-bottom: 22px; }
          .question-text { font-weight: bold; font-size: 13px; margin-bottom: 8px; }
          .option { margin-bottom: 4px; font-size: 12px; padding-left: 24px; }
          .answer-section { padding-top: 10px; }
          .answer-title { text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 20px; }
          .answer-correct { font-weight: bold; color: #16a34a; }
        </style>
      </head>
      <body>

        <!-- Header using TABLE (Word-safe, no flexbox) -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="60">&nbsp;</td>
            <td align="center">
              <h1 style="font-size:20px; font-weight:bold; margin:0; padding:0;">Quiz Paper</h1>
            </td>
            <td width="60" align="right" valign="middle">
              ${
                logoBase64
                  ? `<img src="${logoBase64}" width="56" height="56" style="width:56px;height:56px;object-fit:contain;" />`
                  : `&nbsp;`
              }
            </td>
          </tr>
        </table>

        <hr />

        ${selectedQuestions
          .map(
            (q, idx) => `
          <div class="question">
            <div class="question-text">${idx + 1}. ${q.questionText}</div>
            ${q.options
              .map(
                (opt, i) => `
              <div class="option">${String.fromCharCode(65 + i)}. ${opt}</div>
            `,
              )
              .join("")}
          </div>
        `,
          )
          .join("")}
        <br clear="all" style="page-break-before:always" />    
        <div class="answer-section">
          <div class="answer-title">Answer Key</div>
          <hr />
          <table width="100%" cellpadding="3" cellspacing="0" border="0">
            <tbody>
              ${selectedQuestions
                .map((q, idx) => {
                  const ansIdx = q.correctAnswer ?? 0;
                  const letter = String.fromCharCode(65 + ansIdx);
                  const text = q.options?.[ansIdx] ?? "";
                  return `
                <tr>
                  <td width="40" style="font-size:12px; vertical-align:top;">${idx + 1}.</td>
                  <td style="font-size:12px; color:#16a34a; font-weight:bold; vertical-align:top;">${letter}. ${text}</td>
                </tr>`;
                })
                .join("")}
            </tbody>
          </table>
        </div>

      </body>
    </html>
  `;

  const blob = new Blob(["\ufeff", htmlContent], {
    type: "application/msword",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "quiz-paper.doc";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
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

  // PDF selection states
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setIsAdding(false);
    setEditingQuestion(null);
  };
  const [logoBase64, setLogoBase64] = useState<string>("");

  useEffect(() => {
    fetch(logo)
      .then((res) => res.blob())
      .then((blob) => {
        const reader = new FileReader();
        reader.onloadend = () => setLogoBase64(reader.result as string);
        reader.readAsDataURL(blob);
      });
  }, []);

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

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((qId) => qId !== id) : [...prev, id],
    );
  };

  const handleGeneratePDF = () => {
    if (selectedIds.length === 0) {
      alert("Please select at least one question");
      return;
    }

    // Maintain selection order
    const selectedQuestions = selectedIds
      .map((id) => questions.find((q) => q.id === id))
      .filter(Boolean) as Question[];

    generatePrintPDF(selectedQuestions, logoBase64);

    setSelectionMode(false);
    setSelectedIds([]);
  };

  // ✅ hooks.ts already sorts oldest→newest, so just add difficulty metadata.
  // Then reverse here so newest question appears at the TOP of the list.

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

  const displayList = [...filtered].reverse();

  // ✅ YE TEEN LINES displayList ke BAAD aayengi
  const allFilteredIds = displayList.map((q) => q.id);
  const isAllSelected =
    allFilteredIds.length > 0 &&
    allFilteredIds.every((id) => selectedIds.includes(id));
  const handleSelectAll = () => {
    if (isAllSelected) setSelectedIds([]);
    else setSelectedIds(allFilteredIds);
  };
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

        <div className="flex gap-2">
          {!selectionMode ? (
            <>
              <Button
                onClick={() => setSelectionMode(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg flex items-center gap-2 transition-colors flex-shrink-0 text-sm"
              >
                <Button
                  onClick={() => setSelectionMode(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg flex items-center gap-2 transition-colors flex-shrink-0 text-sm"
                >
                  <FileText className="w-4 h-4" />
                  <span className="hidden sm:inline">Generate Paper</span>
                  <span className="sm:hidden">Paper</span>
                </Button>
              </Button>
              <Button
                onClick={() => setIsAdding(true)}
                className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 rounded-lg flex items-center gap-2 transition-colors flex-shrink-0 text-sm"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add Question</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={handleGeneratePDF}
                className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg flex items-center gap-2 transition-colors text-sm"
              >
                <CheckSquare className="w-4 h-4" />
                <span className="hidden sm:inline">
                  Download PDF ({selectedIds.length})
                </span>
                <span className="sm:hidden">PDF ({selectedIds.length})</span>
              </Button>

              {/* ✅ NEW: Word download button */}
              <Button
                onClick={() => {
                  if (selectedIds.length === 0) {
                    alert("Please select at least one question");
                    return;
                  }
                  const selectedQuestions = selectedIds
                    .map((id) => questions.find((q) => q.id === id))
                    .filter(Boolean) as Question[];
                  generateWordDoc(selectedQuestions, logoBase64);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg flex items-center gap-2 transition-colors text-sm"
              >
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">
                  Download Word ({selectedIds.length})
                </span>
                <span className="sm:hidden">Word ({selectedIds.length})</span>
              </Button>

              <Button
                onClick={() => {
                  setSelectionMode(false);
                  setSelectedIds([]);
                }}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-2 rounded-lg text-sm transition-colors"
              >
                Cancel
              </Button>
            </>
          )}
        </div>
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
      {/* ✅ Select All bar — sirf selection mode mein dikhega */}
      {selectionMode && (
        <div className="flex items-center justify-between px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg mb-4">
          <span className="text-sm text-indigo-700">
            {selectedIds.length} of {displayList.length} selected
          </span>
          <button
            onClick={handleSelectAll}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            {isAllSelected ? "Deselect All" : "Select All"}
          </button>
        </div>
      )}
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
                placeholder="Enter your question here... (English / हिंदी / ગુજરાતી)"
                rows={3}
                style={{
                  fontFamily:
                    "'Noto Sans Gujarati', 'Noto Sans Devanagari', 'Noto Sans', sans-serif",
                }}
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
                      style={{
                        fontFamily:
                          "'Noto Sans Gujarati', 'Noto Sans Devanagari', 'Noto Sans', sans-serif",
                      }}
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
        {displayList.length === 0 ? (
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
          displayList.map((question, idx) => (
            <Card
              key={question.id}
              className={`p-4 bg-white border rounded-lg transition-all ${
                selectionMode && selectedIds.includes(question.id)
                  ? "border-indigo-400 ring-2 ring-indigo-100"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox in selection mode */}
                {/* // Ye existing buttons ke saath add karo (Cancel se pehle): */}
                {selectionMode && (
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(question.id)}
                    onChange={() => toggleSelection(question.id)}
                    className="mt-1 w-4 h-4 flex-shrink-0 cursor-pointer accent-indigo-600"
                  />
                )}
                {/* Content — clicking card selects in selection mode */}
                <div
                  className="flex-1 min-w-0"
                  onClick={() => selectionMode && toggleSelection(question.id)}
                  style={{ cursor: selectionMode ? "pointer" : "default" }}
                >
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
                  </div>
                  {/* ✅ Question number: newest = #total, oldest = #1 */}
                  <p
                    className="text-sm font-medium text-slate-900 mb-3"
                    style={{
                      fontFamily:
                        "'Noto Sans Gujarati', 'Noto Sans Devanagari', 'Noto Sans', sans-serif",
                    }}
                  >
                    {filtered.length - idx}. {question.questionText}
                  </p>
                  <div className="space-y-1.5">
                    {question.options.map((optText, optIdx) => (
                      <div
                        key={optIdx}
                        className={`text-xs px-3 py-2 rounded ${
                          optIdx === question.correctAnswer
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-slate-50 text-slate-600"
                        }`}
                        style={{
                          fontFamily:
                            "'Noto Sans Gujarati', 'Noto Sans Devanagari', 'Noto Sans', sans-serif",
                        }}
                      >
                        {String.fromCharCode(65 + optIdx)}. {optText}
                        {optIdx === question.correctAnswer && (
                          <span className="ml-2 font-semibold">✓ Correct</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                {/* Actions — hidden in selection mode */}
                {!selectionMode && (
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
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
