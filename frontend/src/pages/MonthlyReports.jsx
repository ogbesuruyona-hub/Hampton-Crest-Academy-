import React, { useEffect, useState, useCallback } from "react";
import { PageHeader } from "../components/PageHeader";
import { EmptyState } from "../components/EmptyState";
import { ContentCard } from "../components/ContentCard";
import { ContentEditorDialog } from "../components/ContentEditorDialog";
import { AdminAction } from "../components/AdminActions";
import { useAuth } from "../context/AuthContext";
import { invalidateCachedApi } from "../lib/resourceCache";
import { api } from "../lib/api";
import { FileText } from "lucide-react";
import { RequestError } from "../components/RequestError";

const yearOptions = (() => {
  const now = new Date().getFullYear();
  return [now, now - 1, now - 2, now - 3];
})();

export default function MonthlyReports() {
  const pageSize = 24;
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { year, page, page_size: pageSize };
      const { data, headers } = await api.get("/reports", { params });
      setItems((current) => (page === 1 ? data : [...current, ...data]));
      setTotal(Number(headers["x-total-count"] || data.length));
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoading(false);
    }
  }, [year, page]);

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

  const refreshReports = () => {
    invalidateCachedApi("/reports");
    if (page === 1) load();
    else setPage(1);
  };

  return (
    <div data-testid="reports-page">
      <PageHeader
        overline="Academia · Reportes"
        title="Reportes Mensuales"
        description="Cada mes te enviamos un resumen claro del mercado, ideas y lo que estamos viendo."
        actions={
          isAdmin && (
            <AdminAction
              label="Nuevo reporte"
              testid="new-report-button"
              onClick={openNew}
            />
          )
        }
      />

      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div className="hc-overline">Año {year}</div>
        <select
          data-testid="reports-year-select"
          value={year}
          onChange={(e) => {
            setYear(e.target.value);
            setPage(1);
          }}
          className="bg-[var(--hc-surface)] border border-[var(--hc-border)] text-[var(--hc-text)] text-xs tracking-[0.14em] uppercase px-4 py-2 focus:outline-none focus:border-[var(--hc-gold)]"
        >
          {yearOptions.map((y) => (
            <option key={y}>{y}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-sm text-[var(--hc-text-muted)] py-12 text-center">Cargando…</div>
      ) : error ? (
        <RequestError error={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No hay reportes para este año"
          description={
            isAdmin
              ? "Publica el primer reporte con «Nuevo reporte»."
              : "Los reportes mensuales quedarán archivados aquí al publicarse."
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
              isAdmin={isAdmin}
              onEdit={openEdit}
              onDeleted={refreshReports}
            />
          ))}
        </div>
      )}

      {!loading && !error && items.length < total ? (
        <div className="mt-6 text-center">
          <button type="button" onClick={() => setPage((value) => value + 1)} className="min-h-11 border border-[var(--hc-border)] px-5 text-xs uppercase tracking-[0.14em] hover:border-[var(--hc-gold)]">Cargar más</button>
        </div>
      ) : null}

      <ContentEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        contentType="reports"
        initial={editing}
        onSaved={refreshReports}
      />
    </div>
  );
}
