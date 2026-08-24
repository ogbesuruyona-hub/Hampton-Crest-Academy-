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
import { ImageUploader } from "./ImageUploader";
import { BookPdfUploader } from "./BookPdfUploader";
import { BookOpen, Check, FileText, Link2, Loader2, Search } from "lucide-react";

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
  file_path: "",
  file_name: "",
  file_size: null,
  status: "published",
};

export const BookEditorDialog = ({ open, onOpenChange, initial, onSaved }) => {
  const [form, setForm] = useState(blank);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sourceMode, setSourceMode] = useState("pdf");
  const [detecting, setDetecting] = useState(false);
  const [detectionMessage, setDetectionMessage] = useState("");

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
        file_path: initial.file_path || "",
        file_name: initial.file_name || "",
        file_size: initial.file_size || null,
        status: initial.status || "published",
      });
      setSourceMode(initial.file_path || !initial.external_url ? "pdf" : "link");
    } else {
      setForm(blank);
      setSourceMode("pdf");
    }
    setError("");
    setUploading(false);
    setDetectionMessage("");
  }, [open, initial]);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const detectMetadata = async () => {
    const link = form.external_url.trim();
    setError("");
    setDetectionMessage("");
    try {
      const parsed = new URL(link);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
    } catch {
      setError("Pega primero un enlace web válido.");
      return;
    }
    setDetecting(true);
    try {
      const { data } = await api.post("/books/metadata/inspect", { url: link });
      setForm((current) => ({
        ...current,
        external_url: data.resolved_url || current.external_url,
        title: data.title || current.title,
        author: data.author || current.author,
        cover_url: data.cover_url || current.cover_url,
        description: data.description || current.description,
        category: data.category || current.category,
      }));
      const detectedFields = [data.title && "título", data.author && "autor", data.cover_url && "portada", data.category && "categoría"].filter(Boolean);
      setDetectionMessage(
        detectedFields.length
          ? `Detectamos ${detectedFields.join(", ")} · ${data.source_type}. Puedes corregirlos antes de guardar.`
          : `El enlace funciona, pero la página no publicó datos del libro. Complétalos manualmente.`,
      );
    } catch (err) {
      setDetectionMessage(
        "No pudimos leer automáticamente esa página. Puedes completar los datos del libro manualmente.",
      );
    } finally {
      setDetecting(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (uploading) {
      setError("Espera a que termine la carga del PDF antes de publicar.");
      return;
    }
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      author: form.author.trim(),
      cover_url: form.cover_url.trim() || null,
      description: form.description.trim(),
      category: form.category || null,
      external_url: sourceMode === "link" ? form.external_url.trim() : "",
      file_path: sourceMode === "pdf" ? form.file_path || null : null,
      file_name: sourceMode === "pdf" ? form.file_name || null : null,
      file_size: sourceMode === "pdf" ? form.file_size || null : null,
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

  const sourceReady = sourceMode === "pdf" ? Boolean(form.file_path) : Boolean(form.external_url.trim());
  const canSave = sourceReady && Boolean(form.title.trim()) && !uploading && !saving;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[94dvh] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto rounded-sm border-[var(--hc-border)] bg-[var(--hc-surface)] p-0 text-[var(--hc-text)]"
        data-testid="editor-dialog-books"
      >
        <DialogHeader className="border-b border-[var(--hc-border)] px-5 pb-5 pt-6 pr-12 sm:px-7 sm:pt-7">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--hc-gold-soft)] text-[var(--hc-gold)]">
            <BookOpen className="h-5 w-5" strokeWidth={1.5} />
          </div>
          <div className="hc-overline">Biblioteca</div>
          <DialogTitle className="text-2xl font-medium tracking-tight">
            {initial ? "Editar libro" : "Agregar un libro"}
          </DialogTitle>
          <DialogDescription className="max-w-xl text-sm leading-relaxed text-[var(--hc-text-secondary)]">
            {initial
              ? "Actualiza el archivo y la información que verán los miembros."
              : "Carga el PDF, revisa la información y publícalo. Son solo tres pasos."}
          </DialogDescription>

          <div className="mt-4 grid grid-cols-3 gap-2" aria-label="Progreso de publicación">
            {[
              ["1", "Libro", sourceReady],
              ["2", "Datos", Boolean(form.title.trim())],
              ["3", "Publicar", false],
            ].map(([number, label, complete]) => (
              <div key={number} className="flex items-center gap-2 border-t border-[var(--hc-border)] pt-2">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.62rem] ${
                    complete
                      ? "bg-[#56715a] text-white"
                      : "border border-[var(--hc-border)] text-[var(--hc-text-muted)]"
                  }`}
                >
                  {complete ? <Check className="h-3 w-3" /> : number}
                </span>
                <span className="truncate text-[0.62rem] uppercase tracking-[0.12em] text-[var(--hc-text-muted)]">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </DialogHeader>

        <form onSubmit={submit} data-testid="book-editor-form">
          <div className="space-y-5 px-4 py-5 sm:px-7 sm:py-6">
            <section className="rounded-sm border border-[var(--hc-gold)]/30 bg-[var(--hc-gold-soft)] p-4 sm:p-5">
              <div className="mb-4">
                <div className="hc-overline mb-1 text-[var(--hc-gold)]">Paso 1</div>
                <h3 className="text-base font-medium">¿Cómo quieres agregar el libro?</h3>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Fuente del libro">
                <button
                  type="button"
                  role="radio"
                  aria-checked={sourceMode === "pdf"}
                  onClick={() => setSourceMode("pdf")}
                  className={`flex min-h-16 items-center gap-3 rounded-sm border px-3 py-3 text-left transition-colors ${
                    sourceMode === "pdf"
                      ? "border-[var(--hc-gold)] bg-white text-[var(--hc-text)]"
                      : "border-[var(--hc-border)] bg-transparent text-[var(--hc-text-muted)]"
                  }`}
                >
                  <FileText className="h-5 w-5 shrink-0" strokeWidth={1.5} />
                  <span>
                    <span className="block text-sm font-medium">Subir PDF</span>
                    <span className="mt-0.5 hidden text-[0.68rem] sm:block">Recomendado</span>
                  </span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={sourceMode === "link"}
                  onClick={() => setSourceMode("link")}
                  disabled={Boolean(form.file_path)}
                  title={form.file_path ? "Quita primero el PDF cargado" : undefined}
                  className={`flex min-h-16 items-center gap-3 rounded-sm border px-3 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    sourceMode === "link"
                      ? "border-[var(--hc-gold)] bg-white text-[var(--hc-text)]"
                      : "border-[var(--hc-border)] bg-transparent text-[var(--hc-text-muted)]"
                  }`}
                >
                  <Link2 className="h-5 w-5 shrink-0" strokeWidth={1.5} />
                  <span>
                    <span className="block text-sm font-medium">Usar enlace</span>
                    <span className="mt-0.5 hidden text-[0.68rem] sm:block">Google Drive u otro sitio</span>
                  </span>
                </button>
              </div>

              {sourceMode === "pdf" ? (
                <BookPdfUploader
                  value={
                    form.file_path
                      ? { path: form.file_path, filename: form.file_name, size: form.file_size }
                      : null
                  }
                  onUploadingChange={setUploading}
                  onChange={(file) => {
                    setError("");
                    setForm((current) => ({
                      ...current,
                      file_path: file?.path || "",
                      file_name: file?.filename || "",
                      file_size: file?.size || null,
                      title:
                        current.title ||
                        (file?.filename || "").replace(/\.pdf$/i, "").replace(/[-_]+/g, " ").trim(),
                    }));
                  }}
                />
              ) : (
                <div className="rounded-sm border border-[var(--hc-border)] bg-white/60 p-3 sm:p-4">
                  <label className={labelCls}>Enlace del libro</label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="url"
                      value={form.external_url}
                      onChange={(e) => {
                        update("external_url", e.target.value);
                        setDetectionMessage("");
                      }}
                      required={sourceMode === "link"}
                      data-testid="book-editor-external-url"
                      className={inputCls}
                      placeholder="https://drive.google.com/…"
                    />
                    <button
                      type="button"
                      onClick={detectMetadata}
                      disabled={detecting || !form.external_url.trim()}
                      data-testid="book-detect-metadata"
                      className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-sm bg-[var(--hc-ink)] px-4 py-2 text-[0.65rem] uppercase tracking-[0.14em] text-white disabled:opacity-50"
                    >
                      {detecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                      {detecting ? "Revisando…" : "Completar datos"}
                    </button>
                  </div>
                  <p className="mt-2 text-[0.68rem] leading-relaxed text-[var(--hc-text-muted)]">
                    Debe ser un enlace visible para los miembros. La lectura automática es opcional.
                  </p>
                  {detectionMessage ? (
                    <p className="mt-2 rounded-sm bg-[var(--hc-gold-soft)] px-3 py-2 text-xs leading-relaxed text-[var(--hc-gold)]" data-testid="book-detection-result">
                      {detectionMessage}
                    </p>
                  ) : null}
                </div>
              )}
            </section>

            {sourceReady ? (
              <section className="rounded-sm border border-[var(--hc-border)] bg-[var(--hc-bg)] p-4 sm:p-5">
                <div className="mb-5">
                  <div className="hc-overline mb-1 text-[var(--hc-gold)]">Paso 2</div>
                  <h3 className="text-base font-medium">Información del libro</h3>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--hc-text-muted)]">
                    El título es obligatorio. Los demás datos ayudan a presentar mejor el libro.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className={labelCls}>Título *</label>
                    <input
                      type="text"
                      value={form.title}
                      onChange={(e) => update("title", e.target.value)}
                      required
                      data-testid="book-editor-title"
                      className={inputCls}
                      placeholder="Nombre del libro"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className={labelCls}>Autor</label>
                      <input
                        type="text"
                        value={form.author}
                        onChange={(e) => update("author", e.target.value)}
                        data-testid="book-editor-author"
                        className={inputCls}
                        placeholder="Ej. Howard Marks"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Categoría</label>
                      <select
                        value={form.category}
                        onChange={(e) => update("category", e.target.value)}
                        data-testid="book-editor-category"
                        className={inputCls}
                      >
                        <option value="">Seleccionar categoría</option>
                        {LIBRARY_CATEGORIES.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>Portada</label>
                    <ImageUploader
                      value={form.cover_url}
                      onChange={(url) => update("cover_url", url)}
                      testid="book-editor-cover"
                      aspect="portrait"
                    />
                    <details className="mt-3">
                      <summary className="cursor-pointer text-[0.65rem] uppercase tracking-[0.14em] text-[var(--hc-text-muted)]">
                        Usar una URL de imagen
                      </summary>
                      <input
                        type="url"
                        value={form.cover_url}
                        onChange={(e) => update("cover_url", e.target.value)}
                        className={`${inputCls} mt-2`}
                        data-testid="book-editor-cover-url"
                        placeholder="https://…/portada.jpg"
                      />
                    </details>
                  </div>

                  <div>
                    <label className={labelCls}>Descripción corta</label>
                    <textarea
                      value={form.description}
                      onChange={(e) => update("description", e.target.value)}
                      data-testid="book-editor-description"
                      className={`${inputCls} min-h-[96px] resize-y`}
                      placeholder="¿Por qué deberían leerlo los miembros?"
                    />
                  </div>
                </div>
              </section>
            ) : (
              <section className="rounded-sm border border-dashed border-[var(--hc-border)] px-4 py-5 text-[var(--hc-text-muted)]">
                <div className="hc-overline mb-1">Paso 2</div>
                <p className="text-sm">{sourceMode === "pdf" ? "Carga el PDF para continuar con los datos." : "Pega el enlace para continuar con los datos."}</p>
              </section>
            )}

            {sourceReady ? (
              <section className="rounded-sm border border-[var(--hc-border)] bg-[var(--hc-bg)] p-4 sm:p-5">
                <div className="mb-3">
                  <div className="hc-overline mb-1 text-[var(--hc-gold)]">Paso 3</div>
                  <h3 className="text-base font-medium">Estado de publicación</h3>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ["draft", "Borrador", "Guardar sin mostrar"],
                    ["published", "Publicado", "Visible para miembros"],
                  ].map(([s, label, caption]) => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => update("status", s)}
                      data-testid={`book-editor-status-${s}`}
                      className={`rounded-sm border px-3 py-3 text-left transition-colors ${
                        form.status === s
                          ? "border-[var(--hc-gold)] bg-[var(--hc-gold-soft)] text-[var(--hc-text)]"
                          : "border-[var(--hc-border)] text-[var(--hc-text-secondary)]"
                      }`}
                    >
                      <span className="block text-sm font-medium">{label}</span>
                      <span className="mt-0.5 block text-[0.68rem] text-[var(--hc-text-muted)]">{caption}</span>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {error ? (
              <div
                data-testid="book-editor-error"
                className="rounded-sm border border-[#b75d5d]/35 bg-[#f8e9e7] px-3 py-2.5 text-xs leading-relaxed text-[#913f3f]"
              >
                {error}
              </div>
            ) : null}
          </div>

          <DialogFooter className="sticky bottom-0 z-10 flex-row justify-between gap-2 border-t border-[var(--hc-border)] bg-[var(--hc-surface)]/95 px-4 py-4 backdrop-blur sm:px-7">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              data-testid="book-editor-cancel"
              className="rounded-sm border border-[var(--hc-border)] px-4 py-2.5 text-xs uppercase tracking-[0.14em] text-[var(--hc-text-secondary)]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!canSave}
              data-testid="book-editor-save"
              className="inline-flex min-w-36 items-center justify-center gap-2 rounded-sm bg-[var(--hc-ink)] px-5 py-2.5 text-xs uppercase tracking-[0.14em] text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? "Guardando…" : initial ? "Guardar cambios" : form.status === "published" ? "Publicar libro" : "Guardar borrador"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
