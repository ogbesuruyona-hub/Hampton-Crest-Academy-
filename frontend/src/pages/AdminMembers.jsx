import React, { useCallback, useEffect, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import { EmptyState } from "../components/EmptyState";
import { api, formatApiErrorDetail } from "../lib/api";
import { formatDate } from "../lib/content";
import { Users, Search, Mail, Ban, ShieldCheck, Link2 } from "lucide-react";
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
import { toast } from "sonner";
import { RequestError } from "../components/RequestError";

const PAGE_SIZE = 25;

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
        Cortesía
      </span>
    );
  }
  if (user.membership_status === "active") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 text-[0.65rem] tracking-[0.18em] uppercase border border-[var(--hc-gold)]/40 text-[var(--hc-gold)] bg-[var(--hc-gold-soft)]">
        Activo
      </span>
    );
  }
  if (user.membership_status === "past_due") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 text-[0.65rem] tracking-[0.18em] uppercase border border-[#B98B3F]/50 text-[#D8B36A] bg-[#2B2110]">
        Pago pendiente
      </span>
    );
  }
  if (user.membership_status === "canceled") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 text-[0.65rem] tracking-[0.18em] uppercase border border-[var(--hc-border)] text-[var(--hc-text-secondary)]">
        Cancelado
      </span>
    );
  }
  if (user.membership_status === "pending") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 text-[0.65rem] tracking-[0.18em] uppercase border border-[var(--hc-border)] text-[var(--hc-text-muted)]">
        Pendiente
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 text-[0.65rem] tracking-[0.18em] uppercase border border-[var(--hc-border)] text-[var(--hc-text-muted)]">
      Expirado
    </span>
  );
};

const statusLabel = (value) => {
  const labels = {
    active: "Activo",
    past_due: "Pago pendiente",
    canceled: "Cancelado",
    expired: "Expirado",
    pending: "Pendiente",
    complimentary: "Cortesía",
    admin: "Admin",
    paid: "Pagado",
    failed: "Fallido",
  };
  return labels[value] || value || "—";
};

