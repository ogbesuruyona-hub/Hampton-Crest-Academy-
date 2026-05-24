import React, { useEffect, useState } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { api } from "../lib/api";

export const BookmarkButton = ({ contentType, contentId, size = "md", className = "" }) => {
  const [bookmarked, setBookmarked] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancel = false;
    api
      .get("/bookmarks/check", { params: { content_type: contentType, content_id: contentId } })
      .then(({ data }) => {
        if (!cancel) setBookmarked(!!data.bookmarked);
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, [contentType, contentId]);

  const toggle = async (e) => {
    e?.stopPropagation?.();
    e?.preventDefault?.();
    if (loading) return;
    setLoading(true);
    try {
      if (bookmarked) {
        await api.delete("/bookmarks", { params: { content_type: contentType, content_id: contentId } });
        setBookmarked(false);
      } else {
        await api.post("/bookmarks", { content_type: contentType, content_id: contentId });
        setBookmarked(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const Icon = bookmarked ? BookmarkCheck : Bookmark;
  const dim = size === "lg" ? "h-10 w-10" : "h-9 w-9";
  const icon = size === "lg" ? "h-[18px] w-[18px]" : "h-4 w-4";

  return (
    <button
      onClick={toggle}
      data-testid={`bookmark-toggle-${contentType}-${contentId}`}
      aria-label={bookmarked ? "Remove bookmark" : "Add bookmark"}
      className={`${dim} flex items-center justify-center border transition-colors ${
        bookmarked
          ? "border-[var(--hc-gold)]/60 text-[var(--hc-gold)] bg-[var(--hc-gold-soft)]"
          : "border-[var(--hc-border)] text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] hover:border-[var(--hc-text-muted)]"
      } ${className}`}
    >
      <Icon className={icon} strokeWidth={1.5} />
    </button>
  );
};
