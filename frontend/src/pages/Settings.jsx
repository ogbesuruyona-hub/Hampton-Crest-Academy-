import React, { useEffect, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import { TwoFASetupDialog, TwoFADisableDialog } from "../components/TwoFADialogs";
import { Switch } from "../components/ui/switch";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { ShieldCheck, ShieldOff } from "lucide-react";

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

  return (
    <div data-testid="settings-page">
      <PageHeader
        overline="Members Suite · Settings"
        title="Settings"
        description="Manage your account, security, and delivery preferences."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel overline="Security" title="Two-Factor Authentication" testid="panel-2fa">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm">
                {twoFa.enabled ? (
                  <>
                    <ShieldCheck className="h-4 w-4 text-[var(--hc-gold)]" strokeWidth={1.5} />
                    <span className="text-[var(--hc-text)]">2FA is enabled</span>
                  </>
                ) : (
                  <>
                    <ShieldOff className="h-4 w-4 text-[var(--hc-text-muted)]" strokeWidth={1.5} />
                    <span className="text-[var(--hc-text-secondary)]">2FA is disabled</span>
                  </>
                )}
              </div>
              <p className="text-xs text-[var(--hc-text-muted)] tracking-tight mt-2 max-w-md leading-relaxed">
                When enabled, you'll be asked for a 6-digit code from your authenticator app each time
                you sign in. Backup codes are provided in case you lose access.
              </p>
              {twoFa.enabled && (
                <div className="hc-overline mt-3 text-[var(--hc-text-secondary)]">
                  {twoFa.backup_codes_remaining} backup codes remaining
                </div>
              )}
            </div>
            {twoFa.enabled ? (
              <button
                onClick={() => setDisableOpen(true)}
                data-testid="disable-2fa-button"
                className="px-5 py-2.5 text-xs tracking-[0.18em] uppercase border border-[#7A2424] text-[#E07A7A] hover:bg-[#2A0F0F] transition-colors shrink-0"
              >
                Disable
              </button>
            ) : (
              <button
                onClick={() => setSetupOpen(true)}
                data-testid="enable-2fa-button"
                className="px-5 py-2.5 text-xs tracking-[0.18em] uppercase bg-[var(--hc-platinum)] text-[var(--hc-bg)] hover:bg-white transition-colors shrink-0"
              >
                Enable 2FA
              </button>
            )}
          </div>
        </Panel>

        <Panel overline="Notifications" title="Email Delivery" testid="panel-email">
          <Row
            label="Content Digest Emails"
            value={digestOptIn ? "Enabled — you'll receive new publications" : "Disabled"}
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
            We email new research notes, education modules, and monthly reports as they are
            published. You can opt out anytime.
          </div>
        </Panel>

        <Panel overline="Account" title="Profile" testid="panel-account">
          <Row label="Full Name" value={user?.name || "—"} testid="setting-name" />
          <Row label="Email" value={user?.email || "—"} testid="setting-email" />
          <Row label="Role" value={user?.role || "member"} testid="setting-role" />
        </Panel>

        <Panel overline="Preferences" title="Display" testid="panel-display">
          <Row label="Theme" value="Institutional Dark" testid="setting-theme" />
          <Row label="Language" value="English (US)" testid="setting-language" />
          <Row label="Time Zone" value="Automatic" testid="setting-tz" />
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
