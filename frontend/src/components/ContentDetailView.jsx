import React, { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, FileDown } from "lucide-react";
import { api, formatApiErrorDetail } from "../lib/api";
import { CONTENT_TYPES, formatDate, formatPeriod } from "../lib/content";
import { useAuth } from "../context/AuthContext";
import { BookmarkButton } from "./BookmarkButton";
import { StatusBadge } from "./StatusBadge";
import { AdminInlineActions } from "./AdminActions";
import { RichContent } from "./RichContent";
import { openPdf } from "./PdfUploader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";

/**
 * Reusable detail view for research / education / reports.
 * Renders a long-form reading layout.
 */
export const ContentDetailView = ({ contentType, EditorComponent }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const cfg = CONTENT_TYPES[contentType];

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get(`/${cfg.api}/${id}`);
      setItem(data);
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

  const onDelete = async () => {
    await api.delete(`/${cfg.api}/${id}`);
    navigate(cfg.listRoute);
  };

  if (loading) {
    return (
      <div className="text-sm text-[var(--hc-text-muted)] py-16 text-center" data-testid="detail-loading">
        Loading…
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="py-16 text-center">
        <div className="hc-overline mb-2">Unavailable</div>
        <div className="text-[var(--hc-text-secondary)] text-sm">{error || "Not found"}</div>
        <Link
          to={cfg.listRoute}
          className="inline-flex items-center gap-2 mt-6 text-xs tracking-[0.18em] uppercase text-[var(--hc-gold)] hover:underline underline-offset-4"
        >
          <ArrowLeft className="h-3 w-3" /> Back to {cfg.plural}
        </Link>
      </div>
    );
  }

  const dateLabel =
    contentType === "reports"
      ? formatPeriod(item.period)
      : formatDate(item.published_at || item.created_at);

  return (
    <article data-testid={`detail-${contentType}`} className="max-w-3xl mx-auto hc-enter">
      <Link
        to={cfg.listRoute}
        data-testid="detail-back"
        className="inline-flex items-center gap-2 text-xs tracking-[0.18em] uppercase text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] transition-colors"
      >
        <ArrowLeft className="h-3 w-3" /> {cfg.plural}
      </Link>

      <header className="mt-8">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <span className="hc-overline">{dateLabel}</span>
          {item.category && (
            <>
              <span className="h-1 w-1 rounded-full bg-[var(--hc-text-muted)]" />
              <span className="text-[0.7rem] tracking-[0.18em] uppercase text-[var(--hc-text-secondary)]">
                {item.category}
              </span>
            </>
          )}
          {item.track && (
            <>
              <span className="h-1 w-1 rounded-full bg-[var(--hc-text-muted)]" />
              <span className="text-[0.7rem] tracking-[0.18em] uppercase text-[var(--hc-text-secondary)]">
                {item.track}
              </span>
            </>
          )}
          {isAdmin && <StatusBadge status={item.status} />}
        </div>

        <h1 className="text-3xl sm:text-4xl lg:text-[2.6rem] font-medium tracking-[-0.02em] leading-[1.12] text-[var(--hc-text)]">
          {item.title}
        </h1>

        {item.summary && (
          <p className="mt-5 text-lg text-[var(--hc-text-secondary)] leading-relaxed tracking-tight">
            {item.summary}
          </p>
        )}

        <div className="mt-8 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 text-xs text-[var(--hc-text-muted)] tracking-tight">
            {item.author_name && <span>By {item.author_name}</span>}
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <AdminInlineActions
                testid="detail-admin-actions"
                onEdit={() => setEditorOpen(true)}
                onDelete={() => setConfirmOpen(true)}
              />
            )}
            <BookmarkButton contentType={contentType} contentId={item.id} />
          </div>
        </div>

        <div className="mt-8 hc-gold-rule" />
      </header>

      {/* PDF attachment for reports */}
      {contentType === "reports" && item.pdf_url && (
        <div
          data-testid="report-pdf-block"
          className="mt-8 flex items-center justify-between gap-4 border border-[var(--hc-border)] bg-[var(--hc-surface)] px-5 py-4"
        >
          <div className="min-w-0">
            <div className="hc-overline">Attachment</div>
            <div className="mt-1 text-sm tracking-tight text-[var(--hc-text)] truncate">
              {item.pdf_filename || "report.pdf"}
            </div>
          </div>
          <button
            onClick={() => openPdf(item.pdf_url)}
            data-testid="report-pdf-open"
            className="flex items-center gap-2 px-4 py-2 text-xs tracking-[0.18em] uppercase bg-[var(--hc-platinum)] text-[var(--hc-bg)] hover:bg-white transition-colors"
          >
            <FileDown className="h-3.5 w-3.5" strokeWidth={1.5} /> Open PDF
          </button>
        </div>
      )}

      <div
        className="mt-10 text-[var(--hc-text)] tracking-tight leading-[1.75] text-[1.0625rem]"
        data-testid="detail-body"
      >
        <RichContent html={item.body} />
      </div>

      {Array.isArray(item.tags) && item.tags.length > 0 && (
        <div className="mt-12 flex items-center gap-2 flex-wrap">
          <span className="hc-overline mr-2">Tags</span>
          {item.tags.map((t) => (
            <span
              key={t}
              className="px-3 py-1 text-xs tracking-tight border border-[var(--hc-border)] text-[var(--hc-text-secondary)]"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {EditorComponent && (
        <EditorComponent
          open={editorOpen}
          onOpenChange={setEditorOpen}
          contentType={contentType}
          initial={item}
          onSaved={load}
        />
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="bg-[var(--hc-surface)] border-[var(--hc-border)] text-[var(--hc-text)] rounded-none">
          <AlertDialogHeader>
            <AlertDialogTitle className="tracking-tight">Delete this {cfg.singular.toLowerCase()}?</AlertDialogTitle>
            <AlertDialogDescription className="text-[var(--hc-text-secondary)]">
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              data-testid="delete-cancel"
              className="bg-transparent border-[var(--hc-border)] text-[var(--hc-text)] hover:bg-[var(--hc-surface-elevated)] rounded-none"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              data-testid="delete-confirm"
              className="bg-[#7A2424] text-[var(--hc-text)] hover:bg-[#9a2e2e] rounded-none"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
};
