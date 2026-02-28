import { useState, useRef } from "react";
import { useStudents } from "../lib/hooks";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import {
  Search,
  Check,
  X,
  Users,
  UserCheck,
  Plus,
  Mail,
  Loader2,
  Upload,
  Phone,
  Lock,
  Pencil,
  FileText,
  Ban,
  Eye,
  EyeOff,
} from "lucide-react";
import { Student } from "../lib/api";

type ModalMode = "none" | "add" | "bulk";

export function StudentPermissions() {
  const {
    students,
    loading,
    error,
    refetch,
    createStudent,
    createStudentsBulk,
    updateStudent,
    resetStudentPassword,
    updateStudentStatus,
    deleteStudent,
    statusCounts,
  } = useStudents();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "pending" | "approved" | "blocked"
  >("all");
  const [modalMode, setModalMode] = useState<ModalMode>("none");
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(
    new Set(),
  );

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  const [csvText, setCsvText] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkResult, setBulkResult] = useState<{
    created: number;
    skipped: number;
  } | null>(null);
  const [bulkInputMode, setBulkInputMode] = useState<"paste" | "upload">(
    "paste",
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openModal = (mode: ModalMode) => {
    setModalMode((prev) => (prev === mode ? "none" : mode));
    setBulkResult(null);
    setCsvText("");
    setBulkInputMode("paste");
  };

  const closeAllModals = () => {
    setModalMode("none");
    setBulkResult(null);
    setCsvText("");
    setBulkInputMode("paste");
    setNewName("");
    setNewEmail("");
    setNewPhone("");
    setNewPassword("");
    setShowNewPassword(false);
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword) {
      alert("Email and password are required");
      return;
    }
    setSaving(true);
    try {
      await createStudent({
        name: newName || newEmail.split("@")[0],
        email: newEmail,
        phone: newPhone,
        password: newPassword,
      });
      setNewName("");
      setNewEmail("");
      setNewPhone("");
      setNewPassword("");
      setShowNewPassword(false);
      setModalMode("none");
    } catch (err: any) {
      alert(err.message || "Failed to add student");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (student: Student) => {
    setEditingStudent(student);
    setEditName(student.name);
    setEditEmail(student.email);
    setEditPhone(student.phone ?? "");
    setEditPassword("");
    setShowEditPassword(false);
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    setEditSaving(true);
    try {
      await updateStudent(editingStudent.id, {
        name: editName,
        email: editEmail,
        phone: editPhone,
      });
      if (editPassword.trim()) {
        if (editPassword.length < 6) {
          alert("Password must be at least 6 characters");
          setEditSaving(false);
          return;
        }
        await resetStudentPassword(editingStudent.id, editPassword);
      }
      setEditingStudent(null);
    } catch (err: any) {
      alert(err.message || "Failed to update student");
    } finally {
      setEditSaving(false);
    }
  };

  const parseCsv = (raw: string) => {
    const lines = raw
      .trim()
      .split("\n")
      .filter((l) => l.trim());
    const result: {
      name: string;
      email: string;
      phone: string;
      password: string;
    }[] = [];
    const errors: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].split(",").map((p) => p.trim());
      if (parts.length < 4) {
        errors.push(`Row ${i + 1}: needs 4 columns`);
        continue;
      }
      const [name, email, phone, password] = parts;
      if (!email || !password) {
        errors.push(`Row ${i + 1}: email and password required`);
        continue;
      }
      result.push({ name, email, phone, password });
    }
    return { result, errors };
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCsvText((ev.target?.result as string) ?? "");
      setBulkInputMode("paste");
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleBulkAdd = async () => {
    const { result: studentsToAdd, errors } = parseCsv(csvText);
    if (errors.length > 0) {
      alert("Errors found:\n" + errors.join("\n"));
      return;
    }
    if (studentsToAdd.length === 0) {
      alert("Please add some student data");
      return;
    }
    setBulkSaving(true);
    try {
      const res = await createStudentsBulk(studentsToAdd);
      setBulkResult({ created: res.created, skipped: res.skipped });
      setCsvText("");
    } catch (err: any) {
      alert("Bulk import failed: " + (err.message || "Unknown error"));
    } finally {
      setBulkSaving(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await updateStudentStatus(id, "approved");
    } catch {
      alert("Failed to approve");
    }
  };
  const handleBlock = async (id: string) => {
    try {
      await updateStudentStatus(id, "blocked");
    } catch {
      alert("Failed to block");
    }
  };
  const handleUnblock = async (id: string) => {
    try {
      await updateStudentStatus(id, "approved");
    } catch {
      alert("Failed to unblock");
    }
  };
  const handleDelete = async (id: string) => {
    if (!confirm("Remove this student?")) return;
    try {
      await deleteStudent(id);
      setVisiblePasswords((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch {
      alert("Failed to delete student");
    }
  };

  const filteredStudents = students.filter((s) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      s.name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      s.phone.includes(searchTerm) ||
      s.enrollmentNumber.toLowerCase().includes(q);
    return (
      matchesSearch && (filterStatus === "all" || s.status === filterStatus)
    );
  });

  if (loading)
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400 mr-2" />
        <span className="text-slate-600">Loading students…</span>
      </div>
    );

  if (error)
    return (
      <div className="text-center py-16">
        <p className="text-red-600 text-sm">Failed to load students: {error}</p>
        <button
          onClick={refetch}
          className="mt-3 text-sm text-slate-600 underline"
        >
          Retry
        </button>
      </div>
    );

  return (
    <div>
      {/* ── Header ── */}
      <div className="mb-6">
        {/* Title row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-slate-900">
              Student Permissions
            </h2>
            <p className="text-sm text-slate-600 mt-0.5">
              Add and manage student access
            </p>
          </div>
          {/* ✅ Buttons stack vertically on very small screens, side by side on sm+ */}
          <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
            <Button
              onClick={() => openModal("bulk")}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg transition-colors text-sm ${
                modalMode === "bulk"
                  ? "bg-slate-700 text-white"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              }`}
            >
              <Upload className="w-4 h-4 flex-shrink-0" />
              <span>{modalMode === "bulk" ? "Cancel" : "Bulk Add"}</span>
            </Button>
            <Button
              onClick={() => openModal("add")}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg transition-colors text-sm ${
                modalMode === "add"
                  ? "bg-slate-600 text-white"
                  : "bg-slate-900 hover:bg-slate-800 text-white"
              }`}
            >
              <Plus className="w-4 h-4 flex-shrink-0" />
              <span>{modalMode === "add" ? "Cancel" : "Add Student"}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ── Single Add Form ── */}
      {modalMode === "add" && (
        <Card className="mb-6 p-5 bg-white border-2 border-slate-900 rounded-xl">
          <h3 className="text-lg font-bold text-slate-900 mb-5">
            Add New Student
          </h3>
          <form onSubmit={handleAddStudent} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Name{" "}
                  <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <Users className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Email *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="student@example.com"
                    required
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="9876543210"
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Set login password"
                    required
                    minLength={6}
                    className="w-full pl-10 pr-16 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-medium"
                  >
                    {showNewPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                onClick={closeAllModals}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Add Student
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* ── Bulk Add ── */}
      {modalMode === "bulk" && (
        <Card className="mb-6 p-5 bg-white border-2 border-slate-900 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-900">
              Bulk Add Students
            </h3>
            <button onClick={closeAllModals}>
              <X className="w-5 h-5 text-slate-500 hover:text-slate-700" />
            </button>
          </div>
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setBulkInputMode("paste")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${bulkInputMode === "paste" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-300 hover:border-slate-500"}`}
            >
              <FileText className="w-3.5 h-3.5" /> Paste CSV
            </button>
            <button
              onClick={() => setBulkInputMode("upload")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${bulkInputMode === "upload" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-300 hover:border-slate-500"}`}
            >
              <Upload className="w-3.5 h-3.5" /> Upload .csv
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFileUpload}
          />
          <p className="text-sm text-slate-600 mb-1">
            CSV format — one student per line:
          </p>
          <code className="block text-xs bg-slate-100 px-3 py-2 rounded mb-1 text-slate-700">
            name, email, phone, password
          </code>
          <p className="text-xs text-slate-400 mb-4">
            Example: John Doe, john@example.com, 9876543210, pass123
          </p>
          {bulkInputMode === "upload" && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="mb-4 border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-slate-500 hover:bg-slate-50 transition-colors"
            >
              <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-600">
                Click to upload a CSV file
              </p>
              <p className="text-xs text-slate-400 mt-1">
                File will be loaded into the editor below
              </p>
            </div>
          )}
          {bulkInputMode === "paste" && (
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={6}
              placeholder={
                "John Doe, john@example.com, 9876543210, pass123\nJane Smith, jane@example.com, 9876543211, pass456"
              }
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent mb-4"
            />
          )}
          {bulkResult && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
              ✓ {bulkResult.created} student
              {bulkResult.created !== 1 ? "s" : ""} added.
              {bulkResult.skipped > 0 &&
                ` ${bulkResult.skipped} skipped (duplicates).`}
            </div>
          )}
          <div className="flex gap-3">
            <Button
              onClick={closeAllModals}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
            >
              Close
            </Button>
            <Button
              onClick={handleBulkAdd}
              disabled={
                bulkSaving || (bulkInputMode === "paste" && !csvText.trim())
              }
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
            >
              {bulkSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              Import Students
            </Button>
          </div>
        </Card>
      )}

      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {(
          [
            {
              key: "all",
              label: "Total",
              count: statusCounts.total,
              icon: <Users className="w-4 h-4 text-violet-600" />,
              bg: "bg-violet-50",
              active: "border-violet-600 ring-2 ring-violet-100",
            },
            {
              key: "approved",
              label: "Approved",
              count: statusCounts.approved,
              icon: <UserCheck className="w-4 h-4 text-emerald-600" />,
              bg: "bg-emerald-50",
              active: "border-emerald-600 ring-2 ring-emerald-100",
            },
            {
              key: "blocked",
              label: "Blocked",
              count: statusCounts.blocked,
              icon: <Ban className="w-4 h-4 text-red-600" />,
              bg: "bg-red-50",
              active: "border-red-600 ring-2 ring-red-100",
            },
          ] as const
        ).map(({ key, label, count, icon, bg, active }) => (
          <button
            key={key}
            onClick={() => setFilterStatus(key)}
            className="text-left"
          >
            <Card
              className={`p-3 bg-white border rounded-lg transition-all cursor-pointer ${filterStatus === key ? active : "border-slate-200 hover:border-slate-300"}`}
            >
              <div
                className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center mb-2`}
              >
                {icon}
              </div>
              <div className="text-xl font-bold text-slate-900">{count}</div>
              <div className="text-xs text-slate-500 mt-0.5">{label}</div>
            </Card>
          </button>
        ))}
      </div>

      {/* ── Search ── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, email, phone or enrollment..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className="px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="blocked">Blocked</option>
        </select>
      </div>

      {/* ── Student List ── */}
      <div className="space-y-3">
        {filteredStudents.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-xl bg-white">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-900 mb-1">
              No students found
            </h3>
            <p className="text-sm text-slate-500">
              {students.length === 0
                ? "Add your first student to get started"
                : "Try adjusting your search or filters"}
            </p>
          </div>
        ) : (
          filteredStudents.map((student) => {
            const dbPassword = student.password ?? "";
            const pwVisible = visiblePasswords.has(student.id);
            return (
              <Card
                key={student.id}
                className="p-4 bg-white border border-slate-200 hover:border-slate-300 rounded-lg transition-all"
              >
                {/* Top row: info + action buttons */}
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Users className="w-4 h-4 text-slate-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-slate-900">
                        {student.name}
                      </h3>
                      {/* ✅ Status badge always visible */}
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded flex-shrink-0 ${
                          student.status === "approved"
                            ? "bg-emerald-50 text-emerald-700"
                            : student.status === "pending"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-red-50 text-red-700"
                        }`}
                      >
                        {student.status.charAt(0).toUpperCase() +
                          student.status.slice(1)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {student.email}
                      </span>
                      {student.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {student.phone}
                        </span>
                      )}
                      <span className="text-slate-400">
                        {student.enrollmentNumber}
                      </span>
                    </div>

                    {/* Password row */}
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Lock className="w-3 h-3 text-slate-400" />
                      {dbPassword ? (
                        <>
                          <span className="text-xs font-mono text-slate-700">
                            {pwVisible
                              ? dbPassword
                              : "•".repeat(Math.min(dbPassword.length, 12))}
                          </span>
                          <button
                            onClick={() => togglePasswordVisibility(student.id)}
                            className="ml-1 text-slate-400 hover:text-slate-600"
                            title={
                              pwVisible ? "Hide password" : "Show password"
                            }
                          >
                            {pwVisible ? (
                              <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400 italic">
                          No password set
                        </span>
                      )}
                    </div>

                    {/* ✅ Action buttons below info — always visible, wrapping row */}
                    <div className="flex items-center gap-2 flex-wrap mt-3">
                      <Button
                        onClick={() => openEdit(student)}
                        title="Edit student"
                        className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>

                      {student.status === "pending" && (
                        <>
                          <Button
                            onClick={() => handleApprove(student.id)}
                            title="Approve"
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            onClick={() => handleBlock(student.id)}
                            title="Block"
                            className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                      {student.status === "approved" && (
                        <Button
                          onClick={() => handleBlock(student.id)}
                          title="Block student"
                          className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded transition-colors"
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {student.status === "blocked" && (
                        <Button
                          onClick={() => handleUnblock(student.id)}
                          className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white text-xs rounded transition-colors"
                        >
                          Unblock
                        </Button>
                      )}
                      <Button
                        onClick={() => handleDelete(student.id)}
                        title="Delete"
                        className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* ── Edit Modal ── */}
      {editingStudent && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-5 bg-white rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-slate-900">Edit Student</h3>
              <button onClick={() => setEditingStudent(null)}>
                <X className="w-5 h-5 text-slate-500 hover:text-slate-700" />
              </button>
            </div>
            <form onSubmit={handleEditSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Name
                </label>
                <div className="relative">
                  <Users className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Email *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="student@example.com"
                    required
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Phone
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="9876543210"
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  New Password{" "}
                  <span className="text-slate-400 font-normal">
                    (leave blank to keep current)
                  </span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showEditPassword ? "text" : "password"}
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full pl-10 pr-16 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-medium"
                  >
                    {showEditPassword ? "Hide" : "Show"}
                  </button>
                </div>
                {editPassword.length > 0 && editPassword.length < 6 && (
                  <p className="text-xs text-red-500 mt-1">
                    Password must be at least 6 characters
                  </p>
                )}
                {editingStudent.password && (
                  <p className="text-xs text-slate-400 mt-1">
                    Current:{" "}
                    <span className="font-mono">{editingStudent.password}</span>
                  </p>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    editSaving ||
                    (editPassword.length > 0 && editPassword.length < 6)
                  }
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {editSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
