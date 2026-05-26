import React, { useEffect, useState, useCallback } from "react";
import { PageHeader } from "../components/PageHeader";
import { EmptyState } from "../components/EmptyState";
import { AdminAction } from "../components/AdminActions";
import { BookEditorDialog } from "../components/BookEditorDialog";
import { BookCard } from "../components/BookCard";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { LIBRARY_CATEGORIES } from "../lib/content";
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
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (category) params.category = category;
      if (q) params.q = q;
      if (isAdmin && statusFilter) params.status = statusFilter;
      const { data } = await api.get("/books", { params });
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

  const openEdit = (book) => {
    setEditing(book);
    setEditorOpen(true);
  };

  return (
    <div data-testid="research-page">
      <PageHeader
        overline="Academia · Biblioteca"
        title="Biblioteca"
        description="Una estantería curada de libros seleccionados por Hampton Crest. Cada volumen abre en su fuente original para que leas sin perder tu lugar aquí."
        actions={
          isAdmin && (
            <AdminAction
              label="Nuevo libro"
              testid="new-book-button"
              onClick={openNew}
            />
          )
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-3 mb-8 flex-wrap" data-testid="library-filters">
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
            Todas
          </button>
          {LIBRARY_CATEGORIES.map((c) => (
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
            placeholder="Buscar título, autor o descripción…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            data-testid="library-search"
            className="w-full bg-[var(--hc-surface)] border border-[var(--hc-border)] text-sm text-[var(--hc-text)] pl-9 pr-3 py-2 focus:outline-none focus:border-[var(--hc-gold)]"
          />
        </div>
        {isAdmin && (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            data-testid="library-status-filter"
            className="bg-[var(--hc-surface)] border border-[var(--hc-border)] text-[var(--hc-text)] text-xs tracking-[0.14em] uppercase px-3 py-2 focus:outline-none focus:border-[var(--hc-gold)]"
          >
            <option value="">Todos los estados</option>
            <option value="published">Publicados</option>
            <option value="draft">Borradores</option>
          </select>
        )}
      </div>

      {loading ? (
        <div className="text-sm text-[var(--hc-text-muted)] py-12 text-center">Cargando…</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="La estantería se está preparando"
          description={
            isAdmin
              ? "Usa «Nuevo libro» para añadir el primer volumen. Pega el título, autor, URL de portada, una descripción corta y el enlace externo donde vive el libro."
              : "Pronto encontrarás aquí los libros curados de la academia."
          }
        />
      ) : (
        <div
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
          data-testid="library-grid"
        >
          {items.map((b) => (
            <BookCard
              key={b.id}
              book={b}
              showStatus={isAdmin}
              isAdmin={isAdmin}
              onEdit={() => openEdit(b)}
              onDeleted={load}
            />
          ))}
        </div>
      )}

      <BookEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        initial={editing}
        onSaved={load}
      />
    </div>
  );
}
