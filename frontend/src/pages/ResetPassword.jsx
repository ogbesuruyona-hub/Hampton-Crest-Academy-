import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, formatApiErrorDetail } from "../lib/api";

const LOGO_URL =
  "https://customer-assets.emergentagent.com/job_hampton-crest/artifacts/nj6t4ufd_35939535-7E23-42A3-BF88-4E1ED39508BB.png";

const inputCls =
  "w-full bg-[var(--hc-surface)] border border-[var(--hc-border)] text-[var(--hc-text)] px-4 py-3 text-sm tracking-tight focus:outline-none focus:border-[var(--hc-gold)] transition-colors";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";
  const [state, setState] = useState("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setState("invalid");
      setError("Falta el token de recuperación.");
      return;
    }

    api
      .get(`/auth/password-reset/${encodeURIComponent(token)}`)
      .then(({ data }) => {
        setEmail(data.email);
        setState("ready");
      })
      .catch((e) => {
        setError(formatApiErrorDetail(e.response?.data?.detail) || "El enlace ya no es válido.");
        setState("invalid");
      });
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setState("submitting");
    try {
      await api.post("/auth/password-reset/confirm", { token, password });
      navigate("/login", { replace: true, state: { passwordReset: true } });
    } catch (e2) {
      setError(formatApiErrorDetail(e2.response?.data?.detail) || e2.message);
      setState("ready");
    }
  };

  return (
    <div
      data-testid="reset-password-page"
      className="min-h-screen flex items-center justify-center bg-[var(--hc-bg)] text-[var(--hc-text)] px-6"
    >
      <div className="max-w-md w-full hc-enter">
        <div className="flex items-center gap-3 mb-10">
          <img
            src={LOGO_URL}
            alt="Hampton Crest"
            className="h-14 w-14 object-contain"
            style={{ mixBlendMode: "screen" }}
          />
          <div className="leading-tight">
            <div className="text-[0.85rem] tracking-[0.32em] text-[var(--hc-gold)] uppercase font-semibold">
              Hampton Crest
            </div>
            <div className="text-[0.7rem] tracking-[0.4em] text-[var(--hc-text-muted)] uppercase">
              Academy
            </div>
          </div>
        </div>

        <div className="hc-overline mb-3">Recuperación de acceso</div>
        <h1 className="text-3xl sm:text-4xl font-medium tracking-[-0.02em]">
          Define una nueva contraseña
        </h1>
        <div className="mt-6 hc-gold-rule" />

        {state === "loading" && (
          <p className="mt-8 text-sm text-[var(--hc-text-muted)]">Validando el enlace...</p>
        )}

        {state === "invalid" && (
          <>
            <p
              data-testid="reset-password-invalid"
              className="mt-8 text-sm text-[#E07A7A] border border-[#7A2424] bg-[#2A0F0F] px-4 py-3"
            >
              {error || "Este enlace no es válido o ha expirado."}
            </p>
            <Link
              to="/login"
              className="mt-8 inline-block text-xs tracking-[0.18em] uppercase text-[var(--hc-gold)] hover:underline underline-offset-4"
            >
              Volver al inicio de sesión
            </Link>
          </>
        )}

        {(state === "ready" || state === "submitting") && (
          <form onSubmit={submit} className="mt-8 space-y-5" data-testid="reset-password-form">
            <div>
              <label className="hc-overline block mb-2">Correo electrónico</label>
              <input
                type="email"
                value={email}
                disabled
                data-testid="reset-password-email"
                className={`${inputCls} opacity-70`}
              />
            </div>
            <div>
              <label className="hc-overline block mb-2">Nueva contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoFocus
                autoComplete="new-password"
                data-testid="reset-password-password"
                className={inputCls}
              />
            </div>
            <div>
              <label className="hc-overline block mb-2">Confirmar contraseña</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                data-testid="reset-password-confirm"
                className={inputCls}
              />
            </div>

            {error && (
              <div
                data-testid="reset-password-error"
                className="text-xs tracking-tight text-[#E07A7A] border border-[#7A2424] bg-[#2A0F0F] px-3 py-2"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={state === "submitting"}
              data-testid="reset-password-submit"
              className="w-full bg-[var(--hc-platinum)] text-[var(--hc-bg)] py-3 text-sm font-semibold tracking-[0.16em] uppercase hover:bg-white transition-colors disabled:opacity-60"
            >
              {state === "submitting" ? "Guardando..." : "Actualizar contraseña"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
