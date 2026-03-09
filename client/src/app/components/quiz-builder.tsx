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
} from "lucide-react";
import { QuestionBankSelector } from "./question-bank-selector";
import { useAdminQuestions, useQuizzes } from "../lib/hooks";
import { api } from "../lib/api";
import type { Question, Quiz } from "../lib/api";
import * as XLSX from "xlsx";

export interface QuizData {
  basicInfo: { title: string; duration: number };
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

// ── Unified Row Parser — auto-detects question type, NO type column needed ────
// Column order: questionText, optionA, optionB, optionC, optionD, correctAnswer, marks
// Auto-detection rules:
//   • correctAnswer looks like "A-1 B-2 C-3"  → match question
//   • otherwise correctAnswer is A/B/C/D       → MCQ (2, 3, or 4 options, whichever are filled)
function parseRowsToQuestions(
  rows: string[][],
  startRow = 1,
): { parsed: QuizData["questions"]; errors: string[] } {
  const parsed: QuizData["questions"] = [];
  const errors: string[] = [];

  const dataRows = rows.slice(startRow);
  dataRows.forEach((cols, i) => {
    const rowNum = i + startRow + 1;
    if (cols.every((c) => !c?.trim())) return; // skip blank rows

    if (cols.length < 6) {
      errors.push(
        `Row ${rowNum}: Not enough columns (found ${cols.length}, need at least 6: questionText, optionA, optionB, optionC, optionD, correctAnswer).`,
      );
      return;
    }

    const [
      questionText,
      optionA,
      optionB,
      optionC,
      optionD,
      correctAnswer,
      marksRaw,
    ] = cols.map((c) => (c ?? "").toString().trim());

    const marks = parseInt(marksRaw) || 1;

    if (!questionText) {
      errors.push(`Row ${rowNum}: Question text is empty.`);
      return;
    }
    if (!correctAnswer) {
      errors.push(`Row ${rowNum}: correctAnswer is empty.`);
      return;
    }

    // ── Auto-detect: Match question if correctAnswer looks like "A-1 B-2 ..." ──
    const isMatch = /^[A-Da-d]-\d+(\s+[A-Da-d]-\d+)*$/.test(
      correctAnswer.trim(),
    );

    if (isMatch) {
      const rightItems = [optionA, optionB, optionC, optionD].filter(Boolean);
      if (rightItems.length < 2) {
        errors.push(`Row ${rowNum}: Match question needs at least 2 options.`);
        return;
      }
      const pairs = correctAnswer.trim().toUpperCase().split(/\s+/);
      const correctMatchText = pairs
        .map((p) => {
          const [letter, num] = p.split("-");
          return `${letter} → ${rightItems[parseInt(num) - 1] ?? "?"}`;
        })
        .join(", ");
      parsed.push({
        id: `csv-${Date.now()}-${i}`,
        questionText,
        options: generateMatchOptions(rightItems, pairs, correctMatchText),
        marks,
        negativeMarking: false,
        shuffleOptions: false,
        showCorrectAnswer: true,
      });
      return;
    }

    // ── Auto-detect: MCQ (any number of filled options) ──
    const options = [optionA, optionB, optionC, optionD].filter(Boolean);
    if (options.length < 2) {
      errors.push(`Row ${rowNum}: At least 2 options are required.`);
      return;
    }
    const correctLetter = correctAnswer.trim().toUpperCase();
    const correctIdx = ["A", "B", "C", "D"].indexOf(correctLetter);
    if (correctIdx === -1) {
      errors.push(
        `Row ${rowNum}: correctAnswer must be A, B, C, or D (got "${correctAnswer}").`,
      );
      return;
    }
    if (correctIdx >= options.length) {
      errors.push(
        `Row ${rowNum}: correctAnswer "${correctAnswer}" refers to an option that doesn't exist.`,
      );
      return;
    }
    parsed.push({
      id: `csv-${Date.now()}-${i}`,
      questionText,
      options: options.map((text, idx) => ({
        text,
        isCorrect: idx === correctIdx,
      })),
      marks,
      negativeMarking: false,
      shuffleOptions: false,
      showCorrectAnswer: true,
    });
  });

  return { parsed, errors };
}

// ── CSV Parser ────────────────────────────────────────────────────────────────
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

function parseCSVText(csvText: string): string[][] {
  const lines = csvText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.map(parseCSVLine);
}

// ── XML Parser ────────────────────────────────────────────────────────────────
function parseXMLToRows(xmlText: string): string[][] {
  const rows: string[][] = [
    [
      "type",
      "questionText",
      "optionA",
      "optionB",
      "optionC",
      "optionD",
      "correctAnswer",
      "marks",
    ],
  ];

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "text/xml");
    const questionNodes = doc.querySelectorAll("question");

