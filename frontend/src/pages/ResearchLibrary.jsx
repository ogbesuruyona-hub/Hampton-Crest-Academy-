import React from "react";
import { PageHeader } from "../components/PageHeader";
import { EmptyState } from "../components/EmptyState";
import { BookOpen, Filter } from "lucide-react";

const FILTERS = ["All Notes", "Macro", "Equities", "Fixed Income", "Alternatives", "Sector"];

export default function ResearchLibrary() {
  return (
    <div data-testid="research-page">
      <PageHeader
        overline="Members Suite · Research"
        title="Research Library"
        description="Institutional-grade research notes, sector commentary, and macro briefings — curated by the Hampton Crest analysts."
      />

      {/* Filter rail */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div className="flex items-center gap-1 overflow-x-auto" data-testid="research-filters">
          {FILTERS.map((f, i) => (
            <button
              key={f}
              data-testid={`filter-${f.toLowerCase().replace(/\s/g, "-")}`}
              className={`px-4 py-2 text-xs tracking-[0.14em] uppercase border transition-colors ${
                i === 0
                  ? "border-[var(--hc-gold)] text-[var(--hc-text)] bg-[var(--hc-surface)]"
                  : "border-[var(--hc-border)] text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] hover:border-[var(--hc-text-muted)]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <button
          data-testid="research-advanced-filters"
          className="flex items-center gap-2 px-4 py-2 text-xs tracking-[0.14em] uppercase border border-[var(--hc-border)] text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] transition-colors"
        >
          <Filter className="h-3.5 w-3.5" strokeWidth={1.5} /> Advanced
        </button>
      </div>

      <EmptyState
        icon={BookOpen}
        title="The research library is being prepared"
        description="Upon publication, research notes will appear chronologically with filters for sector, asset class, and analyst."
      />
    </div>
  );
}
