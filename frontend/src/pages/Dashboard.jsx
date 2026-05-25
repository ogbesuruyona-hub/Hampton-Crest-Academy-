import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import { EmptyState } from "../components/EmptyState";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { formatDate, formatPeriod, CONTENT_TYPES } from "../lib/content";
import {
  ArrowUpRight,
  BookOpen,
  GraduationCap,
  FileText,
  BarChart3,
  CalendarClock,
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
  { icon: BookOpen, label: "Research Library", to: "/research" },
  { icon: GraduationCap, label: "Investment Education", to: "/education" },
  { icon: FileText, label: "Monthly Reports", to: "/reports" },
  { icon: BarChart3, label: "Company Analysis", to: "/companies" },
];

export default function Dashboard() {
  const { user } = useAuth();
  const first = (user?.name || "Member").split(" ")[0];

  const [counts, setCounts] = useState({ research: 0, education: 0, reports: 0, companies: 0 });
  const [latestResearch, setLatestResearch] = useState([]);
  const [latestReport, setLatestReport] = useState(null);

  useEffect(() => {
    let cancel = false;
    Promise.allSettled([
      api.get("/books"),
      api.get("/education"),
      api.get("/reports"),
      api.get("/companies"),
    ]).then((rs) => {
      if (cancel) return;
      const [r, e, rep, c] = rs.map((x) => (x.status === "fulfilled" ? x.value.data : []));
      setCounts({
        research: r.length,
        education: e.length,
        reports: rep.length,
        companies: c.length,
      });
      setLatestResearch(r.slice(0, 4));
      setLatestReport(rep[0] || null);
    });
    return () => {
      cancel = true;
    };
  }, []);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div data-testid="dashboard-page">
      <PageHeader
        overline={today}
        title={`Welcome, ${first}.`}
        description="Your members' desk for institutional research, curated education, and monthly intelligence."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <KPI
          label="Library Books"
          value={counts.research || "—"}
          sub={counts.research ? "On the shelf" : "Curation in progress"}
          testid="kpi-research"
        />
        <KPI
          label="Education Modules"
          value={counts.education || "—"}
          sub={counts.education ? "Available" : "Curriculum in preparation"}
          testid="kpi-education"
        />
        <KPI
          label="Monthly Reports"
          value={counts.reports || "—"}
          sub={counts.reports ? "Archived issues" : "Next issue: this month"}
          testid="kpi-reports"
        />
        <KPI
          label="Companies Tracked"
          value={counts.companies || "—"}
          sub={counts.companies ? "Active coverage" : "Coverage list pending"}
          testid="kpi-companies"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Panel
          overline="From the Shelf"
          title="Latest Books"
          className="lg:col-span-2 hc-enter hc-enter-delay-1"
          testid="panel-latest-research"
          action={
            <Link
              to="/research"
              className="text-xs tracking-[0.18em] uppercase text-[var(--hc-gold)] hover:underline underline-offset-4 flex items-center gap-1"
            >
              View library <ArrowUpRight className="h-3 w-3" strokeWidth={1.5} />
            </Link>
          }
        >
          {latestResearch.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No books yet"
              description="Curated volumes added to the academy library will appear here."
            />
          ) : (
            <div className="divide-y divide-[var(--hc-border)]" data-testid="dashboard-latest-research">
              {latestResearch.map((r) => (
                <a
                  key={r.id}
                  href={r.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group grid grid-cols-[110px_1fr_24px] gap-4 items-center py-4 first:pt-0 last:pb-0 hover:bg-[var(--hc-surface-elevated)] -mx-2 px-2 transition-colors"
                >
                  <span className="hc-overline">{r.author || formatDate(r.published_at || r.created_at)}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium tracking-tight text-[var(--hc-text)] truncate group-hover:text-[var(--hc-gold)] transition-colors">
                      {r.title}
                    </div>
                    {r.description && (
                      <div className="text-xs text-[var(--hc-text-secondary)] truncate mt-0.5">
                        {r.description}
                      </div>
                    )}
                  </div>
                  <ArrowUpRight
                    className="h-4 w-4 text-[var(--hc-text-muted)] group-hover:text-[var(--hc-gold)]"
                    strokeWidth={1.5}
                  />
                </a>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          overline="This Month"
          title="Latest Report"
          className="hc-enter hc-enter-delay-2"
          testid="panel-latest-report"
        >
          {latestReport ? (
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
                Read issue <ArrowUpRight className="h-3 w-3" strokeWidth={1.5} />
              </div>
            </Link>
          ) : (
            <EmptyState
              icon={CalendarClock}
              title="No issue published"
              description="The monthly report archive will appear here."
            />
          )}
        </Panel>
      </div>

      <div className="mt-10">
        <div className="flex items-end justify-between mb-5">
          <div>
            <div className="hc-overline">Suite</div>
            <h2 className="text-lg sm:text-xl font-medium tracking-tight text-[var(--hc-text)] mt-1">
              Focus areas
            </h2>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                Explore the section
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
