import React, { useEffect, useState, useCallback } from "react";
import { PageHeader } from "../components/PageHeader";
import { EmptyState } from "../components/EmptyState";
import { ContentCard } from "../components/ContentCard";
import { ContentEditorDialog } from "../components/ContentEditorDialog";
import { AdminAction } from "../components/AdminActions";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { EDUCATION_TRACKS } from "../lib/content";
import { GraduationCap } from "lucide-react";

export default function InvestmentEducation() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [track, setTrack] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      const { data } = await api.get("/education", { params });
      const filtered = track ? data.filter((d) => d.track === track) : data;
      setItems(filtered);
    } finally {
      setLoading(false);
    }
  }, [track]);

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

  return (
    <div data-testid="education-page">
      <PageHeader
        overline="Academia · Currículum"
        title="Educación de Inversión"
        description="Un currículum estructurado — desde marcos fundamentales hasta práctica avanzada — diseñado para asignadores de capital serios."
        actions={
          isAdmin && (
            <AdminAction
              label="Nuevo módulo"
              testid="new-education-button"
              onClick={openNew}
            />
          )
        }
      />

      <div className="flex items-center gap-1 mb-8 overflow-x-auto" data-testid="education-tracks">
        <button
          onClick={() => setTrack("")}
          data-testid="track-filter-all"
          className={`px-4 py-2 text-xs tracking-[0.14em] uppercase border transition-colors ${
            !track
              ? "border-[var(--hc-gold)] text-[var(--hc-text)] bg-[var(--hc-surface)]"
              : "border-[var(--hc-border)] text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)]"
          }`}
        >
          Todos los tracks
        </button>
        {EDUCATION_TRACKS.map((t) => (
          <button
            key={t}
            onClick={() => setTrack(t)}
            className={`px-4 py-2 text-xs tracking-[0.14em] uppercase border transition-colors whitespace-nowrap ${
              track === t
                ? "border-[var(--hc-gold)] text-[var(--hc-text)] bg-[var(--hc-surface)]"
                : "border-[var(--hc-border)] text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-sm text-[var(--hc-text-muted)] py-12 text-center">Cargando…</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="Currículum en preparación"
          description={
            isAdmin
              ? "Usa «Nuevo módulo» para publicar contenido del currículum."
              : "Los módulos abrirán con lecturas, sesiones grabadas y comentarios del analista."
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-testid="education-list">
          {items.map((it) => (
            <ContentCard
              key={it.id}
              item={it}
              contentType="education"
              showStatus={isAdmin}
              isAdmin={isAdmin}
              onEdit={openEdit}
              onDeleted={load}
            />
          ))}
        </div>
      )}

      <ContentEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        contentType="education"
        initial={editing}
        onSaved={load}
      />
    </div>
  );
}
