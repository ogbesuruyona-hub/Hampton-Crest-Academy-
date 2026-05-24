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

  return (
    <div data-testid="education-page">
      <PageHeader
        overline="Members Suite · Curriculum"
        title="Investment Education"
        description="A structured curriculum — from foundational frameworks to advanced practice — designed for serious capital allocators."
        actions={
          isAdmin && (
            <AdminAction
              label="New Module"
              testid="new-education-button"
              onClick={() => setEditorOpen(true)}
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
          All Tracks
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
        <div className="text-sm text-[var(--hc-text-muted)] py-12 text-center">Loading…</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="Curriculum in preparation"
          description={
            isAdmin
              ? "Use “New Module” to publish curriculum content."
              : "Modules will unlock with reading lists, recorded sessions, and analyst commentary."
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-testid="education-list">
          {items.map((it) => (
            <ContentCard key={it.id} item={it} contentType="education" showStatus={isAdmin} />
          ))}
        </div>
      )}

      <ContentEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        contentType="education"
        onSaved={load}
      />
    </div>
  );
}
