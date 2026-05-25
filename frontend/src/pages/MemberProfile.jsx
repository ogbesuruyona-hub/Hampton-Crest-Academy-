import React, { useEffect, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import { useAuth } from "../context/AuthContext";
import { api, formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";

const Field = ({ label, value, testid }) => (
  <div className="py-4 border-b border-[var(--hc-border)] last:border-0">
    <div className="hc-overline mb-1.5">{label}</div>
    <div data-testid={testid} className="text-sm text-[var(--hc-text)] tracking-tight">
      {value || "—"}
    </div>
  </div>
);

const TextInput = ({ label, value, onChange, testid, placeholder, maxLength }) => (
  <div className="py-4 border-b border-[var(--hc-border)] last:border-0">
    <div className="hc-overline mb-1.5">{label}</div>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      data-testid={testid}
      className="w-full bg-transparent border-0 border-b border-transparent focus:border-[var(--hc-gold)] focus:outline-none text-sm text-[var(--hc-text)] tracking-tight py-1"
    />
  </div>
);

export default function MemberProfile() {
  const { user, refresh } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(user?.name || "");
    setPhone(user?.phone || "");
  }, [user]);

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("es-ES", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/auth/profile", { name: name.trim(), phone: phone.trim() });
      await refresh();
      toast.success("Perfil actualizado");
      setEditing(false);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setName(user?.name || "");
    setPhone(user?.phone || "");
    setEditing(false);
  };

  return (
    <div data-testid="profile-page">
      <PageHeader
        overline="Academia · Perfil"
        title="Perfil"
        description="Tu posición dentro de Hampton Crest Academy."
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
              {user?.name || "Miembro"}
            </div>
            <div className="hc-overline mt-1 text-[var(--hc-gold)]">
              {user?.role === "admin" ? "Administrador" : "Miembro"}
            </div>
            <div className="mt-6 hc-gold-rule w-2/3" />
            <div className="mt-6 text-xs text-[var(--hc-text-secondary)] tracking-tight max-w-xs">
              Miembro de Hampton Crest Academy — un círculo privado de asignadores de capital disciplinados.
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <Panel
            overline="Cuenta"
            title="Detalles"
            testid="panel-profile-details"
            action={
              editing ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={cancel}
                    disabled={saving}
                    data-testid="profile-cancel-button"
                    className="px-4 py-2 text-[0.65rem] tracking-[0.18em] uppercase border border-[var(--hc-border)] text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={save}
                    disabled={saving || !name.trim()}
                    data-testid="profile-save-button"
                    className="px-4 py-2 text-[0.65rem] tracking-[0.18em] uppercase bg-[var(--hc-platinum)] text-[var(--hc-bg)] hover:bg-white transition-colors disabled:opacity-50"
                  >
                    {saving ? "Guardando…" : "Guardar"}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  data-testid="profile-edit-button"
                  className="px-4 py-2 text-[0.65rem] tracking-[0.18em] uppercase border border-[var(--hc-border)] text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] hover:border-[var(--hc-gold)]/60 transition-colors"
                >
                  Editar
                </button>
              )
            }
          >
            {editing ? (
              <>
                <TextInput
                  label="Nombre completo"
                  value={name}
                  onChange={setName}
                  testid="profile-name-input"
                  placeholder="Tu nombre completo"
                  maxLength={120}
                />
                <TextInput
                  label="Teléfono"
                  value={phone}
                  onChange={setPhone}
                  testid="profile-phone-input"
                  placeholder="+1 555 123 4567"
                  maxLength={40}
                />
                <Field label="Email" value={user?.email} testid="profile-email" />
                <Field
                  label="Rol"
                  value={user?.role === "admin" ? "administrador" : "miembro"}
                  testid="profile-role"
                />
                <Field label="Miembro desde" value={memberSince} testid="profile-since" />
              </>
            ) : (
              <>
                <Field label="Nombre completo" value={user?.name} testid="profile-name" />
                <Field label="Teléfono" value={user?.phone} testid="profile-phone" />
                <Field label="Email" value={user?.email} testid="profile-email" />
                <Field
                  label="Rol"
                  value={user?.role === "admin" ? "administrador" : "miembro"}
                  testid="profile-role"
                />
                <Field label="Miembro desde" value={memberSince} testid="profile-since" />
              </>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
