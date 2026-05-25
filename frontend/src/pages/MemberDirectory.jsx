import React, { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import { EmptyState } from "../components/EmptyState";
import { api } from "../lib/api";
import { Users, Search, Mail, Phone, ShieldCheck } from "lucide-react";

const initialsOf = (name) =>
  (name || "HC")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const RoleBadge = ({ role }) => {
  if (role === "admin") {
    return (
      <span
        data-testid="directory-role-admin"
        className="inline-flex items-center gap-1 px-2 py-0.5 text-[0.65rem] tracking-[0.18em] uppercase border border-[var(--hc-gold)]/60 text-[var(--hc-gold)] bg-[var(--hc-gold-soft)]"
      >
        <ShieldCheck className="h-3 w-3" strokeWidth={1.5} /> Steward
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 text-[0.65rem] tracking-[0.18em] uppercase border border-[var(--hc-border)] text-[var(--hc-text-secondary)]">
      Charter
    </span>
  );
};

export default function MemberDirectory() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/directory", { params: q ? { q } : {} });
      setMembers(data);
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    load();
  }, [load]);

  const total = useMemo(() => members.length, [members]);

  return (
    <div data-testid="directory-page">
      <PageHeader
        overline="Members Suite · Directory"
        title="Member Directory"
        description="A discreet roster of fellow Hampton Crest members. Use it to find a name, drop a line, or pick up the phone."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-[var(--hc-surface)] border border-[var(--hc-border)] p-5">
          <div className="hc-overline">Listed</div>
          <div
            data-testid="directory-total"
            className="mt-2 text-2xl font-medium tracking-tight text-[var(--hc-text)]"
          >
            {total}
          </div>
        </div>
        <div className="bg-[var(--hc-surface)] border border-[var(--hc-border)] p-5 sm:col-span-2">
          <div className="hc-overline">Confidentiality</div>
          <div className="mt-2 text-xs text-[var(--hc-text-secondary)] tracking-tight leading-relaxed">
            Contact details are visible only to active charter members. Treat with the discretion
            this circle expects.
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-8 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--hc-text-muted)]"
            strokeWidth={1.5}
          />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, email, or phone…"
            data-testid="directory-search"
            className="w-full bg-[var(--hc-surface)] border border-[var(--hc-border)] text-sm text-[var(--hc-text)] pl-9 pr-3 py-2.5 focus:outline-none focus:border-[var(--hc-gold)]"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-[var(--hc-text-muted)] py-12 text-center">Loading…</div>
      ) : members.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No members to show"
          description="As the circle grows, charter members will appear here."
        />
      ) : (
        <Panel testid="directory-table">
          <div className="-m-6 divide-y divide-[var(--hc-border)]">
            {members.map((m) => (
              <div
                key={m.id}
                data-testid={`directory-row-${m.id}`}
                className="grid grid-cols-1 lg:grid-cols-[260px_1fr_1fr_auto] items-center gap-4 px-6 py-4 hover:bg-[var(--hc-surface-elevated)] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 shrink-0 flex items-center justify-center border border-[var(--hc-gold)]/40 bg-[var(--hc-bg)] text-[0.7rem] tracking-[0.2em] text-[var(--hc-platinum)]">
                    {initialsOf(m.name)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium tracking-tight text-[var(--hc-text)] truncate">
                      {m.name || "—"}
                    </div>
                  </div>
                </div>

                <a
                  href={`mailto:${m.email}`}
                  data-testid={`directory-email-${m.id}`}
                  className="flex items-center gap-2 text-xs text-[var(--hc-text-secondary)] hover:text-[var(--hc-gold)] transition-colors min-w-0"
                >
                  <Mail className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                  <span className="truncate">{m.email}</span>
                </a>

                {m.phone ? (
                  <a
                    href={`tel:${m.phone}`}
                    data-testid={`directory-phone-${m.id}`}
                    className="flex items-center gap-2 text-xs text-[var(--hc-text-secondary)] hover:text-[var(--hc-gold)] transition-colors"
                  >
                    <Phone className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                    <span className="truncate">{m.phone}</span>
                  </a>
                ) : (
                  <div
                    data-testid={`directory-phone-${m.id}`}
                    className="flex items-center gap-2 text-xs text-[var(--hc-text-muted)]"
                  >
                    <Phone className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                    <span>—</span>
                  </div>
                )}

                <RoleBadge role={m.role} />
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
