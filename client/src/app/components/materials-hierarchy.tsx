import { useState, useRef } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  ArrowLeft,
  Plus,
  FolderOpen,
  BookOpen,
  FileText,
  Trash2,
  GraduationCap,
  ChevronRight,
  Upload,
  Loader2,
  X,
  ClipboardList,
} from "lucide-react";
import {
  useSemesters,
  useSubjects,
  useUnits,
  useStudyMaterials,
} from "../lib/hooks";
import { cacheDelete } from "../lib/local-cache";
import { api } from "../lib/api";
import type { Semester, Subject, Unit } from "../lib/api";

const EXAM_PREP_SEMESTER_NUMBER = 5;

// ─── Firebase Upload ──────────────────────────────────────────────────────────
async function uploadPdfToFirebase(
  file: File,
  onProgress: (pct: number) => void,
): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("fileName", file.name);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable)
        onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener("load", () => {
      if (xhr.status === 200) resolve(JSON.parse(xhr.responseText).url);
      else
        reject(
          new Error(
            `Upload failed: ${JSON.parse(xhr.responseText).message || xhr.statusText}`,
          ),
        );
    });
    xhr.addEventListener("error", () =>
      reject(new Error("Network error during upload")),
    );
    xhr.open("POST", "/api/admin/upload-pdf");
    const token = localStorage.getItem("auth_token");
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.send(formData);
  });
}