export default function AdminMembers() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [actionTarget, setActionTarget] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ active: 0, inactive: 0, admin: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, page_size: PAGE_SIZE };
      if (q) params.q = q;
      if (statusFilter) params.status = statusFilter;
      const { data, headers } = await api.get("/admin/members", { params });
      setMembers(data);
      setTotal(Number(headers["x-total-count"] || data.length));
      setCounts({
        active: Number(headers["x-member-active-count"] || 0),
        inactive: Number(headers["x-member-inactive-count"] || 0),
        admin: Number(headers["x-member-admin-count"] || 0),
      });
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoading(false);
    }
  }, [q, statusFilter, page]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleComplimentary = async (user) => {
    try {
      await api.put(`/admin/members/${user.id}`, { complimentary: !user.complimentary });
      await load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    }
  };

  const revokeMember = async (user) => {
    try {
      await api.post(`/admin/members/${user.id}/revoke`);
      await load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    }
  };

  const resendInvite = async (user) => {
    try {
      const { data } = await api.post(`/admin/members/${user.id}/resend-invite`);
      if (data.email_sent) {
        toast.success("Correo de invitación enviado.");
      } else {
        await navigator.clipboard?.writeText(data.invite_link);
        toast.success("Correo desactivado. Enlace de invitación copiado.");
      }
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    }
  };

  const copyInviteLink = async (user) => {
    try {
      const { data } = await api.post(`/admin/members/${user.id}/invite-link`);
      await navigator.clipboard?.writeText(data.invite_link);
      toast.success(`Enlace copiado. Expira en ${data.expires_in_days} días.`);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    }
  };

  return (
    <div data-testid="admin-members-page">
      <PageHeader
        overline="Administración · Miembros"
        title="Miembros"
        description="Miembros activos, accesos de cortesía y cuentas caducadas. Administra la lista, revoca acceso o reenvía invitaciones."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-[var(--hc-surface)] border border-[var(--hc-border)] p-5">
          <div className="hc-overline">Activos</div>
          <div className="mt-2 text-2xl font-medium tracking-tight text-[var(--hc-text)]">
            {counts.active}
          </div>
        </div>
        <div className="bg-[var(--hc-surface)] border border-[var(--hc-border)] p-5">
          <div className="hc-overline">Inactivos</div>
          <div className="mt-2 text-2xl font-medium tracking-tight text-[var(--hc-text)]">
            {counts.inactive}
          </div>
        </div>
        <div className="bg-[var(--hc-surface)] border border-[var(--hc-border)] p-5">
          <div className="hc-overline">Administradores</div>
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
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar por correo o nombre..."
            data-testid="members-search"
            className="w-full bg-[var(--hc-surface)] border border-[var(--hc-border)] text-sm text-[var(--hc-text)] pl-9 pr-3 py-2.5 focus:outline-none focus:border-[var(--hc-gold)]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          data-testid="members-status-filter"
          className="bg-[var(--hc-surface)] border border-[var(--hc-border)] text-[var(--hc-text)] text-xs tracking-[0.14em] uppercase px-4 py-2.5 focus:outline-none focus:border-[var(--hc-gold)]"
        >
          <option value="">Todos</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>
      </div>

      {loading ? (
        <div className="text-sm text-[var(--hc-text-muted)] py-12 text-center">Cargando…</div>
      ) : error ? (
        <RequestError error={error} onRetry={load} />
      ) : members.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Aún no hay miembros"
          description="Los miembros aparecerán aquí en cuanto se suscriban vía el enlace de pago de Stripe."
        />
      ) : (
        <Panel testid="members-table">
          <div className="-m-6 divide-y divide-[var(--hc-border)]">
            {members.map((m) => (
              <div
                key={m.id}
                data-testid={`member-row-${m.id}`}
                className="grid grid-cols-1 xl:grid-cols-[minmax(200px,1.2fr)_140px_minmax(360px,1.5fr)_auto] items-center gap-4 px-6 py-4 hover:bg-[var(--hc-surface-elevated)] transition-colors"
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
                {m.role === "admin" ? (
                  <div className="text-xs text-[var(--hc-text-muted)] tracking-tight">
                    <div className="hc-overline mb-1">Tipo de acceso</div>
                    <div>Administración interna</div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="text-xs text-[var(--hc-text-muted)] tracking-tight">
                      <div className="hc-overline mb-1">Suscripción</div>
                      <div>{statusLabel(m.subscription_status)}</div>
                    </div>
                    <div className="text-xs text-[var(--hc-text-muted)] tracking-tight">
                      <div className="hc-overline mb-1">Fin de periodo</div>
                      <div>{formatDate(m.current_period_end)}</div>
                    </div>
                    <div className="text-xs text-[var(--hc-text-muted)] tracking-tight">
                      <div className="hc-overline mb-1">Último pago</div>
                      <div>{statusLabel(m.last_payment_status)}</div>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2 flex-wrap justify-start lg:justify-end">
                  {m.role !== "admin" && (
                    <>
                      <button
                        onClick={() => toggleComplimentary(m)}
                        data-testid={`toggle-comp-${m.id}`}
                        className="px-3 py-1.5 text-[0.65rem] tracking-[0.18em] uppercase border border-[var(--hc-border)] text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] transition-colors"
                      >
                        {m.complimentary ? "Quitar cortesía" : "Marcar cortesía"}
                      </button>
                      <button
                        onClick={() => copyInviteLink(m)}
                        data-testid={`copy-invite-${m.id}`}
                        title="Copiar enlace de invitación"
                        className="h-7 w-7 flex items-center justify-center border border-[var(--hc-border)] text-[var(--hc-text-secondary)] hover:text-[var(--hc-gold)] transition-colors"
                      >
                        <Link2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </button>
                      <button
                        onClick={() => resendInvite(m)}
                        data-testid={`resend-invite-${m.id}`}
                        title="Reenviar invitación (correo si está activo, enlace si no)"
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
                        title="Revocar acceso"
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

      {!loading && !error && total > PAGE_SIZE ? (
        <nav aria-label="Paginación de miembros" className="mt-6 flex items-center justify-between gap-4">
          <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1} className="min-h-11 border border-[var(--hc-border)] px-4 text-xs uppercase tracking-[0.14em] disabled:opacity-40">Anterior</button>
          <span className="text-xs text-[var(--hc-text-muted)]">Página {page} de {Math.ceil(total / PAGE_SIZE)}</span>
          <button type="button" onClick={() => setPage((value) => value + 1)} disabled={page * PAGE_SIZE >= total} className="min-h-11 border border-[var(--hc-border)] px-4 text-xs uppercase tracking-[0.14em] disabled:opacity-40">Siguiente</button>
        </nav>
      ) : null}

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
            <AlertDialogTitle>¿Revocar acceso?</AlertDialogTitle>
            <AlertDialogDescription className="text-[var(--hc-text-secondary)]">
              {actionTarget?.email} será marcado como inactivo y no podrá iniciar sesión hasta que
              la suscripción se reactive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-[var(--hc-border)] text-[var(--hc-text)] hover:bg-[var(--hc-surface-elevated)] rounded-none">
              Cancelar
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
              Revocar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
