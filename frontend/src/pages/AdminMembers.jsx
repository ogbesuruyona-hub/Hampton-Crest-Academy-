import React, { useCallback, useEffect, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import { EmptyState } from "../components/EmptyState";
import { api, formatApiErrorDetail } from "../lib/api";
import { formatDate } from "../lib/content";
import { Users, Search, Mail, Ban, ShieldCheck } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";

const StatusPill = ({ user }) => {
  if (user.role === "admin") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[0.65rem] tracking-[0.18em] uppercase border border-[var(--hc-gold)]/60 text-[var(--hc-gold)] bg-[var(--hc-gold-soft)]">
        <ShieldCheck className="h-3 w-3" strokeWidth={1.5} /> Admin
      </span>
    );
  }
  if (user.complimentary) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 text-[0.65rem] tracking-[0.18em] uppercase border border-[var(--hc-gold)]/40 text-[var(--hc-gold)] bg-[var(--hc-gold-soft)]">
        Complimentary
      </span>
    );
  }
  if (user.membership_status === "active") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 text-[0.65rem] tracking-[0.18em] uppercase border border-[var(--hc-gold)]/40 text-[var(--hc-gold)] bg-[var(--hc-gold-soft)]">
        Active
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 text-[0.65rem] tracking-[0.18em] uppercase border border-[var(--hc-border)] text-[var(--hc-text-muted)]">
      Inactive
    </span>
  );
};

export default function AdminMembers() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [actionTarget, setActionTarget] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (q) params.q = q;
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get("/admin/members", { params });
      setMembers(data);
    } finally {
      setLoading(false);
    }
  }, [q, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = members.reduce(
    (acc, m) => {
      if (m.role === "admin") acc.admin += 1;
      else if (m.complimentary || m.membership_status === "active") acc.active += 1;
      else acc.inactive += 1;
      return acc;
    },
    { active: 0, inactive: 0, admin: 0 },
  );

  const toggleComplimentary = async (user) => {
    try {
      await api.put(`/admin/members/${user.id}`, { complimentary: !user.complimentary });
      await load();
    } catch (e) {
      alert(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    }
  };

  const revokeMember = async (user) => {
    try {
      await api.post(`/admin/members/${user.id}/revoke`);
      await load();
    } catch (e) {
      alert(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    }
  };

  const resendInvite = async (user) => {
    try {
      await api.post(`/admin/members/${user.id}/resend-invite`);
      alert("Invitation email sent.");
    } catch (e) {
      alert(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    }
  };

  return (
    <div data-testid="admin-members-page">
      <PageHeader
        overline="Admin · Roster"
        title="Members"
        description="Active charter members, complimentary access, and lapsed accounts. Manage roster, revoke access, or resend invites."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-[var(--hc-surface)] border border-[var(--hc-border)] p-5">
          <div className="hc-overline">Active</div>
          <div className="mt-2 text-2xl font-medium tracking-tight text-[var(--hc-text)]">
            {counts.active}
          </div>
        </div>
        <div className="bg-[var(--hc-surface)] border border-[var(--hc-border)] p-5">
          <div className="hc-overline">Inactive</div>
          <div className="mt-2 text-2xl font-medium tracking-tight text-[var(--hc-text)]">
            {counts.inactive}
          </div>
        </div>
        <div className="bg-[var(--hc-surface)] border border-[var(--hc-border)] p-5">
          <div className="hc-overline">Admin</div>
          <div className="mt-2 text-2xl font-medium tracking-tight text-[var(--hc-text)]">
            {counts.admin}
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
            placeholder="Search by email or name…"
            data-testid="members-search"
            className="w-full bg-[var(--hc-surface)] border border-[var(--hc-border)] text-sm text-[var(--hc-text)] pl-9 pr-3 py-2.5 focus:outline-none focus:border-[var(--hc-gold)]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          data-testid="members-status-filter"
          className="bg-[var(--hc-surface)] border border-[var(--hc-border)] text-[var(--hc-text)] text-xs tracking-[0.14em] uppercase px-4 py-2.5 focus:outline-none focus:border-[var(--hc-gold)]"
        >
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {loading ? (
        <div className="text-sm text-[var(--hc-text-muted)] py-12 text-center">Loading…</div>
      ) : members.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No members yet"
          description="Members will appear here as soon as they subscribe via the Stripe payment link."
        />
      ) : (
        <Panel testid="members-table">
          <div className="-m-6 divide-y divide-[var(--hc-border)]">
            {members.map((m) => (
              <div
                key={m.id}
                data-testid={`member-row-${m.id}`}
                className="grid grid-cols-1 lg:grid-cols-[1fr_140px_140px_auto] items-center gap-4 px-6 py-4 hover:bg-[var(--hc-surface-elevated)] transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium tracking-tight text-[var(--hc-text)] truncate">
                    {m.name}
                  </div>
                  <div className="text-xs text-[var(--hc-text-secondary)] truncate">
                    {m.email}
                  </div>
                </div>
                <StatusPill user={m} />
                <div className="text-xs text-[var(--hc-text-muted)] tracking-tight">
                  Joined {formatDate(m.created_at)}
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-start lg:justify-end">
                  {m.role !== "admin" && (
                    <>
                      <button
                        onClick={() => toggleComplimentary(m)}
                        data-testid={`toggle-comp-${m.id}`}
                        className="px-3 py-1.5 text-[0.65rem] tracking-[0.18em] uppercase border border-[var(--hc-border)] text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] transition-colors"
                      >
                        {m.complimentary ? "Remove cortesía" : "Mark complimentary"}
                      </button>
                      <button
                        onClick={() => resendInvite(m)}
                        data-testid={`resend-invite-${m.id}`}
                        title="Resend invite"
                        className="h-7 w-7 flex items-center justify-center border border-[var(--hc-border)] text-[var(--hc-text-secondary)] hover:text-[var(--hc-gold)] transition-colors"
                      >
                        <Mail className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </button>
                      <button
                        onClick={() => {
                          setActionTarget(m);
                          setConfirmAction("revoke");
                        }}
                        data-testid={`revoke-${m.id}`}
                        title="Revoke access"
                        className="h-7 w-7 flex items-center justify-center border border-[#7A2424] text-[#E07A7A] hover:bg-[#2A0F0F] transition-colors"
                      >
                        <Ban className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <AlertDialog
        open={confirmAction === "revoke"}
        onOpenChange={(o) => {
          if (!o) {
            setConfirmAction(null);
            setActionTarget(null);
          }
        }}
      >
        <AlertDialogContent className="bg-[var(--hc-surface)] border-[var(--hc-border)] text-[var(--hc-text)] rounded-none">
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke access?</AlertDialogTitle>
            <AlertDialogDescription className="text-[var(--hc-text-secondary)]">
              {actionTarget?.email} will be marked inactive and cannot sign in until the
              subscription is reactivated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-[var(--hc-border)] text-[var(--hc-text)] hover:bg-[var(--hc-surface-elevated)] rounded-none">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (actionTarget) await revokeMember(actionTarget);
                setConfirmAction(null);
                setActionTarget(null);
              }}
              data-testid="confirm-revoke"
              className="bg-[#7A2424] text-[var(--hc-text)] hover:bg-[#9a2e2e] rounded-none"
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
