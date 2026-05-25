import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { api, formatApiErrorDetail } from "../lib/api";
import { LIBRARY_CATEGORIES } from "../lib/content";

const inputCls =
  "w-full bg-[var(--hc-bg)] border border-[var(--hc-border)] text-[var(--hc-text)] px-3 py-2 text-sm tracking-tight placeholder:text-[var(--hc-text-muted)] focus:outline-none focus:border-[var(--hc-gold)] transition-colors";
const labelCls = "hc-overline block mb-1.5";

const blank = {
  title: "",
  author: "",
  cover_url: "",
  description: "",
  category: "",
  external_url: "",
  status: "published",
};

export const BookEditorDialog = ({ open, onOpenChange, initial, onSaved }) => {
  const [form, setForm] = useState(blank);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        ...blank,
        title: initial.title || "",
        author: initial.author || "",
        cover_url: initial.cover_url || "",
        description: initial.description || "",
        category: initial.category || "",
        external_url: initial.external_url || "",
        status: initial.status || "published",
      });
    } else {
      setForm(blank);
    }
    setError("");
  }, [open, initial]);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      author: form.author.trim(),
      cover_url: form.cover_url.trim() || null,
      description: form.description.trim(),
      category: form.category || null,
      external_url: form.external_url.trim(),
      status: form.status,
    };
    try {
      if (initial?.id) {
        const { data } = await api.put(`/books/${initial.id}`, payload);
        onSaved?.(data);
      } else {
        const { data } = await api.post("/books", payload);
        onSaved?.(data);
      }
      onOpenChange(false);
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-[var(--hc-surface)] border-[var(--hc-border)] text-[var(--hc-text)] rounded-none max-w-2xl max-h-[90vh] overflow-y-auto"
        data-testid="editor-dialog-books"
      >
        <DialogHeader>
          <div className="hc-overline mb-1">Library</div>
          <DialogTitle className="text-xl font-medium tracking-tight">
            {initial ? "Edit Book" : "New Book"}
          </DialogTitle>
          <DialogDescription className="text-[var(--hc-text-secondary)] text-sm tracking-tight">
            {initial
              ? "Update this volume on the shelf."
              : "Add a book to the academy library. The external link opens in a new tab so members stay signed in."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5 mt-4" data-testid="book-editor-form">
          <div>
            <label className={labelCls}>Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              required
              data-testid="book-editor-title"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Author</label>
              <input
                type="text"
                value={form.author}
                onChange={(e) => update("author", e.target.value)}
                data-testid="book-editor-author"
                className={inputCls}
                placeholder="e.g. Howard Marks"
              />
            </div>
            <div>
              <label className={labelCls}>Category</label>
              <select
                value={form.category}
                onChange={(e) => update("category", e.target.value)}
                data-testid="book-editor-category"
                className={inputCls}
              >
                <option value="">— None —</option>
                {LIBRARY_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Cover image URL (optional)</label>
            <input
              type="url"
              value={form.cover_url}
              onChange={(e) => update("cover_url", e.target.value)}
              data-testid="book-editor-cover"
              className={inputCls}
              placeholder="https://…/cover.jpg"
            />
            {form.cover_url && (
              <div className="mt-3 inline-block">
                <img
                  src={form.cover_url}
                  alt="cover preview"
                  className="h-32 w-auto object-cover border border-[var(--hc-border)]"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>
            )}
          </div>

          <div>
            <label className={labelCls}>External link (where the book lives)</label>
            <input
              type="url"
              value={form.external_url}
              onChange={(e) => update("external_url", e.target.value)}
              required
              data-testid="book-editor-external-url"
              className={inputCls}
              placeholder="https://…  (Amazon, Drive, your own host)"
            />
            <p className="mt-2 text-[0.65rem] text-[var(--hc-text-muted)] tracking-tight">
              Opens in a new tab so the member's academy session is preserved.
            </p>
          </div>

          <div>
            <label className={labelCls}>Short description</label>
            <textarea
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              data-testid="book-editor-description"
              className={`${inputCls} min-h-[100px] resize-y`}
              placeholder="One paragraph: why members should read it."
            />
          </div>

          <div>
            <label className={labelCls}>Status</label>
            <div className="flex gap-2">
              {["draft", "published"].map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => update("status", s)}
                  data-testid={`book-editor-status-${s}`}
                  className={`px-4 py-2 text-xs tracking-[0.18em] uppercase border transition-colors ${
                    form.status === s
                      ? "border-[var(--hc-gold)] bg-[var(--hc-gold-soft)] text-[var(--hc-gold)]"
                      : "border-[var(--hc-border)] text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)]"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div
              data-testid="book-editor-error"
              className="text-xs tracking-tight text-[#E07A7A] border border-[#7A2424] bg-[#2A0F0F] px-3 py-2"
            >
              {error}
            </div>
          )}

          <DialogFooter className="sm:justify-between gap-2 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              data-testid="book-editor-cancel"
              className="px-5 py-2.5 text-xs tracking-[0.18em] uppercase border border-[var(--hc-border)] text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              data-testid="book-editor-save"
              className="px-6 py-2.5 text-xs tracking-[0.18em] uppercase bg-[var(--hc-platinum)] text-[var(--hc-bg)] hover:bg-white transition-colors disabled:opacity-60"
            >
              {saving ? "Saving…" : initial ? "Save Changes" : "Add to Library"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
