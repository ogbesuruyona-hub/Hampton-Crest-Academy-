import React from "react";

const LOGO_URL =
  "https://customer-assets.emergentagent.com/job_hampton-crest/artifacts/nj6t4ufd_35939535-7E23-42A3-BF88-4E1ED39508BB.png";

export function BrandCrest({ className = "", compact = false, testId }) {
  return (
    <span
      className={`hc-brand-lockup__crest${compact ? " hc-brand-lockup__crest--compact" : ""} ${className}`}
      aria-hidden="true"
      data-testid={testId}
    >
      <img src={LOGO_URL} alt="" />
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
