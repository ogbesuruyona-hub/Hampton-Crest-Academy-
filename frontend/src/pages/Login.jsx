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
  const [notice, setNotice] = useState(
    location.state?.passwordReset ? "Tu contraseña fue actualizada. Ya puedes iniciar sesión." : ""
  );
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
    "w-full bg-white border border-[var(--hc-border)] text-[var(--hc-text)] px-4 py-3 text-sm tracking-tight focus:outline-none focus:border-[var(--hc-gold)] focus:bg-[var(--hc-surface)] transition-colors";

  const isLogin = mode === "login";
  const is2fa = mode === "2fa";
  const isForgot = mode === "forgot";

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.06fr_0.94fr] bg-[var(--hc-bg)] text-[var(--hc-text)]">
      <div className="relative hidden lg:flex flex-col justify-between p-12 xl:p-16 border-r border-[var(--hc-border)] overflow-hidden bg-[var(--hc-ink)] text-white">
        <div
          className="absolute inset-0 opacity-95"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1512453979798-5ea266f8880c?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85)",
            backgroundSize: "cover",
            backgroundPosition: "center bottom",
          }}
        />
        <div className="absolute inset-0 bg-[#071925]/44" />
        <div className="absolute inset-0 bg-gradient-to-br from-[#071925] via-[#071925]/72 to-[#071925]/34" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#071925]/92 to-transparent" />

        <div className="relative z-10 flex items-center gap-4">
          <img
            src={LOGO_URL}
            alt="Hampton Crest"
            className="h-16 w-16 object-contain drop-shadow-[0_8px_20px_rgba(0,0,0,0.35)]"
          />
          <div className="leading-tight">
            <div className="text-[0.85rem] tracking-[0.32em] text-[#e2c56f] uppercase font-semibold">
              Hampton Crest
            </div>
            <div className="text-[0.7rem] tracking-[0.4em] text-white/70 uppercase">
              Academy
            </div>
          </div>
        </div>

        <div className="relative z-10 max-w-md bg-[#071925]/60 border border-white/10 px-6 py-6 shadow-[0_20px_70px_rgba(0,0,0,0.38)] backdrop-blur-[1px]">
          <div className="hc-overline mb-5 text-[#f7d982] drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]">Patrimonio · Disciplina · Visión</div>
          <h2 className="text-3xl xl:text-4xl font-medium tracking-[-0.02em] leading-[1.15] text-[#fffaf0] drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)]">
            Inversiones con propósito. Resultados con disciplina.
          </h2>
          <p className="mt-6 text-[#fffaf0] text-sm leading-relaxed max-w-sm drop-shadow-[0_3px_12px_rgba(0,0,0,0.9)]">
            Una academia privada para inversionistas serios. Investigación de grado institucional,
            educación curada e inteligencia mensual, reservado para nuestros miembros.
          </p>
        </div>

        <div className="relative z-10 flex items-center justify-between text-[0.65rem] tracking-[0.22em] uppercase text-white/70">
          <span>Confidencial</span>
          <span className="h-px w-12 bg-[#e2c56f]/70" />
          <span>Solo Miembros</span>
        </div>
      </div>

      <div className="relative flex flex-col justify-center px-6 sm:px-12 lg:px-16 xl:px-24 py-12 bg-[var(--hc-bg)]">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_20%_10%,rgba(199,163,79,0.16),transparent_32%),linear-gradient(145deg,rgba(255,253,248,0.88),rgba(245,240,231,0.94))]" />
        <div className="relative lg:hidden flex items-center gap-3 mb-12">
          <img src={LOGO_URL} alt="Hampton Crest" className="h-12 w-12 object-contain" />
          <div className="leading-tight">
            <div className="text-[0.85rem] tracking-[0.32em] text-[var(--hc-gold)] uppercase font-semibold">
              Hampton Crest
            </div>
            <div className="text-[0.65rem] tracking-[0.4em] text-[var(--hc-text-muted)] uppercase">
              Academy
            </div>
          </div>
        </div>

        <div className="relative max-w-md w-full hc-enter bg-[var(--hc-surface)] border border-[var(--hc-border)] px-6 py-7 sm:px-8 sm:py-9 shadow-[0_24px_80px_rgba(7,25,37,0.08)]">
          <div className="hc-overline mb-3 text-[var(--hc-gold)]">
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
                className="text-xs tracking-tight text-[#9F1D1D] border border-[#E8B7B7] bg-[#FFF2F2] px-3 py-2"
              >
                {error}
              </div>
            )}

            {notice && (
              <div
                data-testid="auth-notice"
                className="text-xs tracking-tight text-[var(--hc-text)] border border-[var(--hc-border)] bg-[var(--hc-surface-elevated)] px-3 py-2"
              >
                {notice}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              data-testid="auth-submit-button"
              className="w-full bg-[var(--hc-platinum)] text-white py-3 text-sm font-semibold tracking-[0.16em] uppercase hover:bg-[#123044] transition-colors disabled:opacity-60"
            >
              {submitting
                ? isForgot ? "Enviando..." : "Autenticando..."
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
