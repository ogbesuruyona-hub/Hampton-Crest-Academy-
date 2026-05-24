import React from "react";
import { PageHeader } from "../components/PageHeader";
import { EmptyState } from "../components/EmptyState";
import { FileText } from "lucide-react";

export default function MonthlyReports() {
  return (
    <div data-testid="reports-page">
      <PageHeader
        overline="Members Suite · Reports"
        title="Monthly Reports"
        description="A monthly intelligence brief — macro posture, portfolio reflections, and the analyst's letter — delivered the first week of every month."
      />

      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div className="hc-overline">2026 Vintage</div>
        <select
          data-testid="reports-year-select"
          className="bg-[var(--hc-surface)] border border-[var(--hc-border)] text-[var(--hc-text)] text-xs tracking-[0.14em] uppercase px-4 py-2 focus:outline-none focus:border-[var(--hc-gold)]"
        >
          <option>2026</option>
          <option>2025</option>
        </select>
      </div>

      <EmptyState
        icon={FileText}
        title="The first issue is in production"
        description="The inaugural Hampton Crest Monthly will be archived here on publication, with the full back catalogue available to members."
      />
    </div>
  );
}
