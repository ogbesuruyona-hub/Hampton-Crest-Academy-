import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { EmptyState } from "../components/EmptyState";
import { ContentEditorDialog } from "../components/ContentEditorDialog";
import { AdminAction, AdminInlineActions } from "../components/AdminActions";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import { api, formatApiErrorDetail } from "../lib/api";
import { EDUCATION_TRACKS, formatDate } from "../lib/content";
import { courseIdFromTrack, learningProgress } from "../lib/learningProgress";
import { invalidateCachedApi } from "../lib/resourceCache";
import { ArrowUpRight, BookOpenCheck, GraduationCap, Layers, LockKeyhole, ShieldQuestion } from "lucide-react";
import { toast } from "sonner";
import { RequestError } from "../components/RequestError";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";

const sortLessons = (items) =>
  [...items].sort((a, b) => {
    const ao = Number.isFinite(Number(a.order_index)) ? Number(a.order_index) : 9999;
    const bo = Number.isFinite(Number(b.order_index)) ? Number(b.order_index) : 9999;
    if (ao !== bo) return ao - bo;
    return (a.title || "").localeCompare(b.title || "", "es");
  });

const groupBy = (items, getKey) =>
  items.reduce((acc, item) => {
    const key = getKey(item) || "General";
    acc[key] = acc[key] || [];
    acc[key].push(item);
    return acc;
  }, {});

