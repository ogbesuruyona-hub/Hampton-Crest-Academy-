import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Clock } from "lucide-react";
import { formatApiErrorDetail } from "../lib/api";
import { formatDate } from "../lib/content";
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
  lesson.estimated_duration_minutes ||
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([cachedApiGet(`/education/${id}`), cachedApiGet("/education")])
      .then(([detail, list]) => {
        if (cancelled) return;
        setLesson(detail);
        setAllLessons(Array.isArray(list) ? list : []);
        setCompleted(learningProgress.isCompleted(detail.id));
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
  }, [id]);

  const sequence = useMemo(() => {
    if (!lesson) return [];
    const sameModule = allLessons.filter((item) => {
      const sameTrack = (item.track || "") === (lesson.track || "");
      const sameCategory = (item.category || "") === (lesson.category || "");
      return sameTrack && sameCategory;
    });
    return sortLessons(sameModule.length ? sameModule : allLessons);
  }, [allLessons, lesson]);

  const index = sequence.findIndex((item) => item.id === id);
  const previous = index > 0 ? sequence[index - 1] : null;
  const next = index >= 0 && index < sequence.length - 1 ? sequence[index + 1] : null;
  const duration = lesson ? getDuration(lesson) : null;

  const toggleCompleted = () => {
    if (!lesson?.id) return;
    const next = !completed;
    learningProgress.setCompleted(lesson.id, next);
    setCompleted(next);
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
          {lesson.track && <span className="hc-overline">Ruta de aprendizaje · {lesson.track}</span>}
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
            <button
              type="button"
              onClick={toggleCompleted}
              data-testid="mark-lesson-complete"
              className={`px-4 py-2 text-xs tracking-[0.18em] uppercase border transition-colors ${
                completed
                  ? "border-[var(--hc-gold)] bg-[var(--hc-gold-soft)] text-[var(--hc-gold)]"
                  : "border-[var(--hc-border)] text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] hover:border-[var(--hc-gold)]"
              }`}
            >
              {completed ? "Lección completada" : "Marcar como completada"}
            </button>
            <BookmarkButton contentType="education" contentId={lesson.id} />
          </div>
        </div>

        <div className="mt-8 hc-gold-rule" />
      </header>

      <div
        className="mt-10 text-[var(--hc-text)] tracking-tight leading-[1.75] text-[1.0625rem]"
        data-testid="lesson-body"
      >
        <RichContent html={lesson.body} />
      </div>

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
