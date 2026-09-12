import React, { useEffect, useMemo, useState } from "react";
import { BookOpen } from "lucide-react";
import {
  bookCoverSource,
  initialBookCoverState,
  nextBookCoverState,
  normalizeBookCoverUrl,
} from "../lib/bookCover";
import { API } from "../lib/api";

export default function BookCover({
  book,
  loading = "lazy",
  fetchPriority = "auto",
  imageClassName = "",
  fallbackClassName = "",
  compact = false,
}) {
  const coverUrl = useMemo(() => normalizeBookCoverUrl(book?.cover_url), [book?.cover_url]);
  const coverSource = useMemo(() => bookCoverSource(book, API), [book]);
  const [state, setState] = useState(() => initialBookCoverState(coverUrl));

  useEffect(() => {
    setState(initialBookCoverState(coverUrl));
  }, [coverUrl]);

  const showImage = Boolean(coverSource) && state !== "fallback";

  return (
    <div className="relative h-full w-full" data-cover-state={state}>
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center bg-[linear-gradient(145deg,var(--hc-surface),var(--hc-bg))] text-center ${
          compact ? "gap-1 px-1" : "gap-3 px-5"
        } ${fallbackClassName}`}
        data-testid={`book-cover-fallback-${book?.id || "unknown"}`}
        aria-hidden={showImage ? "true" : undefined}
      >
        <BookOpen
          className={`${compact ? "h-5 w-5 sm:h-8 sm:w-8" : "h-9 w-9"} text-[var(--hc-gold)]/70`}
          strokeWidth={1.25}
        />
        <div className={`${compact ? "hidden sm:block" : "block"} max-w-full`}>
          <div className="hc-overline line-clamp-3 text-[var(--hc-text)]">{book?.title || "Libro"}</div>
          {book?.author ? (
            <div className="mt-2 line-clamp-2 text-xs text-[var(--hc-text-secondary)]">{book.author}</div>
          ) : null}
        </div>
      </div>

      {showImage ? (
        <img
          key={coverSource}
          src={coverSource}
          alt={`Portada de ${book?.title || "libro"}`}
          loading={loading}
          fetchPriority={fetchPriority}
          decoding="async"
          className={`relative z-[1] h-full w-full transition-opacity duration-200 ${
            state === "loaded" ? "opacity-100" : "opacity-0"
          } ${imageClassName}`}
          onLoad={() => setState((current) => nextBookCoverState(current, "loaded"))}
          onError={() => setState((current) => nextBookCoverState(current, "failed"))}
        />
      ) : null}
    </div>
  );
}
