import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Plus, X } from "lucide-react";
import { api, formatApiErrorDetail } from "../lib/api";
import { COMPANY_SECTORS, COMPANY_STATUSES } from "../lib/content";
import { RichTextEditor } from "./RichTextEditor";

const inputCls =
  "w-full bg-[var(--hc-bg)] border border-[var(--hc-border)] text-[var(--hc-text)] px-3 py-2 text-sm tracking-tight placeholder:text-[var(--hc-text-muted)] focus:outline-none focus:border-[var(--hc-gold)] transition-colors";
const labelCls = "hc-overline block mb-1.5";

const blank = {
  ticker: "",
  name: "",
  sector: "",
  status: "covered",
  thesis_summary: "",
  thesis_body: "",
  tags: "",
  key_metrics: [],
};

export const CompanyEditorDialog = ({ open, onOpenChange, initial, onSaved }) => {
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
        key_metrics: Array.isArray(initial.key_metrics) ? initial.key_metrics : [],
      });
    } else {
      setForm(blank);
    }
    setError("");
  }, [open, initial]);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const addMetric = () =>
    setForm((f) => ({ ...f, key_metrics: [...f.key_metrics, { label: "", value: "" }] }));
  const removeMetric = (i) =>
    setForm((f) => ({ ...f, key_metrics: f.key_metrics.filter((_, idx) => idx !== i) }));
  const updateMetric = (i, k, v) =>
    setForm((f) => ({
      ...f,
      key_metrics: f.key_metrics.map((m, idx) => (idx === i ? { ...m, [k]: v } : m)),
    }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    const payload = {
      ticker: form.ticker.trim().toUpperCase(),
      name: form.name.trim(),
      sector: form.sector || null,
      status: form.status,
      thesis_summary: form.thesis_summary.trim(),
      thesis_body: form.thesis_body,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      key_metrics: form.key_metrics.filter((m) => m.label.trim() && m.value.trim()),
    };
    try {
      if (initial?.id) {
        const { data } = await api.put(`/companies/${initial.id}`, payload);
        onSaved?.(data);
      } else {
        const { data } = await api.post("/companies", payload);
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
        className="bg-[var(--hc-surface)] border-[var(--hc-border)] text-[var(--hc-text)] rounded-none max-w-3xl max-h-[90vh] overflow-y-auto"
        data-testid="editor-dialog-company"
      >
        <DialogHeader>
          <div className="hc-overline mb-1">Coverage</div>
          <DialogTitle className="text-xl font-medium tracking-tight">
            {initial ? "Edit Company" : "Add Company"}
          </DialogTitle>
          <DialogDescription className="text-[var(--hc-text-secondary)] text-sm tracking-tight">
            Define the coverage entry — thesis, sector, and key metrics.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5 mt-4" data-testid="company-editor-form">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Ticker</label>
              <input
                type="text"
                value={form.ticker}
                onChange={(e) => update("ticker", e.target.value.toUpperCase())}
                required
                data-testid="company-ticker"
                className={inputCls}
                placeholder="BRK.B"
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Company Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                required
                data-testid="company-name"
                className={inputCls}
                placeholder="Berkshire Hathaway"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Sector</label>
              <select
                value={form.sector}
                onChange={(e) => update("sector", e.target.value)}
                data-testid="company-sector"
                className={inputCls}
              >
                <option value="">— None —</option>
                {COMPANY_SECTORS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <div className="flex gap-2">
                {COMPANY_STATUSES.map((s) => (
                  <button
                    type="button"
                    key={s}
                    onClick={() => update("status", s)}
                    data-testid={`company-status-${s}`}
                    className={`flex-1 px-3 py-2 text-xs tracking-[0.18em] uppercase border transition-colors ${
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
          </div>

          <div>
            <label className={labelCls}>Thesis Summary</label>
            <input
              type="text"
              value={form.thesis_summary}
              onChange={(e) => update("thesis_summary", e.target.value)}
              data-testid="company-thesis-summary"
              className={inputCls}
              placeholder="One-line investment thesis"
            />
          </div>

          <div>
            <label className={labelCls}>Thesis Body</label>
            <RichTextEditor
              value={form.thesis_body}
              onChange={(html) => update("thesis_body", html)}
              placeholder="The full investment case. Use headings, lists, and emphasis."
              testid="company-thesis-body"
            />
          </div>

          <div>
            <label className={labelCls}>Tags</label>
            <input
              type="text"
              value={form.tags}
              onChange={(e) => update("tags", e.target.value)}
              data-testid="company-tags"
              className={inputCls}
              placeholder="compounder, owner-operator, defensive"
            />
          </div>

          {/* Key metrics */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className={labelCls}>Key Metrics</span>
              <button
                type="button"
                onClick={addMetric}
                data-testid="add-metric-button"
                className="flex items-center gap-1 text-[0.7rem] tracking-[0.18em] uppercase text-[var(--hc-gold)] hover:underline underline-offset-4"
              >
                <Plus className="h-3 w-3" strokeWidth={1.5} /> Add
              </button>
            </div>
            <div className="space-y-2">
              {form.key_metrics.length === 0 && (
                <div className="text-xs text-[var(--hc-text-muted)] border border-dashed border-[var(--hc-border)] p-3">
                  No metrics yet. Add labelled key figures like "Book Value" or "ROIC".
                </div>
              )}
              {form.key_metrics.map((m, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <input
                    type="text"
                    value={m.label}
                    onChange={(e) => updateMetric(i, "label", e.target.value)}
                    placeholder="Label"
                    data-testid={`metric-label-${i}`}
                    className={inputCls}
                  />
                  <input
                    type="text"
                    value={m.value}
                    onChange={(e) => updateMetric(i, "value", e.target.value)}
                    placeholder="Value"
                    data-testid={`metric-value-${i}`}
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={() => removeMetric(i)}
                    aria-label="Remove metric"
                    className="h-9 w-9 flex items-center justify-center border border-[var(--hc-border)] text-[var(--hc-text-muted)] hover:text-[var(--hc-text)] transition-colors"
                  >
                    <X className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                </div>
              ))}
            </div>
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
              data-testid="company-editor-cancel"
              className="px-5 py-2.5 text-xs tracking-[0.18em] uppercase border border-[var(--hc-border)] text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              data-testid="company-editor-save"
              className="px-6 py-2.5 text-xs tracking-[0.18em] uppercase bg-[var(--hc-platinum)] text-[var(--hc-bg)] hover:bg-white transition-colors disabled:opacity-60"
            >
              {saving ? "Saving…" : initial ? "Save Changes" : "Add Company"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
