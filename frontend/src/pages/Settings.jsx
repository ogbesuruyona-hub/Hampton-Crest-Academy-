import React, { useEffect, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import { TwoFASetupDialog, TwoFADisableDialog } from "../components/TwoFADialogs";
import { Switch } from "../components/ui/switch";
import { api, formatApiErrorDetail } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { ShieldCheck, ShieldOff, CreditCard, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const Row = ({ label, value, action, testid }) => (
  <div
    data-testid={testid}
    className="flex items-center justify-between py-4 border-b border-[var(--hc-border)] last:border-0 gap-4"
  >
    <div className="min-w-0">
      <div className="hc-overline">{label}</div>
      {value && <div className="text-sm text-[var(--hc-text)] tracking-tight mt-1">{value}</div>}
    </div>
    {action}
  </div>
);

export default function Settings() {
  const { user, refresh } = useAuth();
  const [twoFa, setTwoFa] = useState({ enabled: false, backup_codes_remaining: 0 });
  const [setupOpen, setSetupOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [digestOptIn, setDigestOptIn] = useState(user?.email_digest_opt_in !== false);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const loadStatus = async () => {
    try {
      const { data } = await api.get("/auth/2fa/status");
      setTwoFa(data);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  useEffect(() => {
    setDigestOptIn(user?.email_digest_opt_in !== false);
  }, [user]);

  const togglePrefs = async (next) => {
    setDigestOptIn(next);
    setSavingPrefs(true);
    try {
      await api.put("/auth/email-preferences", { email_digest_opt_in: next });
      await refresh();
    } catch {
      setDigestOptIn(!next);
    } finally {
      setSavingPrefs(false);
    }
  };

  const [billingLoading, setBillingLoading] = useState(false);
  const openBillingPortal = async () => {
    setBillingLoading(true);
    try {
      const { data } = await api.post("/billing/portal");
      window.location.href = data.url;
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setBillingLoading(false);
    }
  };

  return (
    <div data-testid="settings-page">
      <PageHeader
        overline="Academia · Ajustes"
        title="Ajustes"
        description="Gestiona tu cuenta, seguridad y preferencias de entrega."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel overline="Seguridad" title="Autenticación de dos factores" testid="panel-2fa">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm">
                {twoFa.enabled ? (
                  <>
                    <ShieldCheck className="h-4 w-4 text-[var(--hc-gold)]" strokeWidth={1.5} />
                    <span className="text-[var(--hc-text)]">2FA está activado</span>
                  </>
                ) : (
                  <>
                    <ShieldOff className="h-4 w-4 text-[var(--hc-text-muted)]" strokeWidth={1.5} />
                    <span className="text-[var(--hc-text-secondary)]">2FA está desactivado</span>
                  </>
                )}
              </div>
              <p className="text-xs text-[var(--hc-text-muted)] tracking-tight mt-2 max-w-md leading-relaxed">
                Cuando esté activo, te pediremos un código de 6 dígitos de tu app de autenticación
                cada vez que inicies sesión. Se generan códigos de respaldo por si pierdes el acceso.
              </p>
              {twoFa.enabled && (
                <div className="hc-overline mt-3 text-[var(--hc-text-secondary)]">
                  {twoFa.backup_codes_remaining} códigos de respaldo restantes
                </div>
              )}
            </div>
            {twoFa.enabled ? (
              <button
                onClick={() => setDisableOpen(true)}
                data-testid="disable-2fa-button"
                className="px-5 py-2.5 text-xs tracking-[0.18em] uppercase border border-[#7A2424] text-[#E07A7A] hover:bg-[#2A0F0F] transition-colors shrink-0"
              >
                Desactivar
              </button>
            ) : (
              <button
                onClick={() => setSetupOpen(true)}
                data-testid="enable-2fa-button"
                className="px-5 py-2.5 text-xs tracking-[0.18em] uppercase bg-[var(--hc-platinum)] text-[var(--hc-bg)] hover:bg-white transition-colors shrink-0"
              >
                Activar 2FA
              </button>
            )}
          </div>
        </Panel>

        <Panel overline="Notificaciones" title="Entrega por correo" testid="panel-email">
          <Row
            label="Resúmenes por correo"
            value={digestOptIn ? "Activado — recibirás nuevas publicaciones" : "Desactivado"}
            testid="setting-digest"
            action={
              <Switch
                checked={digestOptIn}
                onCheckedChange={togglePrefs}
                disabled={savingPrefs}
                data-testid="digest-switch"
                className="data-[state=checked]:bg-[var(--hc-gold)]"
              />
            }
          />
          <div className="text-xs text-[var(--hc-text-muted)] tracking-tight mt-3 leading-relaxed">
            Te enviamos por correo cada nueva investigación, módulo educativo y reporte mensual
            cuando se publica. Puedes desactivarlo en cualquier momento.
          </div>
        </Panel>

        {user?.role !== "admin" && !user?.complimentary && (
          <Panel overline="Facturación" title="Membresía" testid="panel-billing">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
              <div className="min-w-0 max-w-md">
                <div className="flex items-center gap-2 text-sm">
                  <CreditCard className="h-4 w-4 text-[var(--hc-gold)] shrink-0" strokeWidth={1.5} />
                  <span className="text-[var(--hc-text)]">
                    {user?.membership_status === "active"
                      ? "Membresía activa"
                      : "Membresía inactiva"}
                  </span>
                </div>
                <p
                  data-testid="billing-description"
                  className="text-xs text-[var(--hc-text-muted)] tracking-tight mt-3 leading-relaxed"
                >
                  Administra tu método de pago, consulta facturas o cancela tu suscripción desde el
                  portal seguro de Stripe. Te redirige a una página externa y regresas a Ajustes al
                  terminar.
                </p>
              </div>
              <button
                onClick={openBillingPortal}
                disabled={billingLoading}
                data-testid="billing-portal-button"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs tracking-[0.18em] uppercase bg-[var(--hc-platinum)] text-[var(--hc-bg)] hover:bg-white transition-colors shrink-0 self-start disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {billingLoading ? "Abriendo…" : "Administrar suscripción"}
                <ExternalLink className="h-3 w-3" strokeWidth={1.5} />
              </button>
            </div>
          </Panel>
        )}

        <Panel overline="Cuenta" title="Perfil" testid="panel-account">
          <Row label="Nombre completo" value={user?.name || "—"} testid="setting-name" />
          <Row label="Correo electrónico" value={user?.email || "—"} testid="setting-email" />
          <Row label="Teléfono" value={user?.phone || "—"} testid="setting-phone" />
        </Panel>
      </div>

      <TwoFASetupDialog
        open={setupOpen}
        onOpenChange={setSetupOpen}
        onEnabled={() => {
          loadStatus();
          refresh();
        }}
      />
      <TwoFADisableDialog
        open={disableOpen}
        onOpenChange={setDisableOpen}
        onDisabled={() => {
          loadStatus();
          refresh();
        }}
      />
    </div>
  );
}
