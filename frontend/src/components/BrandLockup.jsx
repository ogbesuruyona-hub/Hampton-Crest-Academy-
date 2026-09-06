import React from "react";

const LOGO_URL = "/assets/hampton-crest-320.94f2cd23.webp";

export function BrandCrest({ className = "", compact = false, testId }) {
  return (
    <span
      className={`hc-brand-lockup__crest${compact ? " hc-brand-lockup__crest--compact" : ""} ${className}`}
      aria-hidden="true"
      data-testid={testId}
    >
      <img
        src={LOGO_URL}
        srcSet="/assets/hampton-crest-160.98f77372.webp 160w, /assets/hampton-crest-320.94f2cd23.webp 320w, /assets/hampton-crest-640.e8758d14.webp 640w"
        sizes={compact ? "40px" : "64px"}
        alt=""
        loading="lazy"
        decoding="async"
      />
    </span>
  );
}

export default function BrandLockup({ className = "", large = false, tone = "light", testId }) {
  return (
    <div
      className={`hc-brand-lockup${large ? " hc-brand-lockup--large" : ""}${tone === "ink" ? " hc-brand-lockup--ink" : ""} ${className}`}
      data-testid={testId}
    >
      <BrandCrest />
      <span className="hc-brand-lockup__wordmark">
        <span>Hampton</span>
        <span className="hc-brand-lockup__crest-name">Crest</span>
        <span className="hc-brand-lockup__academy">Academy</span>
      </span>
      <span className="sr-only">Hampton Crest Academy</span>
    </div>
  );
}
