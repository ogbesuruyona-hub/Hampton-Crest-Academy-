import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, GraduationCap, FileText, BarChart3, Lock, ArrowUpRight, ShieldCheck, Users } from "lucide-react";
import { api } from "../lib/api";
import BrandLockup from "../components/BrandLockup";

const PaymentCta = ({ href, price, interval, testId, className }) => {
  if (!href) {
    return (
      <div
        data-testid={`${testId}-not-configured`}
        className="border border-[var(--hc-border)] bg-[var(--hc-surface)] px-5 py-3 text-xs leading-relaxed text-[var(--hc-text-secondary)]"
      >
        El pago de membresía aún no está configurado. Contacta al equipo de Hampton Crest para activar tu acceso.
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-[#fffaf0]" data-testid={`${testId}-price`}>
        {price} · {interval}
      </p>
      <a
        href={href}
        data-testid={testId}
        className={className}
        target="_blank"
        rel="noopener noreferrer"
      >
        Quiero ser miembro
        <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
      </a>
      <p className="mt-3 max-w-md text-xs leading-relaxed text-white/80">
        Renovación automática. Puedes cancelar desde el portal. Al continuar aceptas los{" "}
        <Link className="underline" to="/terminos">términos</Link> y confirmas haber leído el{" "}
        <Link className="underline" to="/aviso-de-riesgo">aviso de riesgo</Link>.
      </p>
    </div>
  );
};

const Pillar = ({ icon: Icon, title, body }) => (
  <div className="border border-[var(--hc-border)] bg-[var(--hc-surface)] p-7">
    <Icon className="h-5 w-5 text-[var(--hc-gold)] mb-5" strokeWidth={1.5} />
    <div className="hc-overline mb-2">{title}</div>
    <p className="text-sm text-[var(--hc-text-secondary)] leading-relaxed tracking-tight">
      {body}
    </p>
  </div>
);

export default function PublicLanding() {
  const [membershipConfig, setMembershipConfig] = useState({
    framer_url: "",
    payment_link_url: "",
    price_display: "",
    billing_interval: "",
  });

  useEffect(() => {
    api.get("/membership/config")
      .then(({ data }) => setMembershipConfig(data || {}))
      .catch(() => setMembershipConfig({ framer_url: "", payment_link_url: "" }));
  }, []);

  const paymentLink = membershipConfig.payment_link_url || "";
  const framerUrl = membershipConfig.framer_url || "";
  const price = membershipConfig.price_display || "";
  const billingInterval = membershipConfig.billing_interval || "";
  const primaryCtaClass =
    "inline-flex w-full sm:w-auto items-center justify-center gap-2 bg-[#e3c36d] text-[#071925] px-7 py-4 text-xs tracking-[0.18em] uppercase font-semibold shadow-[0_10px_30px_rgba(0,0,0,0.24)] hover:bg-[#f0d587] transition-colors";

  return (
    <div data-testid="landing-page" className="min-h-screen bg-[var(--hc-bg)] text-[var(--hc-text)]">
      <header className="border-b border-[#c7a34f]/30 bg-[#071925]">
        <nav aria-label="Navegación pública" className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between gap-3">
          <Link to="/" aria-label="Hampton Crest Academy" className="min-w-0">
            <BrandLockup />
          </Link>
          <Link
            to="/login"
            data-testid="landing-login"
            className="shrink-0 px-3 sm:px-4 py-2.5 text-[0.65rem] sm:text-xs tracking-[0.14em] sm:tracking-[0.18em] uppercase border border-[#fffaf0] bg-[#fffaf0] text-[#071925] font-bold shadow-[0_6px_20px_rgba(0,0,0,0.28)] hover:border-[#e3c36d] hover:bg-[#e3c36d] transition-colors"
          >
            Iniciar sesión
          </Link>
        </nav>
      </header>

      <main>
      <section className="relative min-h-[640px] sm:min-h-[680px] overflow-hidden border-b border-[#c7a34f]/30 bg-[#071925]">
        <div
          className="absolute inset-0 bg-cover bg-[68%_bottom] opacity-[0.78] sm:bg-center sm:opacity-100"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1512453979798-5ea266f8880c?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85)",
          }}
        />
        <div className="absolute inset-0 bg-[#071925]/58 sm:bg-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#071925] via-[#071925]/92 to-[#071925]/55 sm:from-[#071925]/82 sm:via-[#071925]/34 sm:to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#071925]/95 via-[#071925]/42 to-[#071925]/56 sm:from-[#071925]/55 sm:via-transparent sm:to-[#071925]/10" />
        <div className="absolute inset-y-0 left-0 w-full sm:w-[74%] bg-gradient-to-r from-[#071925]/95 via-[#071925]/80 to-[#071925]/20 sm:from-[#071925]/48 sm:via-[#071925]/18 sm:to-transparent" />
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-32 min-h-[640px] sm:min-h-[680px] flex items-center">
          <div className="w-full max-w-3xl bg-[#071925]/82 sm:bg-[#071925]/52 border border-[#e3c36d]/25 sm:border-white/15 px-5 py-6 sm:px-8 sm:py-8 shadow-[0_24px_80px_rgba(0,0,0,0.38)] backdrop-blur-[2px] sm:backdrop-blur-[1px]">
            <div className="text-[0.64rem] sm:text-[0.72rem] tracking-[0.22em] sm:tracking-[0.28em] uppercase font-bold text-[#f7d982] mb-5 sm:mb-6 drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]">
              Patrimonio · Disciplina · Visión
            </div>
            <h1 className="text-[2.5rem] sm:text-6xl lg:text-7xl font-medium tracking-[-0.035em] sm:tracking-[-0.03em] leading-[1.02] sm:leading-[0.98] text-[#fffaf0] drop-shadow-[0_5px_20px_rgba(0,0,0,0.9)]">
              Inversiones con propósito.
              <span className="block text-[#f7d982] drop-shadow-[0_5px_18px_rgba(0,0,0,0.95)]">Resultados con disciplina.</span>
            </h1>
            <p className="mt-6 sm:mt-8 text-[0.94rem] sm:text-lg text-[#fffaf0] leading-relaxed max-w-2xl drop-shadow-[0_3px_14px_rgba(0,0,0,0.95)]">
              Hampton Crest Academy ofrece formación institucional, biblioteca curada y análisis
              para inversionistas que buscan construir patrimonio con criterio y rigor.
            </p>
            <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-stretch sm:items-start gap-3">
              <PaymentCta
                href={paymentLink}
                price={price}
                interval={billingInterval}
                testId="landing-cta-hero"
                className={primaryCtaClass}
              />
              {framerUrl ? (
                <a
                  href={framerUrl}
                  data-testid="landing-learn-more"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 border border-white/35 text-white/82 hover:text-white hover:border-[#e3c36d]/70 px-7 py-4 text-xs tracking-[0.18em] uppercase transition-colors"
                >
                  Conoce más
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[var(--hc-border)]">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="max-w-2xl mb-12">
            <div className="hc-overline">Lo que recibes como miembro</div>
            <h2 className="mt-3 text-2xl sm:text-3xl font-medium tracking-tight">
              Cuatro pilares de inteligencia financiera.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Pillar
              icon={BookOpen}
              title="Biblioteca curada"
              body="Una estantería seleccionada de libros que dieron forma a los mejores asignadores de capital del mundo."
            />
            <Pillar
              icon={GraduationCap}
              title="Educación estructurada"
              body="Módulos diseñados como un currículo: fundamentos, ciclos macro, construcción de cartera y disciplina conductual."
            />
            <Pillar
              icon={FileText}
              title="Reportes mensuales"
              body="Inteligencia mensual: postura macro, reflexiones de cartera y la carta del analista. Disponible en PDF."
            />
            <Pillar
              icon={BarChart3}
              title="Análisis profundo"
              body="Cobertura individual de empresas: tesis, fundamentales y seguimiento del analista a través del tiempo."
            />
          </div>
        </div>
      </section>

      <section className="border-b border-[var(--hc-border)] bg-[var(--hc-surface)]/40">
        <div className="max-w-6xl mx-auto px-6 py-14 grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div className="flex items-start gap-3">
            <Lock className="h-5 w-5 text-[var(--hc-gold)] shrink-0 mt-0.5" strokeWidth={1.5} />
            <div>
              <div className="hc-overline mb-1.5">Acceso privado</div>
              <p className="text-xs text-[var(--hc-text-secondary)] leading-relaxed">
                La academia es solo para miembros. Cuentas individuales con 2FA opcional y bloqueo
                por intentos fallidos.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-[var(--hc-gold)] shrink-0 mt-0.5" strokeWidth={1.5} />
            <div>
              <div className="hc-overline mb-1.5">Círculo discreto</div>
              <p className="text-xs text-[var(--hc-text-secondary)] leading-relaxed">
                Directorio de miembros confidencial. Sin redes sociales, sin ruido. Solo capital
                serio y pensamiento serio.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-[var(--hc-gold)] shrink-0 mt-0.5" strokeWidth={1.5} />
            <div>
              <div className="hc-overline mb-1.5">Membresía Stripe</div>
              <p className="text-xs text-[var(--hc-text-secondary)] leading-relaxed">
                Suscripción gestionada por Stripe. Cambia tu método de pago, ve facturas o cancela
                desde tu portal en cualquier momento.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="max-w-3xl mx-auto px-6 py-24 text-center">
          <div className="hc-overline mb-6">El círculo te espera</div>
          <h2 className="text-3xl sm:text-4xl font-medium tracking-[-0.02em] leading-tight">
            Únete a Hampton Crest Academy.
          </h2>
          <p className="mt-6 text-sm sm:text-base text-[var(--hc-text-secondary)] leading-relaxed max-w-xl mx-auto">
            Reservado para inversionistas que entienden que la disciplina, no el ruido, es la
            ventaja sostenible.
          </p>
          <div className="mt-10 flex items-center justify-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 border border-[var(--hc-border)] text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] px-7 py-4 text-xs tracking-[0.18em] uppercase transition-colors"
            >
              Ya soy miembro
            </Link>
          </div>
        </div>
      </section>
      </main>

      <footer className="border-t border-[var(--hc-border)]">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[0.65rem] tracking-[0.16em] uppercase text-[var(--hc-text-muted)]">
          <span>© Hampton Crest Academy · Est. 2026</span>
          <nav aria-label="Información legal" className="flex flex-wrap justify-center gap-4">
            <Link to="/terminos">Términos</Link>
            <Link to="/privacidad">Privacidad</Link>
            <Link to="/aviso-de-riesgo">Riesgo</Link>
            <a href="mailto:members@investorhamptoncrest.com">Soporte</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
