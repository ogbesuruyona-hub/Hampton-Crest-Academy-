import React, { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api, formatApiErrorDetail } from "../lib/api";
import { COURSE_CATALOG } from "../lib/learningProgress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";

const inputClass = "w-full rounded-lg border border-[var(--hc-border)] bg-[var(--hc-bg)] px-3 py-2.5 text-sm text-[var(--hc-text)] outline-none transition-colors focus:border-[var(--hc-gold)]";
const emptyLesson = () => ({ title: "", estimated_duration_minutes: 15 });

export function EducationModuleDialog({ open, onOpenChange, onSaved, nextOrder = 0 }) {
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState("fundamentos");
  const [status, setStatus] = useState("published");
  const [lessons, setLessons] = useState([emptyLesson()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setCourseId("fundamentos");
    setStatus("published");
    setLessons([emptyLesson()]);
    setError("");
  }, [open]);

  const updateLesson = (index, field, value) => {
    setLessons((current) => current.map((lesson, lessonIndex) => lessonIndex === index ? { ...lesson, [field]: value } : lesson));
  };

  const submit = async (event) => {
    event.preventDefault();
    const normalizedLessons = lessons.map((lesson) => ({
      title: lesson.title.trim(),
      estimated_duration_minutes: Number(lesson.estimated_duration_minutes) || 15,
    })).filter((lesson) => lesson.title);
    if (!title.trim() || normalizedLessons.length === 0) {
      setError("Escribe el título del módulo y al menos una lección.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.post("/education/modules", {
        title: title.trim(),
        course_id: courseId,
        order_index: nextOrder,
        status,
        lessons: normalizedLessons,
      });
      onSaved?.();
      onOpenChange(false);
    } catch (requestError) {
      setError(formatApiErrorDetail(requestError.response?.data?.detail) || requestError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-2xl border-[var(--hc-border)] bg-[var(--hc-surface)] text-[var(--hc-text)]" data-testid="education-module-dialog">
        <DialogHeader>
          <div className="hc-overline mb-1 text-[#9b7628]">Estructura del curso</div>
          <DialogTitle className="font-[Georgia] text-2xl font-normal text-[#173b61]">Agregar módulo</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-[var(--hc-text-secondary)]">
            Crea el módulo y define sus lecciones. Después podrás editar cada lección para añadir el PDF, portada y contenido.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="mt-3 space-y-5">
          <div>
            <label className="hc-overline mb-2 block">Título del módulo</label>
            <input value={title} onChange={(event) => setTitle(event.target.value)} className={inputClass} placeholder="Ej. Estados financieros" required data-testid="module-title" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="hc-overline mb-2 block">Curso</label>
              <select value={courseId} onChange={(event) => setCourseId(event.target.value)} className={inputClass}>
                {COURSE_CATALOG.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
              </select>
            </div>
            <div>
              <label className="hc-overline mb-2 block">Estado inicial</label>
              <select value={status} onChange={(event) => setStatus(event.target.value)} className={inputClass}>
                <option value="published">Publicado</option>
                <option value="draft">Borrador</option>
              </select>
            </div>
          </div>

          <section className="rounded-xl border border-[var(--hc-border)] bg-[var(--hc-bg)] p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div><div className="hc-overline">Lecciones del módulo</div><p className="mt-1 text-xs text-[var(--hc-text-muted)]">El orden mostrado aquí será el orden de estudio.</p></div>
              <button type="button" onClick={() => setLessons((current) => [...current, emptyLesson()])} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--hc-border)] px-4 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[#173b61] hover:border-[var(--hc-gold)]" data-testid="add-module-lesson"><Plus className="h-4 w-4" /> Lección</button>
            </div>
            <div className="space-y-3">
              {lessons.map((lesson, index) => (
                <div key={index} className="grid grid-cols-[32px_minmax(0,1fr)] gap-3 rounded-lg border border-[var(--hc-border-subtle)] bg-[var(--hc-surface)] p-3 sm:grid-cols-[32px_minmax(0,1fr)_110px_40px]" data-testid={`module-lesson-${index}`}>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--hc-gold-soft)] text-xs font-semibold text-[#8f6c24]">{index + 1}</span>
                  <input value={lesson.title} onChange={(event) => updateLesson(index, "title", event.target.value)} className={inputClass} placeholder="Título de la lección" required />
                  <div className="col-start-2 flex items-center gap-2 sm:col-start-auto"><input type="number" min="5" max="45" step="5" value={lesson.estimated_duration_minutes} onChange={(event) => updateLesson(index, "estimated_duration_minutes", event.target.value)} className={inputClass} /><span className="text-xs text-[var(--hc-text-muted)]">min</span></div>
                  <button type="button" disabled={lessons.length === 1} onClick={() => setLessons((current) => current.filter((_, lessonIndex) => lessonIndex !== index))} className="col-start-2 inline-flex h-10 w-10 items-center justify-center text-[#8a3b3b] disabled:opacity-30 sm:col-start-auto" aria-label={`Quitar lección ${index + 1}`}><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          </section>

          {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p> : null}
          <DialogFooter>
            <button type="button" onClick={() => onOpenChange(false)} className="min-h-11 rounded-lg border border-[var(--hc-border)] px-5 text-sm">Cancelar</button>
            <button type="submit" disabled={saving} className="min-h-11 rounded-lg bg-[#173b61] px-6 text-sm font-semibold text-white disabled:opacity-60" data-testid="save-module">{saving ? "Guardando…" : "Crear módulo"}</button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
