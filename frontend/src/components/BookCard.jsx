import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, ArrowUpRight, Pencil, Trash2 } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { BookmarkButton } from "./BookmarkButton";
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

export const BookCard = ({ book, showStatus = false, isAdmin = false, onEdit, onDeleted }) => {
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/books/${book.id}`);
      toast.success("Libro eliminado");
      onDeleted?.();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const open = () => {
    if (book.id) {
      navigate(`/books/${book.id}`);
    }
  };

  return (
    <div
      data-testid={`book-card-${book.id}`}
      onClick={open}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
      className="group relative h-full min-w-0 bg-[var(--hc-surface)] border border-[var(--hc-border)] hover:border-[var(--hc-gold)]/70 hover:shadow-[0_14px_34px_rgba(7,25,37,0.08)] transition-[border-color,box-shadow,transform] duration-300 flex flex-col cursor-pointer focus:outline-none focus:border-[var(--hc-gold)]"
    >
      {/* Cover */}
      <div
        className="relative aspect-[3/4] h-auto w-full overflow-hidden border-b border-[var(--hc-border)] bg-[var(--hc-bg)] sm:aspect-auto sm:h-[185px] xl:h-[200px]"
        data-testid={`book-cover-${book.id}`}
      >
        {book.cover_url ? (
          <img
            src={book.cover_url}
            alt={book.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-contain p-1 sm:p-3 transition-transform duration-500 group-hover:scale-[1.025]"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-1 text-center sm:gap-3 sm:px-4">
            <BookOpen
              className="h-5 w-5 text-[var(--hc-text-muted)] sm:h-8 sm:w-8"
              strokeWidth={1.25}
            />
            <div className="hidden text-[var(--hc-text-muted)] sm:block hc-overline">Sin portada</div>
          </div>
        )}

        {showStatus && book.status === "draft" && (
          <div className="absolute left-2 top-2 hidden sm:block">
            <StatusBadge status="draft" />
          </div>
        )}
        <div
          className="absolute right-2 top-2 hidden sm:block"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <BookmarkButton contentType="books" contentId={book.id} size="sm" />
        </div>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1 flex-col p-1.5 sm:p-3.5">
        {book.category && (
          <div className="mb-1 hidden text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-[var(--hc-gold)]/85 sm:line-clamp-1">
            {book.category}
          </div>
        )}
        <h3 className="text-[0.62rem] font-medium leading-[1.2] tracking-tight text-[var(--hc-text)] line-clamp-2 transition-colors group-hover:text-[var(--hc-gold)] sm:text-sm sm:leading-snug">
          {book.title}
        </h3>
        {book.author && (
          <div className="mt-1 hidden text-xs tracking-tight text-[var(--hc-text-secondary)] sm:line-clamp-1">
            por {book.author}
          </div>
        )}
        {book.description && (
          <p className="mt-1.5 hidden text-[0.68rem] leading-relaxed text-[var(--hc-text-secondary)] sm:line-clamp-2">
            {book.description}
          </p>
        )}

        {isAdmin ? (
          <div
            className="mt-auto flex items-center gap-1 pt-1 sm:hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onEdit}
              data-testid={`book-edit-mobile-${book.id}`}
              aria-label={`Editar ${book.title}`}
              className="flex h-6 flex-1 items-center justify-center border border-[var(--hc-border)] text-[var(--hc-text-secondary)]"
            >
              <Pencil className="h-2.5 w-2.5" strokeWidth={1.5} />
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              data-testid={`book-delete-mobile-${book.id}`}
              aria-label={`Eliminar ${book.title}`}
              className="flex h-6 flex-1 items-center justify-center border border-[#7A2424] text-[#A74444]"
            >
              <Trash2 className="h-2.5 w-2.5" strokeWidth={1.5} />
            </button>
          </div>
        ) : null}

        <div className="mt-auto hidden items-center justify-between gap-1.5 border-t border-[var(--hc-border)] pt-2.5 sm:flex">
          <span
            data-testid={`book-open-${book.id}`}
            className="inline-flex items-center gap-1 text-[0.54rem] sm:text-[0.6rem] tracking-[0.16em] uppercase text-[var(--hc-gold)] group-hover:underline underline-offset-4 whitespace-nowrap"
          >
            Ver libro <ArrowUpRight className="h-2.5 w-2.5" strokeWidth={1.5} />
          </span>
          {isAdmin && (
            <div
              className="flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={onEdit}
                data-testid={`book-edit-${book.id}`}
                title="Editar"
                className="h-6 w-6 flex items-center justify-center border border-[var(--hc-border)] text-[var(--hc-text-secondary)] hover:text-[var(--hc-gold)] transition-colors"
              >
                <Pencil className="h-3 w-3" strokeWidth={1.5} />
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                data-testid={`book-delete-${book.id}`}
                title="Eliminar"
                className="h-6 w-6 flex items-center justify-center border border-[#7A2424] text-[#A74444] hover:bg-[#F7EDED] transition-colors"
              >
                <Trash2 className="h-3 w-3" strokeWidth={1.5} />
              </button>
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent
          className="bg-[var(--hc-surface)] border-[var(--hc-border)] text-[var(--hc-text)] rounded-none"
          onClick={(e) => e.stopPropagation()}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este libro?</AlertDialogTitle>
            <AlertDialogDescription className="text-[var(--hc-text-secondary)]">
              «{book.title}» se eliminará de la biblioteca.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-[var(--hc-border)] text-[var(--hc-text)] hover:bg-[var(--hc-surface-elevated)] rounded-none">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              data-testid={`confirm-delete-book-${book.id}`}
              className="bg-[#7A2424] text-[var(--hc-text)] hover:bg-[#9a2e2e] rounded-none"
            >
              {deleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
