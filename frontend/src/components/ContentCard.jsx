import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Pencil, Trash2 } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { BookmarkButton } from "./BookmarkButton";
import { formatDate, formatPeriod, CONTENT_TYPES } from "../lib/content";
import { api, formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
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

export const ContentCard = ({
  item,
  contentType,
  showStatus = true,
  periodLabel = false,
  isAdmin = false,
  onEdit,
  onDeleted,
  testid,
}) => {
  const cfg = CONTENT_TYPES[contentType];
  const to = cfg.detailRoute(item.id);
  const dateLabel = periodLabel
    ? formatPeriod(item.period)
    : formatDate(item.published_at || item.created_at);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/${cfg.api}/${item.id}`);
      toast.success("Eliminado");
      onDeleted?.();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div
      data-testid={testid || `card-${contentType}-${item.id}`}
      className="group relative bg-[var(--hc-surface)] border border-[var(--hc-border)] hover:border-[var(--hc-text-muted)] transition-colors"
    >
      <Link to={to} className="block p-6 pr-16">
        <div className="flex items-center gap-3 mb-3">
          <span className="hc-overline">{dateLabel}</span>
          {item.category && (
            <>
              <span className="h-1 w-1 rounded-full bg-[var(--hc-text-muted)]" />
              <span className="text-[0.7rem] tracking-[0.18em] uppercase text-[var(--hc-text-secondary)]">
                {item.category}
              </span>
            </>
          )}
          {showStatus && item.status === "draft" && (
            <>
              <span className="h-1 w-1 rounded-full bg-[var(--hc-text-muted)]" />
              <StatusBadge status="draft" />
            </>
          )}
        </div>

        <h3 className="text-lg sm:text-xl font-medium tracking-tight text-[var(--hc-text)] group-hover:text-[var(--hc-gold)] transition-colors">
          {item.title}
        </h3>

        {item.summary && (
          <p className="mt-3 text-sm text-[var(--hc-text-secondary)] leading-relaxed line-clamp-2">
            {item.summary}
          </p>
        )}

        <div className="mt-5 flex items-center gap-4 text-[0.7rem] tracking-tight text-[var(--hc-text-muted)]">
          {item.author_name && <span>{item.author_name}</span>}
          {Array.isArray(item.tags) && item.tags.length > 0 && (
            <span className="flex items-center gap-2">
              {item.tags.slice(0, 3).map((t) => (
                <span
                  key={t}
                  className="px-2 py-0.5 border border-[var(--hc-border)] text-[var(--hc-text-secondary)]"
                >
                  {t}
                </span>
              ))}
            </span>
          )}
        </div>

        <ArrowUpRight
          className="absolute top-6 right-6 h-4 w-4 text-[var(--hc-text-muted)] group-hover:text-[var(--hc-gold)] transition-colors"
          strokeWidth={1.5}
        />
      </Link>

      <div className="absolute bottom-5 right-5 flex items-center gap-1">
        {isAdmin && onEdit && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEdit(item);
            }}
            data-testid={`card-edit-${contentType}-${item.id}`}
            title="Editar"
            className="h-7 w-7 flex items-center justify-center border border-[var(--hc-border)] bg-[var(--hc-surface)] text-[var(--hc-text-secondary)] hover:text-[var(--hc-gold)] transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        )}
        {isAdmin && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setConfirmDelete(true);
            }}
            data-testid={`card-delete-${contentType}-${item.id}`}
            title="Eliminar"
            className="h-7 w-7 flex items-center justify-center border border-[#7A2424] bg-[var(--hc-surface)] text-[#E07A7A] hover:bg-[#2A0F0F] transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        )}
        <BookmarkButton contentType={contentType} contentId={item.id} />
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="bg-[var(--hc-surface)] border-[var(--hc-border)] text-[var(--hc-text)] rounded-none">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este elemento?</AlertDialogTitle>
            <AlertDialogDescription className="text-[var(--hc-text-secondary)]">
              «{item.title}» se eliminará de la academia. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-[var(--hc-border)] text-[var(--hc-text)] hover:bg-[var(--hc-surface-elevated)] rounded-none">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              data-testid={`confirm-delete-${contentType}-${item.id}`}
              className="bg-[#7A2424] text-[var(--hc-text)] hover:bg-[#9a2e2e] rounded-none"
            >
              {deleting ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
