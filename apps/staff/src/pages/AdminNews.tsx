import { useEffect, useRef, useState } from "react";
import { useAuth } from "../features/auth/AuthContext";
import {
  fetchNewsPosts,
  createNewsPost,
  updateNewsPost,
  setNewsPostPublished,
  deleteNewsPost,
  uploadNewsImage,
  type NewsPost,
} from "../features/news/api";

const emptyForm = { title: "", excerpt: "", body: "", image_url: null as string | null, published: true };

export default function AdminNews() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id;

  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  async function loadAll() {
    if (!schoolId) return;
    setLoading(true);
    setError(null);
    try {
      setPosts(await fetchNewsPosts(schoolId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load news posts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  async function handleImageSelect(file: File, target: "create" | "edit") {
    if (!schoolId) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadNewsImage(schoolId, file);
      if (target === "create") setForm((f) => ({ ...f, image_url: url }));
      else setEditForm((f) => ({ ...f, image_url: url }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to upload image");
    } finally {
      setUploading(false);
    }
  }

  async function handlePost() {
    if (!schoolId || !profile || !form.title.trim() || !form.excerpt.trim() || !form.body.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createNewsPost({
        school_id: schoolId,
        title: form.title.trim(),
        excerpt: form.excerpt.trim(),
        body: form.body.trim(),
        image_url: form.image_url,
        published: form.published,
        posted_by: profile.id,
      });
      setForm(emptyForm);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to post news item");
    } finally {
      setSaving(false);
    }
  }

  function startEditing(p: NewsPost) {
    setEditingId(p.id);
    setEditForm({ title: p.title, excerpt: p.excerpt, body: p.body, image_url: p.image_url, published: p.published });
  }

  async function handleSaveEdit(id: string) {
    if (!schoolId || !profile || !editForm.title.trim() || !editForm.excerpt.trim() || !editForm.body.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await updateNewsPost(id, schoolId, profile.id, {
        title: editForm.title.trim(),
        excerpt: editForm.excerpt.trim(),
        body: editForm.body.trim(),
        image_url: editForm.image_url,
      });
      setEditingId(null);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update news item");
    } finally {
      setSaving(false);
    }
  }

  async function handleTogglePublish(p: NewsPost) {
    if (!schoolId || !profile) return;
    setSaving(true);
    setError(null);
    try {
      await setNewsPostPublished(p.id, schoolId, profile.id, !p.published);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update publish status");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!schoolId || !profile) return;
    setSaving(true);
    setError(null);
    try {
      await deleteNewsPost(id, schoolId, profile.id);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete news item");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 font-ui text-forest-100">Loading...</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="font-display text-2xl text-forest-100">News</h1>
      <p className="font-ui text-xs text-forest-300">
        Published posts appear on the public site after the next deploy. Retracted posts stay saved but are hidden.
      </p>

      {error && <p className="text-error font-ui text-sm">{error}</p>}

      <div className="bg-forest-900 rounded-lg p-4 space-y-3">
        <input
          type="text"
          placeholder="Title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="w-full p-2 rounded bg-forest-700 text-forest-100 font-ui placeholder:text-forest-300/60"
        />
        <input
          type="text"
          placeholder="Short excerpt (shown on the news list)"
          value={form.excerpt}
          onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
          className="w-full p-2 rounded bg-forest-700 text-forest-100 font-ui placeholder:text-forest-300/60"
        />
        <textarea
          placeholder="Full post content..."
          value={form.body}
          onChange={(e) => setForm({ ...form, body: e.target.value })}
          rows={4}
          className="w-full p-2 rounded bg-forest-700 text-forest-100 font-ui placeholder:text-forest-300/60"
        />
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0], "create")}
            className="w-full text-forest-100 font-ui text-xs"
          />
          {uploading && <p className="font-ui text-xs text-forest-300">Uploading image...</p>}
          {form.image_url && (
            <img src={form.image_url} alt="" className="h-24 rounded object-cover" />
          )}
        </div>
        <label className="flex items-center gap-1.5 font-ui text-xs text-forest-100 cursor-pointer">
          <input
            type="checkbox"
            checked={form.published}
            onChange={(e) => setForm({ ...form, published: e.target.checked })}
          />
          Publish immediately (uncheck to save as draft)
        </label>
        <button
          onClick={handlePost}
          disabled={saving || uploading}
          className="px-4 py-2 rounded bg-forest-500 text-forest-950 font-ui font-semibold disabled:opacity-50"
        >
          {saving ? "Posting..." : "Post News Item"}
        </button>
      </div>

      <div className="space-y-3">
        {posts.length === 0 && <p className="text-forest-300 font-ui text-sm">No news posts yet — post one above.</p>}

        {posts.map((p) => (
          <div key={p.id} className="bg-forest-900 rounded-lg p-4 space-y-2">
            {editingId === p.id ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full p-2 rounded bg-forest-700 text-forest-100 font-ui"
                />
                <input
                  type="text"
                  value={editForm.excerpt}
                  onChange={(e) => setEditForm({ ...editForm, excerpt: e.target.value })}
                  className="w-full p-2 rounded bg-forest-700 text-forest-100 font-ui"
                />
                <textarea
                  value={editForm.body}
                  onChange={(e) => setEditForm({ ...editForm, body: e.target.value })}
                  rows={3}
                  className="w-full p-2 rounded bg-forest-700 text-forest-100 font-ui"
                />
                <input
                  ref={editFileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0], "edit")}
                  className="w-full text-forest-100 font-ui text-xs"
                />
                {editForm.image_url && <img src={editForm.image_url} alt="" className="h-24 rounded object-cover" />}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSaveEdit(p.id)}
                    disabled={saving || uploading}
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
                  <h3 className="font-display text-lg text-forest-100">{p.title}</h3>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-ui shrink-0 ${
                      p.published ? "bg-forest-500 text-forest-950" : "bg-forest-700 text-forest-300"
                    }`}
                  >
                    {p.published ? "Published" : "Draft/Retracted"}
                  </span>
                </div>
                {p.image_url && <img src={p.image_url} alt="" className="h-24 rounded object-cover" />}
                <p className="font-ui text-sm text-forest-100/80 italic">{p.excerpt}</p>
                <p className="font-ui text-sm text-forest-100 whitespace-pre-wrap">{p.body}</p>
                <p className="font-ui text-[11px] text-forest-300">
                  {p.poster?.full_name ?? "Unknown"} · {new Date(p.created_at).toLocaleString()}
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => startEditing(p)}
                    className="px-3 py-1.5 rounded bg-forest-700 text-forest-100 font-ui text-xs"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleTogglePublish(p)}
                    disabled={saving}
                    className="px-3 py-1.5 rounded bg-forest-700 text-forest-100 font-ui text-xs disabled:opacity-50"
                  >
                    {p.published ? "Retract" : "Publish"}
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
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
