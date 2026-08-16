# Hampton Crest Academy — producción

## Bloqueos antes de abrir al público

1. Rotar en Vercel `JWT_SECRET` (mínimo 32 caracteres), cualquier contraseña que haya aparecido en Git y `STRIPE_WEBHOOK_SECRET`. Revocar las credenciales anteriores.
2. Activar 2FA en la cuenta administradora y retirar `ADMIN_PASSWORD` de Vercel después de verificar el acceso inicial.
3. Configurar `MEMBERSHIP_PRICE_DISPLAY` (incluye moneda e importe) y `MEMBERSHIP_BILLING_INTERVAL` (por ejemplo, “cada mes”). Sin ambos valores el backend no entrega el enlace de pago.
4. Registrar en Stripe el endpoint `https://academy.hamptoncrestcapital.com/api/webhook/stripe` y suscribir los eventos documentados en la sección siguiente.
5. Configurar `APP_PUBLIC_URL`, `CORS_ORIGINS`, `SUPPORT_EMAIL`, `SENDER_EMAIL`, `RESEND_API_KEY` y `EMAILS_ENABLED=true`.

Para recuperar una cuenta administradora existente, establece temporalmente `ADMIN_FORCE_PASSWORD_RESET=true`, actualiza `ADMIN_PASSWORD`, despliega y verifica el acceso. Inmediatamente después cambia el indicador a `false`, retira `ADMIN_PASSWORD` y vuelve a desplegar.

## Prueba controlada de facturación

Usar una cuenta y tarjeta controladas. Verificar, en orden: Checkout completado; evento `checkout.session.completed`; creación de usuario/invitación; correo; contraseña; login; portal de facturación; cancelación; acceso hasta `current_period_end`; suspensión posterior. Probar además `invoice.payment_failed`, recuperación con `invoice.paid` y fin del periodo de gracia.

Los webhooks mínimos son: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_succeeded`, `invoice.payment_failed`, `invoice.payment_action_required` e `invoice.finalization_failed`. Stripe debe reintentar todo evento que no reciba 2xx. Revisar diariamente los eventos fallidos y alertar si existe alguno sin resolver.

## Monitoreo y recuperación

- Crear alertas de Vercel para tasa de errores 5xx, fallos de función y latencia. Revisar específicamente logs con `Stripe handler error` y `runtime bootstrap failed`.
- Activar alertas de Stripe para webhooks fallidos y pagos fallidos; comprobar que las notificaciones lleguen a una dirección operativa compartida.
- Activar copias de seguridad automáticas de MongoDB, con retención acorde a las obligaciones legales. Una vez por trimestre, restaurar la copia más reciente en una base aislada y documentar duración, conteos y errores.
- Objetivo inicial sugerido: RPO de 24 horas y RTO de 4 horas. Para recuperar: congelar escrituras, restaurar en una base nueva, validar usuarios/membresías/contenido, cambiar `MONGO_URL`, desplegar, ejecutar `/api/health` y un login controlado.

## Dominio y correo

El dominio público es `academy.hamptoncrestcapital.com`. Mantener `APP_PUBLIC_URL`, canonical, Open Graph, sitemap y Stripe apuntando a ese dominio. En el proveedor de correo publicar SPF y DKIM; publicar DMARC inicialmente con `p=none`, observar reportes y después endurecer a `quarantine` o `reject`. Probar entrega a Gmail, Outlook y Yahoo.

## Staging y cambios

Mantener un proyecto Vercel de staging con base Mongo, claves Stripe de prueba, webhook y remitente separados. Ningún secreto de producción debe estar disponible en previews. Todo cambio pasa CI, preview, prueba de login y prueba de webhook antes de promoverse. Los despliegues se revierten desde Vercel al último artefacto saludable; los cambios de esquema deben ser compatibles hacia atrás.

## Respuesta a exposición de secretos

Rotar primero, limpiar después. Registrar qué secreto, periodo y accesos pudieron verse. Invalidar sesiones al rotar JWT, revisar logs de administrador y Stripe, limpiar el historial Git y pedir a colaboradores que vuelvan a clonar en lugar de fusionar historiales antiguos.
