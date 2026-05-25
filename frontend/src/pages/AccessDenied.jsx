import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { ArrowUpRight, ShieldAlert } from "lucide-react";

const LOGO_URL =
  "https://customer-assets.emergentagent.com/job_hampton-crest/artifacts/nj6t4ufd_35939535-7E23-42A3-BF88-4E1ED39508BB.png";

export default function AccessDenied() {
  const [config, setConfig] = useState({ framer_url: "", payment_link_url: "" });

  useEffect(() => {
    api.get("/membership/config").then(({ data }) => setConfig(data)).catch(() => {});
  }, []);

  const cta = config.payment_link_url || config.framer_url || "#";
  const ctaLabel = config.payment_link_url ? "Quiero ser miembro" : "Ver planes";

  return (
    <div
      data-testid="access-denied-page"
      className="min-h-screen flex items-center justify-center bg-[var(--hc-bg)] text-[var(--hc-text)] px-6"
    >
      <div className="max-w-xl w-full text-center hc-enter">
        <div className="flex justify-center mb-10">
          <img
            src={LOGO_URL}
            alt="Hampton Crest"
            className="h-16 w-16 object-contain"
            style={{ mixBlendMode: "screen" }}
          />
        </div>
        <div className="hc-overline mb-3 text-[var(--hc-gold)]">Academia Privada</div>
        <h1 className="text-3xl sm:text-4xl font-medium tracking-[-0.02em] leading-[1.15]">
          Acceso restringido.
        </h1>
        <div className="mt-6 hc-gold-rule" />
        <p className="mt-6 text-[var(--hc-text-secondary)] text-sm sm:text-base leading-relaxed">
          Hampton Crest Academy es un círculo privado reservado para miembros activos. Tu cuenta
          no tiene una suscripción activa o tu membresía expiró.
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
            Entrar con otra cuenta
          </Link>
        </div>
        <div className="mt-14 inline-flex items-center gap-2 text-[0.65rem] tracking-[0.22em] uppercase text-[var(--hc-text-muted)]">
          <ShieldAlert className="h-3 w-3" strokeWidth={1.5} />
          Confidencial · Solo Miembros
        </div>
      </div>
    </div>
  );
}
