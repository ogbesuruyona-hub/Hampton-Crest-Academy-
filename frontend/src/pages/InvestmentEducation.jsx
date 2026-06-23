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
import { learningProgress } from "../lib/learningProgress";
import { cachedApiGet, invalidateCachedApi } from "../lib/resourceCache";
import { ArrowUpRight, BookOpenCheck, GraduationCap, Layers } from "lucide-react";
import { toast } from "sonner";
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

const LessonRow = ({ lesson, isAdmin, completed, onEdit, onDelete }) => {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-[48px_1fr_auto] gap-4 items-start py-4 border-t border-[var(--hc-border)] first:border-t-0 ${completed ? "opacity-75" : ""}`}>
      <div className={`h-9 w-9 flex items-center justify-center border text-xs ${
        completed
          ? "border-[var(--hc-gold)] bg-[var(--hc-gold-soft)] text-[var(--hc-gold)]"
          : "border-[var(--hc-border)] bg-[var(--hc-bg)] text-[var(--hc-text-secondary)]"
      }`}>
        {completed ? "✓" : Number.isFinite(Number(lesson.order_index)) ? Number(lesson.order_index) + 1 : "—"}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className={`text-sm font-medium tracking-tight text-[var(--hc-text)] ${completed ? "line-through decoration-[var(--hc-gold)]/70" : ""}`}>
            {lesson.title}
          </h4>
          {completed && (
            <span className="text-[0.65rem] tracking-[0.16em] uppercase text-[var(--hc-gold)]">
              Completada
            </span>
          )}
          {isAdmin && <StatusBadge status={lesson.status} />}
        </div>
        {lesson.summary && (
          <p className="mt-1 text-xs text-[var(--hc-text-secondary)] leading-relaxed line-clamp-2">
            {lesson.summary}
          </p>
        )}
        <div className="mt-2 flex items-center gap-2 text-[0.7rem] text-[var(--hc-text-muted)] tracking-tight">
          <span>{formatDate(lesson.published_at || lesson.created_at)}</span>
          {lesson.week_count ? <span>· {lesson.week_count} semanas</span> : null}
        </div>
      </div>
      <div className="flex items-center gap-2 sm:justify-end flex-wrap">
        {isAdmin && (
          <AdminInlineActions
            testid={`education-admin-${lesson.id}`}
            onEdit={() => onEdit(lesson)}
            onDelete={() => onDelete(lesson)}
          />
        )}
        <Link
          to={`/education/${lesson.id}`}
          data-testid={`lesson-link-${lesson.id}`}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-[0.65rem] tracking-[0.18em] uppercase border border-[var(--hc-border)] text-[var(--hc-gold)] hover:border-[var(--hc-gold)] transition-colors whitespace-nowrap"
        >
          Ver lección <ArrowUpRight className="h-3 w-3" strokeWidth={1.5} />
        </Link>
      </div>
    </div>
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
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [track, setTrack] = useState("");
  const [completedIds, setCompletedIds] = useState(() => learningProgress.getCompletedIds());
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await cachedApiGet("/education");
      setItems(sortLessons(data));
      setCompletedIds(learningProgress.getCompletedIds());
    } finally {
      setLoading(false);
    }
  }, []);

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
      lessons: sortLessons(lessons),
      modules: Object.entries(groupBy(sortLessons(lessons), (item) => item.category || "Módulo general")).map(
        ([moduleName, moduleLessons]) => ({
          name: moduleName,
          lessons: sortLessons(moduleLessons),
        }),
      ),
    }));
  }, [visibleItems]);

  const nextLesson = visibleItems.find((item) => !completedIds.has(item.id));
  const selectedPathComplete = visibleItems.length > 0 && !nextLesson;

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
    load();
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
          className={`px-4 py-2 text-xs tracking-[0.14em] uppercase border transition-colors whitespace-nowrap ${
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
            className={`px-4 py-2 text-xs tracking-[0.14em] uppercase border transition-colors whitespace-nowrap ${
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
                        style={{ width: `${learningProgress.getPercent(path.lessons)}%` }}
                      />
                    </div>
                    <span className="text-[0.7rem] tracking-[0.16em] uppercase text-[var(--hc-text-muted)]">
                      {learningProgress.getPercent(path.lessons)}% completado
                    </span>
                  </div>
                </div>
                </div>
                {path.lessons.find((lesson) => !completedIds.has(lesson.id)) ? (
                  <Link
                    to={`/education/${path.lessons.find((lesson) => !completedIds.has(lesson.id)).id}`}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs tracking-[0.18em] uppercase border border-[var(--hc-border)] text-[var(--hc-gold)] hover:border-[var(--hc-gold)] transition-colors"
                  >
                    Continuar aprendiendo <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </Link>
                ) : (
                  <div className="px-4 py-2 text-xs tracking-[0.18em] uppercase border border-[var(--hc-gold)] text-[var(--hc-gold)] bg-[var(--hc-gold-soft)]">
                    Ruta completada
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {path.modules.map((module) => (
                  <div key={`${path.name}-${module.name}`} className="border border-[var(--hc-border)] bg-[var(--hc-surface)] p-6">
                    <div className="flex items-start justify-between gap-3 mb-4">
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
