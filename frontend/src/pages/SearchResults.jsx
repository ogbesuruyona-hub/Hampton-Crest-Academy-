import React, { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { EmptyState } from "../components/EmptyState";
import { api } from "../lib/api";
import { CONTENT_TYPES, formatDate, formatPeriod } from "../lib/content";
import { Search, ArrowUpRight } from "lucide-react";

const SECTIONS = [
  { key: "books", icon: "Libros", api: "books", external: true },
  { key: "research", icon: "Investigación", api: "research" },
  { key: "education", icon: "Educación", api: "education" },
  { key: "reports", icon: "Reportes", api: "reports" },
  { key: "companies", icon: "Compañías", api: "companies" },
];

const ResultRow = ({ item, section }) => {
  const cfg = CONTENT_TYPES[section];
  if (section === "books") {
    const bookTo = item.id
      ? `/books/${item.id}`
      : `/books?q=${encodeURIComponent(item.title || "")}`;
    return (
      <Link
        to={bookTo}
        data-testid={`result-${section}-${item.id}`}
        className="group grid grid-cols-1 sm:grid-cols-[100px_1fr_24px] gap-2 sm:gap-4 items-start sm:items-center py-4 first:pt-0 last:pb-0 hover:bg-[var(--hc-surface-elevated)] -mx-2 px-2 transition-colors"
      >
        <span className="hc-overline">{item.author || item.category || "Libro"}</span>
        <div className="min-w-0">
          <div className="text-sm font-medium tracking-tight text-[var(--hc-text)] truncate group-hover:text-[var(--hc-gold)] transition-colors">
            {item.title}
          </div>
          {item.description && (
            <div className="text-xs text-[var(--hc-text-secondary)] truncate mt-0.5">
              {item.description}
            </div>
          )}
        </div>
        <ArrowUpRight className="hidden sm:block h-4 w-4 text-[var(--hc-text-muted)] group-hover:text-[var(--hc-gold)]" strokeWidth={1.5} />
      </Link>
    );
  }
  const dateLabel = section === "reports"
    ? formatPeriod(item.period)
    : item.ticker
      ? `${item.ticker} · ${item.sector || "—"}`
      : formatDate(item.published_at || item.created_at);
  const title = item.ticker ? `${item.ticker} · ${item.name}` : item.title;
  return (
    <Link
      to={cfg.detailRoute(item.id)}
      data-testid={`result-${section}-${item.id}`}
      className="group grid grid-cols-1 sm:grid-cols-[140px_1fr_24px] gap-2 sm:gap-4 items-start sm:items-center py-4 first:pt-0 last:pb-0 hover:bg-[var(--hc-surface-elevated)] -mx-2 px-2 transition-colors"
    >
      <span className="hc-overline">{dateLabel}</span>
      <div className="min-w-0">
        <div className="text-sm font-medium tracking-tight text-[var(--hc-text)] truncate group-hover:text-[var(--hc-gold)] transition-colors">
          {title}
        </div>
        {(item.summary || item.thesis_summary) && (
          <div className="text-xs text-[var(--hc-text-secondary)] truncate mt-0.5">
            {item.summary || item.thesis_summary}
          </div>
        )}
      </div>
      <ArrowUpRight className="hidden sm:block h-4 w-4 text-[var(--hc-text-muted)] group-hover:text-[var(--hc-gold)]" strokeWidth={1.5} />
    </Link>
  );
};

export default function SearchResults() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const [input, setInput] = useState(q);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setInput(q);
    if (!q) {
      setResults(null);
      return;
    }
    setLoading(true);
    api
      .get("/search", { params: { q } })
      .then(({ data }) => setResults(data))
      .catch(() => setResults({ total: 0, books: [], research: [], education: [], reports: [], companies: [] }))
      .finally(() => setLoading(false));
  }, [q]);

  const submit = (e) => {
    e.preventDefault();
    if (input.trim()) setParams({ q: input.trim() });
  };

  return (
    <div data-testid="search-page">
      <PageHeader
        overline="Academia · Búsqueda"
        title={q ? `Resultados para "${q}"` : "Búsqueda"}
        description="Busca en libros, investigación, módulos, reportes y empresas de la academia."
      />

      <form onSubmit={submit} className="mb-10 max-w-2xl">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--hc-text-muted)]"
            strokeWidth={1.5}
          />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe tu consulta…"
            data-testid="search-input"
            autoFocus
            className="w-full bg-[var(--hc-surface)] border border-[var(--hc-border)] text-sm text-[var(--hc-text)] pl-10 pr-3 py-3 focus:outline-none focus:border-[var(--hc-gold)]"
          />
        </div>
      </form>

      {!q ? (
        <div className="text-sm text-[var(--hc-text-muted)] py-12 text-center">
          Escribe arriba para buscar contenido.
        </div>
      ) : loading ? (
        <div className="border border-[var(--hc-border)] bg-[var(--hc-surface)]/40 text-sm text-[var(--hc-text-muted)] py-12 text-center">
          Buscando en la academia...
        </div>
      ) : !results || results.total === 0 ? (
        <EmptyState
          icon={Search}
          overline="Búsqueda"
          title="Sin resultados"
          description={`No encontramos contenido para "${q}". Prueba con otro concepto, ticker, autor o tema de inversión.`}
        />
      ) : (
        <div className="space-y-10">
          {SECTIONS.map((s) => {
            const items = results[s.key] || [];
            if (items.length === 0) return null;
            return (
              <section key={s.key} data-testid={`search-section-${s.key}`}>
                <div className="flex items-baseline justify-between mb-4">
                  <div>
                    <div className="hc-overline">{s.icon}</div>
                    <h2 className="text-lg font-medium tracking-tight text-[var(--hc-text)] mt-1">
                      {items.length} resultado{items.length === 1 ? "" : "s"}
                    </h2>
                  </div>
                </div>
                <div className="bg-[var(--hc-surface)] border border-[var(--hc-border)] p-6">
                  <div className="divide-y divide-[var(--hc-border)]">
                    {items.map((it) => (
                      <ResultRow key={it.id} item={it} section={s.key} />
                    ))}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
