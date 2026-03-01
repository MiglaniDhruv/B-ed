import { useState, useRef } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import {
  Plus,
  Trash2,
  ArrowLeft,
  Save,
  Edit2,
  Library,
  Check,
  X,
  Upload,
  Download,
  FileText,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { QuestionBankSelector } from "./question-bank-selector";
import { useAdminQuestions, useQuizzes } from "../lib/hooks";
import { api } from "../lib/api";
import type { Question, Quiz } from "../lib/api";

export interface QuizData {
  basicInfo: { title: string; duration: number; allowReview: boolean };
  questions: {
    id: string;
    questionText: string;
    options: { text: string; isCorrect: boolean }[];
    marks: number;
    negativeMarking: boolean;
    shuffleOptions: boolean;
    showCorrectAnswer: boolean;
  }[];
  createdDate: string;
}

interface QuizBuilderProps {
  onComplete: (quiz: QuizData) => void;
  onCancel: () => void;
  editingQuiz?: Quiz | null;
  editingQuestions?: Question[];
}

// ── CSV Parser ────────────────────────────────────────────────────────────────
function parseCSV(csvText: string): {
  parsed: QuizData["questions"];
  errors: string[];
} {
  const lines = csvText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2)
    return { parsed: [], errors: ["CSV file is empty or has no data rows."] };

  const dataLines = lines.slice(1);
  const parsed: QuizData["questions"] = [];
  const errors: string[] = [];

  dataLines.forEach((line, i) => {
    const rowNum = i + 2;
    const cols = parseCSVLine(line);
    if (cols.length < 7) {
      errors.push(
        `Row ${rowNum}: Not enough columns (found ${cols.length}, need at least 7).`,
      );
      return;
    }
    const [
      type,
      questionText,
      optionA,
      optionB,
      optionC,
      optionD,
      correctAnswer,
      marksRaw,
    ] = cols;
    const marks = parseInt(marksRaw) || 1;
    const qType = type.trim().toLowerCase();
    if (!questionText.trim()) {
      errors.push(`Row ${rowNum}: Question text is empty.`);
      return;
    }

    if (qType === "mcq" || qType === "mcq3") {
      const options = [optionA, optionB, optionC, optionD]
        .map((o) => o?.trim())
        .filter(Boolean);
      if (options.length < 2) {
        errors.push(`Row ${rowNum}: At least 2 options required.`);
        return;
      }
      const correctLetter = correctAnswer.trim().toUpperCase();
      const correctIdx = ["A", "B", "C", "D"].indexOf(correctLetter);
      if (correctIdx === -1) {
        errors.push(`Row ${rowNum}: correctAnswer must be A, B, C, or D.`);
        return;
      }
      if (correctIdx >= options.length) {
        errors.push(`Row ${rowNum}: correctAnswer refers to missing option.`);
        return;
      }
      parsed.push({
        id: `csv-${Date.now()}-${i}`,
        questionText: questionText.trim(),
        options: options.map((text, idx) => ({
          text,
          isCorrect: idx === correctIdx,
        })),
        marks,
        negativeMarking: false,
        shuffleOptions: false,
        showCorrectAnswer: true,
      });
    } else if (qType === "match") {
      const rightItems = [optionA, optionB, optionC, optionD]
        .map((o) => o?.trim())
        .filter(Boolean);
      if (rightItems.length < 2) {
        errors.push(
          `Row ${rowNum}: Match needs at least 2 right-column items.`,
        );
        return;
      }
      const mapping = correctAnswer.trim().toUpperCase();
      const pairs = mapping.split(/\s+/);
      if (!pairs.every((p) => /^[A-D]-\d+$/.test(p))) {
        errors.push(
          `Row ${rowNum}: Match correctAnswer format should be like "A-1 B-2 C-3".`,
        );
        return;
      }
      const correctMatchText = pairs
        .map((p) => {
          const [letter, num] = p.split("-");
          return `${letter} → ${rightItems[parseInt(num) - 1] ?? "?"}`;
        })
        .join(", ");
      parsed.push({
        id: `csv-${Date.now()}-${i}`,
        questionText: questionText.trim(),
        options: generateMatchOptions(rightItems, pairs, correctMatchText),
        marks,
        negativeMarking: false,
        shuffleOptions: false,
        showCorrectAnswer: true,
      });
    } else {
      errors.push(
        `Row ${rowNum}: Unknown type "${type}". Use mcq, mcq3, or match.`,
      );
    }
  });
  return { parsed, errors };
}

