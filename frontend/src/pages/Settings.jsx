import React from "react";
import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";

const Row = ({ label, value, testid }) => (
  <div
    data-testid={testid}
    className="flex items-center justify-between py-4 border-b border-[var(--hc-border)] last:border-0"
  >
    <span className="hc-overline">{label}</span>
    <span className="text-sm text-[var(--hc-text)] tracking-tight">{value}</span>
  </div>
);

export default function Settings() {
  return (
    <div data-testid="settings-page">
      <PageHeader
        overline="Members Suite · Settings"
        title="Settings"
        description="Manage preferences for your Hampton Crest account."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel overline="Preferences" title="Display & Delivery" testid="panel-preferences">
          <Row label="Theme" value="Institutional Dark" testid="setting-theme" />
          <Row label="Language" value="English (US)" testid="setting-language" />
          <Row label="Time Zone" value="Automatic" testid="setting-tz" />
          <Row label="Email Notifications" value="Enabled" testid="setting-email" />
        </Panel>

        <Panel overline="Security" title="Account Security" testid="panel-security">
          <Row label="Two-Factor Auth" value="Not configured" testid="setting-2fa" />
          <Row label="Active Sessions" value="1 device" testid="setting-sessions" />
          <Row label="Password" value="Last changed —" testid="setting-password" />
          <div className="pt-5">
            <button
              data-testid="change-password-button"
              className="w-full sm:w-auto px-5 py-2.5 text-xs tracking-[0.16em] uppercase border border-[var(--hc-border)] text-[var(--hc-text)] hover:bg-[var(--hc-surface-elevated)] transition-colors"
            >
              Change Password
            </button>
          </div>
        </Panel>
      </div>
    </div>
  );
}
