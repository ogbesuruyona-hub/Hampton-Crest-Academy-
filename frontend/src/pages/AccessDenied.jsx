import React, { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api, formatApiErrorDetail } from "../lib/api";
import { ArrowUpRight, CreditCard, RefreshCw, ShieldAlert } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { localizeBillingInterval, withSpanishCheckoutLocale } from "../lib/paymentLinks";

const LOGO_URL =
  "https://customer-assets.emergentagent.com/job_hampton-crest/artifacts/nj6t4ufd_35939535-7E23-42A3-BF88-4E1ED39508BB.png";

export default function AccessDenied() {
  const { user, refresh } = useAuth();
  const [config, setConfig] = useState({ payment_link_url: "" });
  const [billingLoading, setBillingLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/membership/config").then(({ data }) => setConfig(data || {})).catch(() => {});
  }, []);

  const paymentLink = withSpanishCheckoutLocale(config.payment_link_url || "");
  const billingInterval = localizeBillingInterval(config.billing_interval || "");

  if (user?.has_access) {
    return <Navigate to="/dashboard" replace />;
  }

  const openBillingPortal = async () => {
    setBillingLoading(true);
    setError("");
    try {
      const { data } = await api.post("/billing/portal");
      window.location.assign(data.url);
    } catch (e) {
      setError(formatApiErrorDetail(e.response?.data?.detail) || e.message);
      setBillingLoading(false);
    }
  };

  const recheckMembership = async () => {
    setChecking(true);
    setError("");
    try {
      await refresh();
    } catch (e) {
      setError(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setChecking(false);
    }
  };

  return (
    <main
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
          {user
            ? "Tu período de acceso terminó porque no pudimos completar la renovación. Actualiza tu método de pago para recuperar la membresía."
            : "Hampton Crest Academy es un círculo privado reservado para miembros activos. Tu cuenta no tiene una suscripción activa o tu membresía expiró."}
        </p>
        {error && <p role="alert" className="mt-4 text-sm text-[#b33a3a]">{error}</p>}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          {user?.stripe_customer_id ? (
            <button
              type="button"
              onClick={openBillingPortal}
              disabled={billingLoading}
              data-testid="access-denied-billing-portal"
              className="inline-flex items-center gap-2 bg-[var(--hc-platinum)] text-[var(--hc-bg)] px-6 py-3 text-xs tracking-[0.18em] uppercase font-semibold hover:bg-white transition-colors disabled:opacity-50"
            >
              <CreditCard className="h-3.5 w-3.5" strokeWidth={1.5} />
              {billingLoading ? "Abriendo…" : "Actualizar método de pago"}
            </button>
          ) : paymentLink ? (
            <div>
              <p className="mb-3 text-sm font-semibold">{config.price_display} · {billingInterval}</p>
              <a
                href={paymentLink}
                data-testid="access-denied-cta"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-[var(--hc-platinum)] text-[var(--hc-bg)] px-6 py-3 text-xs tracking-[0.18em] uppercase font-semibold hover:bg-white transition-colors"
              >
                Quiero ser miembro
                <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
              </a>
              <p className="mt-3 max-w-xs text-xs leading-relaxed text-[var(--hc-text-muted)]">
                Renovación automática; cancela desde el portal. Consulta los <Link className="underline" to="/terminos">términos</Link>.
              </p>
            </div>
          ) : (
            <div
              data-testid="access-denied-payment-not-configured"
              className="max-w-sm border border-[var(--hc-border)] bg-[var(--hc-surface)] px-5 py-3 text-xs leading-relaxed text-[var(--hc-text-secondary)]"
            >
              El pago de membresía aún no está configurado. Contacta al equipo de Hampton Crest
              para activar tu acceso.
            </div>
          )}
          {user && (
            <button
              type="button"
              onClick={recheckMembership}
              disabled={checking}
              data-testid="access-denied-recheck"
              className="inline-flex items-center gap-2 border border-[var(--hc-border)] text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] px-6 py-3 text-xs tracking-[0.18em] uppercase transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${checking ? "animate-spin" : ""}`} strokeWidth={1.5} />
              {checking ? "Comprobando…" : "Ya actualicé el pago"}
            </button>
          )}
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
    </main>
  );
}
