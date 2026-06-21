import React, { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import { api, formatApiErrorDetail } from "../lib/api";
import {
  Search,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Target,
  ShieldAlert,
  Gem,
  LineChart,
  History as HistoryIcon,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react";

// ---------- helpers ----------
const fmtNum = (v, opts = {}) => {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const { currency = false, pct = false, abbr = false, digits = 2 } = opts;
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  if (pct) return `${(n * 100).toFixed(digits)}%`;
  if (abbr) {
    const abs = Math.abs(n);
    if (abs >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
    if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
    if (abs >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  }
  const v2 = n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return currency ? `$${v2}` : v2;
};

const VERDICT_STYLES = {
  STRONG_BUY: {
    label: "COMPRA FUERTE",
    bg: "bg-[#0F2A1A]",
    border: "border-[#1F5E3A]",
    text: "text-[#7BD3A0]",
    icon: TrendingUp,
  },
  BUY: {
    label: "COMPRA",
    bg: "bg-[var(--hc-gold-soft)]",
    border: "border-[var(--hc-gold)]",
    text: "text-[var(--hc-gold)]",
    icon: TrendingUp,
  },
  HOLD: {
    label: "MANTENER",
    bg: "bg-[var(--hc-surface-elevated)]",
    border: "border-[var(--hc-border)]",
    text: "text-[var(--hc-text-secondary)]",
    icon: Target,
  },
  AVOID: {
    label: "EVITAR",
    bg: "bg-[#2A0F0F]",
    border: "border-[#7A2424]",
    text: "text-[#E07A7A]",
    icon: TrendingDown,
  },
};

const RATING_STYLES = {
  EXCEPTIONAL: { label: "EXCEPCIONAL", color: "text-[var(--hc-gold)]" },
  HIGH_QUALITY: { label: "ALTA CALIDAD", color: "text-[var(--hc-gold)]" },
  WATCHLIST: { label: "EN OBSERVACIÓN", color: "text-[var(--hc-text)]" },
  SPECULATIVE: { label: "ESPECULATIVA", color: "text-[#E0B97A]" },
  AVOID: { label: "EVITAR", color: "text-[#E07A7A]" },
};

const SCORE_LABELS = {
  business_quality: "Calidad del negocio",
  growth: "Crecimiento",
  financial_health: "Salud financiera",
  valuation: "Valoración",
  risk: "Riesgo (mayor = menor riesgo)",
};

const COMPANY_ALIAS_PREVIEW = {
  apple: { ticker: "AAPL", name: "Apple Inc." },
  "apple inc": { ticker: "AAPL", name: "Apple Inc." },
  "apple stock": { ticker: "AAPL", name: "Apple Inc." },
  microsoft: { ticker: "MSFT", name: "Microsoft Corporation" },
  tesla: { ticker: "TSLA", name: "Tesla, Inc." },
  nvidia: { ticker: "NVDA", name: "NVIDIA Corporation" },
  amazon: { ticker: "AMZN", name: "Amazon.com, Inc." },
  google: { ticker: "GOOGL", name: "Alphabet Inc." },
  alphabet: { ticker: "GOOGL", name: "Alphabet Inc." },
  meta: { ticker: "META", name: "Meta Platforms, Inc." },
  facebook: { ticker: "META", name: "Meta Platforms, Inc." },
  berkshire: { ticker: "BRK-B", name: "Berkshire Hathaway Inc." },
};

const normalizeCompanyQuery = (value) =>
  (value || "")
    .trim()
    .toLowerCase()
    .replace(/\./g, " ")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\b(inc|incorporated|corporation|corp|company|co)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

const normalizeTickerInput = (value) => (value || "").replace(/\s+/g, "").toUpperCase();

const getAnalysisTargetLabel = (value) => {
  const alias = COMPANY_ALIAS_PREVIEW[normalizeCompanyQuery(value)];
  if (alias) return `${alias.name} (${alias.ticker})`;
  const ticker = normalizeTickerInput(value);
  return ticker || "";
};

const asFiniteNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const getScoreTotal = (score) => {
  if (score && typeof score === "object" && !Array.isArray(score)) {
    return asFiniteNumber(score.total);
  }
  return asFiniteNumber(score);
};

const getScoreDisplay = (value) => {
  const n = asFiniteNumber(value);
  if (n === null) return { value: null, scale: 100, percent: 0 };
  const scale = n <= 10 ? 10 : 100;
  const percent = scale === 10 ? n * 10 : n;
  return {
    value: n,
    scale,
    percent: Math.max(0, Math.min(100, percent)),
  };
};

const fmtScore = (value) => {
  const display = getScoreDisplay(value);
  return display.value === null ? "—" : `${Math.round(display.value)}/${display.scale}`;
};

const toDisplayText = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(toDisplayText).filter(Boolean).join("; ");
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const isScoreBreakdown = (score) =>
  Boolean(score && typeof score === "object" && !Array.isArray(score));

// ---------- subcomponents ----------
const ScoreBar = ({ value }) => {
  const v = getScoreDisplay(value).percent;
  return (
    <div className="relative h-1.5 w-full bg-[var(--hc-surface-elevated)]">
      <div
        className="absolute inset-y-0 left-0 bg-[var(--hc-gold)]"
        style={{ width: `${v}%` }}
      />
    </div>
  );
};

const RingScore = ({ value }) => {
  const display = getScoreDisplay(value);
  const v = display.percent;
  const c = 2 * Math.PI * 54;
  const dash = (v / 100) * c;
  return (
    <div className="relative h-[140px] w-[140px]" data-testid="score-ring">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          stroke="var(--hc-surface-elevated)"
          strokeWidth="6"
        />
        <circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          stroke="var(--hc-gold)"
          strokeWidth="6"
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="butt"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-medium tracking-tight text-[var(--hc-text)]">
          {display.value === null ? "—" : Math.round(display.value)}
        </span>
        <span className="hc-overline mt-1">de {display.scale}</span>
      </div>
    </div>
  );
};

const VerdictBadge = ({ verdict }) => {
  const s = VERDICT_STYLES[verdict] || VERDICT_STYLES.HOLD;
  const Icon = s.icon;
  return (
    <div
      data-testid="verdict-badge"
      className={`inline-flex items-center gap-2 px-4 py-2 border ${s.bg} ${s.border} ${s.text}`}
    >
      <Icon className="h-4 w-4" strokeWidth={1.5} />
      <span className="text-xs tracking-[0.22em] uppercase font-semibold">{s.label}</span>
    </div>
  );
};

const Metric = ({ label, value, accent = false }) => (
  <div className="flex items-baseline justify-between py-2.5 border-b border-[var(--hc-border)] last:border-b-0">
    <span className="hc-overline">{label}</span>
    <span
      className={`text-sm font-medium tracking-tight ${
        accent ? "text-[var(--hc-gold)]" : "text-[var(--hc-text)]"
      }`}
    >
      {value}
    </span>
  </div>
);

// ---------- main page ----------
export default function AssetValuation() {
  const [ticker, setTicker] = useState("");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState(0); // 0 idle, 1 fetching, 2 dcf, 3 ai
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [analysisTarget, setAnalysisTarget] = useState("");
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const scoreTotal = getScoreTotal(result?.analysis?.score);
  const hasScoreBreakdown = isScoreBreakdown(result?.analysis?.score);
  const resultWarning =
    result && (!result.data || !result.analysis)
      ? "La valoración se completó, pero la respuesta llegó incompleta. Se muestran los campos disponibles."
      : "";

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const { data } = await api.get("/valuation/history", { params: { limit: 12 } });
      setHistory(data);
    } catch {
      /* ignore */
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  // animated phase progress while loading
  useEffect(() => {
    if (!loading) return;
    setPhase(1);
    const t1 = setTimeout(() => setPhase(2), 1800);
    const t2 = setTimeout(() => setPhase(3), 4200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [loading]);

  const submit = async (e, tickerOverride = "") => {
    e?.preventDefault();
    const query = (tickerOverride || ticker).trim();
    if (!query) return;
    setLoading(true);
    setError("");
    setResult(null);
    setTicker(query);
    setAnalysisTarget(getAnalysisTargetLabel(query));
    try {
      const { data } = await api.post("/valuation", { ticker: query });
      setResult(data);
      loadHistory();
    } catch (err) {
      setError(
        formatApiErrorDetail(err.response?.data?.detail) ||
          err.message ||
          "No se pudo completar la valoración."
      );
    } finally {
      setLoading(false);
      setPhase(0);
      setAnalysisTarget("");
    }
  };

  const upside = useMemo(() => {
    if (!result?.dcf?.available || !result?.data?.price) return null;
    const base = result.dcf.fair_value_base;
    const price = result.data.price;
    if (!base || !price) return null;
    return (base - price) / price;
  }, [result]);

  return (
    <div data-testid="valuation-page">
      <PageHeader
        overline="Academia · Inteligencia"
        title="Valoración de Activos"
        description="Análisis institucional impulsado por IA. Datos reales de mercado, DCF propietario en tres escenarios y tesis de calidad hedge fund — en menos de 30 segundos."
      />

      {/* Search */}
      <Panel testid="valuation-search-panel">
        <form
          onSubmit={submit}
          className="flex flex-col sm:flex-row items-stretch gap-3"
          data-testid="valuation-form"
        >
          <div className="relative flex-1">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--hc-text-muted)]"
              strokeWidth={1.5}
            />
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              placeholder="Introduce un ticker o empresa (AAPL, Apple, Microsoft...)"
              data-testid="valuation-ticker-input"
              autoFocus
              maxLength={80}
              disabled={loading}
              className="w-full bg-[var(--hc-bg)] border border-[var(--hc-border)] text-[var(--hc-text)] pl-11 pr-4 py-3.5 text-base tracking-tight placeholder:text-[var(--hc-text-muted)] placeholder:tracking-tight focus:outline-none focus:border-[var(--hc-gold)] transition-colors disabled:opacity-60"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !ticker.trim()}
            data-testid="valuation-submit"
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-xs tracking-[0.22em] uppercase bg-[var(--hc-platinum)] text-[var(--hc-bg)] font-semibold hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> Analizando
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" strokeWidth={1.5} /> Valorar
              </>
            )}
          </button>
        </form>

        {loading && analysisTarget && (
          <div className="mt-4 text-sm tracking-tight text-[var(--hc-text-secondary)]">
            Analizando <span className="font-medium text-[var(--hc-text)]">{analysisTarget}</span>
          </div>
        )}

        {/* phase progress */}
        {loading && (
          <div className="mt-6 grid grid-cols-3 gap-3" data-testid="valuation-progress">
            {[
              { id: 1, label: "Datos de mercado", icon: LineChart },
              { id: 2, label: "DCF propietario", icon: Target },
              { id: 3, label: "Tesis IA", icon: Sparkles },
            ].map((p) => {
              const active = phase >= p.id;
              const done = phase > p.id;
              const Icon = p.icon;
              return (
                <div
                  key={p.id}
                  className={`flex items-center gap-3 px-4 py-3 border transition-colors ${
                    active
                      ? "border-[var(--hc-gold)] bg-[var(--hc-gold-soft)]"
                      : "border-[var(--hc-border)]"
                  }`}
                >
                  {done ? (
                    <CheckCircle2 className="h-4 w-4 text-[var(--hc-gold)]" strokeWidth={1.5} />
                  ) : active ? (
                    <Loader2 className="h-4 w-4 text-[var(--hc-gold)] animate-spin" strokeWidth={1.5} />
                  ) : (
                    <Icon className="h-4 w-4 text-[var(--hc-text-muted)]" strokeWidth={1.5} />
                  )}
                  <span
                    className={`text-[0.7rem] tracking-[0.18em] uppercase ${
                      active ? "text-[var(--hc-gold)]" : "text-[var(--hc-text-muted)]"
                    }`}
                  >
                    {p.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {error && (
          <div
            data-testid="valuation-error"
            className="mt-6 text-xs tracking-tight text-[#E07A7A] border border-[#7A2424] bg-[#2A0F0F] px-4 py-3 flex items-center gap-2"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={1.5} />
            {error}
          </div>
        )}

        {resultWarning && (
          <div className="mt-6 text-xs tracking-tight text-[#E0B97A] border border-[#6A4C1C] bg-[#251D0D] px-4 py-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={1.5} />
            {resultWarning}
          </div>
        )}
      </Panel>

      {/* Results */}
      {result && (
        <div className="mt-10 space-y-6 hc-enter" data-testid="valuation-result">
          {/* Header card */}
          <div className="border border-[var(--hc-border)] bg-[var(--hc-surface)] p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-[0.7rem] tracking-[0.22em] uppercase font-semibold text-[var(--hc-gold)]">
                    {result.ticker}
                  </span>
                  {result.data?.sector && (
                    <span className="text-[0.7rem] tracking-[0.18em] uppercase text-[var(--hc-text-secondary)]">
                      {result.data.sector}
                    </span>
                  )}
                  {result.analysis?.rating && (
                    <span
                      className={`text-[0.7rem] tracking-[0.22em] uppercase font-semibold ${
                        RATING_STYLES[result.analysis.rating]?.color || "text-[var(--hc-text)]"
                      }`}
                    >
                      ★ {RATING_STYLES[result.analysis.rating]?.label || result.analysis.rating}
                    </span>
                  )}
                </div>
                <h2 className="mt-3 text-2xl sm:text-3xl font-medium tracking-[-0.02em] text-[var(--hc-text)]">
                  {result.data?.name || result.ticker}
                </h2>
                <div className="mt-4 flex items-baseline gap-6 flex-wrap">
                  <div>
                    <div className="hc-overline">Precio</div>
                    <div className="text-2xl font-medium tracking-tight text-[var(--hc-text)]">
                      {fmtNum(result.data?.price, { currency: true })}
                    </div>
                  </div>
                  <div>
                    <div className="hc-overline">Market cap</div>
                    <div className="text-base font-medium tracking-tight text-[var(--hc-text)]">
                      {fmtNum(result.data?.market_cap, { currency: true, abbr: true, digits: 2 })}
                    </div>
                  </div>
                  {upside !== null && (
                    <div>
                      <div className="hc-overline">Upside DCF (base)</div>
                      <div
                        className={`text-base font-medium tracking-tight ${
                          upside >= 0 ? "text-[#7BD3A0]" : "text-[#E07A7A]"
                        }`}
                      >
                        {upside >= 0 ? "+" : ""}
                        {(upside * 100).toFixed(1)}%
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {result.analysis?.verdict && <VerdictBadge verdict={result.analysis.verdict} />}
            </div>

            {result.analysis?.executive_summary && (
              <p className="mt-6 text-[var(--hc-text-secondary)] tracking-tight leading-relaxed max-w-4xl">
                {toDisplayText(result.analysis.executive_summary)}
              </p>
            )}
          </div>

          {/* Scoring */}
          {scoreTotal !== null && (
            <Panel overline="Scoring Institucional" title="Calidad ponderada" testid="panel-scoring">
              <div className="flex flex-col lg:flex-row gap-8 items-center lg:items-stretch">
                <div className="flex flex-col items-center justify-center shrink-0">
                  <RingScore value={scoreTotal} />
                  {result.analysis?.verdict && (
                    <div className="mt-4">
                      <VerdictBadge verdict={result.analysis.verdict} />
                    </div>
                  )}
                </div>
                <div className="flex-1 w-full space-y-4">
                  {hasScoreBreakdown ? (
                    Object.entries(SCORE_LABELS).map(([k, label]) => {
                      const v = result.analysis.score?.[k];
                      return (
                      <div key={k} data-testid={`score-${k}`}>
                        <div className="flex items-baseline justify-between mb-1.5">
                          <span className="hc-overline">{label}</span>
                          <span className="text-sm font-medium tracking-tight text-[var(--hc-text)]">
                            {fmtScore(v)}
                          </span>
                        </div>
                        <ScoreBar value={v} />
                      </div>
                      );
                    })
                  ) : (
                    <div className="border border-[var(--hc-border)] bg-[var(--hc-surface-elevated)] px-4 py-5">
                      <div className="hc-overline mb-2">Score recibido</div>
                      <p className="text-sm text-[var(--hc-text-secondary)] tracking-tight leading-relaxed">
                        El análisis devolvió una puntuación total sin desglose por categorías.
                        Se muestra el score total y el resto del reporte generado.
                      </p>
                      <div className="mt-4">
                        <ScoreBar value={scoreTotal} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {result.analysis?.verdict_explanation && (
                <div className="mt-8 pt-6 border-t border-[var(--hc-border)]">
                  <div className="hc-overline mb-2">Veredicto del analista</div>
                  <p className="text-[var(--hc-text)] tracking-tight leading-relaxed">
                    {toDisplayText(result.analysis.verdict_explanation)}
                  </p>
                </div>
              )}
            </Panel>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* DCF */}
            <div className="lg:col-span-2">
              <Panel
                overline="Modelo DCF"
                title="Valor justo · 3 escenarios"
                testid="panel-dcf"
              >
                {result.dcf?.available ? (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        {
                          key: "bear",
                          label: "Pesimista",
                          fv: result.dcf.fair_value_bear,
                          g: result.dcf.assumptions?.bear_growth,
                          color: "text-[#E07A7A]",
                        },
                        {
                          key: "base",
                          label: "Base",
                          fv: result.dcf.fair_value_base,
                          g: result.dcf.assumptions?.base_growth,
                          color: "text-[var(--hc-gold)]",
                          highlight: true,
                        },
                        {
                          key: "bull",
                          label: "Optimista",
                          fv: result.dcf.fair_value_bull,
                          g: result.dcf.assumptions?.bull_growth,
                          color: "text-[#7BD3A0]",
                        },
                      ].map((s) => {
                        const ups =
                          result.data?.price && s.fv
                            ? (s.fv - result.data.price) / result.data.price
                            : null;
                        return (
                          <div
                            key={s.key}
                            data-testid={`dcf-${s.key}`}
                            className={`p-4 border ${
                              s.highlight
                                ? "border-[var(--hc-gold)] bg-[var(--hc-gold-soft)]"
                                : "border-[var(--hc-border)]"
                            }`}
                          >
                            <div className="hc-overline mb-2">{s.label}</div>
                            <div className={`text-xl font-medium tracking-tight ${s.color}`}>
                              {fmtNum(s.fv, { currency: true })}
                            </div>
                            <div className="text-[0.7rem] tracking-tight text-[var(--hc-text-muted)] mt-1">
                              g = {fmtNum(s.g, { pct: true, digits: 1 })}
                            </div>
                            {ups !== null && (
                              <div
                                className={`text-xs tracking-tight mt-2 ${
                                  ups >= 0 ? "text-[#7BD3A0]" : "text-[#E07A7A]"
                                }`}
                              >
                                {ups >= 0 ? "+" : ""}
                                {(ups * 100).toFixed(1)}% vs precio
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-5 pt-5 border-t border-[var(--hc-border)] grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 text-xs tracking-tight text-[var(--hc-text-secondary)]">
                      <div>
                        <span className="hc-overline block mb-1">Tasa de descuento</span>
                        {fmtNum(result.dcf.assumptions?.discount_rate, { pct: true, digits: 1 })}
                      </div>
                      <div>
                        <span className="hc-overline block mb-1">Crecimiento terminal</span>
                        {fmtNum(result.dcf.assumptions?.terminal_growth, { pct: true, digits: 1 })}
                      </div>
                      <div>
                        <span className="hc-overline block mb-1">Horizonte</span>
                        {result.dcf.assumptions?.horizon_years || 5} años
                      </div>
                      <div>
                        <span className="hc-overline block mb-1">Precio actual</span>
                        {fmtNum(result.data?.price, { currency: true })}
                      </div>
                    </div>
                    {result.analysis?.fair_value_summary && (
                      <div className="mt-5 pt-5 border-t border-[var(--hc-border)] text-sm text-[var(--hc-text)] tracking-tight leading-relaxed italic">
                        <Gem className="inline h-4 w-4 mr-2 text-[var(--hc-gold)]" strokeWidth={1.5} />
                        {toDisplayText(result.analysis.fair_value_summary)}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-[var(--hc-text-muted)] italic">
                    DCF no disponible — FCF histórico insuficiente o negativo.
                  </div>
                )}
              </Panel>
            </div>

            {/* Múltiplos */}
            <Panel overline="Múltiplos" title="Valoración relativa" testid="panel-multiples">
              <Metric
                label="PE (TTM)"
                value={fmtNum(result.data?.pe_trailing, { digits: 1 })}
              />
              <Metric
                label="PE forward"
                value={fmtNum(result.data?.pe_forward, { digits: 1 })}
              />
              <Metric label="PEG" value={fmtNum(result.data?.peg, { digits: 2 })} />
              <Metric
                label="EV / EBITDA"
                value={fmtNum(result.data?.ev_ebitda, { digits: 1 })}
              />
              <Metric
                label="EV / Revenue"
                value={fmtNum(result.data?.ev_revenue, { digits: 1 })}
              />
              <Metric
                label="P / Book"
                value={fmtNum(result.data?.price_to_book, { digits: 2 })}
              />
              <Metric
                label="P / Sales"
                value={fmtNum(result.data?.price_to_sales, { digits: 2 })}
              />
            </Panel>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Panel overline="Rentabilidad" title="Calidad operativa" testid="panel-profitability">
              <Metric
                label="Margen bruto"
                value={fmtNum(result.data?.gross_margin, { pct: true, digits: 1 })}
              />
              <Metric
                label="Margen operativo"
                value={fmtNum(result.data?.operating_margin, { pct: true, digits: 1 })}
              />
              <Metric
                label="Margen neto"
                value={fmtNum(result.data?.profit_margin, { pct: true, digits: 1 })}
              />
              <Metric
                label="EBITDA margin"
                value={fmtNum(result.data?.ebitda_margin, { pct: true, digits: 1 })}
              />
              <Metric label="ROE" value={fmtNum(result.data?.roe, { pct: true, digits: 1 })} />
              <Metric label="ROA" value={fmtNum(result.data?.roa, { pct: true, digits: 1 })} />
            </Panel>

            <Panel overline="Crecimiento & Balance" title="Trayectoria" testid="panel-growth">
              <Metric
                label="Revenue CAGR"
                value={fmtNum(result.data?.revenue_cagr, { pct: true, digits: 1 })}
                accent
              />
              <Metric
                label="Net Income CAGR"
                value={fmtNum(result.data?.ni_cagr, { pct: true, digits: 1 })}
              />
              <Metric
                label="FCF CAGR"
                value={fmtNum(result.data?.fcf_cagr, { pct: true, digits: 1 })}
              />
              <Metric
                label="Revenue YoY"
                value={fmtNum(result.data?.revenue_growth, { pct: true, digits: 1 })}
              />
              <Metric
                label="Deuda / Equity"
                value={fmtNum(result.data?.debt_to_equity, { digits: 2 })}
              />
              <Metric
                label="Ratio corriente"
                value={fmtNum(result.data?.current_ratio, { digits: 2 })}
              />
            </Panel>
          </div>

          {/* Thesis */}
          {result.analysis?.thesis && (
            <Panel
              overline="Tesis de Inversión"
              title="Drivers · Moat · Catalizadores · Riesgos"
              testid="panel-thesis"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {Array.isArray(result.analysis.thesis.drivers) &&
                  result.analysis.thesis.drivers.length > 0 && (
                    <div>
                      <div className="hc-overline mb-3 text-[var(--hc-gold)]">Drivers</div>
                      <ul className="space-y-2.5">
                        {result.analysis.thesis.drivers.map((d, i) => (
                          <li
                            key={i}
                            className="flex gap-3 text-sm text-[var(--hc-text)] tracking-tight leading-relaxed"
                          >
                            <span className="text-[var(--hc-gold)] shrink-0">▸</span>
                            <span>{toDisplayText(d)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                {result.analysis.thesis.moat && (
                  <div>
                    <div className="hc-overline mb-3 text-[var(--hc-gold)]">Moat</div>
                    <p className="text-sm text-[var(--hc-text)] tracking-tight leading-relaxed">
                      {toDisplayText(result.analysis.thesis.moat)}
                    </p>
                  </div>
                )}
                {Array.isArray(result.analysis.thesis.catalysts) &&
                  result.analysis.thesis.catalysts.length > 0 && (
                    <div>
                      <div className="hc-overline mb-3 text-[var(--hc-gold)]">Catalizadores</div>
                      <ul className="space-y-2.5">
                        {result.analysis.thesis.catalysts.map((d, i) => (
                          <li
                            key={i}
                            className="flex gap-3 text-sm text-[var(--hc-text)] tracking-tight leading-relaxed"
                          >
                            <span className="text-[var(--hc-gold)] shrink-0">●</span>
                            <span>{toDisplayText(d)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                {Array.isArray(result.analysis.thesis.risks) &&
                  result.analysis.thesis.risks.length > 0 && (
                    <div>
                      <div className="hc-overline mb-3 text-[#E07A7A] flex items-center gap-2">
                        <ShieldAlert className="h-3 w-3" strokeWidth={2} /> Riesgos
                      </div>
                      <ul className="space-y-2.5">
                        {result.analysis.thesis.risks.map((d, i) => (
                          <li
                            key={i}
                            className="flex gap-3 text-sm text-[var(--hc-text-secondary)] tracking-tight leading-relaxed"
                          >
                            <span className="text-[#E07A7A] shrink-0">▲</span>
                            <span>{toDisplayText(d)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>

              {(result.analysis?.financial_quality_comment ||
                result.analysis?.valuation_comment) && (
                <div className="mt-8 pt-6 border-t border-[var(--hc-border)] grid grid-cols-1 md:grid-cols-2 gap-6">
                  {result.analysis?.financial_quality_comment && (
                    <div>
                      <div className="hc-overline mb-2">Comentario financiero</div>
                      <p className="text-sm text-[var(--hc-text)] tracking-tight leading-relaxed">
                        {toDisplayText(result.analysis.financial_quality_comment)}
                      </p>
                    </div>
                  )}
                  {result.analysis?.valuation_comment && (
                    <div>
                      <div className="hc-overline mb-2">Comentario de valoración</div>
                      <p className="text-sm text-[var(--hc-text)] tracking-tight leading-relaxed">
                        {toDisplayText(result.analysis.valuation_comment)}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </Panel>
          )}

          <p className="text-[0.7rem] tracking-tight text-[var(--hc-text-muted)] italic leading-relaxed max-w-3xl">
            Datos vía Yahoo Finance. Análisis generado por IA usando GPT-4o sobre datos reales de mercado. No constituye recomendación
            personalizada de inversión — uso exclusivo para miembros de Hampton Crest Academy con fines educativos y analíticos.
          </p>
        </div>
      )}

      {/* History */}
      <div className="mt-14">
        <Panel
          overline="Historial"
          title="Tus valoraciones recientes"
          testid="panel-history"
          action={
            <HistoryIcon
              className="h-4 w-4 text-[var(--hc-text-muted)]"
              strokeWidth={1.5}
            />
          }
        >
          {historyLoading ? (
            <div className="text-sm text-[var(--hc-text-muted)] py-6 text-center">Cargando…</div>
          ) : history.length === 0 ? (
            <div className="text-sm text-[var(--hc-text-muted)] py-6 text-center italic">
              Aún no has valorado ningún activo.
            </div>
          ) : (
            <div className="divide-y divide-[var(--hc-border)]">
              {history.map((h, i) => {
                const v = VERDICT_STYLES[h.verdict] || VERDICT_STYLES.HOLD;
                return (
                  <button
                    key={i}
                    onClick={() => submit(null, h.ticker)}
                    data-testid={`history-row-${h.ticker}`}
                    className="w-full grid grid-cols-[90px_1fr_90px_60px_90px] items-center gap-4 py-3 text-left hover:bg-[var(--hc-surface-elevated)] transition-colors px-2 -mx-2"
                  >
                    <span className="text-sm font-semibold tracking-[0.1em] text-[var(--hc-text)] uppercase">
                      {h.ticker}
                    </span>
                    <span className="text-sm text-[var(--hc-text-secondary)] tracking-tight truncate">
                      {h.name || "—"}
                    </span>
                    <span className="text-xs text-[var(--hc-text-muted)] tracking-tight">
                      {fmtNum(h.price, { currency: true })}
                    </span>
                    <span className="text-sm font-medium tracking-tight text-[var(--hc-gold)]">
                      {fmtScore(h.score_total)}
                    </span>
                    <span
                      className={`text-[0.65rem] tracking-[0.18em] uppercase font-semibold text-right ${v.text}`}
                    >
                      {v.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
