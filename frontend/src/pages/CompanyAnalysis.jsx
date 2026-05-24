import React from "react";
import { PageHeader } from "../components/PageHeader";
import { EmptyState } from "../components/EmptyState";
import { BarChart3, Search } from "lucide-react";

export default function CompanyAnalysis() {
  return (
    <div data-testid="companies-page">
      <PageHeader
        overline="Members Suite · Coverage"
        title="Company Analysis"
        description="Deep-dive coverage on individual companies — thesis, financials, valuation, and ongoing analyst observation."
      />

      <div className="flex items-center gap-3 mb-8 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--hc-text-muted)]"
            strokeWidth={1.5}
          />
          <input
            type="text"
            placeholder="Search by ticker or company…"
            data-testid="companies-search"
            className="w-full bg-[var(--hc-surface)] border border-[var(--hc-border)] text-sm text-[var(--hc-text)] placeholder:text-[var(--hc-text-muted)] pl-9 pr-3 py-2.5 focus:outline-none focus:border-[var(--hc-gold)]"
          />
        </div>
        <select
          data-testid="companies-sector-select"
          className="bg-[var(--hc-surface)] border border-[var(--hc-border)] text-[var(--hc-text)] text-xs tracking-[0.14em] uppercase px-4 py-2.5 focus:outline-none focus:border-[var(--hc-gold)]"
        >
          <option>All Sectors</option>
          <option>Financials</option>
          <option>Industrials</option>
          <option>Consumer</option>
          <option>Technology</option>
          <option>Energy</option>
          <option>Healthcare</option>
        </select>
      </div>

      <EmptyState
        icon={BarChart3}
        title="Coverage list pending publication"
        description="Each company in our coverage universe will appear with thesis, key metrics, and the latest analyst memo."
      />
    </div>
  );
}
