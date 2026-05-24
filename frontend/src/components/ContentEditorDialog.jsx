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
import {
  RESEARCH_CATEGORIES,
  EDUCATION_TRACKS,
  CONTENT_TYPES,
} from "../lib/content";

const inputCls =
  "w-full bg-[var(--hc-bg)] border border-[var(--hc-border)] text-[var(--hc-text)] px-3 py-2 text-sm tracking-tight placeholder:text-[var(--hc-text-muted)] focus:outline-none focus:border-[var(--hc-gold)] transition-colors";
const labelCls = "hc-overline block mb-1.5";

const blank = {
  title: "",
  summary: "",
  body: "",
  category: "",
  tags: "",
  status: "draft",
  track: "",
  week_count: "",
  order_index: 0,
  period: "",
};

export const ContentEditorDialog = ({
  open,
  onOpenChange,
  contentType, // "research" | "education" | "reports"
  initial,
  onSaved,
}) => {
  const cfg = CONTENT_TYPES[contentType];
  const [form, setForm] = useState(blank);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        ...blank,
        ...initial,
        tags: Array.isArray(initial.tags) ? initial.tags.join(", ") : "",
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
    // Client-side period validation for reports (mirrors backend regex)
    if (contentType === "reports" && !/^\d{4}-(0[1-9]|1[0-2])$/.test(form.period.trim())) {
      setError("Period must be in YYYY-MM format (e.g. 2026-05).");
      return;
    }
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      summary: form.summary.trim(),
      body: form.body,
      category: form.category || null,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      status: form.status,
    };
    if (contentType === "education") {
      payload.track = form.track || null;
      payload.week_count = form.week_count ? Number(form.week_count) : null;
      payload.order_index = Number(form.order_index) || 0;
    }
    if (contentType === "reports") {
      payload.period = form.period;
    }
    try {
      if (initial?.id) {
        const { data } = await api.put(`/${cfg.api}/${initial.id}`, payload);
        onSaved?.(data);
      } else {
        const { data } = await api.post(`/${cfg.api}`, payload);
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
        data-testid={`editor-dialog-${contentType}`}
      >
        <DialogHeader>
          <div className="hc-overline mb-1">{cfg.singular}</div>
          <DialogTitle className="text-xl font-medium tracking-tight">
            {initial ? "Edit" : "New"} {cfg.singular}
          </DialogTitle>
          <DialogDescription className="text-[var(--hc-text-secondary)] text-sm tracking-tight">
            {initial ? "Update this entry." : "Compose a new entry for the members' suite."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5 mt-4" data-testid="editor-form">
          <div>
            <label className={labelCls}>Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              required
              data-testid="editor-title"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Summary</label>
            <input
              type="text"
              value={form.summary}
              onChange={(e) => update("summary", e.target.value)}
              data-testid="editor-summary"
              className={inputCls}
              placeholder="One-line abstract for the list view"
            />
          </div>

          <div>
            <label className={labelCls}>Body</label>
            <textarea
              value={form.body}
              onChange={(e) => update("body", e.target.value)}
              data-testid="editor-body"
              rows={10}
              className={`${inputCls} resize-y leading-relaxed`}
              placeholder="The full text of the note. Plain text — rich-text editor arriving in a later phase."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Category</label>
              <select
                value={form.category}
                onChange={(e) => update("category", e.target.value)}
                data-testid="editor-category"
                className={inputCls}
              >
                <option value="">— None —</option>
                {RESEARCH_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Tags (comma-separated)</label>
              <input
                type="text"
                value={form.tags}
                onChange={(e) => update("tags", e.target.value)}
                data-testid="editor-tags"
                className={inputCls}
                placeholder="inflation, rates, fed"
              />
            </div>
          </div>

          {contentType === "education" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Track</label>
                <select
                  value={form.track}
                  onChange={(e) => update("track", e.target.value)}
                  data-testid="editor-track"
                  className={inputCls}
                >
                  <option value="">— None —</option>
                  {EDUCATION_TRACKS.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Weeks</label>
                <input
                  type="number"
                  min="1"
                  value={form.week_count}
                  onChange={(e) => update("week_count", e.target.value)}
                  data-testid="editor-weeks"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Order</label>
                <input
                  type="number"
                  value={form.order_index}
                  onChange={(e) => update("order_index", e.target.value)}
                  data-testid="editor-order"
                  className={inputCls}
                />
              </div>
            </div>
          )}

          {contentType === "reports" && (
            <div>
              <label className={labelCls}>Period (YYYY-MM)</label>
              <input
                type="text"
                value={form.period}
                onChange={(e) => update("period", e.target.value)}
                required
                placeholder="2026-05"
                data-testid="editor-period"
                className={inputCls}
              />
            </div>
          )}

          <div>
            <label className={labelCls}>Status</label>
            <div className="flex gap-2">
              {["draft", "published"].map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => update("status", s)}
                  data-testid={`editor-status-${s}`}
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
              data-testid="editor-error"
              className="text-xs tracking-tight text-[#E07A7A] border border-[#7A2424] bg-[#2A0F0F] px-3 py-2"
            >
              {error}
            </div>
          )}

          <DialogFooter className="sm:justify-between gap-2 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              data-testid="editor-cancel"
              className="px-5 py-2.5 text-xs tracking-[0.18em] uppercase border border-[var(--hc-border)] text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              data-testid="editor-save"
              className="px-6 py-2.5 text-xs tracking-[0.18em] uppercase bg-[var(--hc-platinum)] text-[var(--hc-bg)] hover:bg-white transition-colors disabled:opacity-60"
            >
              {saving ? "Saving…" : initial ? "Save Changes" : `Create ${cfg.singular}`}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
