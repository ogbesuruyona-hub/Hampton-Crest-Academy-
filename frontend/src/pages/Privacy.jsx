import React from "react";
import PublicPageShell from "../components/PublicPageShell";

export default function Privacy() {
  return (
    <PublicPageShell title="Política de privacidad" eyebrow="Privacidad y datos">
      <section><h2 className="text-xl text-[var(--hc-text)]">Datos que tratamos</h2><p className="mt-2">Tratamos los datos necesarios para crear y proteger tu cuenta, gestionar la membresía, entregar contenido, responder soporte y prevenir abuso: nombre, correo, preferencias de perfil, estado de suscripción, registros técnicos y actividad esencial de seguridad.</p></section>
      <section><h2 className="text-xl text-[var(--hc-text)]">Pagos y proveedores</h2><p className="mt-2">Stripe procesa el pago y los datos de tarjeta; Hampton Crest Academy recibe identificadores y estados de facturación, no el número completo de la tarjeta. También podemos usar proveedores de infraestructura, base de datos y correo únicamente para operar el servicio.</p></section>
      <section><h2 className="text-xl text-[var(--hc-text)]">Cookies</h2><p className="mt-2">Usamos cookies estrictamente necesarias para autenticación y protección CSRF. En la versión actual no cargamos PostHog, publicidad, grabación de sesiones ni cookies analíticas. Si esto cambia, solicitaremos el consentimiento que corresponda antes de activar tecnologías no esenciales.</p></section>
      <section><h2 className="text-xl text-[var(--hc-text)]">Conservación y derechos</h2><p className="mt-2">Conservamos datos mientras la cuenta esté activa y durante el tiempo razonablemente necesario para obligaciones legales, seguridad y resolución de disputas. Puedes solicitar acceso, corrección o eliminación escribiendo a <a className="underline" href="mailto:members@investorhamptoncrest.com">members@investorhamptoncrest.com</a>.</p></section>
    </PublicPageShell>
  );
}
