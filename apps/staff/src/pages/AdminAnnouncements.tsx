import { useEffect, useState } from "react";
import { useAuth } from "../features/auth/AuthContext";
import {
  fetchAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  type Announcement,
} from "../features/announcements/api";

const emptyForm = { title: "", body: "", target_students: false, target_parents: false, target_staff: true };

export default function AdminAnnouncements() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id;

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);

  async function loadAll() {
    if (!schoolId) return;
    setLoading(true);
    setError(null);
    try {
      setAnnouncements(await fetchAnnouncements(schoolId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load announcements");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  async function handlePost() {
    if (!schoolId || !profile || !form.title.trim() || !form.body.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createAnnouncement({
        school_id: schoolId,
        title: form.title.trim(),
        body: form.body.trim(),
        target_students: form.target_students,
        target_parents: form.target_parents,
        target_staff: form.target_staff,
        posted_by: profile.id,
      });
      setForm(emptyForm);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to post announcement");
    } finally {
      setSaving(false);
    }
  }

  function startEditing(a: Announcement) {
    setEditingId(a.id);
    setEditForm({
      title: a.title,
      body: a.body,
      target_students: a.target_students,
      target_parents: a.target_parents,
      target_staff: a.target_staff,
    });
  }

  async function handleSaveEdit(id: string) {
    if (!editForm.title.trim() || !editForm.body.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await updateAnnouncement(id, {
        title: editForm.title.trim(),
        body: editForm.body.trim(),
        target_students: editForm.target_students,
        target_parents: editForm.target_parents,
        target_staff: editForm.target_staff,
      });
      setEditingId(null);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update announcement");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setSaving(true);
    setError(null);
    try {
      await deleteAnnouncement(id);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete announcement");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 font-ui text-forest-100">Loading...</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="font-display text-2xl text-forest-100">Announcements</h1>

      {error && <p className="text-error font-ui text-sm">{error}</p>}

      <div className="bg-forest-900 rounded-lg p-4 space-y-3">
        <input
          type="text"
          placeholder="Title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="w-full p-2 rounded bg-forest-700 text-forest-100 font-ui placeholder:text-forest-300/60"
        />
        <textarea
          placeholder="Write your announcement..."
          value={form.body}
          onChange={(e) => setForm({ ...form, body: e.target.value })}
          rows={4}
          className="w-full p-2 rounded bg-forest-700 text-forest-100 font-ui placeholder:text-forest-300/60"
        />
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-1.5 font-ui text-xs text-forest-100 cursor-pointer">
            <input
              type="checkbox"
              checked={form.target_staff}
              onChange={(e) => setForm({ ...form, target_staff: e.target.checked })}
            />
            Staff
          </label>
          <label className="flex items-center gap-1.5 font-ui text-xs text-forest-100 cursor-pointer">
            <input
              type="checkbox"
              checked={form.target_students}
              onChange={(e) => setForm({ ...form, target_students: e.target.checked })}
            />
            Students
          </label>
          <label className="flex items-center gap-1.5 font-ui text-xs text-forest-100 cursor-pointer">
            <input
              type="checkbox"
              checked={form.target_parents}
              onChange={(e) => setForm({ ...form, target_parents: e.target.checked })}
            />
            Parents
          </label>
        </div>
        <button
          onClick={handlePost}
          disabled={saving}
          className="px-4 py-2 rounded bg-forest-500 text-forest-950 font-ui font-semibold disabled:opacity-50"
        >
          {saving ? "Posting..." : "Post Announcement"}
        </button>
      </div>

      <div className="space-y-3">
        {announcements.length === 0 && (
          <p className="text-forest-300 font-ui text-sm">No announcements yet — post one above.</p>
        )}

        {announcements.map((a) => (
          <div key={a.id} className="bg-forest-900 rounded-lg p-4 space-y-2">
            {editingId === a.id ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full p-2 rounded bg-forest-700 text-forest-100 font-ui"
                />
                <textarea
                  value={editForm.body}
                  onChange={(e) => setEditForm({ ...editForm, body: e.target.value })}
                  rows={3}
                  className="w-full p-2 rounded bg-forest-700 text-forest-100 font-ui"
                />
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-1.5 font-ui text-xs text-forest-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.target_staff}
                      onChange={(e) => setEditForm({ ...editForm, target_staff: e.target.checked })}
                    />
                    Staff
                  </label>
                  <label className="flex items-center gap-1.5 font-ui text-xs text-forest-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.target_students}
                      onChange={(e) => setEditForm({ ...editForm, target_students: e.target.checked })}
                    />
                    Students
                  </label>
                  <label className="flex items-center gap-1.5 font-ui text-xs text-forest-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.target_parents}
                      onChange={(e) => setEditForm({ ...editForm, target_parents: e.target.checked })}
                    />
                    Parents
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSaveEdit(a.id)}
                    disabled={saving}
                    className="px-3 py-1.5 rounded bg-forest-500 text-forest-950 font-ui text-xs font-semibold disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-3 py-1.5 rounded bg-forest-700 text-forest-100 font-ui text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-lg text-forest-100">{a.title}</h3>
                  <div className="flex gap-1.5 shrink-0">
                    {a.target_staff && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-forest-700 text-forest-100 font-ui">
                        Staff
                      </span>
                    )}
                    {a.target_students && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-forest-700 text-forest-100 font-ui">
                        Students
                      </span>
                    )}
                    {a.target_parents && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-forest-700 text-forest-100 font-ui">
                        Parents
                      </span>
                    )}
                  </div>
                </div>
                <p className="font-ui text-sm text-forest-100 whitespace-pre-wrap">{a.body}</p>
                <p className="font-ui text-[11px] text-forest-300">
                  {a.poster?.full_name ?? "Unknown"} · {new Date(a.created_at).toLocaleString()}
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => startEditing(a)}
                    className="px-3 py-1.5 rounded bg-forest-700 text-forest-100 font-ui text-xs"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(a.id)}
                    disabled={saving}
                    className="px-3 py-1.5 rounded bg-error/20 text-error font-ui text-xs disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
