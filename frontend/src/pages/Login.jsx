import React, { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api, formatApiErrorDetail } from "../lib/api";

const LOGO_URL =
  "https://customer-assets.emergentagent.com/job_hampton-crest/artifacts/nj6t4ufd_35939535-7E23-42A3-BF88-4E1ED39508BB.png";

export default function Login() {
  const { user, login, register, verify2fa } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login"); // "login" | "register" | "2fa" | "forgot"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [tempToken, setTempToken] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(location.state?.passwordReset ? "Tu contraseña fue actualizada. Ya puedes iniciar sesión." : "");
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    const next = location.state?.from || "/dashboard";
    return <Navigate to={next} replace />;
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setSubmitting(true);
    if (mode === "forgot") {
      try {
        await api.post("/auth/password-reset/request", { email });
        setNotice("Si existe una cuenta con ese correo, enviaremos un enlace para restablecer la contraseña.");
        setEmail("");
      } catch (e2) {
        setError(formatApiErrorDetail(e2.response?.data?.detail) || e2.message);
      } finally {
        setSubmitting(false);
      }
      return;
    }
    if (mode === "2fa") {
      const res = await verify2fa(tempToken, code);
      setSubmitting(false);
      setCode("");
      if (res.access_denied) {
        navigate("/access-denied", { replace: true });
        return;
      }
      if (!res.ok) setError(res.error);
      return;
    }
    const res =
      mode === "login"
        ? await login(email, password)
        : await register(name, email, password);
    setSubmitting(false);
    // Always clear credentials after a submit attempt
    setEmail("");
    setPassword("");
    setName("");
    if (res.access_denied) {
      navigate("/access-denied", { replace: true });
      return;
    }
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (res.requires_2fa) {
      setMode("2fa");
      setTempToken(res.temp_token);
    }
  };

  const inputCls =
    "w-full bg-[var(--hc-surface)] border border-[var(--hc-border)] text-[var(--hc-text)] px-4 py-3 text-sm tracking-tight focus:outline-none focus:border-[var(--hc-gold)] transition-colors";

  const isLogin = mode === "login";
  const is2fa = mode === "2fa";
  const isForgot = mode === "forgot";

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-[var(--hc-bg)] text-[var(--hc-text)]">
      {/* Brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 xl:p-16 border-r border-[var(--hc-border)] overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.55]"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1593427995298-cad6731716d8?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2OTV8MHwxfHNlYXJjaHwyfHxtb2Rlcm4lMjBsdXh1cnklMjBhcmNoaXRlY3R1cmUlMjBuaWdodHxlbnwwfHx8fDE3Nzk2MzE1ODV8MA&ixlib=rb-4.1.0&q=85)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--hc-bg)]/85 via-[var(--hc-bg)]/55 to-[var(--hc-bg)]/90" />

        <div className="relative z-10 flex items-center gap-4">
          <img
            src={LOGO_URL}
            alt="Hampton Crest"
            className="h-16 w-16 object-contain"
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

        <div className="relative z-10 max-w-md">
          <div className="hc-overline mb-5">Est. 2026 · Solo Miembros</div>
          <h2 className="text-3xl xl:text-4xl font-medium tracking-[-0.02em] leading-[1.15] text-[var(--hc-text)]">
            El capital disciplinado nace del pensamiento disciplinado.
          </h2>
          <p className="mt-6 text-[var(--hc-text-secondary)] text-sm leading-relaxed max-w-sm">
            Una academia privada para inversionistas serios. Investigación de grado institucional,
            educación curada e inteligencia mensual — reservado para nuestros miembros.
          </p>
        </div>

        <div className="relative z-10 flex items-center justify-between text-[0.65rem] tracking-[0.22em] uppercase text-[var(--hc-text-muted)]">
          <span>Confidencial</span>
          <span className="h-px w-12 bg-[var(--hc-gold)]/40" />
          <span>Solo Miembros</span>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-col justify-center px-6 sm:px-12 lg:px-16 xl:px-24 py-12">
        <div className="lg:hidden flex items-center gap-3 mb-12">
          <img
            src={LOGO_URL}
            alt="Hampton Crest"
            className="h-12 w-12 object-contain"
            style={{ mixBlendMode: "screen" }}
          />
          <div className="leading-tight">
            <div className="text-[0.85rem] tracking-[0.32em] text-[var(--hc-gold)] uppercase font-semibold">
              Hampton Crest
            </div>
            <div className="text-[0.65rem] tracking-[0.4em] text-[var(--hc-text-muted)] uppercase">
              Academy
            </div>
          </div>
        </div>

        <div className="max-w-md w-full hc-enter">
          <div className="hc-overline mb-3">
            {is2fa
              ? "Verificación en dos pasos"
              : isForgot
                ? "Recuperar acceso"
              : isLogin
                ? "Acceso de miembro"
                : "Registro de miembro"}
          </div>
          <h1 className="text-3xl sm:text-4xl font-medium tracking-[-0.02em] text-[var(--hc-text)]">
            {is2fa ? "Ingresa tu código" : isForgot ? "Restablece tu contraseña" : isLogin ? "Accede a la academia" : "Crea tu cuenta"}
          </h1>
          <p className="mt-3 text-sm text-[var(--hc-text-secondary)] tracking-tight">
            {is2fa
              ? "Abre tu app de autenticación e ingresa el código de 6 dígitos, o usa un código de respaldo."
              : isForgot
                ? "Ingresa tu correo y te enviaremos un enlace privado para crear una nueva contraseña."
              : isLogin
                ? "Ingresa tus credenciales para continuar."
                : "Reservado para miembros verificados de la academia."}
          </p>

          <div className="mt-8 hc-gold-rule" />

          <form
            onSubmit={onSubmit}
            className="mt-8 space-y-5"
            data-testid="auth-form"
            autoComplete="off"
          >
            {is2fa ? (
              <div>
                <label className="hc-overline block mb-2">Código de 6 dígitos</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  autoFocus
                  data-testid="twofa-code-input"
                  className={`${inputCls} tracking-[0.4em] text-center text-lg`}
                  placeholder="••••••"
                />
              </div>
            ) : isForgot ? (
              <div>
                <label className="hc-overline block mb-2">Correo electrónico</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  data-testid="forgot-email-input"
                  className={inputCls}
                />
              </div>
            ) : (
              <>
                {mode === "register" && (
                  <div>
                    <label className="hc-overline block mb-2">Nombre completo</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      data-testid="register-name-input"
                      className={inputCls}
                    />
                  </div>
                )}

                <div>
                  <label className="hc-overline block mb-2">Correo electrónico</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    data-testid="auth-email-input"
                    className={inputCls}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="hc-overline">Contraseña</label>
                    {isLogin && (
                      <button
                        type="button"
                        onClick={() => {
                          setMode("forgot");
                          setPassword("");
                          setError("");
                          setNotice("");
                        }}
                        data-testid="forgot-password-link"
                        className="text-[0.7rem] text-[var(--hc-gold)] tracking-tight hover:underline underline-offset-4"
                      >
                        Olvidé mi contraseña
                      </button>
                    )}
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    data-testid="auth-password-input"
                    className={inputCls}
                  />
                </div>
              </>
            )}

            {error && (
              <div
                data-testid="auth-error"
                className="text-xs tracking-tight text-[#E07A7A] border border-[#7A2424] bg-[#2A0F0F] px-3 py-2"
              >
                {error}
              </div>
            )}

            {notice && (
              <div
                data-testid="auth-notice"
                className="text-xs tracking-tight text-[var(--hc-text)] border border-[var(--hc-border)] bg-[var(--hc-surface)] px-3 py-2"
              >
                {notice}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              data-testid="auth-submit-button"
              className="w-full bg-[var(--hc-platinum)] text-[var(--hc-bg)] py-3 text-sm font-semibold tracking-[0.16em] uppercase hover:bg-white transition-colors disabled:opacity-60"
            >
              {submitting
                ? isForgot ? "Enviando..." : "Autenticando…"
                : is2fa
                  ? "Verificar"
                  : isForgot
                    ? "Enviar enlace"
                  : isLogin
                    ? "Iniciar sesión"
                    : "Crear cuenta"}
            </button>

            {is2fa ? (
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setCode("");
                  setTempToken("");
                  setError("");
                }}
                data-testid="twofa-back"
                className="w-full text-xs tracking-tight text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] underline underline-offset-4 transition-colors"
              >
                Cancelar y volver a iniciar sesión
              </button>
            ) : isForgot ? (
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError("");
                  setNotice("");
                }}
                data-testid="forgot-back"
                className="w-full text-xs tracking-tight text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] underline underline-offset-4 transition-colors"
              >
                Volver al inicio de sesión
              </button>
            ) : (
              <div className="text-xs text-[var(--hc-text-secondary)] text-center tracking-tight">
                ¿No eres miembro?{" "}
                <a
                  href="/access-denied"
                  data-testid="view-plans-link"
                  className="text-[var(--hc-gold)] hover:underline underline-offset-4"
                >
                  Ver membresía
                </a>
              </div>
            )}
          </form>

          <div className="mt-12 text-[0.65rem] text-[var(--hc-text-muted)] tracking-[0.18em] uppercase">
            Confidencial · Solo Miembros
          </div>
        </div>
      </div>
    </div>
  );
}
