import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { EmptyState } from "../components/EmptyState";
import { CompanyEditorDialog } from "../components/CompanyEditorDialog";
import { AdminAction } from "../components/AdminActions";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import { COMPANY_SECTORS } from "../lib/content";
import { cachedApiGet, invalidateCachedApi } from "../lib/resourceCache";
import { BarChart3, Search, ArrowUpRight } from "lucide-react";

export default function CompanyAnalysis() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [sector, setSector] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (q) params.q = q;
      if (sector) params.sector = sector;
      if (statusFilter) params.status = statusFilter;
      const data = await cachedApiGet("/companies", { params });
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, [q, sector, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div data-testid="companies-page">
      <PageHeader
        overline="Academia · Cobertura"
        title="Análisis de compañías"
        description="Cobertura profunda de empresas — tesis, fundamentales y seguimiento del analista."
        actions={
          isAdmin && (
            <AdminAction
          label="Añadir compañía"
              testid="new-company-button"
              onClick={() => setEditorOpen(true)}
            />
          )
        }
      />

      <div className="flex items-center gap-3 mb-8 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--hc-text-muted)]"
            strokeWidth={1.5}
          />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por ticker o compañía..."
            data-testid="companies-search"
            className="w-full bg-[var(--hc-surface)] border border-[var(--hc-border)] text-sm text-[var(--hc-text)] placeholder:text-[var(--hc-text-muted)] pl-9 pr-3 py-2.5 focus:outline-none focus:border-[var(--hc-gold)]"
          />
        </div>
        <select
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          data-testid="companies-sector-select"
          className="bg-[var(--hc-surface)] border border-[var(--hc-border)] text-[var(--hc-text)] text-xs tracking-[0.14em] uppercase px-4 py-2.5 focus:outline-none focus:border-[var(--hc-gold)]"
        >
          <option value="">Todos los sectores</option>
          {COMPANY_SECTORS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          data-testid="companies-status-select"
          className="bg-[var(--hc-surface)] border border-[var(--hc-border)] text-[var(--hc-text)] text-xs tracking-[0.14em] uppercase px-4 py-2.5 focus:outline-none focus:border-[var(--hc-gold)]"
        >
          <option value="">Todos los estados</option>
          <option value="covered">Cubierta</option>
          <option value="watching">En observación</option>
          <option value="exited">Salida</option>
        </select>
      </div>

      {loading ? (
        <div className="text-sm text-[var(--hc-text-muted)] py-12 text-center">Cargando...</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          overline="Cobertura"
          title="Lista de cobertura pendiente"
          description={
            isAdmin
              ? "Usa «Añadir compañía» para construir la cobertura."
              : "Las compañías de nuestra cobertura aparecerán aquí con tesis, métricas y memos del analista."
          }
        />
      ) : (
        <div className="border border-[var(--hc-border)] bg-[var(--hc-surface)] divide-y divide-[var(--hc-border)]" data-testid="companies-table">
          {items.map((c) => (
            <Link
              key={c.id}
              to={`/companies/${c.id}`}
              data-testid={`company-row-${c.ticker}`}
              className="group grid grid-cols-1 md:grid-cols-[110px_1fr_120px_80px_24px] items-start md:items-center gap-3 md:gap-4 px-6 py-4 hover:bg-[var(--hc-surface-elevated)] transition-colors"
            >
              <div className="text-sm font-semibold tracking-[0.1em] text-[var(--hc-text)] uppercase">
                {c.ticker}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium tracking-tight text-[var(--hc-text)] truncate">
                  {c.name}
                </div>
                {c.thesis_summary && (
                  <div className="text-xs text-[var(--hc-text-secondary)] tracking-tight truncate mt-0.5">
                    {c.thesis_summary}
                  </div>
                )}
              </div>
              <div className="text-xs text-[var(--hc-text-secondary)] tracking-tight">
                {c.sector || "—"}
              </div>
              <div>
                <StatusBadge status={c.status} />
              </div>
              <ArrowUpRight
                className="hidden md:block h-4 w-4 text-[var(--hc-text-muted)] group-hover:text-[var(--hc-gold)] transition-colors"
                strokeWidth={1.5}
              />
            </Link>
          ))}
        </div>
      )}

      <CompanyEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        onSaved={() => {
          invalidateCachedApi("/companies");
          load();
        }}
      />
    </div>
  );
}