    questionNodes.forEach((node) => {
      const get = (tag: string) =>
        (node.querySelector(tag)?.textContent ?? "").trim();
      rows.push([
        node.getAttribute("type") || get("type") || "mcq",
        get("text") || get("questionText"),
        get("optionA"),
        get("optionB"),
        get("optionC"),
        get("optionD"),
        get("correctAnswer"),
        get("marks") || "1",
      ]);
    });
  } catch {
    // parse error handled by caller
  }

  return rows;
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

// ── Template Download (CSV with multi-language examples) ─────────────────────
function downloadTemplate() {
  const template = [
    "type,questionText,optionA,optionB,optionC,optionD,correctAnswer,marks",
    // English
    "mcq,What is the capital of India?,Delhi,Mumbai,Kolkata,Chennai,A,1",
    // Hindi
    'mcq,"भारत की राजधानी क्या है?",दिल्ली,मुंबई,कोलकाता,चेन्नई,A,1',
    // Gujarati
    'mcq,"ભારતની રાજધાની કઈ છે?",દિલ્હી,મુંબઈ,કોલકાતા,ચેન્નઈ,A,1',
    // MCQ3 combo
    'mcq3,"Which are correct? 1.Earth revolves around Sun 2.Moon is a planet 3.Sun is a star",Only 1 and 3,Only 1 and 2,All of the above,None of the above,A,2',
    // Match
    'match,"Match: A.Gandhi  B.Newton  C.Einstein",Father of Nation,Laws of Motion,Theory of Relativity,,A-1 B-2 C-3,3',
  ].join("\n");
  const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "questions_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ── Template Download for Excel ───────────────────────────────────────────────
function downloadExcelTemplate() {
  const wsData = [
    [
      "type",
      "questionText",
      "optionA",
      "optionB",
      "optionC",
      "optionD",
      "correctAnswer",
      "marks",
    ],
    [
      "mcq",
      "What is the capital of India?",
      "Delhi",
      "Mumbai",
      "Kolkata",
      "Chennai",
      "A",
      1,
    ],
    [
      "mcq",
      "भारत की राजधानी क्या है?",
      "दिल्ली",
      "मुंबई",
      "कोलकाता",
      "चेन्नई",
      "A",
      1,
    ],
    [
      "mcq",
      "ભારતની રાજધાની કઈ છે?",
      "દિલ્હી",
      "મુંબઈ",
      "કોલકાતા",
      "ચેન્નઈ",
      "A",
      1,
    ],
    [
      "mcq3",
      "Which are correct? 1.Earth revolves 2.Moon is a planet 3.Sun is a star",
      "Only 1 and 3",
      "Only 1 and 2",
      "All of the above",
      "None of the above",
      "A",
      2,
    ],
    [
      "match",
      "Match: A.Gandhi B.Newton C.Einstein",
      "Father of Nation",
      "Laws of Motion",
      "Theory of Relativity",
      "",
      "A-1 B-2 C-3",
      3,
    ],
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [
    { wch: 8 },
    { wch: 50 },
    { wch: 25 },
    { wch: 25 },
    { wch: 25 },
    { wch: 25 },
    { wch: 15 },
    { wch: 8 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "Questions");
  XLSX.writeFile(wb, "questions_template.xlsx");
}

// ── XML Template Download ─────────────────────────────────────────────────────
function downloadXMLTemplate() {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<questions>
  <!-- English question -->
  <question type="mcq">
    <text>What is the capital of India?</text>
    <optionA>Delhi</optionA>
    <optionB>Mumbai</optionB>
    <optionC>Kolkata</optionC>
    <optionD>Chennai</optionD>
    <correctAnswer>A</correctAnswer>
    <marks>1</marks>
  </question>
  <!-- Hindi question -->
  <question type="mcq">
    <text>भारत की राजधानी क्या है?</text>
    <optionA>दिल्ली</optionA>
    <optionB>मुंबई</optionB>
    <optionC>कोलकाता</optionC>
    <optionD>चेन्नई</optionD>
    <correctAnswer>A</correctAnswer>
    <marks>1</marks>
  </question>
  <!-- Gujarati question -->
  <question type="mcq">
    <text>ભારતની રાજધાની કઈ છે?</text>
    <optionA>દિલ્હી</optionA>
    <optionB>મુંબઈ</optionB>
    <optionC>કોલકાતા</optionC>
    <optionD>ચેન્નઈ</optionD>
    <correctAnswer>A</correctAnswer>
    <marks>1</marks>
  </question>
  <!-- MCQ3 combo -->
  <question type="mcq3">
    <text>Which are correct? 1.Earth revolves around Sun 2.Moon is a planet 3.Sun is a star</text>
    <optionA>Only 1 and 3</optionA>
    <optionB>Only 1 and 2</optionB>
    <optionC>All of the above</optionC>
    <optionD>None of the above</optionD>
    <correctAnswer>A</correctAnswer>
    <marks>2</marks>
  </question>
  <!-- Match question -->
  <question type="match">
    <text>Match: A.Gandhi  B.Newton  C.Einstein</text>
    <optionA>Father of Nation</optionA>
    <optionB>Laws of Motion</optionB>
    <optionC>Theory of Relativity</optionC>
    <optionD></optionD>
    <correctAnswer>A-1 B-2 C-3</correctAnswer>
    <marks>3</marks>
  </question>
</questions>`;
  const blob = new Blob([xml], { type: "application/xml;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "questions_template.xml";
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
  });

  const [activeQuizId, setActiveQuizId] = useState<string | null>(
    editingQuiz?.id ?? null,
  );

  // ── Bulletproof toLocalQuestion ──────────────────────────────────────────
  // Handles every API shape we've seen:
  //   Shape A: { options: string[], correctAnswer: number }
  //   Shape B: { options: string[], correctAnswer: string }   e.g. "1" or "B"
  //   Shape C: { options: {text:string,isCorrect:bool}[] }    already has isCorrect
  //   Shape D: { options: {text:string}[], correct_answer: number } snake_case key
  const toLocalQuestion = (q: any) => {
    const rawOptions: any[] = Array.isArray(q.options) ? q.options : [];

    // Shape C: options already have isCorrect booleans — use them directly
    if (
      rawOptions.length > 0 &&
      typeof rawOptions[0] === "object" &&
      "isCorrect" in rawOptions[0]
    ) {
      // But guard: if NONE are marked correct, fall through to index-based logic
      const hasCorrect = rawOptions.some((o) => o.isCorrect === true);
      if (hasCorrect) {
        return {
          id: q.id,
          questionText: q.questionText ?? q.question_text ?? "",
          options: rawOptions.map((o) => ({
            text: o.text ?? o.label ?? String(o),
            isCorrect: !!o.isCorrect,
          })),
          marks: q.marks ?? q.mark ?? 1,
          negativeMarking: false,
          shuffleOptions: false,
          showCorrectAnswer: true,
        };
      }
    }

    // Extract plain text from each option
    const optionTexts: string[] = rawOptions.map((o) =>
      typeof o === "string" ? o : (o?.text ?? o?.label ?? String(o)),
    );

    // Resolve correctAnswer — supports: number, "0", "1", "A", "B", "C", "D"
    const rawCorrect = q.correctAnswer ?? q.correct_answer ?? q.answer ?? null;
    let correctIdx = -1;

    if (rawCorrect !== null && rawCorrect !== undefined) {
      const asNum = Number(rawCorrect);
      if (!isNaN(asNum) && Number.isInteger(asNum) && asNum >= 0) {
        // numeric index: 0, 1, 2, 3
        correctIdx = asNum;
      } else {
        // letter: "A" → 0, "B" → 1, "C" → 2, "D" → 3
        const letter = String(rawCorrect).trim().toUpperCase();
        const letterIdx = ["A", "B", "C", "D"].indexOf(letter);
        if (letterIdx !== -1) correctIdx = letterIdx;
      }
    }

    return {
      id: q.id,
      questionText: q.questionText ?? q.question_text ?? "",
      options: optionTexts.map((text, idx) => ({
        text,
        isCorrect: idx === correctIdx,
      })),
      marks: q.marks ?? q.mark ?? 1,
      negativeMarking: false,
      shuffleOptions: false,
      showCorrectAnswer: true,
    };
  };

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
  // ── FIX: corrected broken TypeScript generic syntax ──────────────────────
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

  // ── Unified File Import Handler ───────────────────────────────────────────
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCSVImporting(true);
    setCSVErrors([]);

    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      let rows: string[][] = [];

      if (ext === "csv") {
        const buffer = await file.arrayBuffer();
        let text = "";
        try {
          text = new TextDecoder("utf-8").decode(buffer);
        } catch {
          text = new TextDecoder("latin1").decode(buffer);
        }
        rows = parseCSVText(text);
      } else if (ext === "xlsx" || ext === "xls") {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: "array", codepage: 65001 });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          defval: "",
          raw: false,
        }) as string[][];
      } else if (ext === "xml") {
        const buffer = await file.arrayBuffer();
        const text = new TextDecoder("utf-8").decode(buffer);
        rows = parseXMLToRows(text);
        if (rows.length <= 1) {
          setCSVErrors([
            "No <question> elements found. Please use the XML template format.",
          ]);
          setCSVImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
          return;
        }
      } else {
        setCSVErrors([
          "Unsupported file type. Please use CSV, XLSX, XLS, or XML.",
        ]);
        setCSVImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      const { parsed, errors } = parseRowsToQuestions(rows, 1);

      if (errors.length > 0 && parsed.length === 0) {
        setCSVErrors(errors);
        setCSVImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      if (parsed.length === 0) {
        setCSVErrors(["No valid questions found in the file."]);
        setCSVImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
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
    } catch (err) {
      setCSVErrors([
        "Failed to read the file. Please ensure it is a valid CSV, Excel, or XML file.",
      ]);
      console.error(err);
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
      ...newOnes.map((q) => toLocalQuestion(q)),
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
          allowReview: false,
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

              <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50 border border-blue-200">
                <svg
                  className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-sm text-blue-700">
                  <span className="font-semibold">Answer Review</span> can be
                  turned on or off from the quiz list after saving.
                </p>
              </div>

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

        {/* Bulk Import Panel */}
        {showCSVImport && (
          <Card className="p-5 bg-blue-50 border border-blue-200 rounded-lg mb-6">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-blue-900">
                  Bulk Import — CSV / Excel / XML
                </h3>
                <p className="text-xs text-blue-700 mt-0.5">
                  Supports English, Hindi (हिंदी), and Gujarati (ગુજરાતી) text.
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
                Column format (CSV / Excel):
              </p>
              <code className="text-xs bg-slate-100 px-1 rounded block mb-2">
                type, questionText, optionA, optionB, optionC, optionD,
                correctAnswer, marks
              </code>
              <div className="mt-2 space-y-1 text-xs text-slate-600">
                <p>
                  <span className="font-medium text-emerald-700">mcq</span> —
                  4-option. correctAnswer = A / B / C / D
                </p>
                <p>
                  <span className="font-medium text-purple-700">mcq3</span> —
                  Combo options. correctAnswer = A / B / C / D
                </p>
                <p>
                  <span className="font-medium text-orange-700">match</span> —
                  correctAnswer = A-1 B-2 C-3
                </p>
              </div>
              <p className="text-xs text-slate-500 mt-2 border-t border-slate-100 pt-2">
                XML: use the template structure with{" "}
                <code className="bg-slate-100 px-1 rounded">
                  &lt;question type="mcq"&gt;
                </code>{" "}
                elements.
              </p>
            </div>

            <div className="bg-white rounded-lg p-3 mb-3 border border-blue-100">
              <p className="text-xs font-semibold text-slate-700 mb-1">
                🌐 Multi-language support
              </p>
              <p className="text-xs text-slate-600">
                Save your CSV as <strong>UTF-8</strong> (File → Save As → UTF-8
                in Excel/Notepad) to preserve Hindi and Gujarati characters.
                Excel (.xlsx) and XML files handle Unicode automatically.
              </p>
            </div>

            {csvErrors.length > 0 && (
              <div className="bg-white border border-red-200 rounded-lg p-3 mb-3 max-h-40 overflow-y-auto">
                {csvErrors.map((err, i) => (
                  <p
                    key={i}
                    className={`text-xs ${
                      err.startsWith("✅")
                        ? "text-emerald-700 font-medium"
                        : err.startsWith("⚠️")
                          ? "text-amber-700 font-medium"
                          : "text-red-600"
                    }`}
                  >
                    {err}
                  </p>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-1.5 px-3 py-2 text-xs bg-white border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50"
              >
                <Download className="w-3.5 h-3.5" /> CSV Template
              </button>
              <button
                onClick={downloadExcelTemplate}
                className="flex items-center gap-1.5 px-3 py-2 text-xs bg-white border border-green-300 text-green-700 rounded-lg hover:bg-green-50"
              >
                <Download className="w-3.5 h-3.5" /> Excel Template
              </button>
              <button
                onClick={downloadXMLTemplate}
                className="flex items-center gap-1.5 px-3 py-2 text-xs bg-white border border-orange-300 text-orange-700 rounded-lg hover:bg-orange-50"
              >
                <Download className="w-3.5 h-3.5" /> XML Template
              </button>
              <label
                className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg cursor-pointer ${
                  csvImporting
                    ? "bg-slate-200 text-slate-500"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                {csvImporting ? "Importing..." : "Upload File"}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,.xml"
                  className="hidden"
                  onChange={handleImportFile}
                  disabled={csvImporting}
                />
              </label>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Accepted: <strong>.csv</strong>, <strong>.xlsx</strong>,{" "}
              <strong>.xls</strong>, <strong>.xml</strong>
            </p>
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
                placeholder="Enter your question here... (English / हिंदी / ગુજરાતી)"
                rows={3}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                style={{
                  fontFamily:
                    "'Noto Sans', 'Noto Sans Devanagari', 'Noto Sans Gujarati', sans-serif",
                }}
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
                      style={{
                        fontFamily:
                          "'Noto Sans', 'Noto Sans Devanagari', 'Noto Sans Gujarati', sans-serif",
                      }}
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
                <FileText className="w-4 h-4" /> Bulk Import
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
                        style={{
                          fontFamily:
                            "'Noto Sans', 'Noto Sans Devanagari', 'Noto Sans Gujarati', sans-serif",
                        }}
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
                              style={{
                                fontFamily:
                                  "'Noto Sans', 'Noto Sans Devanagari', 'Noto Sans Gujarati', sans-serif",
                              }}
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
                        <p
                          className="text-sm font-medium text-slate-900 mb-2"
                          style={{
                            fontFamily:
                              "'Noto Sans', 'Noto Sans Devanagari', 'Noto Sans Gujarati', sans-serif",
                          }}
                        >
                          {q.questionText}
                        </p>
                        <div className="space-y-1">
                          {q.options.map((opt, oi) => (
                            <div
                              key={oi}
                              className={`text-xs px-3 py-2 rounded ${opt.isCorrect ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-50 text-slate-600"}`}
                              style={{
                                fontFamily:
                                  "'Noto Sans', 'Noto Sans Devanagari', 'Noto Sans Gujarati', sans-serif",
                              }}
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
