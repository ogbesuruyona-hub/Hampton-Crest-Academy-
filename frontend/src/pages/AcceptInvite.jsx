import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { api, tokenStore, formatApiErrorDetail } from "../lib/api";
import { useAuth } from "../context/AuthContext";

const LOGO_URL =
  "https://customer-assets.emergentagent.com/job_hampton-crest/artifacts/nj6t4ufd_35939535-7E23-42A3-BF88-4E1ED39508BB.png";

const inputCls =
  "w-full bg-[var(--hc-surface)] border border-[var(--hc-border)] text-[var(--hc-text)] px-4 py-3 text-sm tracking-tight focus:outline-none focus:border-[var(--hc-gold)] transition-colors";

export default function AcceptInvite() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const token = params.get("token") || "";

  const [state, setState] = useState("loading"); // loading | invalid | ready | submitting
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setState("invalid");
      setError("Falta el token de invitación.");
      return;
    }
    api
      .get(`/auth/invite/${encodeURIComponent(token)}`)
      .then(({ data }) => {
        setEmail(data.email);
        setState("ready");
      })
      .catch((e) => {
        setError(formatApiErrorDetail(e.response?.data?.detail) || "La invitación ya no es válida.");
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
      const { data } = await api.post("/auth/accept-invite", { token, password });
      tokenStore.set(data.access_token);
      await refresh();
      navigate("/dashboard", { replace: true });
    } catch (e2) {
      setError(formatApiErrorDetail(e2.response?.data?.detail) || e2.message);
      setState("ready");
    }
  };

  return (
    <div
      data-testid="accept-invite-page"
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

        <div className="hc-overline mb-3">Activación de membresía</div>
        <h1 className="text-3xl sm:text-4xl font-medium tracking-[-0.02em]">
          Define tu contraseña
        </h1>
        <div className="mt-6 hc-gold-rule" />

        {state === "loading" && (
          <p className="mt-8 text-sm text-[var(--hc-text-muted)]">Validando tu invitación…</p>
        )}

        {state === "invalid" && (
          <>
            <p
              data-testid="invite-invalid"
              className="mt-8 text-sm text-[#E07A7A] border border-[#7A2424] bg-[#2A0F0F] px-4 py-3"
            >
              {error || "Esta invitación no es válida o ha expirado."}
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
          <form onSubmit={submit} className="mt-8 space-y-5" data-testid="invite-form">
            <div>
              <label className="hc-overline block mb-2">Email</label>
              <input
                type="email"
                value={email}
                disabled
                data-testid="invite-email"
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
                data-testid="invite-password"
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
                data-testid="invite-confirm"
                className={inputCls}
              />
            </div>

            {error && (
              <div
                data-testid="invite-error"
                className="text-xs tracking-tight text-[#E07A7A] border border-[#7A2424] bg-[#2A0F0F] px-3 py-2"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={state === "submitting"}
              data-testid="invite-submit"
              className="w-full bg-[var(--hc-platinum)] text-[var(--hc-bg)] py-3 text-sm font-semibold tracking-[0.16em] uppercase hover:bg-white transition-colors disabled:opacity-60"
            >
              {state === "submitting" ? "Activando…" : "Activar cuenta"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
