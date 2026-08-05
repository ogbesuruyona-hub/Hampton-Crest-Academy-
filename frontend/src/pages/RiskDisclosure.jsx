import React from "react";
import PublicPageShell from "../components/PublicPageShell";

export default function RiskDisclosure() {
  return (
    <PublicPageShell title="Aviso educativo y de riesgo" eyebrow="Información importante">
      <section><h2 className="text-xl text-[var(--hc-text)]">Contenido educativo</h2><p className="mt-2">Todo el contenido se proporciona exclusivamente con fines educativos e informativos. No constituye asesoramiento financiero, legal, fiscal o de inversión, ni una oferta o solicitud para comprar o vender valores.</p></section>
      <section><h2 className="text-xl text-[var(--hc-text)]">Riesgo de pérdida</h2><p className="mt-2">Toda inversión implica riesgo, incluida la posible pérdida total del capital. El desempeño pasado, los ejemplos y las estimaciones no garantizan resultados futuros. Debes evaluar tu situación y consultar profesionales independientes cuando corresponda.</p></section>
      <section><h2 className="text-xl text-[var(--hc-text)]">Decisiones independientes</h2><p className="mt-2">Las opiniones pueden cambiar sin aviso y pueden contener errores o información incompleta. Eres responsable de verificar la información y de tus propias decisiones.</p></section>
    </PublicPageShell>
  );
}
