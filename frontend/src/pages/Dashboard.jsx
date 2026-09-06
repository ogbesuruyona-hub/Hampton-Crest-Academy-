import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import { EmptyState } from "../components/EmptyState";
import { useAuth } from "../context/AuthContext";
import { formatDate, formatPeriod } from "../lib/content";
import { courseIdFromTrack, learningProgress } from "../lib/learningProgress";
import { cachedApiGet, primeCachedApi } from "../lib/resourceCache";
import { RequestError } from "../components/RequestError";
import {
  ArrowUpRight,
  BookOpen,
  FileSearch,
  GraduationCap,
  FileText,
  BarChart3,
  CalendarClock,
  ShieldQuestion,
} from "lucide-react";

const KPI = ({ label, value, sub, testid }) => (
  <div
    data-testid={testid}
    className="bg-[var(--hc-surface)] border border-[var(--hc-border)] p-6 hc-enter"
  >
    <div className="hc-overline">{label}</div>
    <div className="mt-3 text-3xl sm:text-[2rem] font-medium tracking-[-0.02em] text-[var(--hc-text)]">
      {value}
    </div>
    <div className="mt-2 text-xs text-[var(--hc-text-muted)] tracking-tight">{sub}</div>
  </div>
);

const FOCUS = [
  { icon: BookOpen, label: "Libros", to: "/books" },
  { icon: FileSearch, label: "Investigación", to: "/research" },
  { icon: GraduationCap, label: "Educación", to: "/education" },
  { icon: FileText, label: "Reportes Mensuales", to: "/reports" },
  { icon: BarChart3, label: "Análisis de compañías", to: "/companies" },
];

const sortLessons = (items) =>
  [...items].sort((a, b) => {
    const ao = Number.isFinite(Number(a.order_index)) ? Number(a.order_index) : 9999;
    const bo = Number.isFinite(Number(b.order_index)) ? Number(b.order_index) : 9999;
    if (ao !== bo) return ao - bo;
    return (a.title || "").localeCompare(b.title || "", "es");
  });

