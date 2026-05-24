import React from "react";
import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import { useAuth } from "../context/AuthContext";

const Field = ({ label, value, testid }) => (
  <div className="py-4 border-b border-[var(--hc-border)] last:border-0">
    <div className="hc-overline mb-1.5">{label}</div>
    <div data-testid={testid} className="text-sm text-[var(--hc-text)] tracking-tight">
      {value || "—"}
    </div>
  </div>
);

export default function MemberProfile() {
  const { user } = useAuth();
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

  return (
    <div data-testid="profile-page">
      <PageHeader
        overline="Members Suite · Profile"
        title="Member Profile"
        description="Your standing within Hampton Crest Academy."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-[var(--hc-surface)] border border-[var(--hc-border)] p-8 flex flex-col items-center text-center">
            <div className="h-24 w-24 flex items-center justify-center border border-[var(--hc-gold)]/40 bg-[var(--hc-bg)] text-2xl tracking-[0.2em] text-[var(--hc-platinum)]">
              {(user?.name || "HC")
                .split(" ")
                .map((s) => s[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div className="mt-6 text-lg font-medium tracking-tight text-[var(--hc-text)]">
              {user?.name || "Member"}
            </div>
            <div className="hc-overline mt-1 text-[var(--hc-gold)]">
              {user?.role === "admin" ? "Steward" : "Charter Member"}
            </div>
            <div className="mt-6 hc-gold-rule w-2/3" />
            <div className="mt-6 text-xs text-[var(--hc-text-secondary)] tracking-tight max-w-xs">
              Member of Hampton Crest Academy — a private circle of disciplined capital allocators.
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <Panel overline="Account" title="Details" testid="panel-profile-details">
            <Field label="Full Name" value={user?.name} testid="profile-name" />
            <Field label="Email" value={user?.email} testid="profile-email" />
            <Field label="Role" value={user?.role} testid="profile-role" />
            <Field label="Member Since" value={memberSince} testid="profile-since" />
          </Panel>
        </div>
      </div>
    </div>
  );
}
