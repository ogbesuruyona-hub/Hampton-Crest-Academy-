import React from "react";
import { Link } from "react-router-dom";
import BrandLockup from "./BrandLockup";

export default function PublicPageShell({ title, eyebrow, children }) {
  return (
    <div className="min-h-screen bg-[var(--hc-bg)] text-[var(--hc-text)]">
      <header className="border-b border-[#c7a34f]/30 bg-[#071925]">
        <nav aria-label="Navegación pública" className="max-w-5xl mx-auto px-5 sm:px-6 py-4 flex items-center justify-between gap-4">
          <Link to="/" aria-label="Hampton Crest Academy"><BrandLockup /></Link>
          <Link to="/login" className="px-4 py-2.5 text-xs tracking-[0.16em] uppercase bg-[#fffaf0] text-[#071925] font-bold">
            Iniciar sesión
          </Link>
        </nav>
      </header>
      <main className="max-w-3xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
        <p className="hc-overline">{eyebrow}</p>
        <h1 className="mt-3 text-3xl sm:text-5xl font-medium tracking-tight">{title}</h1>
        <div className="mt-8 hc-gold-rule" />
        <article className="mt-10 space-y-8 text-sm sm:text-base leading-7 text-[var(--hc-text-secondary)]">
          {children}
        </article>
      </main>
      <footer className="border-t border-[var(--hc-border)]">
        <nav aria-label="Información legal" className="max-w-5xl mx-auto px-6 py-8 flex flex-wrap gap-x-6 gap-y-3 text-xs">
          <Link to="/terminos">Términos</Link>
          <Link to="/privacidad">Privacidad</Link>
          <Link to="/aviso-de-riesgo">Aviso de riesgo</Link>
          <a href="mailto:members@investorhamptoncrest.com">Soporte</a>
        </nav>
      </footer>
    </div>
  );
}