// ─── SemesterCard ─────────────────────────────────────────────────────────────
function SemesterCard({
  semester,
  onClick,
}: {
  semester: Semester & {
    subjectCount?: number;
    chapterCount?: number;
    materialCount?: number;
  };
  onClick: () => void;
}) {
  const isExamPrep = semester.number === EXAM_PREP_SEMESTER_NUMBER;
  const subjectCount = semester.subjectCount ?? 0;
  const chapterCount = semester.chapterCount ?? 0;
  const materialCount = semester.materialCount ?? 0;

  return (
    <Card
      onClick={onClick}
      className="p-6 bg-white border border-slate-200 hover:border-slate-300 rounded-xl cursor-pointer transition-all group hover:shadow-md"
    >
      <div className="flex items-center justify-between mb-4">
        <div
          className={`w-12 h-12 rounded-lg flex items-center justify-center ${isExamPrep ? "bg-amber-50" : "bg-blue-50"}`}
        >
          {isExamPrep ? (
            <ClipboardList className="w-6 h-6 text-amber-600" />
          ) : (
            <GraduationCap className="w-6 h-6 text-blue-600" />
          )}
        </div>
        <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-600 transition-colors" />
      </div>
      <h3 className="text-base font-semibold text-slate-900 mb-3">
        {semester.name}
      </h3>
      {isExamPrep ? (
        <div className="space-y-2 text-sm text-slate-600">
          <div className="flex items-center justify-between">
            <span>Topics:</span>
            <span className="font-medium text-slate-900">{subjectCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Materials:</span>
            <span className="font-medium text-slate-900">{materialCount}</span>
          </div>
        </div>
      ) : (
        <div className="space-y-2 text-sm text-slate-600">
          <div className="flex items-center justify-between">
            <span>Subjects:</span>
            <span className="font-medium text-slate-900">{subjectCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Chapters:</span>
            <span className="font-medium text-slate-900">{chapterCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Materials:</span>
            <span className="font-medium text-slate-900">{materialCount}</span>
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
// Normal flow:    semesters → subjects → chapters → materials
// Exam Prep flow: semesters → topics (subjects) → materials (via auto-unit)
type ViewMode =
  | "semesters"
  | "subjects"
  | "chapters"
  | "materials"
  | "exam_topics"
  | "exam_materials";

interface BreadcrumbPath {
  semesterNumber?: number;
  semesterName?: string;
  isExamPrep?: boolean;
  // normal flow
  subjectId?: string;
  subjectName?: string;
  unitId?: string;
  unitName?: string;
  // exam prep flow
  examTopicId?: string; // the subject id of the topic
  examTopicName?: string;
  examUnitId?: string; // the auto-unit id inside the topic
}

// ─── PDF Upload Area ──────────────────────────────────────────────────────────
function PdfUploadArea({
  fileRef,
  file,
  onChange,
  onClear,
  disabled,
  accent = "blue",
}: {
  fileRef: React.RefObject<HTMLInputElement>;
  file: File | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  disabled: boolean;
  accent?: "blue" | "amber";
}) {
  const activeClass =
    accent === "amber"
      ? "border-amber-400 bg-amber-50"
      : "border-blue-400 bg-blue-50";
  const hoverClass =
    accent === "amber"
      ? "border-slate-300 hover:border-amber-400 bg-white"
      : "border-slate-300 hover:border-slate-400 bg-white";
  const iconClass = accent === "amber" ? "text-amber-500" : "text-blue-500";

  return (
    <div
      onClick={() => !disabled && fileRef.current?.click()}
      className={`mt-1.5 border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center gap-2 transition-colors
        ${disabled ? "opacity-60 cursor-not-allowed border-slate-200 bg-slate-50" : file ? `cursor-pointer ${activeClass}` : `cursor-pointer ${hoverClass}`}`}
    >
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        onChange={onChange}
        className="hidden"
        disabled={disabled}
      />
      {file ? (
        <>
          <FileText className={`w-8 h-8 ${iconClass}`} />
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-800 max-w-[260px] truncate">
              {file.name}
            </span>
            {!disabled && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
                className="p-0.5 hover:bg-red-100 rounded"
              >
                <X className="w-4 h-4 text-red-500" />
              </button>
            )}
          </div>
          <span className="text-xs text-slate-500">
            {(file.size / (1024 * 1024)).toFixed(2)} MB
          </span>
        </>
      ) : (
        <>
          <Upload className="w-8 h-8 text-slate-400" />
          <span className="text-sm font-medium text-slate-700">
            Click to select a PDF
          </span>
          <span className="text-xs text-slate-400">Max 50 MB</span>
        </>
      )}
    </div>
  );
}

// ─── Upload Progress Bar ──────────────────────────────────────────────────────
function UploadProgress({
  progress,
  accent = "blue",
}: {
  progress: number;
  accent?: "blue" | "amber";
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-slate-600">
        <span className="flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" /> Uploading to Firebase
          Storage…
        </span>
        <span>{progress}%</span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all duration-300 ${accent === "amber" ? "bg-amber-500" : "bg-blue-500"}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function MaterialsHierarchy() {
  const [viewMode, setViewMode] = useState<ViewMode>("semesters");
  const [currentPath, setCurrentPath] = useState<BreadcrumbPath>({});

  const { semesters, loading: semestersLoading } = useSemesters();

  // Normal flow hooks
  const {
    subjects,
    loading: subjectsLoading,
    createSubject,
    deleteSubject,
  } = useSubjects(
    !currentPath.isExamPrep ? currentPath.semesterNumber : undefined,
  );
  const {
    units,
    loading: unitsLoading,
    createUnit,
    deleteUnit,
  } = useUnits(
    !currentPath.isExamPrep && currentPath.subjectId
      ? currentPath.subjectId
      : null,
  );
  const {
    materials,
    loading: materialsLoading,
    createMaterial,
    deleteMaterial,
  } = useStudyMaterials(
    !currentPath.isExamPrep ? (currentPath.unitId ?? null) : null,
  );

  // Exam prep hooks
  const {
    subjects: examTopics,
    loading: examTopicsLoading,
    createSubject: createExamTopic,
    deleteSubject: deleteExamTopic,
  } = useSubjects(
    currentPath.isExamPrep ? currentPath.semesterNumber : undefined,
  );
  // Materials inside the selected exam topic's auto-unit
  const {
    materials: examMaterials,
    loading: examMaterialsLoading,
    createMaterial: createExamMaterial,
    deleteMaterial: deleteExamMaterial,
  } = useStudyMaterials(
    currentPath.isExamPrep ? (currentPath.examUnitId ?? null) : null,
  );

  // ─── Form state ──────────────────────────────────────────────────────────────
  const [showAddSubjectForm, setShowAddSubjectForm] = useState(false);
  const [showAddChapterForm, setShowAddChapterForm] = useState(false);
  const [showAddMaterialForm, setShowAddMaterialForm] = useState(false);
  const [showAddExamTopicForm, setShowAddExamTopicForm] = useState(false);
  const [showAddExamMaterialForm, setShowAddExamMaterialForm] = useState(false);

  const [newSubjectName, setNewSubjectName] = useState("");
  const [newChapterName, setNewChapterName] = useState("");
  const [newMaterialTitle, setNewMaterialTitle] = useState("");
  const [newExamTopicName, setNewExamTopicName] = useState("");
  const [newExamMaterialTitle, setNewExamMaterialTitle] = useState("");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const [selectedExamFile, setSelectedExamFile] = useState<File | null>(null);
  const [examUploadProgress, setExamUploadProgress] = useState(0);
  const [isExamUploading, setIsExamUploading] = useState(false);
  const [isCreatingTopic, setIsCreatingTopic] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const examFileInputRef = useRef<HTMLInputElement>(null);

  const resetAllForms = () => {
    setShowAddSubjectForm(false);
    setShowAddChapterForm(false);
    setShowAddMaterialForm(false);
    setShowAddExamTopicForm(false);
    setShowAddExamMaterialForm(false);
    setNewSubjectName("");
    setNewChapterName("");
    setNewMaterialTitle("");
    setNewExamTopicName("");
    setNewExamMaterialTitle("");
    setSelectedFile(null);
    setSelectedExamFile(null);
    setUploadProgress(0);
    setExamUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (examFileInputRef.current) examFileInputRef.current.value = "";
  };

  // ─── File validation ──────────────────────────────────────────────────────────
  const validateFile = (file: File): boolean => {
    if (file.type !== "application/pdf") {
      alert("Please select a PDF file.");
      return false;
    }
    if (file.size > 50 * 1024 * 1024) {
      alert("File size must be under 50 MB.");
      return false;
    }
    return true;
  };

  // ─── Navigation ──────────────────────────────────────────────────────────────
  const handleSemesterClick = (semester: Semester) => {
    resetAllForms();
    const isExamPrep = semester.number === EXAM_PREP_SEMESTER_NUMBER;
    setCurrentPath({
      semesterNumber: semester.number,
      semesterName: semester.name,
      isExamPrep,
    });
    setViewMode(isExamPrep ? "exam_topics" : "subjects");
  };

  const handleSubjectClick = (subject: Subject) => {
    resetAllForms();
    setCurrentPath((p) => ({
      ...p,
      subjectId: subject.id,
      subjectName: subject.name,
    }));
    setViewMode("chapters");
  };

  const handleChapterClick = (unit: Unit) => {
    resetAllForms();
    setCurrentPath((p) => ({ ...p, unitId: unit.id, unitName: unit.title }));
    setViewMode("materials");
  };

  // Click an exam topic → resolve its auto-unit, then show materials
  const handleExamTopicClick = async (topic: Subject) => {
    resetAllForms();
    // Find or create the auto-unit for this topic
    let unitId: string;
    try {
      const existingUnits = await api.getUnitsBySubject(topic.id);
      if (existingUnits.length > 0) {
        unitId = existingUnits[0].id;
      } else {
        // Create auto-unit if missing
        const unit = await api.createUnit({
          subjectId: topic.id,
          title: "Materials",
          description: "",
          order: 1,
        });
        unitId = unit.id;
        cacheDelete(`units_${topic.id}`);
      }
      setCurrentPath((p) => ({
        ...p,
        examTopicId: topic.id,
        examTopicName: topic.name,
        examUnitId: unitId,
      }));
      setViewMode("exam_materials");
    } catch (err) {
      console.error(err);
      alert("Failed to open topic");
    }
  };

  const navigateBack = () => {
    resetAllForms();
    if (viewMode === "materials") {
      setCurrentPath((p) => ({ ...p, unitId: undefined, unitName: undefined }));
      setViewMode("chapters");
    } else if (viewMode === "chapters") {
      setCurrentPath((p) => ({
        ...p,
        subjectId: undefined,
        subjectName: undefined,
      }));
      setViewMode("subjects");
    } else if (viewMode === "subjects" || viewMode === "exam_topics") {
      setCurrentPath({});
      setViewMode("semesters");
    } else if (viewMode === "exam_materials") {
      setCurrentPath((p) => ({
        ...p,
        examTopicId: undefined,
        examTopicName: undefined,
        examUnitId: undefined,
      }));
      setViewMode("exam_topics");
    } else {
      setCurrentPath({});
      setViewMode("semesters");
    }
  };

  // ─── Normal CRUD ──────────────────────────────────────────────────────────────
  const handleAddSubject = async () => {
    if (!newSubjectName.trim() || !currentPath.semesterNumber) return;
    try {
      await createSubject({
        name: newSubjectName.trim(),
        semesterNumber: currentPath.semesterNumber,
        description: "",
        icon: "",
        color: "",
        order: subjects.length + 1,
      });
      setNewSubjectName("");
      setShowAddSubjectForm(false);
    } catch (err) {
      console.error(err);
      alert("Failed to add subject");
    }
  };

  const handleDeleteSubject = async (id: string) => {
    if (!confirm("Delete this subject and all its chapters and materials?"))
      return;
    try {
      await deleteSubject(id);
    } catch {
      alert("Failed to delete subject");
    }
  };

  const handleAddChapter = async () => {
    if (!newChapterName.trim() || !currentPath.subjectId) return;
    try {
      await createUnit({
        subjectId: currentPath.subjectId,
        title: newChapterName.trim(),
        description: "",
        order: units.length + 1,
      });
      setNewChapterName("");
      setShowAddChapterForm(false);
    } catch (err) {
      console.error(err);
      alert("Failed to add chapter");
    }
  };

  const handleDeleteUnit = async (id: string) => {
    if (!confirm("Delete this chapter and all its materials?")) return;
    try {
      await deleteUnit(id);
    } catch {
      alert("Failed to delete chapter");
    }
  };

  const handleAddMaterial = async () => {
    if (!newMaterialTitle.trim() || !selectedFile || !currentPath.unitId) {
      alert("Please enter a title and select a PDF file.");
      return;
    }
    try {
      setIsUploading(true);
      setUploadProgress(0);
      const url = await uploadPdfToFirebase(selectedFile, setUploadProgress);
      await createMaterial({
        unitId: currentPath.unitId,
        title: newMaterialTitle.trim(),
        description: "",
        type: "pdf",
        url,
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
      });
      setNewMaterialTitle("");
      setSelectedFile(null);
      setUploadProgress(0);
      setShowAddMaterialForm(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      console.error(err);
      alert("Upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteMaterial = async (id: string) => {
    if (!confirm("Delete this material?")) return;
    try {
      await deleteMaterial(id);
    } catch {
      alert("Failed to delete material");
    }
  };

  // ─── Exam Prep CRUD ───────────────────────────────────────────────────────────
  // Adding a topic: just create the Subject (auto-unit created on first click)
  const handleAddExamTopic = async () => {
    if (!newExamTopicName.trim() || !currentPath.semesterNumber) return;
    setIsCreatingTopic(true);
    try {
      await createExamTopic({
        name: newExamTopicName.trim(),
        semesterNumber: currentPath.semesterNumber,
        description: "",
        icon: "",
        color: "",
        order: examTopics.length + 1,
      });
      setNewExamTopicName("");
      setShowAddExamTopicForm(false);
    } catch (err) {
      console.error(err);
      alert("Failed to add topic");
    } finally {
      setIsCreatingTopic(false);
    }
  };

  const handleDeleteExamTopic = async (id: string) => {
    if (!confirm("Delete this topic and all its materials?")) return;
    try {
      await deleteExamTopic(id);
    } catch {
      alert("Failed to delete topic");
    }
  };

  // Adding a material inside an exam topic
  const handleAddExamMaterial = async () => {
    if (
      !newExamMaterialTitle.trim() ||
      !selectedExamFile ||
      !currentPath.examUnitId
    ) {
      alert("Please enter a title and select a PDF file.");
      return;
    }
    try {
      setIsExamUploading(true);
      setExamUploadProgress(0);
      const url = await uploadPdfToFirebase(
        selectedExamFile,
        setExamUploadProgress,
      );
      await createExamMaterial({
        unitId: currentPath.examUnitId,
        title: newExamMaterialTitle.trim(),
        description: "",
        type: "pdf",
        url,
        fileName: selectedExamFile.name,
        fileSize: selectedExamFile.size,
      });
      setNewExamMaterialTitle("");
      setSelectedExamFile(null);
      setExamUploadProgress(0);
      setShowAddExamMaterialForm(false);
      if (examFileInputRef.current) examFileInputRef.current.value = "";
    } catch (err) {
      console.error(err);
      alert("Upload failed.");
    } finally {
      setIsExamUploading(false);
    }
  };

  const handleDeleteExamMaterial = async (id: string) => {
    if (!confirm("Delete this material?")) return;
    try {
      await deleteExamMaterial(id);
    } catch {
      alert("Failed to delete material");
    }
  };

  // ─── Breadcrumbs ─────────────────────────────────────────────────────────────
  const renderBreadcrumbs = () => {
    const crumbs: React.ReactNode[] = [];
    if (viewMode !== "semesters") {
      crumbs.push(
        <button
          key="root"
          onClick={() => {
            setCurrentPath({});
            setViewMode("semesters");
            resetAllForms();
          }}
          className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
        >
          Semesters
        </button>,
      );
    }
    if (
      currentPath.semesterName &&
      viewMode !== "subjects" &&
      viewMode !== "exam_topics"
    ) {
      crumbs.push(
        <ChevronRight key="c1" className="w-4 h-4 text-slate-400" />,
        <button
          key="sem"
          onClick={() => {
            setCurrentPath((p) => ({
              semesterNumber: p.semesterNumber,
              semesterName: p.semesterName,
              isExamPrep: p.isExamPrep,
            }));
            setViewMode(currentPath.isExamPrep ? "exam_topics" : "subjects");
            resetAllForms();
          }}
          className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
        >
          {currentPath.semesterName}
        </button>,
      );
    }
    if (currentPath.subjectName && viewMode !== "chapters") {
      crumbs.push(
        <ChevronRight key="c2" className="w-4 h-4 text-slate-400" />,
        <button
          key="subj"
          onClick={() => {
            setCurrentPath((p) => ({
              ...p,
              unitId: undefined,
              unitName: undefined,
            }));
            setViewMode("chapters");
            resetAllForms();
          }}
          className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
        >
          {currentPath.subjectName}
        </button>,
      );
    }
    if (currentPath.unitName && viewMode === "materials") {
      crumbs.push(
        <ChevronRight key="c3" className="w-4 h-4 text-slate-400" />,
        <span key="unit" className="text-sm text-slate-900 font-medium">
          {currentPath.unitName}
        </span>,
      );
    }
    if (currentPath.examTopicName && viewMode === "exam_materials") {
      crumbs.push(
        <ChevronRight key="c4" className="w-4 h-4 text-slate-400" />,
        <span key="topic" className="text-sm text-slate-900 font-medium">
          {currentPath.examTopicName}
        </span>,
      );
    }
    return crumbs;
  };

  if (semestersLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400 mr-2" />
        <span className="text-slate-600">Loading…</span>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          {viewMode !== "semesters" && (
            <button
              onClick={navigateBack}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            {renderBreadcrumbs()}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              {viewMode === "semesters" && "Study Materials"}
              {viewMode === "subjects" && currentPath.semesterName}
              {viewMode === "chapters" && currentPath.subjectName}
              {viewMode === "materials" && currentPath.unitName}
              {viewMode === "exam_topics" && currentPath.semesterName}
              {viewMode === "exam_materials" && currentPath.examTopicName}
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              {viewMode === "semesters" &&
                "Select a semester to manage materials"}
              {viewMode === "subjects" && "Manage subjects for this semester"}
              {viewMode === "chapters" && "Manage chapters for this subject"}
              {viewMode === "materials" && "Manage materials for this chapter"}
              {viewMode === "exam_topics" && "Manage exam preparation topics"}
              {viewMode === "exam_materials" && "Manage PDFs for this topic"}
            </p>
          </div>
          {viewMode === "subjects" && (
            <Button
              onClick={() => setShowAddSubjectForm(true)}
              className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-lg flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Subject
            </Button>
          )}
          {viewMode === "chapters" && (
            <Button
              onClick={() => setShowAddChapterForm(true)}
              className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-lg flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Chapter
            </Button>
          )}
          {viewMode === "materials" && (
            <Button
              onClick={() => setShowAddMaterialForm(true)}
              className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-lg flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Material
            </Button>
          )}
          {viewMode === "exam_topics" && (
            <Button
              onClick={() => setShowAddExamTopicForm(true)}
              className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-2.5 rounded-lg flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Topic
            </Button>
          )}
          {viewMode === "exam_materials" && (
            <Button
              onClick={() => setShowAddExamMaterialForm(true)}
              className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-2.5 rounded-lg flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Material
            </Button>
          )}
        </div>
      </div>

      {/* ── Add Subject Form ── */}
      {showAddSubjectForm && (
        <Card className="p-6 bg-white border border-slate-200 rounded-xl mb-6">
          <h3 className="text-base font-semibold text-slate-900 mb-4">
            Add New Subject
          </h3>
          <div className="space-y-4">
            <div>
              <Label htmlFor="subjectName">Subject Name</Label>
              <Input
                id="subjectName"
                value={newSubjectName}
                onChange={(e) => setNewSubjectName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddSubject()}
                placeholder="e.g., Mathematics, Physics…"
                className="mt-1.5"
              />
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleAddSubject}
                disabled={!newSubjectName.trim()}
                className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-lg disabled:opacity-50"
              >
                Add Subject
              </Button>
              <Button
                onClick={() => {
                  setShowAddSubjectForm(false);
                  setNewSubjectName("");
                }}
                variant="outline"
                className="px-6 py-2.5 rounded-lg"
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* ── Add Chapter Form ── */}
      {showAddChapterForm && (
        <Card className="p-6 bg-white border border-slate-200 rounded-xl mb-6">
          <h3 className="text-base font-semibold text-slate-900 mb-4">
            Add New Chapter
          </h3>
          <div className="space-y-4">
            <div>
              <Label htmlFor="chapterName">Chapter Name</Label>
              <Input
                id="chapterName"
                value={newChapterName}
                onChange={(e) => setNewChapterName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddChapter()}
                placeholder="e.g., Chapter 1: Introduction"
                className="mt-1.5"
              />
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleAddChapter}
                disabled={!newChapterName.trim()}
                className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-lg disabled:opacity-50"
              >
                Add Chapter
              </Button>
              <Button
                onClick={() => {
                  setShowAddChapterForm(false);
                  setNewChapterName("");
                }}
                variant="outline"
                className="px-6 py-2.5 rounded-lg"
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* ── Add Material Form (normal) ── */}
      {showAddMaterialForm && (
        <Card className="p-6 bg-white border border-slate-200 rounded-xl mb-6">
          <h3 className="text-base font-semibold text-slate-900 mb-4">
            Add New Material
          </h3>
          <div className="space-y-4">
            <div>
              <Label htmlFor="materialTitle">Material Title</Label>
              <Input
                id="materialTitle"
                value={newMaterialTitle}
                onChange={(e) => setNewMaterialTitle(e.target.value)}
                placeholder="e.g., Lecture Notes, Assignment…"
                className="mt-1.5"
                disabled={isUploading}
              />
            </div>
            <div>
              <Label>PDF File</Label>
              <PdfUploadArea
                fileRef={fileInputRef}
                file={selectedFile}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f && validateFile(f)) setSelectedFile(f);
                  else e.target.value = "";
                }}
                onClear={() => {
                  setSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                disabled={isUploading}
                accent="blue"
              />
            </div>
            {isUploading && (
              <UploadProgress progress={uploadProgress} accent="blue" />
            )}
            <div className="flex gap-3">
              <Button
                onClick={handleAddMaterial}
                disabled={
                  isUploading || !selectedFile || !newMaterialTitle.trim()
                }
                className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-lg flex items-center gap-2 disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Uploading…
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" /> Upload & Save
                  </>
                )}
              </Button>
              <Button
                onClick={() => {
                  if (isUploading) return;
                  setShowAddMaterialForm(false);
                  setNewMaterialTitle("");
                  setSelectedFile(null);
                  setUploadProgress(0);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                variant="outline"
                disabled={isUploading}
                className="px-6 py-2.5 rounded-lg"
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* ── Add Exam Topic Form (just a name — PDFs added after clicking in) ── */}
      {showAddExamTopicForm && (
        <Card className="p-6 bg-white border border-amber-200 rounded-xl mb-6">
          <h3 className="text-base font-semibold text-slate-900 mb-1">
            Add New Topic
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Give the topic a name. You can add multiple PDFs after clicking into
            it.
          </p>
          <div className="space-y-4">
            <div>
              <Label htmlFor="examTopicName">Topic Name</Label>
              <Input
                id="examTopicName"
                value={newExamTopicName}
                onChange={(e) => setNewExamTopicName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddExamTopic()}
                placeholder="e.g., Previous Year Papers, Mock Tests…"
                className="mt-1.5"
                disabled={isCreatingTopic}
              />
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleAddExamTopic}
                disabled={!newExamTopicName.trim() || isCreatingTopic}
                className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-2.5 rounded-lg flex items-center gap-2 disabled:opacity-50"
              >
                {isCreatingTopic ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Creating…
                  </>
                ) : (
                  "Add Topic"
                )}
              </Button>
              <Button
                onClick={() => {
                  setShowAddExamTopicForm(false);
                  setNewExamTopicName("");
                }}
                variant="outline"
                disabled={isCreatingTopic}
                className="px-6 py-2.5 rounded-lg"
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* ── Add Exam Material Form ── */}
      {showAddExamMaterialForm && (
        <Card className="p-6 bg-white border border-amber-200 rounded-xl mb-6">
          <h3 className="text-base font-semibold text-slate-900 mb-4">
            Add Material to "{currentPath.examTopicName}"
          </h3>
          <div className="space-y-4">
            <div>
              <Label htmlFor="examMaterialTitle">Material Title</Label>
              <Input
                id="examMaterialTitle"
                value={newExamMaterialTitle}
                onChange={(e) => setNewExamMaterialTitle(e.target.value)}
                placeholder="e.g., 2023 Question Paper, Mock Test 1…"
                className="mt-1.5"
                disabled={isExamUploading}
              />
            </div>
            <div>
              <Label>PDF File</Label>
              <PdfUploadArea
                fileRef={examFileInputRef}
                file={selectedExamFile}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f && validateFile(f)) setSelectedExamFile(f);
                  else e.target.value = "";
                }}
                onClear={() => {
                  setSelectedExamFile(null);
                  if (examFileInputRef.current)
                    examFileInputRef.current.value = "";
                }}
                disabled={isExamUploading}
                accent="amber"
              />
            </div>
            {isExamUploading && (
              <UploadProgress progress={examUploadProgress} accent="amber" />
            )}
            <div className="flex gap-3">
              <Button
                onClick={handleAddExamMaterial}
                disabled={
                  isExamUploading ||
                  !selectedExamFile ||
                  !newExamMaterialTitle.trim()
                }
                className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-2.5 rounded-lg flex items-center gap-2 disabled:opacity-50"
              >
                {isExamUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Uploading…
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" /> Upload & Save
                  </>
                )}
              </Button>
              <Button
                onClick={() => {
                  if (isExamUploading) return;
                  setShowAddExamMaterialForm(false);
                  setNewExamMaterialTitle("");
                  setSelectedExamFile(null);
                  setExamUploadProgress(0);
                  if (examFileInputRef.current)
                    examFileInputRef.current.value = "";
                }}
                variant="outline"
                disabled={isExamUploading}
                className="px-6 py-2.5 rounded-lg"
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* ══════ Views ══════ */}

      {/* Semesters */}
      {viewMode === "semesters" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {(semesters as any[]).map((semester) => (
            <SemesterCard
              key={semester.id}
              semester={semester}
              onClick={() => handleSemesterClick(semester)}
            />
          ))}
        </div>
      )}

      {/* Subjects */}
      {viewMode === "subjects" && (
        <div className="space-y-3">
          {subjectsLoading ? (
            <div className="flex items-center justify-center py-8 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading
              subjects…
            </div>
          ) : subjects.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-xl bg-white">
              <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-900 mb-1">
                No subjects yet
              </h3>
              <p className="text-sm text-slate-500 mb-4">
                Start by adding your first subject
              </p>
              <Button
                onClick={() => setShowAddSubjectForm(true)}
                className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-lg"
              >
                <Plus className="w-4 h-4 mr-2" /> Add Subject
              </Button>
            </div>
          ) : (
            subjects.map((subject) => (
              <Card
                key={subject.id}
                className="p-4 bg-white border border-slate-200 hover:border-slate-300 rounded-lg transition-all group"
              >
                <div className="flex items-center justify-between gap-4">
                  <div
                    onClick={() => handleSubjectClick(subject)}
                    className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer"
                  >
                    <div className="w-11 h-11 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-5 h-5 text-slate-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-slate-900 mb-1">
                        {subject.name}
                      </h3>
                      <div className="text-xs text-slate-500">
                        Semester {subject.semesterNumber}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-600 transition-colors flex-shrink-0" />
                  </div>
                  <button
                    onClick={() => handleDeleteSubject(subject.id)}
                    className="p-1.5 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Chapters */}
      {viewMode === "chapters" && (
        <div className="space-y-3">
          {unitsLoading ? (
            <div className="flex items-center justify-center py-8 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading
              chapters…
            </div>
          ) : units.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-xl bg-white">
              <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-900 mb-1">
                No chapters yet
              </h3>
              <p className="text-sm text-slate-500 mb-4">
                Start by adding your first chapter
              </p>
              <Button
                onClick={() => setShowAddChapterForm(true)}
                className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-lg"
              >
                <Plus className="w-4 h-4 mr-2" /> Add Chapter
              </Button>
            </div>
          ) : (
            units.map((unit) => (
              <Card
                key={unit.id}
                className="p-4 bg-white border border-slate-200 hover:border-slate-300 rounded-lg transition-all group"
              >
                <div className="flex items-center justify-between gap-4">
                  <div
                    onClick={() => handleChapterClick(unit)}
                    className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer"
                  >
                    <div className="w-11 h-11 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-slate-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-slate-900 mb-1">
                        {unit.title}
                      </h3>
                      {unit.description && (
                        <div className="text-xs text-slate-500 truncate">
                          {unit.description}
                        </div>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-600 transition-colors flex-shrink-0" />
                  </div>
                  <button
                    onClick={() => handleDeleteUnit(unit.id)}
                    className="p-1.5 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Materials (normal) */}
      {viewMode === "materials" && (
        <div className="space-y-3">
          {materialsLoading ? (
            <div className="flex items-center justify-center py-8 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading
              materials…
            </div>
          ) : materials.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-xl bg-white">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-900 mb-1">
                No materials yet
              </h3>
              <p className="text-sm text-slate-500 mb-4">
                Start by adding your first material
              </p>
              <Button
                onClick={() => setShowAddMaterialForm(true)}
                className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-lg"
              >
                <Plus className="w-4 h-4 mr-2" /> Add Material
              </Button>
            </div>
          ) : (
            materials.map((material) => (
              <Card
                key={material.id}
                className="p-4 bg-white border border-slate-200 hover:border-slate-300 rounded-lg transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="w-11 h-11 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-slate-900 mb-1 truncate">
                        {material.title}
                      </h3>
                      <div className="text-xs text-slate-500">
                        {material.uploadedAt
                          ? new Date(material.uploadedAt).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              },
                            )
                          : ""}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <a
                      href={material.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium px-3 py-1.5 hover:bg-blue-50 rounded transition-colors whitespace-nowrap"
                    >
                      View PDF
                    </a>
                    <button
                      onClick={() => handleDeleteMaterial(material.id)}
                      className="p-1.5 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Exam Prep — Topics list */}
      {viewMode === "exam_topics" && (
        <div className="space-y-3">
          {examTopicsLoading ? (
            <div className="flex items-center justify-center py-8 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading topics…
            </div>
          ) : examTopics.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-amber-200 rounded-xl bg-amber-50/30">
              <ClipboardList className="w-12 h-12 text-amber-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-900 mb-1">
                No topics yet
              </h3>
              <p className="text-sm text-slate-500 mb-4">
                Add a topic — e.g., Previous Year Papers, Mock Tests
              </p>
              <Button
                onClick={() => setShowAddExamTopicForm(true)}
                className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-2.5 rounded-lg"
              >
                <Plus className="w-4 h-4 mr-2" /> Add Topic
              </Button>
            </div>
          ) : (
            examTopics.map((topic) => (
              <Card
                key={topic.id}
                className="p-4 bg-white border border-amber-100 hover:border-amber-200 rounded-lg transition-all group"
              >
                <div className="flex items-center justify-between gap-4">
                  <div
                    onClick={() => handleExamTopicClick(topic)}
                    className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer"
                  >
                    <div className="w-11 h-11 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <ClipboardList className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-slate-900 mb-1">
                        {topic.name}
                      </h3>
                      <div className="text-xs text-slate-500">
                        Exam Preparation Topic
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-amber-500 transition-colors flex-shrink-0" />
                  </div>
                  <button
                    onClick={() => handleDeleteExamTopic(topic.id)}
                    className="p-1.5 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Exam Prep — Materials inside a topic */}
      {viewMode === "exam_materials" && (
        <div className="space-y-3">
          {examMaterialsLoading ? (
            <div className="flex items-center justify-center py-8 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading
              materials…
            </div>
          ) : examMaterials.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-amber-200 rounded-xl bg-amber-50/30">
              <FileText className="w-12 h-12 text-amber-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-900 mb-1">
                No materials yet
              </h3>
              <p className="text-sm text-slate-500 mb-4">
                Upload PDFs for this topic
              </p>
              <Button
                onClick={() => setShowAddExamMaterialForm(true)}
                className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-2.5 rounded-lg"
              >
                <Plus className="w-4 h-4 mr-2" /> Add Material
              </Button>
            </div>
          ) : (
            examMaterials.map((material) => (
              <Card
                key={material.id}
                className="p-4 bg-white border border-amber-100 hover:border-amber-200 rounded-lg transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="w-11 h-11 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-slate-900 mb-1 truncate">
                        {material.title}
                      </h3>
                      <div className="text-xs text-slate-500">
                        {material.uploadedAt
                          ? new Date(material.uploadedAt).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              },
                            )
                          : ""}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <a
                      href={material.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-amber-700 hover:text-amber-900 font-medium px-3 py-1.5 hover:bg-amber-50 rounded transition-colors whitespace-nowrap"
                    >
                      View PDF
                    </a>
                    <button
                      onClick={() => handleDeleteExamMaterial(material.id)}
                      className="p-1.5 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
