import React from "react";
import PublicPageShell from "../components/PublicPageShell";

export default function Terms() {
  return (
    <PublicPageShell title="Términos de servicio" eyebrow="Vigentes desde agosto de 2026">
      <section><h2 className="text-xl text-[var(--hc-text)]">Servicio y membresía</h2><p className="mt-2">Hampton Crest Academy ofrece contenido educativo, herramientas de análisis y acceso privado para miembros. El precio y la frecuencia de cobro se muestran antes de abrir Stripe y nuevamente antes de confirmar el pago.</p></section>
      <section><h2 className="text-xl text-[var(--hc-text)]">Cobro, cancelación y reembolsos</h2><p className="mt-2">La suscripción se renueva con la frecuencia indicada al contratar. Puedes cancelarla desde el portal de facturación; la cancelación evita renovaciones futuras y el acceso continúa hasta terminar el periodo ya pagado. Las solicitudes de reembolso se revisan individualmente según el servicio consumido y la ley aplicable. Escríbenos antes de presentar una disputa para poder ayudarte.</p></section>
      <section><h2 className="text-xl text-[var(--hc-text)]">Pagos fallidos</h2><p className="mt-2">Si una renovación falla, podremos conceder un periodo de gracia y pedirte que actualices el método de pago. Al terminar ese periodo, el acceso se suspende hasta que Stripe confirme un pago exitoso.</p></section>
      <section><h2 className="text-xl text-[var(--hc-text)]">Uso aceptable</h2><p className="mt-2">La cuenta es personal. No puedes redistribuir materiales, intentar acceder a cuentas ajenas, automatizar extracciones ni usar el servicio para actividades ilícitas.</p></section>
      <section><h2 className="text-xl text-[var(--hc-text)]">Contacto</h2><p className="mt-2">El servicio opera bajo la marca Hampton Crest Academy. Para soporte, cancelaciones, privacidad o reembolsos: <a className="underline" href="mailto:members@investorhamptoncrest.com">members@investorhamptoncrest.com</a>.</p></section>
    </PublicPageShell>
  );
}
