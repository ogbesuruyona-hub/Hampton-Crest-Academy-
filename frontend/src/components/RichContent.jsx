import React, { useMemo } from "react";
import DOMPurify from "dompurify";

/**
 * Renders TipTap HTML safely. Falls back to whitespace-preserving plain text
 * if the body doesn't look like HTML (back-compat for previously saved plain text).
 */
export const RichContent = ({ html, testid }) => {
  const looksLikeHtml = useMemo(() => /<\/?[a-z][\s\S]*>/i.test(html || ""), [html]);
  const safe = useMemo(() => {
    if (!html) return "";
    if (!looksLikeHtml) return null;
    return DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true },
      ALLOWED_ATTR: ["href", "target", "rel", "class"],
    });
  }, [html, looksLikeHtml]);

  if (!html) {
    return (
      <span data-testid={testid} className="text-[var(--hc-text-muted)] italic">
        Sin contenido.
      </span>
    );
  }

  if (!looksLikeHtml) {
    return (
      <div data-testid={testid} className="whitespace-pre-wrap">
        {html}
      </div>
    );
  }

  return (
    <div
      data-testid={testid}
      className="hc-prose"
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
};
