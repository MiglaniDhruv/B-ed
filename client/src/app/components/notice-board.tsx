import { useState, useEffect } from "react";
import {
  Plus, Trash2, Edit2, X, Loader2, Megaphone,
  Clock, AlertTriangle, AlertCircle, Info,
} from "lucide-react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { api } from "../lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Notice {
  id: string;
  title: string;
  message: string;
  priority: "normal" | "important" | "urgent";
  createdAt: string | null;
  expiresAt: string | null;
}

// ─── Priority config ──────────────────────────────────────────────────────────
const PRIORITY = {
  normal:    { label: "Normal",    color: "bg-blue-100 text-blue-700",   border: "border-blue-300",   icon: Info,          iconColor: "text-blue-500" },
  important: { label: "Important", color: "bg-yellow-100 text-yellow-700", border: "border-yellow-400", icon: AlertTriangle, iconColor: "text-yellow-500" },
  urgent:    { label: "Urgent",    color: "bg-red-100 text-red-700",     border: "border-red-400",    icon: AlertCircle,   iconColor: "text-red-500" },
};

function daysLeft(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

function isExpired(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso) < new Date();
}

// ─── Notice Form ──────────────────────────────────────────────────────────────
function NoticeForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: Partial<Notice>;
  onSave: (data: { title: string; message: string; priority: string; expiresAt: string }) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 16);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [message, setMessage] = useState(initial?.message ?? "");
  const [priority, setPriority] = useState<string>(initial?.priority ?? "normal");
  const [expiresAt, setExpiresAt] = useState(
    initial?.expiresAt ? new Date(initial.expiresAt).toISOString().slice(0, 16) : tomorrowStr
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;
    onSave({ title: title.trim(), message: message.trim(), priority, expiresAt });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
        <input
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Notice title…"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Message *</label>
        <textarea
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write your notice here…"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
          <select
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="normal">Normal</option>
            <option value="important">Important</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Expires At *</label>
          <input
            type="datetime-local"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            value={expiresAt}
            min={tomorrowStr}
            onChange={(e) => setExpiresAt(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors">
          Cancel
        </button>
        <Button type="submit" disabled={saving} className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2 rounded-lg text-sm flex items-center gap-2">
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {initial?.id ? "Save Changes" : "Post Notice"}
        </Button>
      </div>
    </form>
  );
}

// ─── Notice Board Page ────────────────────────────────────────────────────────
export function NoticeBoardPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "expired">("active");

  const fetchNotices = async () => {
    try {
      const data = await api.getNotices();
      setNotices(data);
    } catch (err) {
      console.error("Failed to fetch notices:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNotices(); }, []);

  const handleCreate = async (data: { title: string; message: string; priority: string; expiresAt: string }) => {
    setSaving(true);
    try {
      await api.createNotice(data);
      await fetchNotices();
      setShowForm(false);
    } catch (err: any) {
      alert(err.message || "Failed to create notice");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (data: { title: string; message: string; priority: string; expiresAt: string }) => {
    if (!editingNotice) return;
    setSaving(true);
    try {
      await api.updateNotice(editingNotice.id, data);
      await fetchNotices();
      setEditingNotice(null);
    } catch (err: any) {
      alert(err.message || "Failed to update notice");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this notice? Students will no longer see it.")) return;
    try {
      await api.deleteNotice(id);
      setNotices(prev => prev.filter(n => n.id !== id));
    } catch (err: any) {
      alert(err.message || "Failed to delete notice");
    }
  };

  const filtered = notices.filter(n => {
    if (filter === "active") return !isExpired(n.expiresAt);
    if (filter === "expired") return isExpired(n.expiresAt);
    return true;
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-blue-600" />
            Notice Board
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Post notices to all students. They'll receive in-app and push notifications.
          </p>
        </div>
        <Button
          onClick={() => { setShowForm(true); setEditingNotice(null); }}
          className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-lg flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> New Notice
        </Button>
      </div>

      {/* Create form */}
      {showForm && !editingNotice && (
        <Card className="p-6 bg-white border border-slate-200 rounded-xl mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-900">New Notice</h3>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <NoticeForm onSave={handleCreate} onCancel={() => setShowForm(false)} saving={saving} />
        </Card>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {(["active", "all", "expired"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors capitalize ${
              filter === f
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400 mr-2" />
          <span className="text-slate-500">Loading notices…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-xl bg-white">
          <Megaphone className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-900 mb-1">
            {filter === "expired" ? "No expired notices" : "No notices yet"}
          </h3>
          <p className="text-sm text-slate-500 mb-4">
            {filter === "expired" ? "All notices are still active." : "Create a notice to inform your students."}
          </p>
          {filter !== "expired" && (
            <Button
              onClick={() => setShowForm(true)}
              className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 rounded-lg"
            >
              <Plus className="w-4 h-4 mr-2" /> New Notice
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((notice) => {
            const pCfg = PRIORITY[notice.priority];
            const PIcon = pCfg.icon;
            const dl = daysLeft(notice.expiresAt);
            const expired = isExpired(notice.expiresAt);
            const expiringSoon = !expired && dl !== null && dl <= 1;

            return (
              <div key={notice.id}>
                {/* Edit form inline */}
                {editingNotice?.id === notice.id ? (
                  <Card className="p-6 bg-white border border-slate-200 rounded-xl">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-semibold text-slate-900">Edit Notice</h3>
                      <button onClick={() => setEditingNotice(null)} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <NoticeForm initial={notice} onSave={handleUpdate} onCancel={() => setEditingNotice(null)} saving={saving} />
                  </Card>
                ) : (
                  <Card className={`p-5 bg-white border-l-4 rounded-xl transition-all ${pCfg.border} ${expired ? "opacity-60" : "hover:shadow-md"}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Priority + expiry row */}
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${pCfg.color}`}>
                            <PIcon className={`w-3 h-3 ${pCfg.iconColor}`} />
                            {pCfg.label}
                          </span>
                          {expired ? (
                            <span className="text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full font-medium">
                              Expired
                            </span>
                          ) : (
                            <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${
                              expiringSoon
                                ? "bg-red-50 text-red-600"
                                : "bg-slate-100 text-slate-500"
                            }`}>
                              <Clock className="w-3 h-3" />
                              {dl === 0 ? "Expires today" : dl === 1 ? "Expires tomorrow" : `Expires in ${dl} days`}
                            </span>
                          )}
                        </div>

                        <h3 className="text-base font-semibold text-slate-900 mb-1">{notice.title}</h3>
                        <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{notice.message}</p>

                        <p className="text-xs text-slate-400 mt-3">
                          Posted {notice.createdAt ? new Date(notice.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => { setEditingNotice(notice); setShowForm(false); }}
                          title="Edit notice"
                          className="p-2 hover:bg-slate-50 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4 text-slate-500" />
                        </button>
                        <button
                          onClick={() => handleDelete(notice.id)}
                          title="Delete notice"
                          className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                  </Card>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}