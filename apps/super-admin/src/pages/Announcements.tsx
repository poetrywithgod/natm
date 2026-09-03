import { useEffect, useState } from "react";
import { Megaphone, Pencil, Trash2, Send } from "lucide-react";
import {
  fetchPlatformAnnouncements,
  postPlatformAnnouncement,
  updatePlatformAnnouncement,
  deletePlatformAnnouncement,
  type PlatformAnnouncement,
} from "../features/announcements/api";

export default function Announcements() {
  const [announcements, setAnnouncements] = useState<PlatformAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setAnnouncements(await fetchPlatformAnnouncements());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load announcements");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handlePost() {
    if (!title.trim() || !body.trim()) return;
    setPosting(true);
    setError(null);
    try {
      await postPlatformAnnouncement(title.trim(), body.trim());
      setTitle("");
      setBody("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to post announcement");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-slate-100 flex items-center gap-2">
          <Megaphone size={22} className="text-amber-500" /> Announcements
        </h1>
        <p className="font-body text-sm text-slate-400 mt-1">
          Broadcasts to every School Admin, platform-wide — shown at the top of their dashboard.
        </p>
      </div>

      {error && <p className="font-ui text-sm text-error">{error}</p>}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
        <h2 className="font-display font-bold text-slate-100">New Announcement</h2>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="w-full p-2 rounded bg-slate-800 border border-slate-700 text-slate-100 font-body text-sm placeholder:text-slate-500"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="Message"
          className="w-full p-2 rounded bg-slate-800 border border-slate-700 text-slate-100 font-body text-sm placeholder:text-slate-500"
        />
        <button
          onClick={handlePost}
          disabled={posting || !title.trim() || !body.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-ui text-sm font-semibold disabled:opacity-60"
        >
          <Send size={14} />
          {posting ? "Posting..." : "Post to All School Admins"}
        </button>
      </div>

      {loading ? (
        <p className="font-ui text-sm text-slate-400">Loading...</p>
      ) : announcements.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
          <Megaphone className="mx-auto text-slate-600 mb-2" size={28} />
          <p className="font-ui text-sm text-slate-400">Nothing posted yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {announcements.map((a) => (
            <AnnouncementRow key={a.id} announcement={a} onChanged={load} />
          ))}
        </div>
      )}
    </div>
  );
}

function AnnouncementRow({
  announcement,
  onChanged,
}: {
  announcement: PlatformAnnouncement;
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(announcement.title);
  const [body, setBody] = useState(announcement.body);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!title.trim() || !body.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await updatePlatformAnnouncement(announcement.id, title.trim(), body.trim());
      setEditing(false);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${announcement.title}"? This can't be undone.`)) return;
    setSaving(true);
    setError(null);
    try {
      await deletePlatformAnnouncement(announcement.id);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
      setSaving(false);
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
      {editing ? (
        <div className="space-y-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full p-2 rounded bg-slate-800 border border-slate-700 text-slate-100 font-body text-sm"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            className="w-full p-2 rounded bg-slate-800 border border-slate-700 text-slate-100 font-body text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                setEditing(false);
                setTitle(announcement.title);
                setBody(announcement.body);
                setError(null);
              }}
              disabled={saving}
              className="flex-1 px-4 py-2 rounded-lg bg-slate-800 text-slate-100 font-ui text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-ui text-sm font-semibold disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-display font-bold text-slate-100">{announcement.title}</h3>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => setEditing(true)} className="text-slate-400 hover:text-amber-400" aria-label="Edit">
                <Pencil size={14} />
              </button>
              <button onClick={handleDelete} disabled={saving} className="text-slate-400 hover:text-error" aria-label="Delete">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
          <p className="font-body text-sm text-slate-300 whitespace-pre-wrap">{announcement.body}</p>
          <p className="font-ui text-xs text-slate-500">{new Date(announcement.created_at).toLocaleString()}</p>
        </>
      )}
      {error && <p className="font-ui text-xs text-error">{error}</p>}
    </div>
  );
}