const LessonRow = ({ lesson, isAdmin, completed, locked, onEdit, onDelete }) => {
  return (
    <article className="grid grid-cols-[72px_minmax(0,1fr)] sm:grid-cols-[88px_minmax(0,1fr)] gap-x-4 gap-y-3 items-start py-5 border-t border-[var(--hc-border)] first:border-t-0">
      <div className={`relative h-14 w-[72px] sm:h-16 sm:w-[88px] overflow-hidden flex items-center justify-center border text-xs ${
        completed
          ? "border-[var(--hc-gold)] bg-[var(--hc-gold-soft)] text-[var(--hc-gold)]"
          : "border-[var(--hc-border)] bg-[var(--hc-bg)] text-[var(--hc-text-secondary)]"
      }`}>
        {lesson.cover_url ? (
          <img src={lesson.cover_url} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : completed ? (
          "✓"
        ) : Number.isFinite(Number(lesson.order_index)) ? (
          Number(lesson.order_index) + 1
        ) : (
          "—"
        )}
        {completed && lesson.cover_url ? (
          <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center bg-[var(--hc-ink)] text-[var(--hc-gold)]">✓</span>
        ) : null}
      </div>
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <h4 className="min-w-0 text-[0.95rem] font-medium leading-snug tracking-tight text-[var(--hc-text)]">
            {lesson.title}
          </h4>
          <div className="hidden sm:flex shrink-0 items-center gap-2">
            {completed && (
              <span className="inline-flex items-center border border-[#7d9b7f]/45 bg-[#edf3ea] px-2 py-1 text-[0.6rem] font-medium tracking-[0.14em] uppercase text-[#426246]">
                ✓ Completada
              </span>
            )}
            {isAdmin && <StatusBadge status={lesson.status} />}
          </div>
        </div>
        <div className="mt-2 flex sm:hidden items-center gap-2 flex-wrap">
          {completed && <span className="text-[0.62rem] font-medium tracking-[0.14em] uppercase text-[#56715a]">✓ Completada</span>}
          {isAdmin && <StatusBadge status={lesson.status} />}
        </div>
        {lesson.summary && (
          <p className="mt-2 max-w-2xl text-xs text-[var(--hc-text-secondary)] leading-relaxed line-clamp-2">
            {lesson.summary}
          </p>
        )}
        <div className="mt-2 flex items-center gap-2 text-[0.68rem] text-[var(--hc-text-muted)] tracking-tight">
          <span>{formatDate(lesson.published_at || lesson.created_at)}</span>
          {lesson.estimated_duration_minutes ? <span>· {lesson.estimated_duration_minutes} min</span> : null}
          {lesson.week_count ? <span>· {lesson.week_count} semanas</span> : null}
        </div>
      </div>
      <div className="col-span-2 sm:col-start-2 sm:col-span-1 flex items-center gap-2 flex-wrap">
        {locked ? (
          <div className="inline-flex min-h-9 items-center gap-1.5 border border-[var(--hc-border)] bg-[var(--hc-bg)] px-3.5 py-2 text-[0.65rem] uppercase tracking-[0.16em] text-[var(--hc-text-muted)]">
            <LockKeyhole className="h-3 w-3" /> Bloqueada
          </div>
        ) : (
          <Link
            to={`/education/${lesson.id}`}
            data-testid={`lesson-link-${lesson.id}`}
            className="inline-flex min-h-9 items-center gap-1.5 bg-[var(--hc-ink)] px-3.5 py-2 text-[0.65rem] tracking-[0.16em] uppercase text-white hover:bg-[var(--hc-gold)] transition-colors whitespace-nowrap"
          >
            Ver lección <ArrowUpRight className="h-3 w-3" strokeWidth={1.5} />
          </Link>
        )}
        {isAdmin && (
          <AdminInlineActions
            testid={`education-admin-${lesson.id}`}
            onEdit={() => onEdit(lesson)}
            onDelete={() => onDelete(lesson)}
          />
        )}
      </div>
    </article>
  );
};

const deleteLesson = async (lesson, onDeleted) => {
    try {
      await api.delete(`/education/${lesson.id}`);
      toast.success("Lección eliminada");
      onDeleted?.();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    }
};

export default function InvestmentEducation() {
  const pageSize = 50;
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [track, setTrack] = useState("");
  const [completedIds, setCompletedIds] = useState(() => learningProgress.getCompletedIds(user?.id));
  const [courseProgress, setCourseProgress] = useState({});
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, page_size: pageSize };
      const { data, headers } = await api.get("/education", { params });
      setItems((current) => sortLessons(page === 1 ? data : [...current, ...data]));
      setTotal(Number(headers["x-total-count"] || data.length));
      try {
        const statuses = await learningProgress.syncWithServer(user?.id);
        setCourseProgress(Object.fromEntries(statuses.map((status) => [status.course.id, status])));
      } catch {
        // Keep the compatible local view if progress synchronization is temporarily unavailable.
      }
      setCompletedIds(learningProgress.getCompletedIds(user?.id));
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoading(false);
    }
  }, [user?.id, page]);

  useEffect(() => {
    load();
  }, [load]);

  const visibleItems = useMemo(
    () => (track ? items.filter((item) => item.track === track) : items),
    [items, track],
  );

  const learningPaths = useMemo(() => {
    const grouped = groupBy(visibleItems, (item) => item.track || "Ruta general");
    return Object.entries(grouped).map(([name, lessons]) => ({
      name,
      courseId: courseIdFromTrack(name),
      progress: courseProgress[courseIdFromTrack(name)],
      lessons: sortLessons(lessons),
      modules: Object.entries(groupBy(sortLessons(lessons), (item) => item.category || "Módulo general")).map(
        ([moduleName, moduleLessons]) => ({
          name: moduleName,
          lessons: sortLessons(moduleLessons),
        }),
      ),
    }));
  }, [courseProgress, visibleItems]);

  const nextLesson = visibleItems.find((item) => !completedIds.has(item.id) && !item.course_locked);
  const selectedPathComplete = visibleItems.length > 0 && visibleItems.every((item) => completedIds.has(item.id));
  const selectedPendingQuiz = learningPaths.find(
    (path) => path.progress?.content_completed && path.progress?.quiz && !path.progress?.completed,
  );

  const openNew = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setEditorOpen(true);
  };

  const refreshEducation = () => {
    invalidateCachedApi("/education");
    if (page === 1) load();
    else setPage(1);
  };

  return (
    <div data-testid="education-page">
      <PageHeader
        overline="Academia · Rutas de aprendizaje"
        title="Educación de Inversión"
        description="Rutas de aprendizaje organizadas por módulo, diseñadas para avanzar con claridad desde fundamentos hasta práctica avanzada."
        actions={
          isAdmin && (
            <AdminAction
              label="Nueva lección"
              testid="new-education-button"
              onClick={openNew}
            />
          )
        }
      />

      <div className="flex items-center gap-1 mb-8 overflow-x-auto" data-testid="education-tracks">
        <button
          onClick={() => setTrack("")}
          data-testid="track-filter-all"
          aria-pressed={!track}
          className={`min-h-11 px-4 py-2 text-xs tracking-[0.14em] uppercase border transition-colors whitespace-nowrap ${
            !track
              ? "border-[var(--hc-gold)] text-[var(--hc-text)] bg-[var(--hc-surface)]"
              : "border-[var(--hc-border)] text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)]"
          }`}
        >
          Todas las rutas
        </button>
        {EDUCATION_TRACKS.map((t) => (
          <button
            key={t}
            onClick={() => setTrack(t)}
            aria-pressed={track === t}
            className={`min-h-11 px-4 py-2 text-xs tracking-[0.14em] uppercase border transition-colors whitespace-nowrap ${
              track === t
                ? "border-[var(--hc-gold)] text-[var(--hc-text)] bg-[var(--hc-surface)]"
                : "border-[var(--hc-border)] text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {nextLesson ? (
        <section className="mb-8 border border-[var(--hc-border)] bg-[var(--hc-surface)] p-6" data-testid="continue-learning">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="hc-overline">Continuar aprendiendo</div>
              <h2 className="mt-2 text-xl font-medium tracking-tight text-[var(--hc-text)]">
                {nextLesson.title}
              </h2>
              <p className="mt-2 text-sm text-[var(--hc-text-secondary)] leading-relaxed">
                {nextLesson.summary || "Retoma la siguiente lección de la ruta seleccionada."}
              </p>
            </div>
            <Link
              to={`/education/${nextLesson.id}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs tracking-[0.18em] uppercase bg-[var(--hc-platinum)] text-[var(--hc-bg)] hover:bg-white transition-colors"
            >
              Ver lección <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
            </Link>
          </div>
        </section>
      ) : selectedPendingQuiz ? (
        <section className="mb-8 border border-[var(--hc-gold)] bg-[var(--hc-gold-soft)] p-6" data-testid="learning-quiz-pending">
          <div className="hc-overline">Contenido completado</div>
          <h2 className="mt-2 text-xl font-medium tracking-tight text-[var(--hc-text)]">
            La evaluación de {selectedPendingQuiz.name} está pendiente.
          </h2>
          <p className="mt-2 text-sm text-[var(--hc-text-secondary)] leading-relaxed">
            Aprueba el quiz para completar el curso y desbloquear la siguiente ruta.
          </p>
        </section>
      ) : selectedPathComplete ? (
        <section className="mb-8 border border-[var(--hc-border)] bg-[var(--hc-surface)] p-6" data-testid="learning-complete">
          <div className="hc-overline">Ruta completada</div>
          <h2 className="mt-2 text-xl font-medium tracking-tight text-[var(--hc-text)]">
            Has completado todas las lecciones disponibles.
          </h2>
          <p className="mt-2 text-sm text-[var(--hc-text-secondary)] leading-relaxed">
            Cuando Hampton Crest publique nuevas lecciones, aparecerán aquí para continuar tu avance.
          </p>
        </section>
      ) : null}

      {loading ? (
        <div className="border border-[var(--hc-border)] bg-[var(--hc-surface)]/40 text-sm text-[var(--hc-text-muted)] py-12 text-center">
          Cargando rutas de aprendizaje...
        </div>
      ) : error ? (
        <RequestError error={error} onRetry={load} />
      ) : visibleItems.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          overline="Academia"
          title="Currículum en preparación"
          description={
            isAdmin
              ? "Usa «Nueva lección» para publicar contenido de la academia."
              : "Las rutas de aprendizaje aparecerán aquí cuando el equipo publique las primeras lecciones."
          }
        />
      ) : (
        <div className="space-y-10" data-testid="learning-paths">
          {learningPaths.map((path) => (
            <section key={path.name} data-testid={`learning-path-${path.name}`}>
              <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
                <div className="flex items-center gap-3">
                <div className="h-9 w-9 flex items-center justify-center border border-[var(--hc-border)] bg-[var(--hc-surface)]">
                  <BookOpenCheck className="h-[18px] w-[18px] text-[var(--hc-platinum)]" strokeWidth={1.5} />
                </div>
                <div>
                  <div className="hc-overline">Ruta de aprendizaje</div>
                  <h2 className="text-xl font-medium tracking-tight text-[var(--hc-text)]">
                    {path.name}
                  </h2>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-1.5 w-40 bg-[var(--hc-bg)] border border-[var(--hc-border)]">
                      <div
                        className="h-full bg-[var(--hc-gold)]"
                        style={{ width: `${learningProgress.getPercent(path.lessons, user?.id)}%` }}
                      />
                    </div>
                    <span className="text-[0.7rem] tracking-[0.16em] uppercase text-[var(--hc-text-muted)]">
                      {learningProgress.getPercent(path.lessons, user?.id)}% {path.progress?.content_completed && path.progress?.quiz && !path.progress?.completed ? "contenido · evaluación pendiente" : "completado"}
                    </span>
                  </div>
                </div>
                </div>
                {path.progress?.locked ? (
                  <div className="inline-flex items-center gap-2 border border-[var(--hc-border)] bg-[var(--hc-bg)] px-4 py-2 text-xs uppercase tracking-[0.18em] text-[var(--hc-text-muted)]">
                    <LockKeyhole className="h-3.5 w-3.5" /> Curso bloqueado
                  </div>
                ) : path.lessons.find((lesson) => !completedIds.has(lesson.id)) ? (
                  <Link
                    to={`/education/${path.lessons.find((lesson) => !completedIds.has(lesson.id)).id}`}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs tracking-[0.18em] uppercase border border-[var(--hc-border)] text-[var(--hc-gold)] hover:border-[var(--hc-gold)] transition-colors"
                  >
                    Continuar aprendiendo <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </Link>
                ) : path.progress?.quiz ? (
                  <Link
                    to={`/courses/${path.courseId}/quiz`}
                    className={`inline-flex items-center gap-2 border px-4 py-2 text-xs uppercase tracking-[0.18em] ${path.progress.completed ? "border-[#7d9b7f]/50 bg-[#edf3ea] text-[#426246]" : "border-[var(--hc-gold)] bg-[var(--hc-gold-soft)] text-[var(--hc-gold)]"}`}
                  >
                    <ShieldQuestion className="h-3.5 w-3.5" /> {path.progress.completed ? "Curso completado" : "Iniciar evaluación"}
                  </Link>
                ) : (
                  <div className="px-4 py-2 text-xs tracking-[0.18em] uppercase border border-[var(--hc-gold)] text-[var(--hc-gold)] bg-[var(--hc-gold-soft)]">
                    Ruta completada
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 min-[1700px]:grid-cols-2 gap-4">
                {path.modules.map((module) => (
                  <div key={`${path.name}-${module.name}`} className="border border-[var(--hc-border)] bg-[var(--hc-surface)] px-4 py-5 sm:p-6">
                    <div className="flex items-start justify-between gap-3 border-b border-[var(--hc-border)] pb-4">
                      <div>
                        <div className="hc-overline">Módulo</div>
                        <h3 className="mt-1 text-base font-medium tracking-tight text-[var(--hc-text)]">
                          {module.name}
                        </h3>
                      </div>
                      <div className="inline-flex items-center gap-1.5 text-[0.7rem] tracking-[0.16em] uppercase text-[var(--hc-text-muted)]">
                        <Layers className="h-3.5 w-3.5" strokeWidth={1.5} />
                        Lecciones · {module.lessons.length}
                      </div>
                    </div>

                    <div data-testid={`module-lessons-${module.name}`}>
                      {module.lessons.map((lesson) => (
                        <LessonRow
                          key={lesson.id}
                          lesson={lesson}
                          isAdmin={isAdmin}
                          completed={completedIds.has(lesson.id)}
                          locked={Boolean(path.progress?.locked || lesson.course_locked)}
                          onEdit={openEdit}
                          onDelete={setDeleteTarget}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {!loading && !error && items.length < total ? (
        <div className="mt-6 text-center">
          <button type="button" onClick={() => setPage((value) => value + 1)} className="min-h-11 border border-[var(--hc-border)] px-5 text-xs uppercase tracking-[0.14em] hover:border-[var(--hc-gold)]">Cargar más lecciones</button>
        </div>
      ) : null}

      <ContentEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        contentType="education"
        initial={editing}
        onSaved={refreshEducation}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-[var(--hc-surface)] border-[var(--hc-border)] text-[var(--hc-text)] rounded-none">
          <AlertDialogHeader>
            <AlertDialogTitle className="tracking-tight">¿Eliminar esta lección?</AlertDialogTitle>
            <AlertDialogDescription className="text-[var(--hc-text-secondary)]">
              {deleteTarget?.title ? `«${deleteTarget.title}» se eliminará de la ruta de aprendizaje.` : "Esta acción no se puede deshacer."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-[var(--hc-border)] text-[var(--hc-text)] hover:bg-[var(--hc-surface-elevated)] rounded-none">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const target = deleteTarget;
                setDeleteTarget(null);
                if (target) await deleteLesson(target, refreshEducation);
              }}
              className="bg-[#7A2424] text-[var(--hc-text)] hover:bg-[#9a2e2e] rounded-none"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
