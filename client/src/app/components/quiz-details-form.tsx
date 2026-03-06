import { useState } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Loader2 } from "lucide-react";
import type { Question } from "../lib/api";

interface QuizDetailsFormProps {
  selectedQuestions: Question[];
  onComplete: (details: {
    title: string;
    description: string | null;
    duration: number;
    subjectId: string;
  }) => void;
  onCancel: () => void;
  initialTitle?: string;
  initialDescription?: string;
  initialDuration?: number;
  isEditMode?: boolean;
  isSaving?: boolean;
}

export function QuizDetailsForm({
  selectedQuestions,
  onComplete,
  onCancel,
  initialTitle = "",
  initialDescription = "",
  initialDuration = 30,
  isEditMode = false,
  isSaving = false,
}: QuizDetailsFormProps) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [duration, setDuration] = useState(initialDuration);

  const handleSubmit = () => {
    if (!title.trim()) {
      alert("Please enter a quiz title");
      return;
    }
    onComplete({
      title: title.trim(),
      description: description.trim() || null,
      duration,
      subjectId: "",
      // allowReview intentionally omitted — controlled from quiz list page
    });
  };

  return (
    <Card className="p-6 bg-white border border-slate-200 rounded-xl max-w-2xl">
      <h3 className="text-lg font-semibold text-slate-900 mb-1">
        {isEditMode ? "Edit Quiz Details" : "Quiz Details"}
      </h3>
      <p className="text-sm text-slate-500 mb-6">
        {selectedQuestions.length} question
        {selectedQuestions.length !== 1 ? "s" : ""} selected
      </p>

      <div className="space-y-4">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Quiz Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Unit 1 Assessment"
            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
          />
        </div>

        {/* Description — optional */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Description{" "}
            <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of this quiz..."
            rows={2}
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
            value={duration}
            onChange={(e) => setDuration(Math.max(1, Number(e.target.value)))}
            min="1"
            className="w-40 px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
          />
        </div>

        {/* Info note about review setting */}
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
            <span className="font-semibold">Answer Review</span> can be turned
            on or off from the quiz list after saving.
          </p>
        </div>

        {/* Summary */}
        <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-600 space-y-1">
          <div className="flex justify-between">
            <span>Questions:</span>
            <span className="font-medium text-slate-900">
              {selectedQuestions.length}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Total Marks:</span>
            <span className="font-medium text-slate-900">
              {selectedQuestions.reduce((sum, q) => sum + (q.marks ?? 1), 0)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Duration:</span>
            <span className="font-medium text-slate-900">{duration} min</span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-2">
          <Button
            onClick={handleSubmit}
            disabled={!title.trim() || isSaving}
            className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSaving
              ? "Creating Quiz..."
              : isEditMode
                ? "Update Quiz"
                : "Create Quiz"}
          </Button>
          <Button
            onClick={onCancel}
            disabled={isSaving}
            className="px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-lg disabled:opacity-50"
          >
            Cancel
          </Button>
        </div>
      </div>
    </Card>
  );
}
