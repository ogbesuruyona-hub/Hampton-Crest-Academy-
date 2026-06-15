import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { EmptyState } from "../components/EmptyState";
import { AdminAction } from "../components/AdminActions";
import { BookEditorDialog } from "../components/BookEditorDialog";
import { BookCard } from "../components/BookCard";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { LIBRARY_CATEGORIES } from "../lib/content";
import { BookOpen, Search } from "lucide-react";

export default function BooksLibrary() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("");
  const [q, setQ] = useState(searchParams.get("q") || "");
  const [statusFilter, setStatusFilter] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    setQ(searchParams.get("q") || "");
  }, [searchParams]);

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
    <div data-testid="books-page">
      <PageHeader
        overline="Academia · Libros"
        title="Biblioteca de Libros"
        description="Una estantería curada de libros seleccionados por Hampton Crest. Cada volumen abre en su fuente original."
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
            placeholder="Buscar libro, autor o tema..."
            data-testid="books-search"
            className="w-full bg-[var(--hc-surface)] border border-[var(--hc-border)] text-sm text-[var(--hc-text)] pl-9 pr-3 py-2 focus:outline-none focus:border-[var(--hc-gold)]"
          />
        </div>
        {isAdmin && (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            data-testid="books-status-filter"
            className="bg-[var(--hc-surface)] border border-[var(--hc-border)] text-[var(--hc-text)] text-xs tracking-[0.14em] uppercase px-3 py-2 focus:outline-none focus:border-[var(--hc-gold)]"
          >
            <option value="">Todos</option>
            <option value="published">Publicados</option>
            <option value="draft">Borradores</option>
          </select>
        )}
      </div>

      <div className="flex items-center gap-1 mb-8 overflow-x-auto" data-testid="books-categories">
        <button
          onClick={() => setCategory("")}
          data-testid="book-category-all"
          className={`px-4 py-2 text-xs tracking-[0.14em] uppercase border transition-colors whitespace-nowrap ${
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
          Cargando biblioteca...
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          overline="Biblioteca"
          title="La biblioteca se está preparando"
          description={
            isAdmin
              ? "Usa «Nuevo libro» para añadir el primer volumen."
              : "Los libros curados aparecerán aquí cuando estén disponibles. Mientras tanto, puedes continuar con educación o investigación interna."
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4" data-testid="books-list">
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
