import React, { useEffect, useState, useCallback } from "react";
import { PageHeader } from "../components/PageHeader";
import { EmptyState } from "../components/EmptyState";
import { ContentCard } from "../components/ContentCard";
import { ContentEditorDialog } from "../components/ContentEditorDialog";
import { AdminAction } from "../components/AdminActions";
import { useAuth } from "../context/AuthContext";
import { RESEARCH_CATEGORIES } from "../lib/content";
import { cachedApiGet, invalidateCachedApi } from "../lib/resourceCache";
import { FileSearch, Search } from "lucide-react";

export default function ResearchLibrary() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (category) params.category = category;
      if (q) params.q = q;
      if (isAdmin && statusFilter) params.status = statusFilter;
      const data = await cachedApiGet("/research", { params });
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, [category, q, statusFilter, isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setEditorOpen(true);
  };

  const refreshResearch = () => {
    invalidateCachedApi("/research");
    load();
  };

  return (
    <div data-testid="research-page">
      <PageHeader
        overline="Academia · Investigación"
        title="Investigación Interna"
        description="Notas internas, tesis y análisis publicados por Hampton Crest para miembros de la academia."
        actions={
          isAdmin && (
            <AdminAction
              label="Nueva nota"
              testid="new-research-button"
              onClick={openNew}
            />
          )
        }
      />

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--hc-text-muted)]"
            strokeWidth={1.5}
          />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar investigación..."
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
            <option value="">Todos</option>
            <option value="published">Publicados</option>
            <option value="draft">Borradores</option>
          </select>
        )}
      </div>

      <div className="flex items-center gap-1 mb-8 overflow-x-auto" data-testid="research-categories">
        <button
          onClick={() => setCategory("")}
          data-testid="research-category-all"
          className={`px-4 py-2 text-xs tracking-[0.14em] uppercase border transition-colors whitespace-nowrap ${
            !category
              ? "border-[var(--hc-gold)] text-[var(--hc-text)] bg-[var(--hc-surface)]"
              : "border-[var(--hc-border)] text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)]"
          }`}
        >
          Todas
        </button>
        {RESEARCH_CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
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

      {loading ? (
        <div className="border border-[var(--hc-border)] bg-[var(--hc-surface)]/40 text-sm text-[var(--hc-text-muted)] py-12 text-center">
          Cargando investigación...
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={FileSearch}
          overline="Investigación interna"
          title="Investigación en preparación"
          description={
            isAdmin
              ? "Usa «Nueva nota» para publicar la primera investigación interna."
              : "Las notas internas aparecerán aquí cuando sean publicadas por el equipo de Hampton Crest."
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-testid="research-list">
          {items.map((it) => (
            <ContentCard
              key={it.id}
              item={it}
              contentType="research"
              showStatus={isAdmin}
              isAdmin={isAdmin}
              onEdit={openEdit}
              onDeleted={refreshResearch}
            />
          ))}
        </div>
      )}

      <ContentEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        contentType="research"
        initial={editing}
        onSaved={refreshResearch}
      />
    </div>
  );
}
