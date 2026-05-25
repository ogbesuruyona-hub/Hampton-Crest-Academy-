import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { api, formatApiErrorDetail } from "../lib/api";
import { Copy, ShieldCheck } from "lucide-react";

const inputCls =
  "w-full bg-[var(--hc-bg)] border border-[var(--hc-border)] text-[var(--hc-text)] px-3 py-2 text-sm tracking-tight focus:outline-none focus:border-[var(--hc-gold)] transition-colors";
const labelCls = "hc-overline block mb-1.5";

export const TwoFASetupDialog = ({ open, onOpenChange, onEnabled }) => {
  const [step, setStep] = useState("loading"); // loading | setup | success
  const [secret, setSecret] = useState("");
  const [qr, setQr] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [backupCodes, setBackupCodes] = useState([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setStep("loading");
    setError("");
    setCode("");
    setBackupCodes([]);
    api
      .post("/auth/2fa/setup", {})
      .then(({ data }) => {
        if (cancelled) return;
        setSecret(data.secret || "");
        setQr(data.qr_png_base64 || "");
        setStep("setup");
      })
      .catch((e) => {
        if (cancelled) return;
        setError(formatApiErrorDetail(e.response?.data?.detail) || e.message);
        setStep("setup"); // show the error inside the form rather than spinning forever
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const verify = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const { data } = await api.post("/auth/2fa/verify-setup", { code });
      setBackupCodes(data.backup_codes || []);
      setStep("success");
      onEnabled?.();
    } catch (e2) {
      setError(formatApiErrorDetail(e2.response?.data?.detail) || e2.message);
    } finally {
      setSaving(false);
    }
  };

  const copyAll = () => {
    navigator.clipboard?.writeText(backupCodes.join("\n"));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-[var(--hc-surface)] border-[var(--hc-border)] text-[var(--hc-text)] rounded-none max-w-lg"
        data-testid="twofa-setup-dialog"
      >
        <DialogHeader>
          <div className="hc-overline mb-1">Autenticación de dos factores</div>
          <DialogTitle className="text-xl font-medium tracking-tight">
            {step === "success" ? "2FA activado" : "Configurar 2FA"}
          </DialogTitle>
          <DialogDescription className="text-[var(--hc-text-secondary)] text-sm tracking-tight">
            {step === "success"
              ? "Guarda estos códigos de respaldo de un solo uso en un lugar seguro."
              : "Escanea el QR con tu app de autenticación e ingresa el código de 6 dígitos para confirmar."}
          </DialogDescription>
        </DialogHeader>

        {step === "loading" && (
          <div className="py-10 text-center text-sm text-[var(--hc-text-muted)]">Preparando…</div>
        )}

        {step === "setup" && (
          <form onSubmit={verify} className="space-y-5 mt-4">
            <div className="flex flex-col items-center gap-4">
              {qr && (
                <img
                  src={`data:image/png;base64,${qr}`}
                  alt="Código QR 2FA"
                  data-testid="twofa-qr"
                  className="h-44 w-44 bg-white p-2"
                />
              )}
              <div className="w-full">
                <label className={labelCls}>Clave manual</label>
                <div className="flex items-center gap-2">
                  <code
                    data-testid="twofa-secret"
                    className="flex-1 text-xs tracking-[0.18em] uppercase bg-[var(--hc-bg)] border border-[var(--hc-border)] px-3 py-2 text-[var(--hc-text-secondary)] break-all"
                  >
                    {secret}
                  </code>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(secret)}
                    className="h-9 w-9 flex items-center justify-center border border-[var(--hc-border)] text-[var(--hc-text-muted)] hover:text-[var(--hc-text)]"
                    aria-label="Copiar clave"
                  >
                    <Copy className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className={labelCls}>Código de verificación</label>
              <input
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                data-testid="twofa-verify-input"
                className={`${inputCls} tracking-[0.4em] text-center`}
                placeholder="••••••"
              />
            </div>

            {error && (
              <div
                data-testid="twofa-setup-error"
                className="text-xs tracking-tight text-[#E07A7A] border border-[#7A2424] bg-[#2A0F0F] px-3 py-2"
              >
                {error}
              </div>
            )}

            <DialogFooter className="sm:justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="px-5 py-2.5 text-xs tracking-[0.18em] uppercase border border-[var(--hc-border)] text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                data-testid="twofa-verify-submit"
                className="px-6 py-2.5 text-xs tracking-[0.18em] uppercase bg-[var(--hc-platinum)] text-[var(--hc-bg)] hover:bg-white transition-colors disabled:opacity-60"
              >
                {saving ? "Verificando…" : "Verificar y activar"}
              </button>
            </DialogFooter>
          </form>
        )}

        {step === "success" && (
          <div className="space-y-5 mt-4">
            <div className="flex items-center gap-3 text-[var(--hc-gold)]">
              <ShieldCheck className="h-5 w-5" strokeWidth={1.5} />
              <span className="text-sm tracking-tight">
                2FA está activo a partir de tu próximo inicio de sesión.
              </span>
            </div>
            <div>
              <div className={labelCls}>Códigos de respaldo (un solo uso)</div>
              <div
                data-testid="twofa-backup-codes"
                className="grid grid-cols-2 gap-2 bg-[var(--hc-bg)] border border-[var(--hc-border)] p-4 font-mono text-xs"
              >
                {backupCodes.map((c) => (
                  <code key={c} className="tracking-wider text-[var(--hc-text)]">
                    {c}
                  </code>
                ))}
              </div>
            </div>
            <DialogFooter className="sm:justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={copyAll}
                data-testid="twofa-copy-backup"
                className="px-5 py-2.5 text-xs tracking-[0.18em] uppercase border border-[var(--hc-border)] text-[var(--hc-text)] hover:bg-[var(--hc-surface-elevated)] transition-colors"
              >
                Copiar todo
              </button>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                data-testid="twofa-done"
                className="px-6 py-2.5 text-xs tracking-[0.18em] uppercase bg-[var(--hc-platinum)] text-[var(--hc-bg)] hover:bg-white transition-colors"
              >
                Listo
              </button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export const TwoFADisableDialog = ({ open, onOpenChange, onDisabled }) => {
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setPassword("");
      setCode("");
      setError("");
    }
  }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.post("/auth/2fa/disable", { password, code });
      onDisabled?.();
      onOpenChange(false);
    } catch (e2) {
      setError(formatApiErrorDetail(e2.response?.data?.detail) || e2.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-[var(--hc-surface)] border-[var(--hc-border)] text-[var(--hc-text)] rounded-none max-w-md"
        data-testid="twofa-disable-dialog"
      >
        <DialogHeader>
          <div className="hc-overline mb-1">Autenticación de dos factores</div>
          <DialogTitle className="text-xl font-medium tracking-tight">Desactivar 2FA</DialogTitle>
          <DialogDescription className="text-[var(--hc-text-secondary)] text-sm tracking-tight">
            Confirma tu contraseña y el código actual de 6 dígitos (o un código de respaldo).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5 mt-4">
          <div>
            <label className={labelCls}>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              data-testid="twofa-disable-password"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Código</label>
            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              data-testid="twofa-disable-code"
              className={`${inputCls} tracking-[0.4em] text-center`}
              placeholder="••••••"
            />
          </div>
          {error && (
            <div className="text-xs tracking-tight text-[#E07A7A] border border-[#7A2424] bg-[#2A0F0F] px-3 py-2">
              {error}
            </div>
          )}
          <DialogFooter className="sm:justify-between gap-2 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-5 py-2.5 text-xs tracking-[0.18em] uppercase border border-[var(--hc-border)] text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              data-testid="twofa-disable-submit"
              className="px-6 py-2.5 text-xs tracking-[0.18em] uppercase bg-[#7A2424] text-[var(--hc-text)] hover:bg-[#9a2e2e] transition-colors disabled:opacity-60"
            >
              {saving ? "Desactivando…" : "Desactivar 2FA"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
