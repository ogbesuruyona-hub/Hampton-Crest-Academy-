import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { ArrowUpRight, ShieldAlert } from "lucide-react";

const LOGO_URL =
  "https://customer-assets.emergentagent.com/job_hampton-crest/artifacts/h4tthbvd_A58944FA-BD9D-4E3C-9437-9EED1300A03D.png";

export default function AccessDenied() {
  const [config, setConfig] = useState({ framer_url: "", payment_link_url: "" });

  useEffect(() => {
    api.get("/membership/config").then(({ data }) => setConfig(data)).catch(() => {});
  }, []);

  const cta = config.payment_link_url || config.framer_url || "#";
  const ctaLabel = config.payment_link_url ? "Become a member" : "View plans";

  return (
    <div
      data-testid="access-denied-page"
      className="min-h-screen flex items-center justify-center bg-[var(--hc-bg)] text-[var(--hc-text)] px-6"
    >
      <div className="max-w-xl w-full text-center hc-enter">
        <div className="flex justify-center mb-10">
          <img src={LOGO_URL} alt="Hampton Crest" className="h-14 w-14 object-contain" />
        </div>
        <div className="hc-overline mb-3 text-[var(--hc-gold)]">Members Suite</div>
        <h1 className="text-3xl sm:text-4xl font-medium tracking-[-0.02em] leading-[1.15]">
          Access restricted.
        </h1>
        <div className="mt-6 hc-gold-rule" />
        <p className="mt-6 text-[var(--hc-text-secondary)] text-sm sm:text-base leading-relaxed">
          Hampton Crest Academy is a private circle reserved for paying members. Your account
          either has no active subscription, or your membership has lapsed.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          {cta !== "#" ? (
            <a
              href={cta}
              data-testid="access-denied-cta"
              className="inline-flex items-center gap-2 bg-[var(--hc-platinum)] text-[var(--hc-bg)] px-6 py-3 text-xs tracking-[0.18em] uppercase font-semibold hover:bg-white transition-colors"
            >
              {ctaLabel}
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
            </a>
          ) : null}
          <Link
            to="/login"
            data-testid="access-denied-signin"
            className="inline-flex items-center gap-2 border border-[var(--hc-border)] text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] px-6 py-3 text-xs tracking-[0.18em] uppercase transition-colors"
          >
            Sign in with another account
          </Link>
        </div>
        <div className="mt-14 inline-flex items-center gap-2 text-[0.65rem] tracking-[0.22em] uppercase text-[var(--hc-text-muted)]">
          <ShieldAlert className="h-3 w-3" strokeWidth={1.5} />
          Confidential · For Members Only
        </div>
      </div>
    </div>
  );
}
