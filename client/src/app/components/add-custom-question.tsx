import { useState } from "react";
import {
  QuestionBankItem,
  questionBankStore,
} from "@/app/data/question-bank-data";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Plus } from "lucide-react";

interface AddCustomQuestionProps {
  onComplete: () => void;
  onCancel: () => void;
}

export function AddCustomQuestion({
  onComplete,
  onCancel,
}: AddCustomQuestionProps) {
  const [questionText, setQuestionText] = useState("");
  const [options, setOptions] = useState([
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
  ]);
  const [marks, setMarks] = useState(1);

  const handleSave = () => {
    if (!questionText.trim()) {
      alert("Please enter a question");
      return;
    }

    const filledOptions = options.filter((opt) => opt.text.trim());
    if (filledOptions.length < 2) {
      alert("Please add at least 2 options");
      return;
    }

    const hasCorrect = options.some((opt) => opt.isCorrect);
    if (!hasCorrect) {
      alert("Please mark at least one correct answer");
      return;
    }

    const newQuestion: QuestionBankItem = {
      id: `qb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      questionText,
      options: filledOptions,
      marks,
      subject: "",
      semester: "",
      createdDate: new Date().toISOString(),
      negativeMarking: false,
      shuffleOptions: false,
      showCorrectAnswer: true,
    };

    questionBankStore.addQuestion(newQuestion);
    onComplete();
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-2xl mx-auto">
        <Card className="p-6 bg-white border border-slate-200 rounded-lg">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Question Text
              </label>
              <textarea
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
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
                {options.map((option, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={option.isCorrect}
                      onChange={(e) => {
                        const newOptions = [...options];
                        newOptions[idx].isCorrect = e.target.checked;
                        setOptions(newOptions);
                      }}
                      className="w-4 h-4 text-slate-900 border-slate-300 rounded focus:ring-slate-900"
                    />
                    <input
                      type="text"
                      value={option.text}
                      onChange={(e) => {
                        const newOptions = [...options];
                        newOptions[idx].text = e.target.value;
                        setOptions(newOptions);
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
                value={marks}
                onChange={(e) => setMarks(Number(e.target.value))}
                min="1"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleSave}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Question
              </Button>
              <Button
                onClick={onCancel}
                className="px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-lg transition-colors"
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
