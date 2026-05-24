import React from "react";
import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import { EmptyState } from "../components/EmptyState";
import { useAuth } from "../context/AuthContext";
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
        description="Your members' desk for institutional research, curated education, and monthly intelligence. The library is being prepared — your suite will populate as content is published."
      />

      {/* KPI row — structural, no fabricated data */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <KPI label="Research Notes" value="—" sub="Awaiting publication" testid="kpi-research" />
        <KPI label="Education Modules" value="—" sub="Curriculum in preparation" testid="kpi-education" />
        <KPI label="Monthly Reports" value="—" sub="Next issue: this month" testid="kpi-reports" />
        <KPI label="Companies Tracked" value="—" sub="Coverage list pending" testid="kpi-companies" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Latest research */}
        <Panel
          overline="Latest Intelligence"
          title="Featured Research"
          className="lg:col-span-2 hc-enter hc-enter-delay-1"
          testid="panel-latest-research"
          action={
            <a
              href="/research"
              className="text-xs tracking-[0.18em] uppercase text-[var(--hc-gold)] hover:underline underline-offset-4 flex items-center gap-1"
            >
              View library <ArrowUpRight className="h-3 w-3" strokeWidth={1.5} />
            </a>
          }
        >
          <EmptyState
            icon={BookOpen}
            title="The research desk is being curated"
            description="New thesis-driven research notes, sector commentaries, and macro briefings will appear here as our analysts publish them."
          />
        </Panel>

        {/* Upcoming */}
        <Panel
          overline="Calendar"
          title="Upcoming Sessions"
          className="hc-enter hc-enter-delay-2"
          testid="panel-upcoming"
        >
          <EmptyState
            icon={CalendarClock}
            title="No scheduled sessions"
            description="Members' briefings and live discussions will be listed here."
          />
        </Panel>
      </div>

      {/* Focus areas */}
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
            <a
              key={to}
              href={to}
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
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
