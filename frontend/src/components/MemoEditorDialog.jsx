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
import { RichTextEditor } from "./RichTextEditor";

const inputCls =
  "w-full bg-[var(--hc-bg)] border border-[var(--hc-border)] text-[var(--hc-text)] px-3 py-2 text-sm tracking-tight placeholder:text-[var(--hc-text-muted)] focus:outline-none focus:border-[var(--hc-gold)] transition-colors";
const labelCls = "hc-overline block mb-1.5";

export const MemoEditorDialog = ({ open, onOpenChange, companyId, onSaved }) => {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle("");
      setBody("");
      setError("");
    }
  }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !body || body === "<p></p>") {
      setError("Title and body are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { data } = await api.post(`/companies/${companyId}/memos`, { title, body });
      onSaved?.(data);
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
        className="bg-[var(--hc-surface)] border-[var(--hc-border)] text-[var(--hc-text)] rounded-none max-w-2xl"
        data-testid="memo-editor-dialog"
      >
        <DialogHeader>
          <div className="hc-overline mb-1">Analyst Memo</div>
          <DialogTitle className="text-xl font-medium tracking-tight">Add Memo</DialogTitle>
          <DialogDescription className="text-[var(--hc-text-secondary)] text-sm tracking-tight">
            Publish an analyst observation to this company's memo feed.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5 mt-4">
          <div>
            <label className={labelCls}>Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              data-testid="memo-title"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Body</label>
            <RichTextEditor
              value={body}
              onChange={(html) => setBody(html)}
              placeholder="The analyst observation, in detail."
              testid="memo-body"
            />
          </div>

          {error && (
            <div className="text-xs tracking-tight text-[#E07A7A] border border-[#7A2424] bg-[#2A0F0F] px-3 py-2">
              {error}
            </div>
          )}

          <DialogFooter className="sm:justify-between gap-2 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-5 py-2.5 text-xs tracking-[0.18em] uppercase border border-[var(--hc-border)] text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              data-testid="memo-save"
              className="px-6 py-2.5 text-xs tracking-[0.18em] uppercase bg-[var(--hc-platinum)] text-[var(--hc-bg)] hover:bg-white transition-colors disabled:opacity-60"
            >
              {saving ? "Saving…" : "Publish Memo"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
