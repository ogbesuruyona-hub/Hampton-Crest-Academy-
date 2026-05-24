import React from "react";
import { PageHeader } from "../components/PageHeader";
import { EmptyState } from "../components/EmptyState";
import { GraduationCap } from "lucide-react";

const TRACKS = [
  { label: "Foundations of Value Investing", weeks: "8 weeks" },
  { label: "Macro & Capital Cycles", weeks: "6 weeks" },
  { label: "Portfolio Construction", weeks: "5 weeks" },
  { label: "Behavioural Discipline", weeks: "4 weeks" },
];

export default function InvestmentEducation() {
  return (
    <div data-testid="education-page">
      <PageHeader
        overline="Members Suite · Curriculum"
        title="Investment Education"
        description="A structured curriculum — from foundational frameworks to advanced practice — designed for serious capital allocators."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
        {TRACKS.map((t, i) => (
          <div
            key={t.label}
            data-testid={`track-${i}`}
            className="bg-[var(--hc-surface)] border border-[var(--hc-border)] p-6 hc-enter"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="hc-overline mb-2">Track {String(i + 1).padStart(2, "0")}</div>
                <div className="text-base font-medium tracking-tight text-[var(--hc-text)]">
                  {t.label}
                </div>
                <div className="mt-1 text-xs text-[var(--hc-text-muted)] tracking-tight">
                  {t.weeks} · Members-only
                </div>
              </div>
              <span className="text-[0.65rem] tracking-[0.18em] uppercase text-[var(--hc-gold)] border border-[var(--hc-gold)]/40 px-2 py-1">
                Forthcoming
              </span>
            </div>
          </div>
        ))}
      </div>

      <EmptyState
        icon={GraduationCap}
        title="Curriculum modules in preparation"
        description="Each track will unlock with reading lists, recorded sessions, problem sets, and analyst commentary."
      />
    </div>
  );
}
