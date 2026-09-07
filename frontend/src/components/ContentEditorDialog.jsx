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
  CONTENT_TYPES,
} from "../lib/content";
import { COURSE_CATALOG } from "../lib/learningProgress";
import { RichTextEditor } from "./RichTextEditor";
import { BookPdfUploader } from "./BookPdfUploader";
import { ImageUploader } from "./ImageUploader";

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
  course_id: "fundamentos",
  is_course_intro: false,
  track: "",
  week_count: "",
  order_index: 0,
  cover_url: "",
  estimated_duration_minutes: "",
  period: "",
  pdf_url: null,
  pdf_filename: null,
  pdf_size: null,
  pdf_storage_path: "",
  file_path: "",
  file_name: "",
  file_size: null,
  module_id: null,
  module_title: null,
  module_order: 0,
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
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        ...blank,
        ...initial,
        tags: Array.isArray(initial.tags) ? initial.tags.join(", ") : "",
        estimated_duration_minutes:
          contentType === "education" ? initial.estimated_duration_minutes || 15 : "",
      });
    } else {
      setForm({
        ...blank,
        estimated_duration_minutes: contentType === "education" ? 15 : "",
      });
    }
    setError("");
    setUploading(false);
  }, [open, initial, contentType]);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (uploading) {
      setError("Espera a que termine la carga del PDF antes de guardar la lección.");
      return;
    }
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
      payload.course_id = form.course_id || "fundamentos";
      payload.is_course_intro = Boolean(form.is_course_intro);
      payload.track = form.track || null;
      payload.week_count = form.week_count ? Number(form.week_count) : null;
      payload.order_index = Number(form.order_index) || 0;
      payload.cover_url = form.cover_url?.trim() || null;
      payload.estimated_duration_minutes = Number(form.estimated_duration_minutes) || 15;
      payload.file_path = form.file_path || null;
      payload.file_name = form.file_name || null;
      payload.file_size = form.file_size || null;
      payload.module_id = form.module_id || null;
      payload.module_title = form.module_title || null;
      payload.module_order = Number(form.module_order) || 0;
    }
    if (contentType === "reports") {
      payload.period = form.period;
      payload.pdf_url = form.pdf_url;
      payload.pdf_filename = form.pdf_filename;
      payload.pdf_size = form.pdf_size;
      payload.pdf_storage_path = form.pdf_storage_path || null;
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
            {initial ? "Editar" : "Nuevo"} {cfg.singular.toLowerCase()}
          </DialogTitle>
          <DialogDescription className="text-[var(--hc-text-secondary)] text-sm tracking-tight">
            {initial ? "Actualiza esta entrada." : "Crea una nueva entrada para los miembros."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5 mt-4" data-testid="editor-form">
          <div>
            <label className={labelCls}>Título</label>
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
            <label className={labelCls}>Resumen</label>
            <input
              type="text"
              value={form.summary}
              onChange={(e) => update("summary", e.target.value)}
              data-testid="editor-summary"
              className={inputCls}
              placeholder="Resumen de una línea para la lista"
            />
          </div>

          {contentType === "education" && (
            <div>
              <label className={labelCls}>Portada de la lección</label>
              <ImageUploader
                value={form.cover_url}
                onChange={(url) => update("cover_url", url)}
                testid="education-cover-uploader"
              />
              <details className="mt-3">
                <summary className="cursor-pointer text-[0.65rem] uppercase tracking-[0.16em] text-[var(--hc-text-muted)]">
                  Usar una URL de imagen
                </summary>
                <input
                  type="url"
                  value={form.cover_url}
                  onChange={(e) => update("cover_url", e.target.value)}
                  className={`${inputCls} mt-2`}
                  data-testid="education-cover-url"
                  placeholder="https://…/portada.jpg"
                />
              </details>
            </div>
          )}

          {contentType === "education" && (
            <div>
              <label className={labelCls}>Documento PDF de la lección</label>
              <BookPdfUploader
                value={
                  form.file_path
                    ? { path: form.file_path, filename: form.file_name, size: form.file_size }
                    : null
                }
                endpoint="/education/uploads/sign"
                uploadingLabel="Subiendo el documento"
                itemLabel="documento"
                onUploadingChange={setUploading}
                testid="education-pdf-uploader"
                onChange={(file) => {
                  update("file_path", file?.path || "");
                  update("file_name", file?.filename || "");
                  update("file_size", file?.size || null);
                }}
              />
              <p className="mt-2 text-[0.68rem] leading-relaxed text-[var(--hc-text-muted)]">
                El PDF se guarda de forma privada y solo los miembros con acceso podrán abrirlo.
              </p>
            </div>
          )}

          <div>
            <label className={labelCls}>Cuerpo</label>
            <RichTextEditor
              value={form.body}
              onChange={(html) => update("body", html)}
              placeholder="Redacta el texto completo — se admiten títulos, listas, enlaces y énfasis."
              testid="editor-body"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Categoría</label>
              <select
                value={form.category}
                onChange={(e) => update("category", e.target.value)}
                data-testid="editor-category"
                className={inputCls}
              >
                <option value="">— Ninguna —</option>
                {RESEARCH_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Etiquetas (separadas por coma)</label>
              <input
                type="text"
                value={form.tags}
                onChange={(e) => update("tags", e.target.value)}
                data-testid="editor-tags"
                className={inputCls}
                placeholder="inflación, tasas, fed"
              />
            </div>
          </div>

          {contentType === "education" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Curso</label>
                <select
                  value={form.course_id || "fundamentos"}
                  onChange={(e) => update("course_id", e.target.value)}
                  data-testid="editor-course"
                  className={inputCls}
                >
                  {COURSE_CATALOG.map((course) => (
                    <option key={course.id} value={course.id}>{course.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Duración de la ruta (semanas)</label>
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
                <label className={labelCls}>Duración de esta lección</label>
                <div className="relative">
                  <input
                    type="number"
                    min="5"
                    max="45"
                    step="5"
                    value={form.estimated_duration_minutes}
                    onChange={(e) => update("estimated_duration_minutes", e.target.value)}
                    required={!form.is_course_intro}
                    disabled={form.is_course_intro}
                    data-testid="editor-duration"
                    className={`${inputCls} pr-16`}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--hc-text-muted)]">
                    min
                  </span>
                </div>
                <p className="mt-1.5 text-[0.65rem] text-[var(--hc-text-muted)]">
                  Entre 5 y 45 minutos. Recomendado: 10–15.
                </p>
              </div>
              <div>
                <label className={labelCls}>Orden</label>
                <input
                  type="number"
                  value={form.order_index}
                  onChange={(e) => update("order_index", e.target.value)}
                  data-testid="editor-order"
                  className={inputCls}
                />
              </div>
              <label className="sm:col-span-2 flex items-start gap-3 border border-[var(--hc-border)] bg-[var(--hc-surface-elevated)] p-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(form.is_course_intro)}
                  onChange={(e) => update("is_course_intro", e.target.checked)}
                  data-testid="editor-course-intro"
                  className="mt-0.5 h-4 w-4 accent-[var(--hc-gold)]"
                />
                <span>
                  <span className="block text-sm font-medium text-[var(--hc-text)]">Introducción del curso</span>
                  <span className="mt-1 block text-xs leading-relaxed text-[var(--hc-text-secondary)]">
                    Se muestra antes del temario y no cuenta como lección ni para el progreso de la evaluación.
                  </span>
                </span>
              </label>
            </div>
          )}

          {contentType === "reports" && (
            <>
              <div>
                <label className={labelCls}>Período (YYYY-MM)</label>
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
              <div>
                <label className={labelCls}>Adjunto PDF</label>
                <BookPdfUploader
                  value={
                    form.pdf_storage_path || form.pdf_url
                      ? { path: form.pdf_storage_path || "legacy", filename: form.pdf_filename, size: form.pdf_size }
                      : null
                  }
                  endpoint="/reports/uploads/sign"
                  uploadingLabel="Subiendo el reporte"
                  itemLabel="reporte"
                  maxBytes={25 * 1024 * 1024}
                  maxLabel="25 MB"
                  onUploadingChange={setUploading}
                  onChange={(v) => {
                    update("pdf_storage_path", v?.path && v.path !== "legacy" ? v.path : null);
                    if (!v || v.path !== "legacy") update("pdf_url", null);
                    update("pdf_filename", v?.filename || null);
                    update("pdf_size", v?.size || null);
                  }}
                />
              </div>
            </>
          )}

          <div>
            <label className={labelCls}>Estado</label>
            <div className="flex gap-2">
              {[
                ["draft", "Borrador"],
                ["published", "Publicado"],
              ].map(([s, label]) => (
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
                  {label}
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
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || uploading}
              data-testid="editor-save"
              className="px-6 py-2.5 text-xs tracking-[0.18em] uppercase bg-[var(--hc-platinum)] text-[var(--hc-bg)] hover:bg-white transition-colors disabled:opacity-60"
            >
              {uploading ? "Subiendo PDF…" : saving ? "Guardando…" : initial ? "Guardar cambios" : `Crear ${cfg.singular.toLowerCase()}`}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
