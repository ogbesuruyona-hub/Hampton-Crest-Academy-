import React from "react";
import { Link } from "react-router-dom";
import { BookOpen, GraduationCap, FileText, BarChart3, Lock, ArrowUpRight, ShieldCheck, Users } from "lucide-react";

const LOGO_URL =
  "https://customer-assets.emergentagent.com/job_hampton-crest/artifacts/nj6t4ufd_35939535-7E23-42A3-BF88-4E1ED39508BB.png";

const PAYMENT_LINK =
  process.env.REACT_APP_PAYMENT_LINK_URL ||
  "https://buy.stripe.com/eVqbJ0gqAaXT3A8eDkdjO02";
const FRAMER_URL =
  process.env.REACT_APP_FRAMER_URL || "https://hamptonacademy.framer.website";

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
  return (
    <div data-testid="landing-page" className="min-h-screen bg-[var(--hc-bg)] text-[var(--hc-text)]">
      {/* Header */}
      <header className="border-b border-[var(--hc-border)]">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img
              src={LOGO_URL}
              alt="Hampton Crest"
              className="h-9 w-9 object-contain"
              style={{ mixBlendMode: "screen" }}
            />
            <div className="leading-tight">
              <div className="text-[0.7rem] tracking-[0.22em] text-[var(--hc-gold)] uppercase font-semibold">
                Hampton Crest
              </div>
              <div className="text-[0.6rem] tracking-[0.32em] text-[var(--hc-text-muted)] uppercase">
                Academy
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              data-testid="landing-login"
              className="px-4 py-2 text-xs tracking-[0.18em] uppercase border border-[var(--hc-border)] text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] transition-colors"
            >
              Iniciar sesión
            </Link>
            <a
              href={PAYMENT_LINK}
              data-testid="landing-cta-top"
              className="px-4 py-2 text-xs tracking-[0.18em] uppercase bg-[var(--hc-platinum)] text-[var(--hc-bg)] hover:bg-white transition-colors hidden sm:inline-flex items-center gap-1.5"
            >
              Quiero ser miembro
              <ArrowUpRight className="h-3 w-3" strokeWidth={1.5} />
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[var(--hc-border)]">
        <div
          className="absolute inset-0 opacity-[0.45]"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1593427995298-cad6731716d8?crop=entropy&cs=srgb&fm=jpg&q=85)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--hc-bg)]/85 via-[var(--hc-bg)]/65 to-[var(--hc-bg)]/95" />
        <div className="relative z-10 max-w-6xl mx-auto px-6 py-24 sm:py-32">
          <div className="max-w-3xl">
            <div className="hc-overline mb-6">Academia privada de inversión</div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-medium tracking-[-0.02em] leading-[1.05] text-[var(--hc-text)]">
              El capital disciplinado nace del pensamiento disciplinado.
            </h1>
            <div className="mt-8 hc-gold-rule" />
            <p className="mt-8 text-base sm:text-lg text-[var(--hc-text-secondary)] leading-relaxed max-w-2xl">
              Una academia privada reservada para inversionistas serios. Biblioteca curada,
              educación estructurada, reportes mensuales y análisis profundo de empresas — todo en
              un mismo lugar, sin ruido.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-start gap-3">
              <a
                href={PAYMENT_LINK}
                data-testid="landing-cta-hero"
                className="inline-flex items-center gap-2 bg-[var(--hc-platinum)] text-[var(--hc-bg)] px-7 py-4 text-xs tracking-[0.18em] uppercase font-semibold hover:bg-white transition-colors"
              >
                Quiero ser miembro
                <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
              </a>
              <a
                href={FRAMER_URL}
                data-testid="landing-learn-more"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 border border-[var(--hc-border)] text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] hover:border-[var(--hc-gold)]/60 px-7 py-4 text-xs tracking-[0.18em] uppercase transition-colors"
              >
                Conoce más
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Pillars */}
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
              body="Módulos diseñados como un currículum — fundamentos, ciclos macro, construcción de cartera y disciplina conductual."
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

      {/* Trust strip */}
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

      {/* Final CTA */}
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
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href={PAYMENT_LINK}
              data-testid="landing-cta-footer"
              className="inline-flex items-center gap-2 bg-[var(--hc-platinum)] text-[var(--hc-bg)] px-7 py-4 text-xs tracking-[0.18em] uppercase font-semibold hover:bg-white transition-colors"
            >
              Quiero ser miembro
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
            </a>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 border border-[var(--hc-border)] text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] px-7 py-4 text-xs tracking-[0.18em] uppercase transition-colors"
            >
              Ya soy miembro
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--hc-border)]">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[0.65rem] tracking-[0.22em] uppercase text-[var(--hc-text-muted)]">
          <span>© Hampton Crest Academy · Est. 2026</span>
          <span>Confidencial · Solo Miembros</span>
        </div>
      </footer>
    </div>
  );
}
