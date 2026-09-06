import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, BookOpen, Check, ChevronDown, Clock3, GraduationCap, LockKeyhole, ShieldQuestion, Sparkles, Target, TimerReset } from "lucide-react";
import { AdminAction, AdminInlineActions } from "../components/AdminActions";
import { ContentEditorDialog } from "../components/ContentEditorDialog";
import { EmptyState } from "../components/EmptyState";
import { RequestError } from "../components/RequestError";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import { api, formatApiErrorDetail } from "../lib/api";
import { learningProgress } from "../lib/learningProgress";
import { invalidateCachedApi } from "../lib/resourceCache";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../components/ui/alert-dialog";

const PAGE_SIZE = 50;

const sortLessons = (items) => [...items].sort((a, b) => {
  const ao = Number.isFinite(Number(a.order_index)) ? Number(a.order_index) : 9999;
  const bo = Number.isFinite(Number(b.order_index)) ? Number(b.order_index) : 9999;
  if (ao !== bo) return ao - bo;
  return (a.title || "").localeCompare(b.title || "", "es");
});

const formatMinutes = (minutes) => {
  const total = Math.max(0, Number(minutes) || 0);
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const remainder = total % 60;
  return remainder ? `${hours} h ${remainder} min` : `${hours} h`;
};

const deleteResource = async (resource, onDeleted) => {
  try {
    await api.delete(`/education/${resource.id}`);
    toast.success(resource.is_course_intro ? "Introducción eliminada" : "Lección eliminada");
    onDeleted?.();
  } catch (error) {
    toast.error(formatApiErrorDetail(error.response?.data?.detail) || error.message);
  }
};

const ProgressBar = ({ value, className = "" }) => (
  <div className={`h-1.5 overflow-hidden rounded-full bg-[#e7dfd1] ${className}`} aria-label={`${value}% completado`}>
    <div className="h-full rounded-full bg-gradient-to-r from-[#b78d32] to-[#d2af5d] transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
  </div>
);

const IntroductionCard = ({ introduction, isAdmin, onEdit, onDelete }) => {
  if (!introduction) return null;
  return (
    <section className="mb-7 rounded-[1.4rem] border border-[var(--hc-border)] bg-[var(--hc-surface)] px-5 py-5 shadow-[0_18px_45px_rgba(28,38,47,0.06)] sm:px-7" data-testid="course-introduction-card">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--hc-gold-soft)] text-[#9b7628]"><Sparkles className="h-5 w-5" strokeWidth={1.6} /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><div className="hc-overline text-[#9b7628]">Antes de comenzar</div><h2 className="mt-1 font-[Georgia] text-xl text-[var(--hc-text)] sm:text-2xl">{introduction.title}</h2></div>
            {isAdmin ? <StatusBadge status={introduction.status} /> : null}
          </div>
          {introduction.summary ? <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--hc-text-secondary)]">{introduction.summary}</p> : null}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link to={`/education/${introduction.id}`} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--hc-border)] px-4 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[var(--hc-text)] hover:border-[var(--hc-gold)]">Ver introducción <ArrowUpRight className="h-3.5 w-3.5" /></Link>
            {isAdmin ? <AdminInlineActions testid={`education-admin-${introduction.id}`} onEdit={() => onEdit(introduction)} onDelete={() => onDelete(introduction)} /> : null}
          </div>
        </div>
      </div>
    </section>
  );
};

