import React from "react";

const LOGO_URL =
  "https://customer-assets.emergentagent.com/job_hampton-crest/artifacts/nj6t4ufd_35939535-7E23-42A3-BF88-4E1ED39508BB.png";

export default function BrandLockup({ className = "", large = false }) {
  return (
    <div className={`hc-brand-lockup${large ? " hc-brand-lockup--large" : ""} ${className}`}>
      <span className="hc-brand-lockup__crest" aria-hidden="true">
        <img src={LOGO_URL} alt="" />
      </span>
      <span className="hc-brand-lockup__wordmark">
        <span>Hampton</span>
        <span className="hc-brand-lockup__crest-name">Crest</span>
        <span className="hc-brand-lockup__academy">Academy</span>
      </span>
      <span className="sr-only">Hampton Crest Academy</span>
    </div>
  );
}
