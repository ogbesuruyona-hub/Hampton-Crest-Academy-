const ALLOWED_COVER_PROTOCOLS = new Set(["http:", "https:"]);

export function normalizeBookCoverUrl(value) {
  const candidate = typeof value === "string" ? value.trim() : "";
  if (!candidate) return null;
  if (candidate.startsWith("/")) return candidate;

  try {
    const url = new URL(candidate);
    return ALLOWED_COVER_PROTOCOLS.has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function initialBookCoverState(value) {
  return normalizeBookCoverUrl(value) ? "loading" : "fallback";
}

export function bookCoverSource(book, apiBase = "/api") {
  const coverUrl = normalizeBookCoverUrl(book?.cover_url);
  if (!coverUrl) return null;
  if (coverUrl.startsWith("/")) return coverUrl;

  const hostname = new URL(coverUrl).hostname;
  if (hostname.endsWith(".supabase.co")) return coverUrl;
  return book?.id ? `${apiBase}/books/${encodeURIComponent(book.id)}/cover` : coverUrl;
}

export function nextBookCoverState(state, event) {
  if (event === "loaded") return "loaded";
  if (event === "failed") return "fallback";
  return state;
}
