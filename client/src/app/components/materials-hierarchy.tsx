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
} from "lucide-react";
import {
  useSemesters,
  useSubjects,
  useUnits,
  useStudyMaterials,
} from "../lib/hooks";
import type { Semester, Subject, Unit } from "../lib/api";

// ─── Firebase Storage Upload ──────────────────────────────────────────────────
async function uploadPdfToFirebase(
  file: File,
  onProgress: (pct: number) => void,
): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("fileName", file.name);

  // Use XMLHttpRequest so we get upload progress
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        onProgress(pct);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status === 200) {
        const response = JSON.parse(xhr.responseText);
        resolve(response.url);
      } else {
        const err = JSON.parse(xhr.responseText).message || xhr.statusText;
        reject(new Error(`Upload failed: ${err}`));
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Network error during upload"));
    });

    xhr.open("POST", "/api/admin/upload-pdf");

    // Include auth token
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
  return (
    <Card
      onClick={onClick}
      className="p-6 bg-white border border-slate-200 hover:border-slate-300 rounded-xl cursor-pointer transition-all group hover:shadow-md"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
          <GraduationCap className="w-6 h-6 text-blue-600" />
        </div>
        <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-600 transition-colors" />
      </div>
      <h3 className="text-base font-semibold text-slate-900 mb-3">
        {semester.name}
      </h3>
      <div className="space-y-2 text-sm text-slate-600">
        <div className="flex items-center justify-between">
          <span>Subjects:</span>
          <span className="font-medium text-slate-900">
            {semester.subjectCount ?? 0}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Chapters:</span>
          <span className="font-medium text-slate-900">
            {semester.chapterCount ?? 0}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Materials:</span>
          <span className="font-medium text-slate-900">
            {semester.materialCount ?? 0}
          </span>
        </div>
      </div>
    </Card>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
type ViewMode = "semesters" | "subjects" | "chapters" | "materials";

interface BreadcrumbPath {
  semesterNumber?: number;
  semesterName?: string;
  subjectId?: string;
  subjectName?: string;
  unitId?: string;
  unitName?: string;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function MaterialsHierarchy() {
  const [viewMode, setViewMode] = useState<ViewMode>("semesters");
  const [currentPath, setCurrentPath] = useState<BreadcrumbPath>({});

  const { semesters, loading: semestersLoading } = useSemesters();

  const {
    subjects,
    loading: subjectsLoading,
    createSubject,
    deleteSubject,
  } = useSubjects(currentPath.semesterNumber);

  const {
    units,
    loading: unitsLoading,
    createUnit,
    deleteUnit,
  } = useUnits(
    typeof currentPath.subjectId === "string" && currentPath.subjectId
      ? currentPath.subjectId
      : null,
  );

  const {
    materials,
    loading: materialsLoading,
    createMaterial,
    deleteMaterial,
  } = useStudyMaterials(
    typeof currentPath.unitId === "string" && currentPath.unitId
      ? currentPath.unitId
      : null,
  );

  const [showAddSubjectForm, setShowAddSubjectForm] = useState(false);
  const [showAddChapterForm, setShowAddChapterForm] = useState(false);
  const [showAddMaterialForm, setShowAddMaterialForm] = useState(false);

  const [newSubjectName, setNewSubjectName] = useState("");
  const [newChapterName, setNewChapterName] = useState("");
  const [newMaterialTitle, setNewMaterialTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetAllForms = () => {
    setShowAddSubjectForm(false);
    setShowAddChapterForm(false);
    setShowAddMaterialForm(false);
    setNewSubjectName("");
    setNewChapterName("");
    setNewMaterialTitle("");
    setSelectedFile(null);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSemesterClick = (semester: Semester) => {
    resetAllForms();
    setCurrentPath({
      semesterNumber: semester.number,
      semesterName: semester.name,
    });
    setViewMode("subjects");
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
    } else {
      setCurrentPath({});
      setViewMode("semesters");
    }
  };

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

      // 1. Upload PDF to Firebase Storage via backend
      const downloadUrl = await uploadPdfToFirebase(
        selectedFile,
        setUploadProgress,
      );

      // 2. Save metadata to Firestore
      await createMaterial({
        unitId: currentPath.unitId,
        title: newMaterialTitle.trim(),
        description: "",
        type: "pdf",
        url: downloadUrl,
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
      });

      setNewMaterialTitle("");
      setSelectedFile(null);
      setUploadProgress(0);
      setShowAddMaterialForm(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      console.error("Failed to add material:", err);
      alert("Upload failed. Check the console for details.");
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      alert("Please select a PDF file.");
      e.target.value = "";
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      alert("File size must be under 50 MB.");
      e.target.value = "";
      return;
    }
    setSelectedFile(file);
  };

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

    if (currentPath.semesterName && viewMode !== "subjects") {
      crumbs.push(
        <ChevronRight key="c1" className="w-4 h-4 text-slate-400" />,
        <button
          key="sem"
          onClick={() => {
            setCurrentPath((p) => ({
              semesterNumber: p.semesterNumber,
              semesterName: p.semesterName,
            }));
            setViewMode("subjects");
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
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              {viewMode === "semesters" &&
                "Select a semester to manage materials"}
              {viewMode === "subjects" && "Manage subjects for this semester"}
              {viewMode === "chapters" && "Manage chapters for this subject"}
              {viewMode === "materials" && "Manage materials for this chapter"}
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
        </div>
      </div>

      {/* Add Subject Form */}
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

      {/* Add Chapter Form */}
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

      {/* Add Material Form */}
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
              <div
                onClick={() => !isUploading && fileInputRef.current?.click()}
                className={`mt-1.5 border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center gap-2 transition-colors
                  ${
                    isUploading
                      ? "opacity-60 cursor-not-allowed border-slate-200 bg-slate-50"
                      : selectedFile
                        ? "border-blue-400 bg-blue-50 cursor-pointer"
                        : "border-slate-300 hover:border-slate-400 bg-white cursor-pointer"
                  }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={isUploading}
                />
                {selectedFile ? (
                  <>
                    <FileText className="w-8 h-8 text-blue-500" />
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-800 max-w-[260px] truncate">
                        {selectedFile.name}
                      </span>
                      {!isUploading && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFile(null);
                            if (fileInputRef.current)
                              fileInputRef.current.value = "";
                          }}
                          className="p-0.5 hover:bg-red-100 rounded"
                        >
                          <X className="w-4 h-4 text-red-500" />
                        </button>
                      )}
                    </div>
                    <span className="text-xs text-slate-500">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
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
            </div>

            {isUploading && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span className="flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Uploading to
                    Firebase Storage…
                  </span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1.5">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
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

      {/* Semesters View */}
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

      {/* Subjects View */}
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

      {/* Chapters View */}
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

      {/* Materials View */}
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
                    {/* ✅ Direct Firebase URL — opens as real PDF in browser */}
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
    </div>
  );
}
