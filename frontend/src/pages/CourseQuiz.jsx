import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import { api, formatApiErrorDetail } from "../lib/api";

const difficultyLabels = {
  fundamental: "Fundamental",
  intermediate: "Intermedia",
  application: "Aplicación",
};

const errorMessage = (error) => formatApiErrorDetail(error.response?.data?.detail) || error.message;

export default function CourseQuiz() {
  const { courseId } = useParams();
  const [status, setStatus] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [result, setResult] = useState(null);
  const [selectedOption, setSelectedOption] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: nextStatus } = await api.get(`/courses/${courseId}/quiz-status`);
      setStatus(nextStatus);
      if (nextStatus.active_attempt_id) {
        const { data: activeAttempt } = await api.get(`/quiz-attempts/${nextStatus.active_attempt_id}`);
        if (activeAttempt.status === "completed") {
          setResult(activeAttempt);
        } else if (!activeAttempt.question && activeAttempt.answered_questions === activeAttempt.total_questions) {
          const { data: completedAttempt } = await api.post(`/quiz-attempts/${activeAttempt.id}/complete`);
          setResult(completedAttempt);
        } else {
          setAttempt(activeAttempt);
        }
      }
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    load();
  }, [load]);

  const start = async () => {
    if (!status?.quiz?.id) return;
    setBusy(true);
    setError("");
    setFeedback(null);
    setSelectedOption("");
    setResult(null);
    try {
      const { data } = await api.post(`/quizzes/${status.quiz.id}/start`);
      if (!data.question && data.answered_questions === data.total_questions) {
        const { data: completedAttempt } = await api.post(`/quiz-attempts/${data.id}/complete`);
        setResult(completedAttempt);
        setAttempt(null);
      } else {
        setAttempt(data);
      }
    } catch (startError) {
      setError(errorMessage(startError));
    } finally {
      setBusy(false);
    }
  };

  const submitAnswer = async () => {
    if (!attempt?.question?.id || !selectedOption || feedback) return;
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post(`/quiz-attempts/${attempt.id}/answer`, {
        question_id: attempt.question.id,
        selected_option_id: selectedOption,
      });
      setFeedback(data);
    } catch (answerError) {
      setError(errorMessage(answerError));
    } finally {
      setBusy(false);
    }
  };

  const advance = async () => {
    if (!attempt || !feedback) return;
    setBusy(true);
    setError("");
    try {
      if (feedback.has_next) {
        const { data } = await api.get(`/quiz-attempts/${attempt.id}`);
        setAttempt(data);
        setFeedback(null);
        setSelectedOption("");
      } else {
        const { data } = await api.post(`/quiz-attempts/${attempt.id}/complete`);
        setResult(data);
        setAttempt(null);
        setFeedback(null);
        const { data: nextStatus } = await api.get(`/courses/${courseId}/quiz-status`);
        setStatus(nextStatus);
      }
    } catch (advanceError) {
      setError(errorMessage(advanceError));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="border border-[var(--hc-border)] bg-[var(--hc-surface)] py-16 text-center text-sm text-[var(--hc-text-muted)]">
        Preparando evaluación…
      </div>
    );
  }

  if (error && !status) {
    return (
      <div className="mx-auto max-w-2xl border border-[#b75d5d]/35 bg-[#f8e9e7] p-6 text-sm text-[#913f3f]">
        {error}
      </div>
    );
  }

  const quiz = status?.quiz;

  if (result) {
    const passed = Boolean(result.passed);
    return (
      <main className="mx-auto w-full max-w-3xl" data-testid="quiz-result">
        <Link to="/education" className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)]">
          <ArrowLeft className="h-3.5 w-3.5" /> Educación
        </Link>
        <section className="mt-8 overflow-hidden border border-[var(--hc-border)] bg-[var(--hc-surface)]">
          <div className={`h-1.5 ${passed ? "bg-[#68876d]" : "bg-[var(--hc-gold)]"}`} />
          <div className="px-5 py-8 text-center sm:px-10 sm:py-12">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--hc-gold-soft)] text-[var(--hc-gold)]">
              {passed ? <CheckCircle2 className="h-7 w-7" /> : <RefreshCw className="h-6 w-6" />}
            </div>
            <div className="mt-6 hc-overline">Intento {result.attempt_number}</div>
            <div className="mt-3 text-6xl font-medium tracking-[-0.04em] text-[var(--hc-text)] sm:text-7xl">
              {result.score}%
            </div>
            <h1 className="mt-4 text-2xl font-medium tracking-tight text-[var(--hc-text)]">
              {passed ? "Passed" : "Needs Review"}
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[var(--hc-text-secondary)]">
              {passed
                ? "Aprobaste la evaluación y completaste este curso. La siguiente ruta ya está disponible."
                : `Necesitas ${result.passing_score}% para aprobar. Revisa las explicaciones y vuelve a intentarlo cuando estés listo.`}
            </p>

            <div className="mx-auto mt-8 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
              <ResultMetric label="Correctas" value={result.correct_answers} />
              <ResultMetric label="Incorrectas" value={result.incorrect_answers} />
              <ResultMetric label="Mejor score" value={`${result.best_score ?? result.score}%`} />
            </div>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              {passed ? (
                <Link to="/education" className="inline-flex min-h-12 items-center justify-center gap-2 bg-[var(--hc-ink)] px-6 py-3 text-xs uppercase tracking-[0.18em] text-white hover:bg-[var(--hc-gold)]">
                  Continuar <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <button type="button" onClick={start} disabled={busy} className="inline-flex min-h-12 items-center justify-center gap-2 bg-[var(--hc-ink)] px-6 py-3 text-xs uppercase tracking-[0.18em] text-white hover:bg-[var(--hc-gold)] disabled:opacity-50">
                  <RefreshCw className="h-4 w-4" /> Try Again
                </button>
              )}
              <Link to="/education" className="inline-flex min-h-12 items-center justify-center border border-[var(--hc-border)] px-6 py-3 text-xs uppercase tracking-[0.18em] text-[var(--hc-text-secondary)] hover:border-[var(--hc-gold)] hover:text-[var(--hc-text)]">
                Volver al curso
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (attempt?.question) {
    const progress = Math.round((attempt.question_number / attempt.total_questions) * 100);
    return (
      <main className="mx-auto w-full max-w-3xl" data-testid="quiz-question">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="hc-overline">{attempt.course_title}</div>
            <h1 className="mt-2 text-xl font-medium tracking-tight text-[var(--hc-text)] sm:text-2xl">{attempt.quiz_title}</h1>
          </div>
          <div className="shrink-0 text-right text-xs uppercase tracking-[0.16em] text-[var(--hc-text-muted)]">
            Pregunta {attempt.question_number} de {attempt.total_questions}
          </div>
        </div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-[var(--hc-border)]" aria-label={`Progreso ${progress}%`}>
          <div className="h-full rounded-full bg-[var(--hc-gold)] transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>

        <section className="mt-6 border border-[var(--hc-border)] bg-[var(--hc-surface)] p-5 sm:p-8">
          <div className="text-[0.68rem] uppercase tracking-[0.18em] text-[var(--hc-gold)]">
            {difficultyLabels[attempt.question.difficulty] || attempt.question.difficulty}
          </div>
          <h2 className="mt-3 text-xl font-medium leading-snug tracking-tight text-[var(--hc-text)] sm:text-2xl">
            {attempt.question.question_text}
          </h2>

          <div className="mt-7 grid gap-3" role="radiogroup" aria-label="Opciones de respuesta">
            {attempt.question.options.map((option, index) => {
              const selected = selectedOption === option.id;
              const correctAfterAnswer = feedback?.correct_option_id === option.id;
              const wrongSelection = feedback && selected && !feedback.correct;
              const optionStyle = correctAfterAnswer
                ? "border-[#68876d] bg-[#edf3ea] text-[#345438]"
                : wrongSelection
                  ? "border-[#b75d5d] bg-[#f8e9e7] text-[#913f3f]"
                  : selected
                    ? "border-[var(--hc-gold)] bg-[var(--hc-gold-soft)] text-[var(--hc-text)]"
                    : "border-[var(--hc-border)] bg-white/50 text-[var(--hc-text-secondary)] hover:border-[var(--hc-gold)] hover:text-[var(--hc-text)]";
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={Boolean(feedback)}
                  onClick={() => setSelectedOption(option.id)}
                  className={`flex min-h-14 w-full items-center gap-3 overflow-hidden border px-4 py-3 text-left text-sm leading-relaxed transition-colors disabled:cursor-default sm:px-5 ${optionStyle}`}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-current/25 text-[0.68rem] font-semibold">
                    {correctAfterAnswer ? <Check className="h-4 w-4" /> : wrongSelection ? <X className="h-4 w-4" /> : String.fromCharCode(65 + index)}
                  </span>
                  <span className="min-w-0">{option.option_text}</span>
                </button>
              );
            })}
          </div>

          {feedback ? (
            <div className={`mt-6 border-l-4 px-4 py-4 ${feedback.correct ? "border-[#68876d] bg-[#edf3ea]" : "border-[var(--hc-gold)] bg-[var(--hc-gold-soft)]"}`} data-testid="quiz-feedback">
              <div className="text-sm font-medium text-[var(--hc-text)]">{feedback.correct ? "Respuesta correcta" : "Respuesta incorrecta"}</div>
              <p className="mt-2 text-sm leading-relaxed text-[var(--hc-text-secondary)]">{feedback.explanation}</p>
            </div>
          ) : null}

          {error ? <div className="mt-5 text-sm text-[#913f3f]">{error}</div> : null}

          <div className="mt-7 flex justify-end">
            {feedback ? (
              <button type="button" onClick={advance} disabled={busy} className="inline-flex min-h-12 w-full items-center justify-center gap-2 bg-[var(--hc-ink)] px-6 py-3 text-xs uppercase tracking-[0.18em] text-white hover:bg-[var(--hc-gold)] disabled:opacity-50 sm:w-auto">
                {feedback.has_next ? "Siguiente pregunta" : "Ver resultado"} <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button type="button" onClick={submitAnswer} disabled={!selectedOption || busy} className="inline-flex min-h-12 w-full items-center justify-center bg-[var(--hc-ink)] px-6 py-3 text-xs uppercase tracking-[0.18em] text-white hover:bg-[var(--hc-gold)] disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto">
                Enviar respuesta
              </button>
            )}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl" data-testid="quiz-start">
      <Link to="/education" className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)]">
        <ArrowLeft className="h-3.5 w-3.5" /> Volver a educación
      </Link>
      <section className="mt-8 border border-[var(--hc-border)] bg-[var(--hc-surface)] px-5 py-8 sm:px-10 sm:py-12">
        <div className="flex h-12 w-12 items-center justify-center border border-[var(--hc-gold)]/50 bg-[var(--hc-gold-soft)] text-[var(--hc-gold)]">
          {status?.locked ? <LockKeyhole className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
        </div>
        <div className="mt-6 hc-overline">{status?.course?.title || "Curso"} · Evaluación final</div>
        <h1 className="mt-3 text-3xl font-medium leading-tight tracking-[-0.02em] text-[var(--hc-text)] sm:text-4xl">
          {quiz?.title || "Evaluación no disponible"}
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[var(--hc-text-secondary)] sm:text-base">
          {quiz?.description || "Este curso todavía no tiene un quiz activo."}
        </p>

        {quiz ? (
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <ResultMetric label="Preguntas" value={quiz.question_count} />
            <ResultMetric label="Puntuación mínima" value={`${quiz.passing_score}%`} />
            <ResultMetric label="Mejor score" value={status.best_score == null ? "—" : `${status.best_score}%`} />
          </div>
        ) : null}

        {status?.locked ? (
          <div className="mt-7 border border-[var(--hc-border)] bg-[var(--hc-bg)] p-4 text-sm leading-relaxed text-[var(--hc-text-secondary)]">
            Debes aprobar la evaluación del curso anterior para desbloquear esta ruta.
          </div>
        ) : quiz && !status?.content_completed ? (
          <div className="mt-7 border border-[var(--hc-border)] bg-[var(--hc-bg)] p-4 text-sm leading-relaxed text-[var(--hc-text-secondary)]">
            Completa todas las lecciones del curso para iniciar la evaluación.
          </div>
        ) : null}

        {error ? <div className="mt-5 text-sm text-[#913f3f]">{error}</div> : null}

        {quiz ? (
          <button
            type="button"
            onClick={start}
            disabled={busy || status.locked || !status.content_completed}
            className="mt-8 inline-flex min-h-12 w-full items-center justify-center gap-2 bg-[var(--hc-ink)] px-7 py-3.5 text-xs uppercase tracking-[0.18em] text-white hover:bg-[var(--hc-gold)] disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
          >
            Iniciar quiz <ArrowRight className="h-4 w-4" />
          </button>
        ) : null}
      </section>
    </main>
  );
}

const ResultMetric = ({ label, value }) => (
  <div className="border border-[var(--hc-border)] bg-[var(--hc-bg)] px-4 py-4 text-left">
    <div className="text-[0.65rem] uppercase tracking-[0.16em] text-[var(--hc-text-muted)]">{label}</div>
    <div className="mt-2 text-xl font-medium tracking-tight text-[var(--hc-text)]">{value}</div>
  </div>
);
