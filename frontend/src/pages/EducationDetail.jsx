import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Clock, FileDown, ShieldQuestion } from "lucide-react";
import { API, formatApiErrorDetail } from "../lib/api";
import { formatDate, formatFileSize } from "../lib/content";
import { RichContent } from "../components/RichContent";
import { BookmarkButton } from "../components/BookmarkButton";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import { learningProgress } from "../lib/learningProgress";
import { cachedApiGet } from "../lib/resourceCache";

const sortLessons = (items) =>
  [...items].sort((a, b) => {
    const ao = Number.isFinite(Number(a.order_index)) ? Number(a.order_index) : 9999;
    const bo = Number.isFinite(Number(b.order_index)) ? Number(b.order_index) : 9999;
    if (ao !== bo) return ao - bo;
    return (a.title || "").localeCompare(b.title || "", "es");
  });

const getDuration = (lesson) =>
  lesson.estimated_duration ||
  (lesson.estimated_duration_minutes ? `${lesson.estimated_duration_minutes} min` : null) ||
  lesson.duration ||
  lesson.reading_time ||
  null;

export default function EducationDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [lesson, setLesson] = useState(null);
  const [allLessons, setAllLessons] = useState([]);
  const [completed, setCompleted] = useState(false);
  const [quizStatus, setQuizStatus] = useState(null);
  const [savingProgress, setSavingProgress] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [progressError, setProgressError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setProgressError("");
    Promise.all([cachedApiGet(`/education/${id}`), cachedApiGet("/education")])
      .then(async ([detail, list]) => {
        if (cancelled) return;
        setLesson(detail);
        setAllLessons(Array.isArray(list) ? list : []);
        try {
          const statuses = await learningProgress.syncWithServer(user?.id);
          if (cancelled) return;
          const courseStatus = statuses.find((status) => status.course.id === detail.course_id);
          setQuizStatus(courseStatus || null);
          setCompleted(Boolean(courseStatus?.completed_lesson_ids?.includes(detail.id)));
        } catch {
          setCompleted(learningProgress.isCompleted(detail.id, user?.id));
        }
      })
      .catch((e) => {
        if (!cancelled) setError(formatApiErrorDetail(e.response?.data?.detail) || e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, user?.id]);

  const sequence = useMemo(() => {
    if (!lesson) return [];
    const courseLessons = sortLessons(allLessons.filter((item) => (
      !item.is_course_intro && (item.course_id || "fundamentos") === (lesson.course_id || "fundamentos")
    )));
    return lesson.is_course_intro ? [lesson, ...courseLessons] : courseLessons;
  }, [allLessons, lesson]);

  const index = sequence.findIndex((item) => item.id === id);
  const previous = index > 0 ? sequence[index - 1] : null;
  const next = index >= 0 && index < sequence.length - 1 ? sequence[index + 1] : null;
  const duration = lesson ? getDuration(lesson) : null;

  const toggleCompleted = async () => {
    if (!lesson?.id) return;
    const next = !completed;
    setSavingProgress(true);
    setProgressError("");
    try {
      const nextStatus = await learningProgress.setCompletedOnServer(lesson.id, next, user?.id);
      setCompleted(next);
      setQuizStatus(nextStatus);
    } catch (progressError) {
      setProgressError(formatApiErrorDetail(progressError.response?.data?.detail) || progressError.message);
    } finally {
      setSavingProgress(false);
    }
  };

  if (loading) {
    return (
      <div
        className="border border-[var(--hc-border)] bg-[var(--hc-surface)]/40 text-sm text-[var(--hc-text-muted)] py-16 text-center"
        data-testid="education-detail-loading"
      >
        Cargando lección...
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="py-16 text-center" data-testid="education-detail-error">
        <div className="hc-overline mb-2">Lección no disponible</div>
        <div className="text-[var(--hc-text-secondary)] text-sm">{error || "No encontrada"}</div>
        <Link
          to="/education"
          className="inline-flex items-center gap-2 mt-6 text-xs tracking-[0.18em] uppercase text-[var(--hc-gold)] hover:underline underline-offset-4"
        >
          <ArrowLeft className="h-3 w-3" /> Volver a educación
        </Link>
      </div>
    );
  }

  return (
    <article data-testid="education-detail" className="max-w-3xl mx-auto hc-enter">
      <Link
        to="/education"
        data-testid="education-detail-back"
        className="inline-flex items-center gap-2 text-xs tracking-[0.18em] uppercase text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] transition-colors"
      >
        <ArrowLeft className="h-3 w-3" /> Educación
      </Link>

      <header className="mt-8">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <span className="hc-overline">
            {lesson.is_course_intro ? "Introducción del curso" : "Lección"} · {lesson.course_title || "Fundamentos"}
          </span>
          {lesson.category && (
            <>
              <span className="h-1 w-1 rounded-full bg-[var(--hc-text-muted)]" />
              <span className="text-[0.7rem] tracking-[0.18em] uppercase text-[var(--hc-text-secondary)]">
                Módulo · {lesson.category}
              </span>
            </>
          )}
          {isAdmin && <StatusBadge status={lesson.status} />}
        </div>

        <h1 className="text-3xl sm:text-4xl lg:text-[2.6rem] font-medium tracking-[-0.02em] leading-[1.12] text-[var(--hc-text)]">
          {lesson.title}
        </h1>

        {lesson.summary && (
          <p className="mt-5 text-lg text-[var(--hc-text-secondary)] leading-relaxed tracking-tight">
            {lesson.summary}
          </p>
        )}

        <div className="mt-6 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 text-xs text-[var(--hc-text-muted)] tracking-tight">
            <span>{formatDate(lesson.published_at || lesson.created_at)}</span>
            {duration && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" strokeWidth={1.5} />
                {duration}
              </span>
            )}
            {lesson.week_count ? <span>{lesson.week_count} semanas</span> : null}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {!lesson.is_course_intro ? (
              <button
                type="button"
                onClick={toggleCompleted}
                disabled={savingProgress}
                data-testid="mark-lesson-complete"
                className={`px-4 py-2 text-xs tracking-[0.18em] uppercase border transition-colors ${
                  completed
                    ? "border-[var(--hc-gold)] bg-[var(--hc-gold-soft)] text-[var(--hc-gold)]"
                    : "border-[var(--hc-border)] text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] hover:border-[var(--hc-gold)]"
                }`}
              >
                {savingProgress ? "Guardando…" : completed ? "Lección completada" : "Marcar como completada"}
              </button>
            ) : null}
            <BookmarkButton contentType="education" contentId={lesson.id} />
          </div>
          {progressError ? <div className="mt-3 text-xs text-[#913f3f]">{progressError}</div> : null}
        </div>

        {lesson.cover_url ? (
          <div className="mt-8 aspect-[16/9] overflow-hidden border border-[var(--hc-border)] bg-[var(--hc-surface)]">
            <img
              src={lesson.cover_url}
              alt={`Portada de ${lesson.title}`}
              className="h-full w-full object-cover"
            />
          </div>
        ) : null}

        {lesson.file_path ? (
          <div className="mt-6 flex items-center justify-between gap-4 border border-[var(--hc-border)] bg-[var(--hc-surface)] px-4 py-4 sm:px-5">
            <div className="min-w-0">
              <div className="hc-overline">Documento de la lección</div>
              <div className="mt-1 truncate text-sm tracking-tight text-[var(--hc-text)]">
                {lesson.file_name || "material-de-la-leccion.pdf"}
              </div>
              {lesson.file_size ? <div className="mt-1 text-xs text-[var(--hc-text-muted)]">PDF · {formatFileSize(lesson.file_size)}</div> : null}
            </div>
            <a
              href={`${API}/education/${lesson.id}/open`}
              target="_blank"
              rel="noopener"
              data-testid="education-pdf-open"
              className="inline-flex shrink-0 items-center gap-2 bg-[var(--hc-ink)] px-4 py-2.5 text-[0.65rem] tracking-[0.16em] uppercase text-white hover:bg-[var(--hc-gold)] transition-colors"
            >
              <FileDown className="h-3.5 w-3.5" strokeWidth={1.5} /> Abrir PDF
            </a>
          </div>
        ) : null}

        <div className="mt-8 hc-gold-rule" />
      </header>

      <div
        className="mt-10 text-[var(--hc-text)] tracking-tight leading-[1.75] text-[1.0625rem]"
        data-testid="lesson-body"
      >
        <RichContent html={lesson.body} />
      </div>

      {!lesson.is_course_intro && quizStatus?.quiz && quizStatus.content_completed ? (
        <section className="mt-10 border border-[var(--hc-gold)]/60 bg-[var(--hc-gold-soft)] p-5 sm:p-7" data-testid="course-quiz-cta">
          <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2 hc-overline"><ShieldQuestion className="h-4 w-4" /> Evaluación final</div>
              <h2 className="mt-2 text-xl font-medium tracking-tight text-[var(--hc-text)]">{quizStatus.quiz.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--hc-text-secondary)]">
                {quizStatus.completed ? `Curso aprobado · mejor puntuación ${quizStatus.best_score}%` : `Completa el quiz con ${quizStatus.quiz.passing_score}% o más para finalizar el curso.`}
              </p>
            </div>
            <Link to={`/courses/${lesson.course_id}/quiz`} className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 bg-[var(--hc-ink)] px-5 py-3 text-xs uppercase tracking-[0.18em] text-white hover:bg-[var(--hc-gold)] sm:w-auto">
              {quizStatus.completed ? "Ver evaluación" : "Iniciar quiz"} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      ) : null}

      <nav className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-4" aria-label="Navegación de lecciones">
        {previous ? (
          <Link
            to={`/education/${previous.id}`}
            className="border border-[var(--hc-border)] bg-[var(--hc-surface)] p-5 hover:bg-[var(--hc-surface-elevated)] transition-colors"
          >
            <div className="hc-overline">Lección anterior</div>
            <div className="mt-2 flex items-center gap-2 text-sm font-medium tracking-tight text-[var(--hc-text)]">
              <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
              {previous.title}
            </div>
          </Link>
        ) : (
          <div className="border border-[var(--hc-border)] bg-[var(--hc-surface)] p-5 opacity-60">
            <div className="hc-overline">Lección anterior</div>
            <div className="mt-2 text-sm text-[var(--hc-text-muted)]">Inicio del módulo</div>
          </div>
        )}

        {next ? (
          <Link
            to={`/education/${next.id}`}
            className="border border-[var(--hc-border)] bg-[var(--hc-surface)] p-5 hover:bg-[var(--hc-surface-elevated)] transition-colors text-left sm:text-right"
          >
            <div className="hc-overline">Siguiente lección</div>
            <div className="mt-2 flex items-center gap-2 sm:justify-end text-sm font-medium tracking-tight text-[var(--hc-text)]">
              {next.title}
              <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
            </div>
          </Link>
        ) : (
          <div className="border border-[var(--hc-border)] bg-[var(--hc-surface)] p-5 opacity-60 sm:text-right">
            <div className="hc-overline">Siguiente lección</div>
            <div className="mt-2 text-sm text-[var(--hc-text-muted)]">Fin del módulo</div>
          </div>
        )}
      </nav>
    </article>
  );
}
