import React, { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api, formatApiErrorDetail } from "../lib/api";
import { ArrowUpRight, CreditCard, RefreshCw, ShieldAlert } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { localizeBillingInterval, withSpanishCheckoutLocale } from "../lib/paymentLinks";

const LOGO_URL = "/assets/hampton-crest-320.94f2cd23.webp";

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
        <div className="mx-auto mt-8 max-w-2xl">
          {!user?.stripe_customer_id && paymentLink ? (
            <p className="mb-4 text-sm font-semibold tracking-wide text-[var(--hc-text)]">
              {config.price_display} · {billingInterval}
            </p>
          ) : null}
          <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          {user?.stripe_customer_id ? (
            <button
              type="button"
              onClick={openBillingPortal}
              disabled={billingLoading}
              data-testid="access-denied-billing-portal"
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[#173b61] px-6 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-white transition-colors hover:bg-[#0f2e4d] disabled:opacity-50 sm:w-auto"
            >
              <CreditCard className="h-3.5 w-3.5" strokeWidth={1.5} />
              {billingLoading ? "Abriendo…" : "Actualizar método de pago"}
            </button>
          ) : paymentLink ? (
            <a
              href={paymentLink}
              data-testid="access-denied-cta"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[#173b61] px-6 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-white transition-colors hover:bg-[#0f2e4d] sm:w-auto"
            >
              Quiero ser miembro
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
            </a>
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
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[var(--hc-border)] px-6 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--hc-text-secondary)] transition-colors hover:border-[var(--hc-gold)] hover:text-[var(--hc-text)] disabled:opacity-50 sm:w-auto"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${checking ? "animate-spin" : ""}`} strokeWidth={1.5} />
              {checking ? "Comprobando…" : "Ya actualicé el pago"}
            </button>
          )}
          <Link
            to="/login"
            data-testid="access-denied-signin"
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[var(--hc-border)] bg-transparent px-6 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[#173b61] transition-colors hover:border-[var(--hc-gold)] hover:bg-[var(--hc-surface)] sm:w-auto"
          >
            Entrar con otra cuenta
          </Link>
          </div>
          {!user?.stripe_customer_id && paymentLink ? (
            <p className="mx-auto mt-4 max-w-sm text-xs leading-relaxed text-[var(--hc-text-muted)]">
              Renovación automática; cancela desde el portal. Consulta los <Link className="underline" to="/terminos">términos</Link>.
            </p>
          ) : null}
        </div>
        <div className="mt-14 inline-flex items-center gap-2 text-[0.65rem] tracking-[0.22em] uppercase text-[var(--hc-text-muted)]">
          <ShieldAlert className="h-3 w-3" strokeWidth={1.5} />
          Confidencial · Solo Miembros
        </div>
      </div>
    </main>
  );
}