export default function Dashboard() {
  const { user } = useAuth();
  const first = (user?.name || "Miembro").split(" ")[0];

  const [counts, setCounts] = useState({
    books: 0,
    research: 0,
    education: 0,
    reports: 0,
    companies: 0,
  });
  const [latestBooks, setLatestBooks] = useState([]);
  const [latestResearch, setLatestResearch] = useState([]);
  const [educationLessons, setEducationLessons] = useState([]);
  const [latestReport, setLatestReport] = useState(null);
  const [completedIds, setCompletedIds] = useState(() => learningProgress.getCompletedIds(user?.id));
  const [courseStatuses, setCourseStatuses] = useState([]);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [progressLoading, setProgressLoading] = useState(true);
  const [summaryError, setSummaryError] = useState(null);
  const [progressError, setProgressError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const prepareBookDetail = (book) => {
    primeCachedApi(`/books/${book.id}`, book);
    import("./BookDetail");
  };

  useEffect(() => {
    let cancel = false;
    setSummaryLoading(true);
    setProgressLoading(true);
    setSummaryError(null);
    setProgressError(null);

    cachedApiGet("/dashboard-summary", {}, { ttl: 60_000, force: reloadKey > 0 })
      .then((summary) => {
        if (cancel) return;
        setCounts(summary.counts);
        setLatestBooks(summary.latest_books || []);
        setLatestResearch(summary.latest_research || []);
        setEducationLessons(summary.education_lessons || []);
        setLatestReport(summary.latest_report || null);
      })
      .catch((error) => {
        if (!cancel) setSummaryError(error);
      })
      .finally(() => {
        if (!cancel) setSummaryLoading(false);
      });

    learningProgress.syncWithServer(user?.id)
      .then((progress) => {
        if (cancel) return;
        setCourseStatuses(progress);
        setCompletedIds(learningProgress.getCompletedIds(user?.id));
      })
      .catch((error) => {
        if (!cancel) setProgressError(error);
      })
      .finally(() => {
        if (!cancel) setProgressLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [user?.id, reloadKey]);

  const today = new Date().toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const orderedLessons = sortLessons(educationLessons);
  const completedLessons = orderedLessons.filter((lesson) => completedIds.has(lesson.id)).length;
  const progressPercent = orderedLessons.length ? Math.round((completedLessons / orderedLessons.length) * 100) : 0;
  const lockedCourseIds = new Set(courseStatuses.filter((course) => course.locked).map((course) => course.course.id));
  const nextLesson = orderedLessons.find((lesson) => !completedIds.has(lesson.id) && !lockedCourseIds.has(courseIdFromTrack(lesson.track)));
  const allLessonsComplete = orderedLessons.length > 0 && !nextLesson;
  const pendingQuiz = courseStatuses.find((course) => course.content_completed && course.quiz && !course.completed);
  const availableCourseStatuses = courseStatuses.filter((course) => course.total_lessons > 0);
  const allAvailableCoursesComplete =
    availableCourseStatuses.length > 0 && availableCourseStatuses.every((course) => course.completed);

  return (
    <div data-testid="dashboard-page">
      <PageHeader
        overline={today}
        title={`Bienvenido, ${first}.`}
        description="Tu mesa de miembro para libros curados, investigación interna, educación e inteligencia mensual."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-10">
        <KPI
          label="Libros"
          value={summaryLoading ? "…" : counts.books || "—"}
          sub={counts.books ? "En la biblioteca" : "Curación en proceso"}
          testid="kpi-books"
        />
        <KPI
          label="Investigación"
          value={summaryLoading ? "…" : counts.research || "—"}
          sub={counts.research ? "Notas internas" : "Investigación en preparación"}
          testid="kpi-research"
        />
        <KPI
          label="Módulos educativos"
          value={summaryLoading ? "…" : counts.education || "—"}
          sub={counts.education ? "Disponibles" : "Currículum en preparación"}
          testid="kpi-education"
        />
        <KPI
          label="Reportes mensuales"
          value={summaryLoading ? "…" : counts.reports || "—"}
          sub={counts.reports ? "Reportes archivados" : "Próximo reporte: este mes"}
          testid="kpi-reports"
        />
        <KPI
          label="Compañías cubiertas"
          value={summaryLoading ? "…" : counts.companies || "—"}
          sub={counts.companies ? "Cobertura activa" : "Lista pendiente"}
          testid="kpi-companies"
        />
      </div>

      {summaryError ? (
        <div className="mb-8"><RequestError error={summaryError} onRetry={() => setReloadKey((value) => value + 1)} /></div>
      ) : null}

      <section
        className="mb-10 border border-[var(--hc-border)] bg-[var(--hc-surface)] p-6 hc-enter"
        data-testid="dashboard-learning-progress"
      >
        {progressError ? <RequestError error={progressError} onRetry={() => setReloadKey((value) => value + 1)} compact /> : null}
        {!progressError && progressLoading ? <div className="h-20 animate-pulse bg-[var(--hc-surface-elevated)]" data-testid="dashboard-progress-loading" /> : null}
        {!progressError && !progressLoading ? (
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0">
            <div className="hc-overline">Progreso de academia</div>
            <h2 className="mt-2 text-xl font-medium tracking-tight text-[var(--hc-text)]">
              {pendingQuiz
                ? "Contenido completado · evaluación pendiente"
                : allAvailableCoursesComplete
                  ? "Ruta de aprendizaje completada"
                  : "Continuar aprendiendo"}
            </h2>
            <p className="mt-2 text-sm text-[var(--hc-text-secondary)] leading-relaxed">
              {educationLessons.length === 0
                ? "Las lecciones de la academia aparecerán aquí cuando estén disponibles."
                : pendingQuiz
                  ? `Completaste las lecciones de ${pendingQuiz.course.title}. Aprueba la evaluación para completar el curso.`
                  : allAvailableCoursesComplete
                  ? "Has completado todas las lecciones disponibles. Nuevas publicaciones aparecerán aquí para continuar tu avance."
                  : `${completedLessons} de ${educationLessons.length} lecciones completadas.`}
            </p>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <div className="min-w-[180px]">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-xs tracking-[0.16em] uppercase text-[var(--hc-text-muted)]">
                  Progreso
                </span>
                <span className="text-sm font-medium text-[var(--hc-text)]">
                  {progressPercent}%
                </span>
              </div>
              <div className="mt-2 h-1.5 bg-[var(--hc-bg)] border border-[var(--hc-border)]">
                <div className="h-full bg-[var(--hc-gold)]" style={{ width: `${progressPercent}%` }} />
              </div>
              <div className="mt-2 text-[0.7rem] tracking-tight text-[var(--hc-text-muted)]">
                {completedLessons} completadas · {educationLessons.length} totales
              </div>
            </div>

            {pendingQuiz ? (
              <Link
                to={`/courses/${pendingQuiz.course.id}/quiz`}
                data-testid="dashboard-start-quiz"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs tracking-[0.18em] uppercase bg-[var(--hc-platinum)] text-[var(--hc-bg)] hover:bg-white transition-colors"
              >
                Iniciar evaluación <ShieldQuestion className="h-3.5 w-3.5" strokeWidth={1.5} />
              </Link>
            ) : nextLesson ? (
              <Link
                to={`/education/${nextLesson.id}`}
                data-testid="dashboard-continue-learning"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs tracking-[0.18em] uppercase bg-[var(--hc-platinum)] text-[var(--hc-bg)] hover:bg-white transition-colors"
              >
                Continuar aprendiendo <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
              </Link>
            ) : allLessonsComplete ? (
              <div className="px-5 py-2.5 text-xs tracking-[0.18em] uppercase border border-[var(--hc-gold)] text-[var(--hc-gold)] bg-[var(--hc-gold-soft)]">
                Academia al día
              </div>
            ) : (
              <Link
                to="/education"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs tracking-[0.18em] uppercase border border-[var(--hc-border)] text-[var(--hc-gold)] hover:border-[var(--hc-gold)] transition-colors"
              >
                Ver academia <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
              </Link>
            )}
          </div>
        </div>
        ) : null}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Panel
          overline="Biblioteca"
          title="Últimos libros"
          className="hc-enter hc-enter-delay-1"
          testid="panel-latest-books"
          action={
            <Link
              to="/books"
              className="text-xs tracking-[0.18em] uppercase text-[var(--hc-gold)] hover:underline underline-offset-4 flex items-center gap-1"
            >
              Ver libros <ArrowUpRight className="h-3 w-3" strokeWidth={1.5} />
            </Link>
          }
        >
          {summaryLoading ? (
            <div className="h-28 animate-pulse bg-[var(--hc-surface-elevated)]" />
          ) : summaryError ? (
            <RequestError error={summaryError} onRetry={() => setReloadKey((value) => value + 1)} compact />
          ) : latestBooks.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="Aún no hay libros"
              description="Los libros curados que se agreguen a la biblioteca aparecerán aquí."
            />
          ) : (
            <div className="divide-y divide-[var(--hc-border)]" data-testid="dashboard-latest-books">
              {latestBooks.map((book) => (
                <Link
                  key={book.id}
                  to={`/books/${book.id}`}
                  onMouseEnter={() => prepareBookDetail(book)}
                  onFocus={() => prepareBookDetail(book)}
                  onTouchStart={() => prepareBookDetail(book)}
                  className="group grid grid-cols-1 sm:grid-cols-[100px_1fr_24px] gap-2 sm:gap-4 items-start sm:items-center py-4 first:pt-0 last:pb-0 hover:bg-[var(--hc-surface-elevated)] -mx-2 px-2 transition-colors"
                >
                  <span className="hc-overline">{book.author || book.category || "Libro"}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium tracking-tight text-[var(--hc-text)] truncate group-hover:text-[var(--hc-gold)] transition-colors">
                      {book.title}
                    </div>
                    {book.description && (
                      <div className="text-xs text-[var(--hc-text-secondary)] truncate mt-0.5">
                        {book.description}
                      </div>
                    )}
                  </div>
                  <ArrowUpRight
                    className="hidden sm:block h-4 w-4 text-[var(--hc-text-muted)] group-hover:text-[var(--hc-gold)]"
                    strokeWidth={1.5}
                  />
                </Link>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          overline="Investigación"
          title="Notas recientes"
          className="hc-enter hc-enter-delay-2"
          testid="panel-latest-research"
          action={
            <Link
              to="/research"
              className="text-xs tracking-[0.18em] uppercase text-[var(--hc-gold)] hover:underline underline-offset-4 flex items-center gap-1"
            >
              Ver investigación <ArrowUpRight className="h-3 w-3" strokeWidth={1.5} />
            </Link>
          }
        >
          {summaryLoading ? (
            <div className="h-28 animate-pulse bg-[var(--hc-surface-elevated)]" />
          ) : summaryError ? (
            <RequestError error={summaryError} onRetry={() => setReloadKey((value) => value + 1)} compact />
          ) : latestResearch.length === 0 ? (
            <EmptyState
              icon={FileSearch}
              title="Sin investigación publicada"
              description="Las notas internas aparecerán aquí cuando sean publicadas."
            />
          ) : (
            <div className="divide-y divide-[var(--hc-border)]" data-testid="dashboard-latest-research">
              {latestResearch.map((item) => (
                <Link
                  key={item.id}
                  to={`/research/${item.id}`}
                  className="group grid grid-cols-1 sm:grid-cols-[100px_1fr_24px] gap-2 sm:gap-4 items-start sm:items-center py-4 first:pt-0 last:pb-0 hover:bg-[var(--hc-surface-elevated)] -mx-2 px-2 transition-colors"
                >
                  <span className="hc-overline">{item.category || formatDate(item.published_at || item.created_at)}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium tracking-tight text-[var(--hc-text)] truncate group-hover:text-[var(--hc-gold)] transition-colors">
                      {item.title}
                    </div>
                    {item.summary && (
                      <div className="text-xs text-[var(--hc-text-secondary)] truncate mt-0.5">
                        {item.summary}
                      </div>
                    )}
                  </div>
                  <ArrowUpRight
                    className="hidden sm:block h-4 w-4 text-[var(--hc-text-muted)] group-hover:text-[var(--hc-gold)]"
                    strokeWidth={1.5}
                  />
                </Link>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          overline="Este mes"
          title="Último reporte"
          className="hc-enter hc-enter-delay-3"
          testid="panel-latest-report"
        >
          {summaryLoading ? (
            <div className="h-28 animate-pulse bg-[var(--hc-surface-elevated)]" />
          ) : summaryError ? (
            <RequestError error={summaryError} onRetry={() => setReloadKey((value) => value + 1)} compact />
          ) : latestReport ? (
            <Link
              to={`/reports/${latestReport.id}`}
              className="block group"
              data-testid="dashboard-latest-report"
            >
              <div className="hc-overline mb-2">{formatPeriod(latestReport.period)}</div>
              <div className="text-base font-medium tracking-tight text-[var(--hc-text)] group-hover:text-[var(--hc-gold)] transition-colors">
                {latestReport.title}
              </div>
              {latestReport.summary && (
                <p className="mt-3 text-sm text-[var(--hc-text-secondary)] leading-relaxed line-clamp-4">
                  {latestReport.summary}
                </p>
              )}
              <div className="mt-5 inline-flex items-center gap-1 text-xs tracking-[0.18em] uppercase text-[var(--hc-gold)]">
                Leer reporte <ArrowUpRight className="h-3 w-3" strokeWidth={1.5} />
              </div>
            </Link>
          ) : (
            <EmptyState
              icon={CalendarClock}
              title="Sin reporte publicado"
              description="El archivo de reportes mensuales aparecerá aquí."
            />
          )}
        </Panel>
      </div>

      <div className="mt-10">
        <div className="flex items-end justify-between mb-5">
          <div>
            <div className="hc-overline">Academia</div>
            <h2 className="text-lg sm:text-xl font-medium tracking-tight text-[var(--hc-text)] mt-1">
              Áreas principales
            </h2>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {FOCUS.map(({ icon: Icon, label, to }, i) => (
            <Link
              key={to}
              to={to}
              data-testid={`focus-${label.toLowerCase().replace(/\s/g, "-")}`}
              className={`group bg-[var(--hc-surface)] border border-[var(--hc-border)] p-6 hover:bg-[var(--hc-surface-elevated)] transition-colors hc-enter hc-enter-delay-${i + 1}`}
            >
              <div className="flex items-start justify-between">
                <div className="h-9 w-9 flex items-center justify-center border border-[var(--hc-border)] bg-[var(--hc-bg)]">
                  <Icon
                    className="h-[18px] w-[18px] text-[var(--hc-platinum)]"
                    strokeWidth={1.5}
                  />
                </div>
                <ArrowUpRight
                  className="h-4 w-4 text-[var(--hc-text-muted)] group-hover:text-[var(--hc-gold)] transition-colors"
                  strokeWidth={1.5}
                />
              </div>
              <div className="mt-6 text-sm font-medium tracking-tight text-[var(--hc-text)]">
                {label}
              </div>
              <div className="mt-1 text-xs text-[var(--hc-text-muted)] tracking-tight">
                Explorar la sección
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
