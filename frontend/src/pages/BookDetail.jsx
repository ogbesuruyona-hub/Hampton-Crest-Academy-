import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { API, formatApiErrorDetail } from "../lib/api";
import { StatusBadge } from "../components/StatusBadge";
import { BookmarkButton } from "../components/BookmarkButton";
import { cachedApiGet, peekCachedApi } from "../lib/resourceCache";

const formatFileSize = (bytes) => {
  if (!bytes) return null;
  const megabytes = bytes / (1024 * 1024);
  return megabytes >= 1 ? `${megabytes.toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
};

export default function BookDetail() {
  const { id } = useParams();
  const initialBook = peekCachedApi(`/books/${id}`) || null;
  const [book, setBook] = useState(initialBook);
  const [loading, setLoading] = useState(!initialBook);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(!peekCachedApi(`/books/${id}`));
    setError("");
    cachedApiGet(`/books/${id}`)
      .then((data) => {
        if (!cancelled) setBook(data);
      })
      .catch((e) => {
        if (!cancelled) setError(formatApiErrorDetail(e.response?.data?.detail) || e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div
        className="border border-[var(--hc-border)] bg-[var(--hc-surface)]/40 text-sm text-[var(--hc-text-muted)] py-16 text-center"
        data-testid="book-detail-loading"
      >
        Cargando libro...
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="py-16 text-center" data-testid="book-detail-error">
        <div className="hc-overline mb-2">Libro no disponible</div>
        <div className="text-[var(--hc-text-secondary)] text-sm">{error || "No encontrado"}</div>
        <Link
          to="/books"
          className="inline-flex items-center gap-2 mt-6 text-xs tracking-[0.18em] uppercase text-[var(--hc-gold)] hover:underline underline-offset-4"
        >
          <ArrowLeft className="h-3 w-3" /> Volver a libros
        </Link>
      </div>
    );
  }

  return (
    <article data-testid="book-detail" className="max-w-4xl mx-auto hc-enter">
      <Link
        to="/books"
        data-testid="book-detail-back"
        className="inline-flex items-center gap-2 text-xs tracking-[0.18em] uppercase text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] transition-colors"
      >
        <ArrowLeft className="h-3 w-3" /> Libros
      </Link>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-8">
        <div className="bg-[var(--hc-surface)] border border-[var(--hc-border)] aspect-[3/4] max-h-[320px] overflow-hidden">
          {book.cover_url ? (
            <img
              src={book.cover_url}
              alt={book.title}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="h-full flex items-center justify-center text-center px-4">
              <span className="hc-overline text-[var(--hc-text-muted)]">Sin portada</span>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            {book.category && (
              <span className="text-[0.7rem] tracking-[0.18em] uppercase text-[var(--hc-gold)]">
                {book.category}
              </span>
            )}
            {book.status && <StatusBadge status={book.status} />}
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-[2.6rem] font-medium tracking-[-0.02em] leading-[1.12] text-[var(--hc-text)]">
            {book.title}
          </h1>

          {book.author && (
            <div className="mt-4 text-sm text-[var(--hc-text-secondary)] tracking-tight">
              Por {book.author}
            </div>
          )}

          {formatFileSize(book.file_size) ? (
            <div className="mt-3 text-xs uppercase tracking-[0.14em] text-[var(--hc-text-muted)]" data-testid="book-file-size">
              PDF · {formatFileSize(book.file_size)}
            </div>
          ) : null}

          {book.description ? (
            <p className="mt-6 text-base text-[var(--hc-text-secondary)] leading-relaxed tracking-tight">
              {book.description}
            </p>
          ) : (
            <p className="mt-6 text-base text-[var(--hc-text-secondary)] leading-relaxed tracking-tight">
              Hampton Crest aún no ha añadido una descripción editorial para este libro.
            </p>
          )}

          <div className="mt-8 flex items-center gap-3 flex-wrap">
            {(book.file_path || book.external_url) && (
              <a
                href={book.file_path ? `${API}/books/${book.id}/open` : book.external_url}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="book-external-link"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs tracking-[0.18em] uppercase bg-[var(--hc-platinum)] text-[var(--hc-bg)] hover:bg-white transition-colors"
              >
                {book.file_path || book.external_url.startsWith("/api/files/") ? "Abrir libro" : "Abrir fuente externa"}
                <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} />
              </a>
            )}
            <BookmarkButton contentType="books" contentId={book.id} />
          </div>
        </div>
      </div>
    </article>
  );
}
