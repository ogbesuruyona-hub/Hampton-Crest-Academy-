import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { EmptyState } from "../components/EmptyState";
import { BookmarkButton } from "../components/BookmarkButton";
import { api } from "../lib/api";
import { CONTENT_TYPES, formatDate, formatPeriod } from "../lib/content";
import { Bookmark, ArrowUpRight } from "lucide-react";

export default function SavedResources() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    api
      .get("/bookmarks")
      .then(({ data }) => {
        if (!cancel) setItems(data);
      })
      .finally(() => !cancel && setLoading(false));
    return () => {
      cancel = true;
    };
  }, []);

  const filtered = filter === "all" ? items : items.filter((b) => b.content_type === filter);
  const counts = items.reduce(
    (acc, b) => ({ ...acc, [b.content_type]: (acc[b.content_type] || 0) + 1 }),
    {}
  );

  return (
    <div data-testid="saved-page">
      <PageHeader
        overline="Academia · Guardados"
        title="Guardados"
        description="Tu archivo personal — libros, módulos, reportes y empresas que has marcado para volver."
      />

      {items.length > 0 && (
        <div className="flex items-center gap-1 mb-8 overflow-x-auto" data-testid="saved-filters">
          {[
            ["all", `Todos (${items.length})`],
            ["books", `Libros (${counts.books || 0})`],
            ["research", `Investigación (${counts.research || 0})`],
            ["education", `Educación (${counts.education || 0})`],
            ["reports", `Reportes (${counts.reports || 0})`],
            ["companies", `Empresas (${counts.companies || 0})`],
          ].map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              data-testid={`saved-filter-${k}`}
              className={`px-4 py-2 text-xs tracking-[0.14em] uppercase border transition-colors whitespace-nowrap ${
                filter === k
                  ? "border-[var(--hc-gold)] text-[var(--hc-text)] bg-[var(--hc-surface)]"
                  : "border-[var(--hc-border)] text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-[var(--hc-text-muted)] py-12 text-center">Cargando…</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="Aún no has guardado nada"
          description="Marca cualquier libro, nota, módulo, reporte o empresa. Tus selecciones aparecerán aquí."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-testid="saved-list">
          {filtered.map((b) => {
            const cfg = CONTENT_TYPES[b.content_type];
            const c = b.content;
            const isBook = b.content_type === "books";
            const dateLabel = isBook
              ? c.author || c.category || "—"
              : b.content_type === "reports"
                ? formatPeriod(c.period)
                : c.ticker
                  ? c.sector || "—"
                  : formatDate(c.published_at || c.created_at);
            const title = c.ticker ? `${c.ticker} · ${c.name}` : c.title;
            const InnerLink = isBook ? "a" : Link;
            const linkProps = isBook
              ? { href: c.external_url, target: "_blank", rel: "noopener noreferrer" }
              : { to: cfg.detailRoute(c.id) };
            return (
              <div
                key={b.bookmark_id}
                data-testid={`saved-item-${b.content_type}-${c.id}`}
                className="group relative bg-[var(--hc-surface)] border border-[var(--hc-border)] hover:border-[var(--hc-text-muted)] transition-colors"
              >
                <InnerLink {...linkProps} className="block p-6 pr-16">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="hc-overline">{cfg.singular}</span>
                    <span className="h-1 w-1 rounded-full bg-[var(--hc-text-muted)]" />
                    <span className="text-[0.7rem] tracking-[0.18em] uppercase text-[var(--hc-text-secondary)]">
                      {dateLabel}
                    </span>
                  </div>
                  <h3 className="text-lg font-medium tracking-tight text-[var(--hc-text)] group-hover:text-[var(--hc-gold)] transition-colors">
                    {title}
                  </h3>
                  {(c.summary || c.thesis_summary || c.description) && (
                    <p className="mt-3 text-sm text-[var(--hc-text-secondary)] leading-relaxed line-clamp-2">
                      {c.summary || c.thesis_summary || c.description}
                    </p>
                  )}
                  <div className="mt-4 text-[0.65rem] tracking-[0.18em] uppercase text-[var(--hc-text-muted)]">
                    Guardado {formatDate(b.saved_at)}
                  </div>
                  <ArrowUpRight
                    className="absolute top-6 right-6 h-4 w-4 text-[var(--hc-text-muted)] group-hover:text-[var(--hc-gold)] transition-colors"
                    strokeWidth={1.5}
                  />
                </InnerLink>
                <div className="absolute bottom-5 right-5">
                  <BookmarkButton contentType={b.content_type} contentId={c.id} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
