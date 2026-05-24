import React, { useEffect, useState, useCallback } from "react";
import { PageHeader } from "../components/PageHeader";
import { EmptyState } from "../components/EmptyState";
import { ContentCard } from "../components/ContentCard";
import { ContentEditorDialog } from "../components/ContentEditorDialog";
import { AdminAction } from "../components/AdminActions";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { RESEARCH_CATEGORIES } from "../lib/content";
import { BookOpen, Search } from "lucide-react";

export default function ResearchLibrary() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (category) params.category = category;
      if (q) params.q = q;
      if (isAdmin && statusFilter) params.status = statusFilter;
      const { data } = await api.get("/research", { params });
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, [category, q, statusFilter, isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div data-testid="research-page">
      <PageHeader
        overline="Members Suite · Research"
        title="Research Library"
        description="Institutional-grade research notes, sector commentary, and macro briefings — curated by Hampton Crest analysts."
        actions={
          isAdmin && (
            <AdminAction
              label="New Research"
              testid="new-research-button"
              onClick={() => setEditorOpen(true)}
            />
          )
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-3 mb-8 flex-wrap" data-testid="research-filters">
        <div className="flex items-center gap-1 overflow-x-auto">
          <button
            onClick={() => setCategory("")}
            data-testid="filter-all"
            className={`px-4 py-2 text-xs tracking-[0.14em] uppercase border transition-colors ${
              !category
                ? "border-[var(--hc-gold)] text-[var(--hc-text)] bg-[var(--hc-surface)]"
                : "border-[var(--hc-border)] text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)]"
            }`}
          >
            All
          </button>
          {RESEARCH_CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              data-testid={`filter-${c.toLowerCase().replace(/\s/g, "-")}`}
              className={`px-4 py-2 text-xs tracking-[0.14em] uppercase border transition-colors whitespace-nowrap ${
                category === c
                  ? "border-[var(--hc-gold)] text-[var(--hc-text)] bg-[var(--hc-surface)]"
                  : "border-[var(--hc-border)] text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)]"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--hc-text-muted)]"
            strokeWidth={1.5}
          />
          <input
            type="text"
            placeholder="Search title or summary…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            data-testid="research-search"
            className="w-full bg-[var(--hc-surface)] border border-[var(--hc-border)] text-sm text-[var(--hc-text)] pl-9 pr-3 py-2 focus:outline-none focus:border-[var(--hc-gold)]"
          />
        </div>
        {isAdmin && (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            data-testid="research-status-filter"
            className="bg-[var(--hc-surface)] border border-[var(--hc-border)] text-[var(--hc-text)] text-xs tracking-[0.14em] uppercase px-3 py-2 focus:outline-none focus:border-[var(--hc-gold)]"
          >
            <option value="">All Statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        )}
      </div>

      {loading ? (
        <div className="text-sm text-[var(--hc-text-muted)] py-12 text-center">Loading…</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="The library is being prepared"
          description={
            isAdmin
              ? "Use “New Research” to publish your first note. It will appear here for members upon publication."
              : "Upon publication, research notes will appear here. Check back shortly."
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-testid="research-list">
          {items.map((it) => (
            <ContentCard key={it.id} item={it} contentType="research" showStatus={isAdmin} />
          ))}
        </div>
      )}

      <ContentEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        contentType="research"
        onSaved={load}
      />
    </div>
  );
}
