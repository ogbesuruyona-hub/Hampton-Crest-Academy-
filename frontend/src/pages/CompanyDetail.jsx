import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { api, formatApiErrorDetail } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { BookmarkButton } from "../components/BookmarkButton";
import { StatusBadge } from "../components/StatusBadge";
import { AdminInlineActions } from "../components/AdminActions";
import { CompanyEditorDialog } from "../components/CompanyEditorDialog";
import { MemoEditorDialog } from "../components/MemoEditorDialog";
import { Panel } from "../components/Panel";
import { RichContent } from "../components/RichContent";
import { formatDate } from "../lib/content";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";

export default function CompanyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [memoOpen, setMemoOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [memoToDelete, setMemoToDelete] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/companies/${id}`);
      setCompany(data);
    } catch (e) {
      setError(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const onDeleteCompany = async () => {
    await api.delete(`/companies/${id}`);
    navigate("/companies");
  };

  const onDeleteMemo = async () => {
    if (!memoToDelete) return;
    await api.delete(`/companies/${id}/memos/${memoToDelete}`);
    setMemoToDelete(null);
    load();
  };

  if (loading) {
    return <div className="text-sm text-[var(--hc-text-muted)] py-16 text-center">Loading…</div>;
  }
  if (error || !company) {
    return (
      <div className="py-16 text-center">
        <div className="hc-overline mb-2">Unavailable</div>
        <div className="text-[var(--hc-text-secondary)] text-sm">{error || "Not found"}</div>
        <Link
          to="/companies"
          className="inline-flex items-center gap-2 mt-6 text-xs tracking-[0.18em] uppercase text-[var(--hc-gold)] hover:underline underline-offset-4"
        >
          <ArrowLeft className="h-3 w-3" /> Back to coverage
        </Link>
      </div>
    );
  }

  const memos = Array.isArray(company.memos) ? company.memos : [];

  return (
    <div data-testid="company-detail" className="hc-enter">
      <Link
        to="/companies"
        data-testid="company-back"
        className="inline-flex items-center gap-2 text-xs tracking-[0.18em] uppercase text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] transition-colors"
      >
        <ArrowLeft className="h-3 w-3" /> Coverage
      </Link>

      {/* Header */}
      <div className="mt-8 flex items-start justify-between gap-6 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-4 mb-3">
            <span className="text-[0.7rem] tracking-[0.22em] uppercase font-semibold text-[var(--hc-gold)]">
              {company.ticker}
            </span>
            <StatusBadge status={company.status} />
            {company.sector && (
              <span className="text-[0.7rem] tracking-[0.18em] uppercase text-[var(--hc-text-secondary)]">
                {company.sector}
              </span>
            )}
          </div>
          <h1 className="text-3xl sm:text-4xl font-medium tracking-[-0.02em] text-[var(--hc-text)]">
            {company.name}
          </h1>
          {company.thesis_summary && (
            <p className="mt-4 text-lg text-[var(--hc-text-secondary)] leading-relaxed max-w-3xl tracking-tight">
              {company.thesis_summary}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isAdmin && (
            <AdminInlineActions
              onEdit={() => setEditorOpen(true)}
              onDelete={() => setConfirmDelete(true)}
            />
          )}
          <BookmarkButton contentType="companies" contentId={company.id} />
        </div>
      </div>

      <div className="mt-8 hc-gold-rule" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-10">
        {/* Thesis body */}
        <div className="lg:col-span-2">
          <Panel overline="Thesis" title="Investment Case" testid="panel-thesis">
            {company.thesis_body ? (
              <div className="text-[var(--hc-text)] tracking-tight leading-[1.75] whitespace-pre-wrap text-[1rem]">
                {company.thesis_body}
              </div>
            ) : (
              <div className="text-sm text-[var(--hc-text-muted)] italic">No thesis written yet.</div>
            )}
          </Panel>

          {/* Memos */}
          <div className="mt-6">
            <Panel
              overline="Analyst Memo Feed"
              title={`Memos${memos.length ? ` · ${memos.length}` : ""}`}
              testid="panel-memos"
              action={
                isAdmin && (
                  <button
                    onClick={() => setMemoOpen(true)}
                    data-testid="add-memo-button"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[0.7rem] tracking-[0.18em] uppercase border border-[var(--hc-border)] text-[var(--hc-gold)] hover:bg-[var(--hc-gold-soft)] transition-colors"
                  >
                    <Plus className="h-3 w-3" strokeWidth={1.5} /> Add Memo
                  </button>
                )
              }
            >
              {memos.length === 0 ? (
                <div className="text-sm text-[var(--hc-text-muted)] py-6 text-center italic">
                  No memos yet.
                </div>
              ) : (
                <div className="space-y-6 divide-y divide-[var(--hc-border)]">
                  {memos.map((m, idx) => (
                    <div
                      key={m.id || idx}
                      data-testid={`memo-${m.id || idx}`}
                      className={idx === 0 ? "" : "pt-6"}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className="hc-overline">{formatDate(m.created_at)}</span>
                          {m.author_name && (
                            <>
                              <span className="h-1 w-1 rounded-full bg-[var(--hc-text-muted)]" />
                              <span className="text-[0.7rem] tracking-tight text-[var(--hc-text-muted)]">
                                {m.author_name}
                              </span>
                            </>
                          )}
                        </div>
                        {isAdmin && (
                          <button
                            onClick={() => setMemoToDelete(m.id)}
                            data-testid={`memo-delete-${m.id}`}
                            aria-label="Delete memo"
                            className="text-[var(--hc-text-muted)] hover:text-[#E07A7A] transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                          </button>
                        )}
                      </div>
                      <div className="text-base font-medium tracking-tight text-[var(--hc-text)]">
                        {m.title}
                      </div>
                      <div className="mt-2 text-sm text-[var(--hc-text-secondary)] tracking-tight">
                        <RichContent html={m.body} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </div>

        {/* Side: metrics */}
        <div>
          <Panel overline="Key Metrics" title="Snapshot" testid="panel-metrics">
            {Array.isArray(company.key_metrics) && company.key_metrics.length > 0 ? (
              <div className="divide-y divide-[var(--hc-border)]">
                {company.key_metrics.map((m, i) => (
                  <div key={i} className="flex items-baseline justify-between py-3 first:pt-0 last:pb-0">
                    <span className="hc-overline">{m.label}</span>
                    <span className="text-sm font-medium tracking-tight text-[var(--hc-text)]">
                      {m.value}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-[var(--hc-text-muted)] italic">No metrics yet.</div>
            )}
          </Panel>

          {Array.isArray(company.tags) && company.tags.length > 0 && (
            <div className="mt-6">
              <Panel overline="Tags" title="Classification" testid="panel-tags">
                <div className="flex flex-wrap gap-2">
                  {company.tags.map((t) => (
                    <span
                      key={t}
                      className="px-3 py-1 text-xs tracking-tight border border-[var(--hc-border)] text-[var(--hc-text-secondary)]"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </Panel>
            </div>
          )}
        </div>
      </div>

      <CompanyEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        initial={company}
        onSaved={load}
      />
      <MemoEditorDialog
        open={memoOpen}
        onOpenChange={setMemoOpen}
        companyId={company.id}
        onSaved={load}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="bg-[var(--hc-surface)] border-[var(--hc-border)] text-[var(--hc-text)] rounded-none">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this company?</AlertDialogTitle>
            <AlertDialogDescription className="text-[var(--hc-text-secondary)]">
              All memos and analyst commentary will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-[var(--hc-border)] text-[var(--hc-text)] hover:bg-[var(--hc-surface-elevated)] rounded-none">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={onDeleteCompany}
              className="bg-[#7A2424] text-[var(--hc-text)] hover:bg-[#9a2e2e] rounded-none"
              data-testid="delete-company-confirm"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!memoToDelete} onOpenChange={(o) => !o && setMemoToDelete(null)}>
        <AlertDialogContent className="bg-[var(--hc-surface)] border-[var(--hc-border)] text-[var(--hc-text)] rounded-none">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this memo?</AlertDialogTitle>
            <AlertDialogDescription className="text-[var(--hc-text-secondary)]">
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-[var(--hc-border)] text-[var(--hc-text)] hover:bg-[var(--hc-surface-elevated)] rounded-none">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={onDeleteMemo}
              className="bg-[#7A2424] text-[var(--hc-text)] hover:bg-[#9a2e2e] rounded-none"
              data-testid="delete-memo-confirm"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
