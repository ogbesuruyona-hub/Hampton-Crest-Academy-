import React, { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { ArrowDown, ArrowUp, Plus, Save, ShieldQuestion, Trash2 } from "lucide-react";
import { api, formatApiErrorDetail } from "../lib/api";
import { COURSE_CATALOG } from "../lib/learningProgress";
import { useAuth } from "../context/AuthContext";
import { PageHeader } from "../components/PageHeader";
import { RequestError } from "../components/RequestError";
import { toast } from "sonner";

const inputClass = "w-full min-w-0 border border-[var(--hc-border)] bg-white px-3 py-2.5 text-sm text-[var(--hc-text)] outline-none focus:border-[var(--hc-gold)]";
const labelClass = "mb-2 block text-[0.65rem] uppercase tracking-[0.16em] text-[var(--hc-text-muted)]";

const blankQuestion = (position = 0) => ({
  question_text: "",
  explanation: "",
  difficulty: "fundamental",
  position,
  is_active: true,
  options: Array.from({ length: 4 }, (_, optionPosition) => ({
    option_text: "",
    position: optionPosition,
    is_correct: optionPosition === 0,
  })),
});

const blankQuiz = () => ({
  course_id: COURSE_CATALOG[0].id,
  title: "",
  description: "",
  passing_score: 80,
  is_active: false,
  questions: Array.from({ length: 10 }, (_, index) => blankQuestion(index)),
});

export default function AdminQuizzes() {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get("/admin/quizzes");
      setQuizzes(data);
      setForm((current) => current || (data[0] ? structuredClone(data[0]) : blankQuiz()));
    } catch (error) {
      setError(error);
      toast.error(formatApiErrorDetail(error.response?.data?.detail) || error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === "admin") load();
  }, [load, user?.role]);

  if (user?.role !== "admin") return <Navigate to="/dashboard" replace />;

  const updateQuestion = (index, patch) => {
    setForm((current) => ({
      ...current,
      questions: current.questions.map((question, questionIndex) =>
        questionIndex === index ? { ...question, ...patch } : question,
      ),
    }));
  };

  const updateOption = (questionIndex, optionIndex, patch) => {
    const question = form.questions[questionIndex];
    const nextOptions = question.options.map((option, index) => ({
      ...option,
      ...(index === optionIndex ? patch : {}),
      ...(patch.is_correct ? { is_correct: index === optionIndex } : {}),
    }));
    updateQuestion(questionIndex, { options: nextOptions });
  };

  const moveQuestion = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= form.questions.length) return;
    const questions = [...form.questions];
    [questions[index], questions[target]] = [questions[target], questions[index]];
    setForm({ ...form, questions });
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        course_id: form.course_id,
        title: form.title,
        description: form.description,
        passing_score: Number(form.passing_score),
        is_active: Boolean(form.is_active),
        questions: form.questions.map((question, questionIndex) => ({
          ...question,
          position: questionIndex,
          options: question.options.map((option, optionIndex) => ({ ...option, position: optionIndex })),
        })),
      };
      const { data } = form.id
        ? await api.put(`/admin/quizzes/${form.id}`, payload)
        : await api.post("/admin/quizzes", payload);
      toast.success("Quiz guardado correctamente");
      setForm(structuredClone(data));
      await load();
    } catch (error) {
      toast.error(formatApiErrorDetail(error.response?.data?.detail) || error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-testid="admin-quizzes-page">
      <PageHeader
        overline="Administración · Academia"
        title="Quizzes y evaluaciones"
        description="Gestiona la evaluación final de cada ruta sin exponer respuestas a los estudiantes."
        actions={
          <button type="button" onClick={() => setForm(blankQuiz())} className="inline-flex min-h-11 items-center gap-2 bg-[var(--hc-ink)] px-5 py-2.5 text-xs uppercase tracking-[0.18em] text-white hover:bg-[var(--hc-gold)]">
            <Plus className="h-4 w-4" /> Nuevo quiz
          </button>
        }
      />

      {loading ? (
        <div className="border border-[var(--hc-border)] bg-[var(--hc-surface)] py-14 text-center text-sm text-[var(--hc-text-muted)]">Cargando quizzes…</div>
      ) : error ? (
        <RequestError error={error} onRetry={load} />
      ) : !form ? (
        <RequestError error={new Error("No se pudo preparar el editor de quizzes.")} onRetry={load} />
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="min-w-0 border border-[var(--hc-border)] bg-[var(--hc-surface)] p-3">
            <div className="px-2 pb-3 pt-2 hc-overline">Quizzes existentes</div>
            <div className="space-y-2">
              {quizzes.map((quiz) => (
                <button
                  key={quiz.id}
                  type="button"
                  onClick={() => setForm(structuredClone(quiz))}
                  className={`w-full border px-3 py-3 text-left ${form.id === quiz.id ? "border-[var(--hc-gold)] bg-[var(--hc-gold-soft)]" : "border-[var(--hc-border)] hover:border-[var(--hc-gold)]"}`}
                >
                  <div className="truncate text-sm font-medium text-[var(--hc-text)]">{quiz.course_title}</div>
                  <div className="mt-1 text-[0.68rem] uppercase tracking-[0.14em] text-[var(--hc-text-muted)]">{quiz.question_count} preguntas · {quiz.is_active ? "Activo" : "Borrador"}</div>
                </button>
              ))}
            </div>
          </aside>

          <form onSubmit={save} className="min-w-0 space-y-5">
            <section className="border border-[var(--hc-border)] bg-[var(--hc-surface)] p-4 sm:p-6">
              <div className="flex items-center gap-3 border-b border-[var(--hc-border)] pb-4">
                <ShieldQuestion className="h-5 w-5 text-[var(--hc-gold)]" />
                <div>
                  <div className="hc-overline">Configuración</div>
                  <h2 className="mt-1 text-lg font-medium text-[var(--hc-text)]">Datos del quiz</h2>
                </div>
              </div>
              <div className="mt-5 grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Curso">
                  <select className={inputClass} value={form.course_id} onChange={(event) => setForm({ ...form, course_id: event.target.value })}>
                    {COURSE_CATALOG.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
                  </select>
                </Field>
                <Field label="Passing score">
                  <input className={inputClass} type="number" min="1" max="100" value={form.passing_score} onChange={(event) => setForm({ ...form, passing_score: event.target.value })} />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Título">
                    <input required className={inputClass} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
                  </Field>
                </div>
                <div className="md:col-span-2">
                  <Field label="Descripción">
                    <textarea className={`${inputClass} min-h-24 resize-y`} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
                  </Field>
                </div>
                <label className="flex min-h-11 items-center gap-3 text-sm text-[var(--hc-text-secondary)] md:col-span-2">
                  <input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} />
                  Quiz activo y visible para estudiantes
                </label>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="hc-overline">Banco de preguntas</div>
                  <h2 className="mt-1 text-lg font-medium text-[var(--hc-text)]">Preguntas · {form.questions.length}</h2>
                </div>
                <button type="button" onClick={() => setForm({ ...form, questions: [...form.questions, blankQuestion(form.questions.length)] })} className="inline-flex min-h-10 items-center gap-2 border border-[var(--hc-border)] px-4 py-2 text-xs uppercase tracking-[0.16em] text-[var(--hc-text-secondary)] hover:border-[var(--hc-gold)]">
                  <Plus className="h-3.5 w-3.5" /> Añadir
                </button>
              </div>

              {form.questions.map((question, questionIndex) => (
                <details key={question.id || `new-${questionIndex}`} open={questionIndex === 0} className="min-w-0 border border-[var(--hc-border)] bg-[var(--hc-surface)]">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 sm:px-5">
                    <span className="min-w-0 truncate text-sm font-medium text-[var(--hc-text)]">{questionIndex + 1}. {question.question_text || "Pregunta sin título"}</span>
                    <span className="shrink-0 text-[0.65rem] uppercase tracking-[0.14em] text-[var(--hc-text-muted)]">{question.difficulty}</span>
                  </summary>
                  <div className="min-w-0 border-t border-[var(--hc-border)] p-4 sm:p-5">
                    <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
                      <Field label="Pregunta">
                        <textarea required className={`${inputClass} min-h-24 resize-y`} value={question.question_text} onChange={(event) => updateQuestion(questionIndex, { question_text: event.target.value })} />
                      </Field>
                      <div className="space-y-4">
                        <Field label="Dificultad">
                          <select className={inputClass} value={question.difficulty} onChange={(event) => updateQuestion(questionIndex, { difficulty: event.target.value })}>
                            <option value="fundamental">Fundamental</option>
                            <option value="intermediate">Intermediate</option>
                            <option value="application">Application</option>
                          </select>
                        </Field>
                        <label className="flex items-center gap-2 text-xs text-[var(--hc-text-secondary)]">
                          <input type="checkbox" checked={question.is_active} onChange={(event) => updateQuestion(questionIndex, { is_active: event.target.checked })} /> Activa
                        </label>
                      </div>
                    </div>

                    <div className="mt-5 space-y-2">
                      <div className={labelClass}>Opciones — selecciona la correcta</div>
                      {question.options.map((option, optionIndex) => (
                        <label key={option.id || optionIndex} className="flex min-w-0 items-center gap-3">
                          <input type="radio" name={`correct-${questionIndex}`} checked={option.is_correct} onChange={() => updateOption(questionIndex, optionIndex, { is_correct: true })} />
                          <input required className={inputClass} value={option.option_text} onChange={(event) => updateOption(questionIndex, optionIndex, { option_text: event.target.value })} placeholder={`Opción ${String.fromCharCode(65 + optionIndex)}`} />
                        </label>
                      ))}
                    </div>

                    <div className="mt-5">
                      <Field label="Explicación educativa">
                        <textarea required className={`${inputClass} min-h-24 resize-y`} value={question.explanation} onChange={(event) => updateQuestion(questionIndex, { explanation: event.target.value })} />
                      </Field>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-4">
                      <button type="button" onClick={() => moveQuestion(questionIndex, -1)} disabled={questionIndex === 0} className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.14em] text-[var(--hc-text-secondary)] disabled:opacity-30">
                        <ArrowUp className="h-3.5 w-3.5" /> Subir
                      </button>
                      <button type="button" onClick={() => moveQuestion(questionIndex, 1)} disabled={questionIndex === form.questions.length - 1} className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.14em] text-[var(--hc-text-secondary)] disabled:opacity-30">
                        <ArrowDown className="h-3.5 w-3.5" /> Bajar
                      </button>
                      <button type="button" onClick={() => setForm({ ...form, questions: form.questions.filter((_, index) => index !== questionIndex) })} className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-[#913f3f]">
                        <Trash2 className="h-3.5 w-3.5" /> Eliminar pregunta
                      </button>
                    </div>
                  </div>
                </details>
              ))}
            </section>

            <div className="sticky bottom-4 flex justify-end">
              <button type="submit" disabled={saving} className="inline-flex min-h-12 w-full items-center justify-center gap-2 bg-[var(--hc-ink)] px-7 py-3 text-xs uppercase tracking-[0.18em] text-white shadow-lg hover:bg-[var(--hc-gold)] disabled:opacity-50 sm:w-auto">
                <Save className="h-4 w-4" /> {saving ? "Guardando…" : "Guardar quiz"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

const Field = ({ label, children }) => (
  <label className="block min-w-0">
    <span className={labelClass}>{label}</span>
    {children}
  </label>
);
