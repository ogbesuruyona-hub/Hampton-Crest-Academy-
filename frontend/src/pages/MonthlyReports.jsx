import React, { useEffect, useState, useCallback } from "react";
import { PageHeader } from "../components/PageHeader";
import { EmptyState } from "../components/EmptyState";
import { ContentCard } from "../components/ContentCard";
import { ContentEditorDialog } from "../components/ContentEditorDialog";
import { AdminAction } from "../components/AdminActions";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { FileText } from "lucide-react";

const yearOptions = (() => {
  const now = new Date().getFullYear();
  return [now, now - 1, now - 2, now - 3];
})();

export default function MonthlyReports() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [editorOpen, setEditorOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { year };
      const { data } = await api.get("/reports", { params });
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div data-testid="reports-page">
      <PageHeader
        overline="Members Suite · Reports"
        title="Monthly Reports"
        description="A monthly intelligence brief — macro posture, portfolio reflections, and the analyst's letter."
        actions={
          isAdmin && (
            <AdminAction
              label="New Issue"
              testid="new-report-button"
              onClick={() => setEditorOpen(true)}
            />
          )
        }
      />

      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div className="hc-overline">{year} Vintage</div>
        <select
          data-testid="reports-year-select"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className="bg-[var(--hc-surface)] border border-[var(--hc-border)] text-[var(--hc-text)] text-xs tracking-[0.14em] uppercase px-4 py-2 focus:outline-none focus:border-[var(--hc-gold)]"
        >
          {yearOptions.map((y) => (
            <option key={y}>{y}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-sm text-[var(--hc-text-muted)] py-12 text-center">Loading…</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No reports for this year"
          description={
            isAdmin
              ? "Publish the first issue with “New Issue”."
              : "Issues will be archived here on publication."
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-testid="reports-list">
          {items.map((it) => (
            <ContentCard
              key={it.id}
              item={it}
              contentType="reports"
              periodLabel
              showStatus={isAdmin}
            />
          ))}
        </div>
      )}

      <ContentEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        contentType="reports"
        onSaved={load}
      />
    </div>
  );
}