const LessonRow = ({ lesson, index, completed, isNext, locked, isAdmin, onEdit, onDelete }) => (
  <div className="border-t border-[var(--hc-border-subtle)] first:border-t-0" data-testid={`course-lesson-${lesson.id}`}>
    <div className="flex items-start gap-3 px-5 py-5 sm:gap-4 sm:px-7">
      <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${completed ? "border-[#bcd8ca] bg-[#e3f1ea] text-[#3f7960]" : isNext ? "border-[#c6a34d] bg-[#173b61] text-[#f2d06e] shadow-[inset_0_0_0_5px_#f6f0e5]" : locked ? "border-[#ded8cd] bg-[#f4f0e8] text-[#aaa398]" : "border-[#cfc5b4] bg-transparent text-[#9f978b]"}`}>
        {completed ? <Check className="h-4 w-4" strokeWidth={2} /> : locked ? <LockKeyhole className="h-3.5 w-3.5" /> : <span className="text-[0.65rem] font-semibold">{String(index + 1).padStart(2, "0")}</span>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-[0.95rem] font-semibold leading-snug text-[#183653] sm:text-base">{lesson.title}</h3>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.65rem] uppercase tracking-[0.13em] text-[var(--hc-text-muted)]">
              <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> {lesson.estimated_duration_minutes || 15} min</span>
              {completed ? <span className="text-[#54806a]">· Completada</span> : null}
              {isNext ? <span className="text-[#a37d2d]">· Tu siguiente paso</span> : null}
              {isAdmin && lesson.status === "draft" ? <StatusBadge status={lesson.status} /> : null}
            </div>
          </div>
          {isNext ? <span className="rounded-full bg-[#efe5cd] px-3 py-1 text-[0.58rem] font-semibold uppercase tracking-[0.15em] text-[#9a7528]">Siguiente</span> : null}
        </div>
        {lesson.summary ? <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[var(--hc-text-secondary)]">{lesson.summary}</p> : null}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {locked ? <span className="inline-flex min-h-9 items-center gap-1.5 text-[0.65rem] uppercase tracking-[0.14em] text-[var(--hc-text-muted)]"><LockKeyhole className="h-3.5 w-3.5" /> Lección bloqueada</span> : <Link to={`/education/${lesson.id}`} className="inline-flex min-h-9 items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-[#173b61] hover:text-[#a47d2d]">Entrar a la lección <ArrowRight className="h-3.5 w-3.5" /></Link>}
          {isAdmin ? <AdminInlineActions testid={`education-admin-${lesson.id}`} onEdit={() => onEdit(lesson)} onDelete={() => onDelete(lesson)} /> : null}
        </div>
      </div>
    </div>
  </div>
);

const CourseCard = ({ course, number, completedIds, nextLessonId, isAdmin, onEdit, onDelete }) => {
  const [open, setOpen] = useState(number === 1);
  const completedCount = course.lessons.filter((lesson) => completedIds.has(lesson.id)).length;
  const percentage = course.lessons.length ? Math.round((completedCount / course.lessons.length) * 100) : 0;
  const totalMinutes = course.lessons.reduce((sum, lesson) => sum + (Number(lesson.estimated_duration_minutes) || 15), 0);
  const locked = Boolean(course.progress?.locked || course.lessons.every((lesson) => lesson.course_locked));
  return (
    <section className="overflow-hidden rounded-[1.45rem] border border-[var(--hc-border)] bg-[var(--hc-surface)] shadow-[0_20px_50px_rgba(28,38,47,0.065)]" data-testid={`learning-course-${course.id}`}>
      <button type="button" onClick={() => setOpen((value) => !value)} className="grid w-full grid-cols-[64px_minmax(0,1fr)_42px] items-center gap-4 px-5 py-6 text-left sm:grid-cols-[78px_minmax(0,1fr)_46px] sm:px-7" aria-expanded={open}>
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--hc-border)] bg-[#f6f0e6] font-mono text-sm tracking-[0.18em] text-[#173b61] sm:h-[72px] sm:w-[72px]"><span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-[var(--hc-gold)]" />{String(number).padStart(2, "0")}</div>
        <div className="min-w-0">
          <div className="text-[0.62rem] font-semibold uppercase tracking-[0.19em] text-[#9d8353]">Curso de inversión</div>
          <div className="mt-1 text-[0.63rem] uppercase tracking-[0.16em] text-[var(--hc-text-muted)]">{course.lessons.length} lecciones · {formatMinutes(totalMinutes)}</div>
          <h2 className="mt-2 truncate font-[Georgia] text-2xl leading-none text-[#173653] sm:text-3xl">{course.title}</h2>
          <div className="mt-4 flex items-center gap-3"><ProgressBar value={percentage} className="max-w-[270px] flex-1" /><span className="text-xs text-[var(--hc-text-muted)]">{percentage}%</span></div>
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--hc-border)] text-[#173b61]"><ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} /></span>
      </button>
      {open ? <div className="border-t border-[var(--hc-border)]" data-testid={`course-lessons-${course.id}`}>{course.lessons.map((lesson, index) => <LessonRow key={lesson.id} lesson={lesson} index={index} completed={completedIds.has(lesson.id)} isNext={lesson.id === nextLessonId} locked={Boolean(locked || lesson.course_locked)} isAdmin={isAdmin} onEdit={onEdit} onDelete={onDelete} />)}</div> : null}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--hc-border)] px-5 py-4 text-[0.62rem] uppercase tracking-[0.14em] text-[var(--hc-text-muted)] sm:px-7">
        <span>{completedCount} de {course.lessons.length} completadas</span>
        {course.progress?.quiz && course.progress?.content_completed ? <Link to={`/courses/${course.id}/quiz`} className="inline-flex items-center gap-1.5 font-semibold text-[#173b61]"><ShieldQuestion className="h-3.5 w-3.5" /> {course.progress.completed ? "Ver evaluación" : "Iniciar evaluación"} <ArrowRight className="h-3.5 w-3.5" /></Link> : <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 font-semibold text-[#173b61]">Abrir curso <ArrowRight className="h-3.5 w-3.5" /></button>}
      </footer>
    </section>
  );
};

export default function InvestmentEducation() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [courseProgress, setCourseProgress] = useState({});
  const [completedIds, setCompletedIds] = useState(() => learningProgress.getCompletedIds(user?.id));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, headers } = await api.get("/education", { params: { page, page_size: PAGE_SIZE } });
      setItems((current) => sortLessons(page === 1 ? data : [...current, ...data]));
      setTotal(Number(headers["x-total-count"] || data.length));
      try {
        const statuses = await learningProgress.syncWithServer(user?.id);
        setCourseProgress(Object.fromEntries(statuses.map((status) => [status.course.id, status])));
      } catch {
        // Curriculum remains usable if progress is briefly unavailable.
      }
      setCompletedIds(learningProgress.getCompletedIds(user?.id));
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoading(false);
    }
  }, [page, user?.id]);

  useEffect(() => { load(); }, [load]);

  const introduction = items.find((item) => item.is_course_intro) || null;
  const lessons = useMemo(() => sortLessons(items.filter((item) => !item.is_course_intro)), [items]);
  const courses = useMemo(() => {
    const grouped = lessons.reduce((result, lesson) => {
      const id = lesson.course_id || "fundamentos";
      result[id] = result[id] || [];
      result[id].push(lesson);
      return result;
    }, {});
    return Object.entries(grouped).map(([id, courseLessons]) => ({ id, title: courseLessons[0]?.course_title || courseProgress[id]?.course?.title || "Curso de inversión", lessons: sortLessons(courseLessons), progress: courseProgress[id] }));
  }, [courseProgress, lessons]);

  const nextLesson = lessons.find((lesson) => !completedIds.has(lesson.id) && !lesson.course_locked) || null;
  const completedCount = lessons.filter((lesson) => completedIds.has(lesson.id)).length;
  const progressPercent = lessons.length ? Math.round((completedCount / lessons.length) * 100) : 0;
  const completedMinutes = lessons.filter((lesson) => completedIds.has(lesson.id)).reduce((sum, lesson) => sum + (Number(lesson.estimated_duration_minutes) || 15), 0);
  const openNew = () => { setEditing(null); setEditorOpen(true); };
  const openEdit = (item) => { setEditing(item); setEditorOpen(true); };
  const refreshEducation = () => { invalidateCachedApi("/education"); if (page === 1) load(); else setPage(1); };

  if (loading && items.length === 0) return <div data-testid="education-page" className="mx-auto max-w-6xl space-y-5"><div className="h-40 animate-pulse rounded-[1.5rem] bg-[var(--hc-surface)]" /><div className="h-64 animate-pulse rounded-[1.5rem] bg-[var(--hc-surface)]" /></div>;

  return (
    <div data-testid="education-page" className="mx-auto max-w-6xl pb-12">
      <header className="mb-9 hc-enter">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl"><div className="flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#a17c2f]"><Sparkles className="h-4 w-4" /> Academia · Panel de estudio</div><h1 className="mt-3 font-[Georgia] text-[2.35rem] font-normal leading-[1.02] tracking-[-0.025em] text-[#183653] sm:text-5xl">Educación de Inversión</h1><p className="mt-5 max-w-2xl text-base leading-relaxed text-[var(--hc-text-secondary)] sm:text-lg">Un itinerario pensado para convertir curiosidad en criterio. Avanza a tu ritmo, vuelve a las ideas importantes y construye una mirada propia.</p></div>
          {isAdmin ? <AdminAction label="Nueva lección" testid="new-education-button" onClick={openNew} /> : null}
        </div>
        {nextLesson ? <Link to={`/education/${nextLesson.id}`} className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-lg bg-[#173b61] px-5 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-white shadow-[0_14px_30px_rgba(23,59,97,0.18)] hover:bg-[#0f2e4d]">Continuar aprendiendo <ArrowUpRight className="h-4 w-4" /></Link> : null}
      </header>

      {error ? <RequestError error={error} onRetry={load} /> : null}
      {!error && items.length === 0 ? <EmptyState icon={GraduationCap} overline="Academia" title="Currículum en preparación" description={isAdmin ? "Usa «Nueva lección» para publicar contenido de la academia." : "El curso aparecerá aquí cuando el equipo publique las primeras lecciones."} /> : null}

      {!error && items.length > 0 ? <>
        {nextLesson ? <Link to={`/education/${nextLesson.id}`} className="relative mb-6 block overflow-hidden rounded-[1.65rem] bg-[#173b61] px-7 py-8 text-white shadow-[0_25px_55px_rgba(16,44,72,0.18)] sm:px-9 sm:py-10" data-testid="next-lesson-card"><div className="pointer-events-none absolute -right-12 -top-24 h-64 w-64 rounded-full border border-white/10" /><div className="pointer-events-none absolute -right-4 -top-16 h-48 w-48 rounded-full border border-white/10" /><div className="relative max-w-2xl"><div className="text-[0.63rem] font-semibold uppercase tracking-[0.2em] text-[#e0bf69]">Tu siguiente lección</div><h2 className="mt-4 max-w-xl font-[Georgia] text-3xl font-normal leading-[1.03] sm:text-4xl">{nextLesson.title}</h2><div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-white/65"><Clock3 className="h-4 w-4" /> {nextLesson.estimated_duration_minutes || 15} min · {nextLesson.course_title || "Fundamentos"}</div><div className="mt-8 inline-flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#f0d483]">Entrar a la lección <ArrowRight className="h-4 w-4" /></div></div></Link> : null}

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <section className="rounded-[1.4rem] border border-[var(--hc-border)] bg-[var(--hc-surface)] p-7 shadow-[0_18px_45px_rgba(28,38,47,0.055)]" data-testid="education-progress-card"><div className="flex items-center justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--hc-gold-soft)] text-[#9b7628]"><Target className="h-5 w-5" /></span><span className="text-xs text-[var(--hc-text-muted)]">{String(completedCount).padStart(2, "0")} / {String(lessons.length).padStart(2, "0")}</span></div><div className="mt-8 font-[Georgia] text-4xl text-[#173b61]">{progressPercent}%</div><div className="mt-2 text-[0.65rem] uppercase tracking-[0.18em] text-[var(--hc-text-muted)]">Curso completado</div><ProgressBar value={progressPercent} className="mt-6" /></section>
          <section className="rounded-[1.4rem] border border-[var(--hc-border)] bg-[var(--hc-surface)] p-7 shadow-[0_18px_45px_rgba(28,38,47,0.055)]" data-testid="education-time-card"><div className="flex items-center justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e7f1ed] text-[#4f806e]"><TimerReset className="h-5 w-5" /></span><span className="text-[var(--hc-text-muted)]">•••</span></div><div className="mt-8 font-[Georgia] text-4xl text-[#173b61]">{formatMinutes(completedMinutes)}</div><div className="mt-2 text-[0.65rem] uppercase tracking-[0.18em] text-[var(--hc-text-muted)]">Contenido completado</div><div className="mt-6 flex items-center gap-2 text-xs text-[#4f806e]"><BookOpen className="h-4 w-4" /> {completedCount} {completedCount === 1 ? "lección estudiada" : "lecciones estudiadas"}</div></section>
        </div>

        <IntroductionCard introduction={introduction} isAdmin={isAdmin} onEdit={openEdit} onDelete={setDeleteTarget} />
        <section className="mb-6"><div className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[#9d8353]">Mapa de aprendizaje</div><h2 className="mt-3 font-[Georgia] text-3xl font-normal text-[#173b61] sm:text-4xl">Tu curso, paso a paso.</h2><p className="mt-2 text-sm leading-relaxed text-[var(--hc-text-secondary)]">La introducción orienta el recorrido; las lecciones siguientes son las que construyen tu progreso.</p></section>
        <div className="space-y-5" data-testid="learning-courses">{courses.map((course, index) => <CourseCard key={course.id} course={course} number={index + 1} completedIds={completedIds} nextLessonId={nextLesson?.id} isAdmin={isAdmin} onEdit={openEdit} onDelete={setDeleteTarget} />)}</div>
        {!loading && items.length < total ? <div className="mt-6 text-center"><button type="button" onClick={() => setPage((value) => value + 1)} className="min-h-11 rounded-full border border-[var(--hc-border)] px-5 text-xs uppercase tracking-[0.14em] hover:border-[var(--hc-gold)]">Cargar más lecciones</button></div> : null}
      </> : null}

      <ContentEditorDialog open={editorOpen} onOpenChange={setEditorOpen} contentType="education" initial={editing} onSaved={refreshEducation} />
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}><AlertDialogContent className="rounded-none border-[var(--hc-border)] bg-[var(--hc-surface)] text-[var(--hc-text)]"><AlertDialogHeader><AlertDialogTitle>¿Eliminar este contenido?</AlertDialogTitle><AlertDialogDescription className="text-[var(--hc-text-secondary)]">{deleteTarget?.title ? `«${deleteTarget.title}» se eliminará del curso.` : "Esta acción no se puede deshacer."}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="rounded-none border-[var(--hc-border)] bg-transparent">Cancelar</AlertDialogCancel><AlertDialogAction onClick={async () => { const target = deleteTarget; setDeleteTarget(null); if (target) await deleteResource(target, refreshEducation); }} className="rounded-none bg-[#7A2424] text-white hover:bg-[#9a2e2e]">Eliminar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}
