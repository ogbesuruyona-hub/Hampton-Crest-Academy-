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
import { Loader2, Search } from "lucide-react";

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
        status: initial.status || "published",
      });
    } else {
      setForm(blank);
    }
    setError("");
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
      setError(formatApiErrorDetail(err.response?.data?.detail) || "No pudimos leer esa página. Completa los datos manualmente.");
    } finally {
      setDetecting(false);
    }
  };

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
          <div className="hc-overline mb-1">Biblioteca</div>
          <DialogTitle className="text-xl font-medium tracking-tight">
            {initial ? "Editar libro" : "Nuevo libro"}
          </DialogTitle>
          <DialogDescription className="text-[var(--hc-text-secondary)] text-sm tracking-tight">
            {initial
              ? "Actualiza este volumen en la estantería."
              : "Agrega un libro a la biblioteca de la academia. El enlace externo abre en una pestaña nueva para que el miembro mantenga la sesión activa."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5 mt-4" data-testid="book-editor-form">
          <div className="border border-[var(--hc-gold)]/35 bg-[var(--hc-gold-soft)] p-4">
            <label className={labelCls}>Enlace del libro</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="url"
                value={form.external_url}
                onChange={(e) => {
                  update("external_url", e.target.value);
                  setDetectionMessage("");
                }}
                required
                data-testid="book-editor-external-url"
                className={inputCls}
                placeholder="https://… (Amazon, editorial, Google Books u otra página)"
              />
              <button
                type="button"
                onClick={detectMetadata}
                disabled={detecting || !form.external_url.trim()}
                data-testid="book-detect-metadata"
                className="inline-flex shrink-0 items-center justify-center gap-2 bg-[var(--hc-ink)] px-4 py-2 text-[0.65rem] uppercase tracking-[0.16em] text-white hover:bg-[var(--hc-ink-soft)] disabled:opacity-50"
              >
                {detecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                {detecting ? "Detectando…" : "Detectar datos"}
              </button>
            </div>
            <p className="mt-2 text-[0.68rem] leading-relaxed text-[var(--hc-text-muted)]">
              Pegamos el enlace y buscamos automáticamente el título, autor, categoría y portada disponibles.
            </p>
            {detectionMessage ? (
              <p className="mt-2 text-xs leading-relaxed text-[var(--hc-gold)]" data-testid="book-detection-result">
                {detectionMessage}
              </p>
            ) : null}
          </div>

          <div>
            <label className={labelCls}>Título</label>
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
                <option value="">— Ninguna —</option>
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
              <summary className="cursor-pointer text-[0.65rem] uppercase tracking-[0.16em] text-[var(--hc-text-muted)]">
                Usar una URL de imagen
              </summary>
              <div className="mt-2">
                <input
                  type="url"
                  value={form.cover_url}
                  onChange={(e) => update("cover_url", e.target.value)}
                  className={inputCls}
                  data-testid="book-editor-cover-url"
                  placeholder="https://…/portada.jpg"
                />
              </div>
            </details>
          </div>

          <div>
            <label className={labelCls}>Descripción corta</label>
            <textarea
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              data-testid="book-editor-description"
              className={`${inputCls} min-h-[100px] resize-y`}
              placeholder="Un párrafo: por qué los miembros deberían leerlo."
            />
          </div>

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
                  data-testid={`book-editor-status-${s}`}
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
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              data-testid="book-editor-save"
              className="px-6 py-2.5 text-xs tracking-[0.18em] uppercase bg-[var(--hc-platinum)] text-[var(--hc-bg)] hover:bg-white transition-colors disabled:opacity-60"
            >
              {saving ? "Guardando…" : initial ? "Guardar cambios" : "Añadir a la biblioteca"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