function generateMatchOptions(
  rightItems: string[],
  correctPairs: string[],
  correctText: string,
): { text: string; isCorrect: boolean }[] {
  const letters = ["A", "B", "C", "D"].slice(0, correctPairs.length);
  const wrongCombos: string[] = [];
  for (let i = 0; i < 20 && wrongCombos.length < 3; i++) {
    const shuffled = [...rightItems].sort(() => Math.random() - 0.5);
    const comboText = letters
      .map((l, idx) => `${l} → ${shuffled[idx]}`)
      .join(", ");
    if (comboText !== correctText && !wrongCombos.includes(comboText))
      wrongCombos.push(comboText);
  }
  while (wrongCombos.length < 3)
    wrongCombos.push(`Option ${wrongCombos.length + 2} (auto-generated)`);
  const correctPosition = Math.floor(Math.random() * 4);
  const allOptions: { text: string; isCorrect: boolean }[] = [];
  let wrongIdx = 0;
  for (let i = 0; i < 4; i++) {
    allOptions.push(
      i === correctPosition
        ? { text: correctText, isCorrect: true }
        : { text: wrongCombos[wrongIdx++], isCorrect: false },
    );
  }
  return allOptions;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function downloadTemplate() {
  const template = [
    "type,questionText,optionA,optionB,optionC,optionD,correctAnswer,marks",
    "mcq,What is the capital of India?,Delhi,Mumbai,Kolkata,Chennai,A,1",
    'mcq3,"Which are correct? 1.Earth revolves around Sun 2.Moon is a planet 3.Sun is a star",Only 1 and 3,Only 1 and 2,All of the above,None of the above,A,2',
    'match,"Match: A.Gandhi  B.Newton  C.Einstein",Father of Nation,Laws of Motion,Theory of Relativity,,A-1 B-2 C-3,3',
  ].join("\n");
  const blob = new Blob([template], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "questions_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function QuizBuilder({
  onComplete,
  onCancel,
  editingQuiz = null,
  editingQuestions = [],
}: QuizBuilderProps) {
  const isEditMode = !!editingQuiz;
  const [step, setStep] = useState<"basic" | "questions">("basic");
  const [showQuestionBankSelector, setShowQuestionBankSelector] =
    useState(false);
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [csvErrors, setCSVErrors] = useState<string[]>([]);
  const [csvImporting, setCSVImporting] = useState(false);
  const [creatingQuiz, setCreatingQuiz] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCancelWarning, setShowCancelWarning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [basicInfo, setBasicInfo] = useState({
    title: editingQuiz?.title ?? "",
    duration: editingQuiz?.duration ?? 30,
    // Default OFF for existing quizzes (null = not set = treat as false), new quizzes default OFF
    allowReview: editingQuiz?.allowReview ?? false,
  });

  const [activeQuizId, setActiveQuizId] = useState<string | null>(
    editingQuiz?.id ?? null,
  );

  const toLocalQuestion = (q: Question) => ({
    id: q.id,
    questionText: q.questionText,
    options: q.options.map((text, idx) => ({
      text,
      isCorrect: idx === q.correctAnswer,
    })),
    marks: q.marks ?? 1,
    negativeMarking: false,
    shuffleOptions: false,
    showCorrectAnswer: true,
  });

  const [questions, setQuestions] = useState<QuizData["questions"]>(
    isEditMode ? editingQuestions.map(toLocalQuestion) : [],
  );
  const [usedQuestionIds, setUsedQuestionIds] = useState<Set<string>>(
    new Set(isEditMode ? editingQuestions.map((q) => q.id) : []),
  );
  const [currentQuestion, setCurrentQuestion] = useState({
    questionText: "",
    options: [
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
    ],
    marks: 1,
    negativeMarking: false,
    shuffleOptions: false,
    showCorrectAnswer: true,
  });

  const blankQuestion = () => ({
    questionText: "",
    options: [
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
    ],
    marks: 1,
    negativeMarking: false,
    shuffleOptions: false,
    showCorrectAnswer: true,
  });

  const [editingQuestionIdx, setEditingQuestionIdx] = useState<number | null>(
    null,
  );
  const [editingQuestionData, setEditingQuestionData] = useState<
    typeof currentQuestion | null
  >(null);

  const { updateQuestion } = useAdminQuestions();
  const { updateQuiz } = useQuizzes();

  // ── Cancel handling ───────────────────────────────────────────────────────
  const handleCancelClick = () => {
    if (!isEditMode && questions.length > 0) {
      setShowCancelWarning(true);
    } else {
      onCancel();
    }
  };

  const handleConfirmCancel = () => {
    setShowCancelWarning(false);
    onCancel();
  };

  // ── Step 1 → Step 2 ───────────────────────────────────────────────────────
  const handleGoToQuestions = async () => {
    if (!basicInfo.title.trim()) {
      alert("Please enter a quiz title");
      return;
    }
    setStep("questions");
  };

  // ── Add Question ──────────────────────────────────────────────────────────
  const handleAddQuestion = async () => {
    if (!currentQuestion.questionText.trim()) {
      alert("Please enter a question");
      return;
    }
    const filledOptions = currentQuestion.options.filter((o) => o.text.trim());
    if (filledOptions.length < 2) {
      alert("Please add at least 2 options");
      return;
    }
    if (!filledOptions.some((o) => o.isCorrect)) {
      alert("Please mark at least one correct answer");
      return;
    }

    const correctIndex = filledOptions.findIndex((o) => o.isCorrect);
    const tempId = `q-${Date.now()}`;
    const newQuestion = {
      ...currentQuestion,
      id: tempId,
      options: filledOptions,
    };
    setQuestions((prev) => [...prev, newQuestion]);
    setCurrentQuestion(blankQuestion());

    try {
      const created = await api.createQuestion({
        questionText: newQuestion.questionText,
        options: filledOptions.map((o) => o.text),
        correctAnswer: correctIndex,
        marks: newQuestion.marks,
        explanation: null,
      });
      if (created?.id) {
        setQuestions((prev) =>
          prev.map((q) => (q.id === tempId ? { ...q, id: created.id } : q)),
        );
        setUsedQuestionIds((prev) => new Set([...prev, created.id]));
        if (activeQuizId) {
          await api.addQuestionToQuiz(activeQuizId, created.id);
        }
      }
    } catch (err) {
      console.warn("Could not save question:", err);
    }
  };

  // ── CSV Import ────────────────────────────────────────────────────────────
  const handleCSVFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCSVImporting(true);
    setCSVErrors([]);

    try {
      const text = await file.text();
      const { parsed, errors } = parseCSV(text);
      if (errors.length > 0) {
        setCSVErrors(errors);
        if (parsed.length === 0) {
          setCSVImporting(false);
          return;
        }
      }
      if (parsed.length === 0) {
        setCSVErrors(["No valid questions found in the CSV."]);
        setCSVImporting(false);
        return;
      }

      let savedCount = 0;
      const finalQuestions: QuizData["questions"] = [];

      for (const q of parsed) {
        const correctIdx = q.options.findIndex((o) => o.isCorrect);
        try {
          const created = await api.createQuestion({
            questionText: q.questionText,
            options: q.options.map((o) => o.text),
            correctAnswer: correctIdx,
            marks: q.marks,
            explanation: null,
          });
          finalQuestions.push({ ...q, id: created?.id ?? q.id });
          if (created?.id && activeQuizId) {
            await api.addQuestionToQuiz(activeQuizId, created.id);
            setUsedQuestionIds((prev) => new Set([...prev, created.id]));
          }
          savedCount++;
        } catch {
          finalQuestions.push(q);
        }
      }

      setQuestions((prev) => [...prev, ...finalQuestions]);

      if (errors.length > 0) {
        setCSVErrors([
          `✅ ${savedCount} questions imported successfully.`,
          `⚠️ ${errors.length} row(s) had errors:`,
          ...errors,
        ]);
      } else {
        setShowCSVImport(false);
        setCSVErrors([]);
        alert(`✅ ${savedCount} questions imported successfully!`);
      }
    } catch {
      setCSVErrors(["Failed to read the file. Make sure it's a valid CSV."]);
    }

    setCSVImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Edit Question ─────────────────────────────────────────────────────────
  const handleStartEditQuestion = (idx: number) => {
    const q = questions[idx];
    const padded = [
      ...q.options,
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
    ].slice(0, Math.max(4, q.options.length));
    setEditingQuestionIdx(idx);
    setEditingQuestionData({
      questionText: q.questionText,
      options: padded,
      marks: q.marks,
      negativeMarking: q.negativeMarking,
      shuffleOptions: q.shuffleOptions,
      showCorrectAnswer: q.showCorrectAnswer,
    });
  };

  const handleSaveEditQuestion = async (idx: number) => {
    if (!editingQuestionData) return;
    if (!editingQuestionData.questionText.trim()) {
      alert("Please enter a question");
      return;
    }
    const filledOptions = editingQuestionData.options.filter((o) =>
      o.text.trim(),
    );
    if (filledOptions.length < 2) {
      alert("At least 2 options required");
      return;
    }
    if (!filledOptions.some((o) => o.isCorrect)) {
      alert("Please mark the correct answer");
      return;
    }

    const updated = {
      ...questions[idx],
      questionText: editingQuestionData.questionText,
      options: filledOptions,
      marks: editingQuestionData.marks,
    };
    setQuestions((prev) => prev.map((q, i) => (i === idx ? updated : q)));
    setEditingQuestionIdx(null);
    setEditingQuestionData(null);

    const realId = questions[idx].id;
    if (realId && !realId.startsWith("q-")) {
      try {
        await api.updateQuestion(realId, {
          questionText: updated.questionText,
          options: filledOptions.map((o) => o.text),
          correctAnswer: filledOptions.findIndex((o) => o.isCorrect),
          marks: updated.marks,
        });
      } catch (err) {
        console.warn("Could not update question:", err);
      }
    }
  };

  // ── Delete Question ───────────────────────────────────────────────────────
  const handleDeleteQuestion = async (idx: number) => {
    if (!confirm("Remove this question from the quiz?")) return;
    const removedQuestion = questions[idx];
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
    setUsedQuestionIds((prev) => {
      const next = new Set(prev);
      next.delete(removedQuestion.id);
      return next;
    });

    if (removedQuestion.id && !removedQuestion.id.startsWith("q-")) {
      if (activeQuizId) {
        try {
          await api.removeQuestionFromQuiz(activeQuizId, removedQuestion.id);
        } catch (err) {
          console.warn(err);
        }
      }
      try {
        await api.deleteQuestion(removedQuestion.id);
      } catch (err) {
        console.warn(err);
      }
    }
  };

  // ── Import from Question Bank ─────────────────────────────────────────────
  const handleImportQuestions = async (selectedQuestions: Question[]) => {
    const newOnes = selectedQuestions.filter((q) => !usedQuestionIds.has(q.id));
    if (newOnes.length === 0) {
      alert("All selected questions are already in this quiz.");
      setShowQuestionBankSelector(false);
      return;
    }
    if (newOnes.length < selectedQuestions.length) {
      alert(
        `${selectedQuestions.length - newOnes.length} question(s) skipped — already in this quiz.`,
      );
    }

    setQuestions((prev) => [
      ...prev,
      ...newOnes.map((q) => ({
        id: q.id,
        questionText: q.questionText,
        options: q.options.map((text, idx) => ({
          text,
          isCorrect: idx === q.correctAnswer,
        })),
        marks: q.marks ?? 1,
        negativeMarking: false,
        shuffleOptions: false,
        showCorrectAnswer: true,
      })),
    ]);
    setUsedQuestionIds(
      (prev) => new Set([...prev, ...newOnes.map((q) => q.id)]),
    );

    if (activeQuizId) {
      for (const q of newOnes) {
        try {
          await api.addQuestionToQuiz(activeQuizId, q.id);
        } catch (err) {
          console.warn(err);
        }
      }
    }
    setShowQuestionBankSelector(false);
  };

  // ── Save Quiz ─────────────────────────────────────────────────────────────
  const handleSaveQuiz = async () => {
    if (questions.length === 0) {
      alert("Please add at least one question");
      return;
    }
    const totalMarksValue = questions.reduce((sum, q) => sum + q.marks, 0);

    setSaving(true);
    try {
      let quizId = activeQuizId;

      if (!isEditMode && !activeQuizId) {
        const newQuiz = await api.createQuiz({
          title: basicInfo.title,
          duration: basicInfo.duration,
          totalMarks: totalMarksValue,
          allowReview: basicInfo.allowReview,
          isActive: false,
        } as any);
        quizId = newQuiz.id;
        setActiveQuizId(newQuiz.id);

        for (const q of questions) {
          if (q.id && !q.id.startsWith("q-")) {
            try {
              await api.addQuestionToQuiz(newQuiz.id, q.id);
            } catch (err) {
              console.warn(err);
            }
          }
        }
      } else if (quizId) {
        await api.updateQuiz(quizId, {
          title: basicInfo.title,
          duration: basicInfo.duration,
          totalMarks: totalMarksValue,
          allowReview: basicInfo.allowReview,
        });
      }
    } catch (err: any) {
      alert("Failed to save quiz: " + (err.message || "Unknown error"));
      setSaving(false);
      return;
    }

    setSaving(false);
    onComplete({ basicInfo, questions, createdDate: new Date().toISOString() });
  };

  if (showQuestionBankSelector) {
    return (
      <QuestionBankSelector
        onSelectQuestions={handleImportQuestions}
        onCancel={() => setShowQuestionBankSelector(false)}
        disabledQuestionIds={usedQuestionIds}
      />
    );
  }

  // ── Step 1: Basic Info ────────────────────────────────────────────────────
  if (step === "basic") {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={handleCancelClick}
              className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                {isEditMode ? "Edit Quiz" : "Create Quiz"}
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Step 1 of 2 — Basic Info
              </p>
            </div>
          </div>

          <Card className="p-6 bg-white border border-slate-200 rounded-lg">
            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Quiz Title *
                </label>
                <input
                  type="text"
                  value={basicInfo.title}
                  onChange={(e) =>
                    setBasicInfo({ ...basicInfo, title: e.target.value })
                  }
                  placeholder="e.g., Unit 1 Assessment"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Duration (minutes)
                </label>
                <input
                  type="number"
                  value={basicInfo.duration}
                  onChange={(e) =>
                    setBasicInfo({
                      ...basicInfo,
                      duration: Number(e.target.value),
                    })
                  }
                  min="1"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>

              {/* ── Allow Review Toggle ─────────────────────────────────────── */}
              <div
                className={`flex items-start justify-between gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  basicInfo.allowReview
                    ? "border-green-300 bg-green-50"
                    : "border-slate-200 bg-slate-50"
                }`}
                onClick={() =>
                  setBasicInfo({
                    ...basicInfo,
                    allowReview: !basicInfo.allowReview,
                  })
                }
              >
                <div className="flex items-start gap-3">
                  {basicInfo.allowReview ? (
                    <Eye className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  ) : (
                    <EyeOff className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                  )}
                  <div>
                    <p
                      className={`text-sm font-semibold ${basicInfo.allowReview ? "text-green-800" : "text-slate-600"}`}
                    >
                      Allow Answer Review
                    </p>
                    <p
                      className={`text-xs mt-0.5 ${basicInfo.allowReview ? "text-green-600" : "text-slate-400"}`}
                    >
                      {basicInfo.allowReview
                        ? "Students can review correct answers after submitting"
                        : "Students will only see their score, not the answers"}
                    </p>
                  </div>
                </div>
                {/* Toggle switch */}
                <div
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 mt-0.5 ${
                    basicInfo.allowReview ? "bg-green-500" : "bg-slate-300"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      basicInfo.allowReview
                        ? "translate-x-5"
                        : "translate-x-0.5"
                    }`}
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={handleGoToQuestions}
                  disabled={creatingQuiz}
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-lg flex items-center justify-center gap-2"
                >
                  {creatingQuiz && <Loader2 className="w-4 h-4 animate-spin" />}
                  {creatingQuiz
                    ? "Creating Quiz..."
                    : `Next: ${isEditMode ? "Edit Questions" : "Add Questions"}`}
                </Button>
                <Button
                  onClick={handleCancelClick}
                  className="px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-lg"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // ── Step 2: Questions ─────────────────────────────────────────────────────
  const totalMarks = questions.reduce((s, q) => s + q.marks, 0);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {/* Cancel Warning Dialog */}
      {showCancelWarning && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <Card className="p-6 bg-white rounded-xl shadow-xl max-w-md w-full">
            <h3 className="text-base font-semibold text-slate-900 mb-2">
              Discard this quiz?
            </h3>
            <p className="text-sm text-slate-600 mb-1">
              You've added{" "}
              <span className="font-semibold text-slate-800">
                {questions.length} question{questions.length !== 1 ? "s" : ""}
              </span>{" "}
              that haven't been saved to a quiz yet.
            </p>
            <p className="text-sm text-slate-500 mb-5">
              These questions will still be available in your{" "}
              <span className="font-medium">Question Bank</span>, but this quiz
              will be discarded.
            </p>
            <div className="flex gap-3">
              <Button
                onClick={handleConfirmCancel}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg text-sm"
              >
                Discard Quiz
              </Button>
              <Button
                onClick={() => setShowCancelWarning(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-lg text-sm"
              >
                Keep Editing
              </Button>
            </div>
          </Card>
        </div>
      )}

      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setStep("basic")}
              className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                {basicInfo.title}
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Step 2 of 2 — {isEditMode ? "Edit" : "Add"} Questions
                <span className="font-medium text-slate-700">
                  {" "}
                  · {questions.length} question
                  {questions.length !== 1 ? "s" : ""} · {totalMarks} marks
                </span>
              </p>
              {/* Show review setting reminder */}
              <p
                className={`text-xs mt-0.5 flex items-center gap-1 ${basicInfo.allowReview ? "text-green-600" : "text-slate-400"}`}
              >
                {basicInfo.allowReview ? (
                  <Eye className="w-3 h-3" />
                ) : (
                  <EyeOff className="w-3 h-3" />
                )}
                {basicInfo.allowReview
                  ? "Answer review enabled"
                  : "Answer review disabled"}
              </p>
              {activeQuizId && (
                <p className="text-xs text-emerald-600 mt-0.5">
                  ✓ Quiz ready — questions link automatically as you add them
                </p>
              )}
            </div>
          </div>

          <Button
            onClick={handleSaveQuiz}
            disabled={questions.length === 0 || saving}
            className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />{" "}
                {isEditMode ? "Update Quiz" : "Save Quiz"}
              </>
            )}
          </Button>
        </div>

        {/* CSV Import Panel */}
        {showCSVImport && (
          <Card className="p-5 bg-blue-50 border border-blue-200 rounded-lg mb-6">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-blue-900">
                  Bulk Import via CSV
                </h3>
                <p className="text-xs text-blue-700 mt-0.5">
                  Upload a CSV file to add many questions at once.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowCSVImport(false);
                  setCSVErrors([]);
                }}
                className="text-blue-400 hover:text-blue-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-white rounded-lg p-3 mb-3 border border-blue-100">
              <p className="text-xs font-semibold text-slate-700 mb-2">
                CSV Format:
              </p>
              <code className="text-xs bg-slate-100 px-1 rounded">
                type, questionText, optionA, optionB, optionC, optionD,
                correctAnswer, marks
              </code>
              <div className="mt-2 space-y-1 text-xs text-slate-600">
                <p>
                  <span className="font-medium text-emerald-700">mcq</span> —
                  Standard. correctAnswer = A/B/C/D
                </p>
                <p>
                  <span className="font-medium text-purple-700">mcq3</span> —
                  Combo options. correctAnswer = A/B/C/D
                </p>
                <p>
                  <span className="font-medium text-orange-700">match</span> —
                  correctAnswer = A-1 B-2 C-3
                </p>
              </div>
            </div>
            {csvErrors.length > 0 && (
              <div className="bg-white border border-red-200 rounded-lg p-3 mb-3 max-h-40 overflow-y-auto">
                {csvErrors.map((err, i) => (
                  <p
                    key={i}
                    className={`text-xs ${err.startsWith("✅") ? "text-emerald-700 font-medium" : err.startsWith("⚠️") ? "text-amber-700 font-medium" : "text-red-600"}`}
                  >
                    {err}
                  </p>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-1.5 px-3 py-2 text-xs bg-white border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50"
              >
                <Download className="w-3.5 h-3.5" /> Download Template
              </button>
              <label
                className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg cursor-pointer ${csvImporting ? "bg-slate-200 text-slate-500" : "bg-blue-600 hover:bg-blue-700 text-white"}`}
              >
                <Upload className="w-3.5 h-3.5" />
                {csvImporting ? "Importing..." : "Upload CSV"}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleCSVFile}
                  disabled={csvImporting}
                />
              </label>
            </div>
          </Card>
        )}

        {/* Add new question form */}
        <Card className="p-6 bg-white border border-slate-200 rounded-lg mb-6">
          <h3 className="text-base font-semibold text-slate-900 mb-4">
            Add New Question
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Question Text
              </label>
              <textarea
                value={currentQuestion.questionText}
                onChange={(e) =>
                  setCurrentQuestion({
                    ...currentQuestion,
                    questionText: e.target.value,
                  })
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
                {currentQuestion.options.map((option, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={option.isCorrect}
                      onChange={(e) => {
                        const opts = [...currentQuestion.options];
                        opts[idx] = {
                          ...opts[idx],
                          isCorrect: e.target.checked,
                        };
                        setCurrentQuestion({
                          ...currentQuestion,
                          options: opts,
                        });
                      }}
                      className="w-4 h-4 text-slate-900 border-slate-300 rounded focus:ring-slate-900"
                    />
                    <input
                      type="text"
                      value={option.text}
                      onChange={(e) => {
                        const opts = [...currentQuestion.options];
                        opts[idx] = { ...opts[idx], text: e.target.value };
                        setCurrentQuestion({
                          ...currentQuestion,
                          options: opts,
                        });
                      }}
                      placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                      className="flex-1 px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Check the box to mark correct answer(s)
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Marks
              </label>
              <input
                type="number"
                value={currentQuestion.marks}
                onChange={(e) =>
                  setCurrentQuestion({
                    ...currentQuestion,
                    marks: Number(e.target.value),
                  })
                }
                min="1"
                className="w-32 px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Button
                onClick={handleAddQuestion}
                className="bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-lg flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> Add Question
              </Button>
              <Button
                onClick={() => setShowQuestionBankSelector(true)}
                className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 py-2.5 rounded-lg flex items-center justify-center gap-2"
              >
                <Library className="w-4 h-4" /> Import from Bank
              </Button>
              <Button
                onClick={() => {
                  setShowCSVImport(!showCSVImport);
                  setCSVErrors([]);
                }}
                className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 py-2.5 rounded-lg flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" /> Bulk CSV
              </Button>
            </div>
          </div>
        </Card>

        {/* Questions list */}
        {questions.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-slate-900">
              Questions ({questions.length})
            </h3>
            {questions.map((q, idx) => (
              <Card
                key={`${q.id}-${idx}`}
                className="bg-white border border-slate-200 rounded-lg overflow-hidden"
              >
                {editingQuestionIdx === idx && editingQuestionData ? (
                  <div className="p-4 bg-slate-50 border-l-4 border-slate-900">
                    <h4 className="text-sm font-semibold text-slate-900 mb-3">
                      Editing Q{idx + 1}
                    </h4>
                    <div className="space-y-3">
                      <textarea
                        value={editingQuestionData.questionText}
                        onChange={(e) =>
                          setEditingQuestionData({
                            ...editingQuestionData,
                            questionText: e.target.value,
                          })
                        }
                        rows={2}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                      <div className="space-y-2">
                        {editingQuestionData.options.map((opt, oi) => (
                          <div key={oi} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={opt.isCorrect}
                              onChange={(e) => {
                                const opts = [...editingQuestionData.options];
                                opts[oi] = {
                                  ...opts[oi],
                                  isCorrect: e.target.checked,
                                };
                                setEditingQuestionData({
                                  ...editingQuestionData,
                                  options: opts,
                                });
                              }}
                              className="w-4 h-4 rounded border-slate-300 focus:ring-slate-900"
                            />
                            <input
                              type="text"
                              value={opt.text}
                              onChange={(e) => {
                                const opts = [...editingQuestionData.options];
                                opts[oi] = {
                                  ...opts[oi],
                                  text: e.target.value,
                                };
                                setEditingQuestionData({
                                  ...editingQuestionData,
                                  options: opts,
                                });
                              }}
                              placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                            />
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="text-xs text-slate-600">Marks:</label>
                        <input
                          type="number"
                          value={editingQuestionData.marks}
                          min={1}
                          onChange={(e) =>
                            setEditingQuestionData({
                              ...editingQuestionData,
                              marks: Number(e.target.value),
                            })
                          }
                          className="w-20 px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                        />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button
                          onClick={() => handleSaveEditQuestion(idx)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm rounded-lg"
                        >
                          <Check className="w-3.5 h-3.5" /> Save
                        </Button>
                        <Button
                          onClick={() => {
                            setEditingQuestionIdx(null);
                            setEditingQuestionData(null);
                          }}
                          className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm rounded-lg"
                        >
                          <X className="w-3.5 h-3.5" /> Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 group">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded">
                            Q{idx + 1}
                          </span>
                          <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded">
                            {q.marks} mark{q.marks !== 1 ? "s" : ""}
                          </span>
                          {!q.id.startsWith("q-") && (
                            <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded border border-emerald-200">
                              ✓ Linked
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-slate-900 mb-2">
                          {q.questionText}
                        </p>
                        <div className="space-y-1">
                          {q.options.map((opt, oi) => (
                            <div
                              key={oi}
                              className={`text-xs px-3 py-2 rounded ${opt.isCorrect ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-50 text-slate-600"}`}
                            >
                              {String.fromCharCode(65 + oi)}. {opt.text}
                              {opt.isCorrect && (
                                <span className="ml-2 font-semibold">✓</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleStartEditQuestion(idx)}
                          className="p-1.5 hover:bg-blue-50 rounded transition-colors"
                          title="Edit question"
                        >
                          <Edit2 className="w-4 h-4 text-blue-600" />
                        </button>
                        <button
                          onClick={() => handleDeleteQuestion(idx)}
                          className="p-1.5 hover:bg-red-50 rounded transition-colors"
                          title="Delete question"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
