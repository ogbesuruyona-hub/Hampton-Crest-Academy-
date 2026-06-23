import React, { useEffect, useMemo, useRef, useState } from "react";
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
  if (v === null || v === undefined || Number.isNaN(v)) return "No disponible";
  const { currency = false, pct = false, abbr = false, digits = 2 } = opts;
  const n = Number(v);
  if (Number.isNaN(n)) return "No disponible";
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
  WATCHLIST: { label: "EN OBSERVACIÃ“N", color: "text-[var(--hc-text)]" },
  SPECULATIVE: { label: "ESPECULATIVA", color: "text-[#E0B97A]" },
  AVOID: { label: "EVITAR", color: "text-[#E07A7A]" },
};

const SCORE_LABELS = {
  business_quality: "Calidad del negocio",
  growth: "Crecimiento",
  financial_health: "Salud financiera",
  valuation: "ValoraciÃ³n",
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

const getValuationCacheKey = (value) => {
  const alias = COMPANY_ALIAS_PREVIEW[normalizeCompanyQuery(value)];
  return alias?.ticker || normalizeTickerInput(value);
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
  return display.value === null ? "No disponible" : `${Math.round(display.value)}/${display.scale}`;
};

const humanizeKey = (key) =>
  String(key || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const toDisplayText = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(toDisplayText).filter(Boolean).join("; ");
  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, item]) => `${humanizeKey(key)}: ${toDisplayText(item)}`)
      .filter(Boolean)
      .join("; ");
  }
  return String(value);
};

const hasDcfScenarioValues = (value) =>
  Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      ["bear_case", "base_case", "bull_case"].some((key) => value[key] !== undefined)
  );

const isScoreBreakdown = (score) =>
  Boolean(score && typeof score === "object" && !Array.isArray(score));

const DCF_DEFAULT_CONFIG = {
  bear_growth: 0,
  base_growth: 0.05,
  bull_growth: 0.1,
  discount_rate: 0.09,
  terminal_growth: 0.025,
  horizon_years: 5,
};

const clampNumber = (value, min, max, fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
};

const getDcfConfigFromResult = (dcf) => ({
  ...DCF_DEFAULT_CONFIG,
  ...(dcf?.assumptions || {}),
});

const getLastPositive = (series) => {
  if (!Array.isArray(series)) return null;
  for (let i = series.length - 1; i >= 0; i -= 1) {
    const value = asFiniteNumber(series[i]);
    if (value && value > 0) return value;
  }
  return null;
};

const recalculateDcf = (data, config) => {
  const baseFcf = getLastPositive(data?.fcf_series) || getLastPositive(data?.net_income_series);
  const shares = asFiniteNumber(data?.shares_outstanding);
  if (!baseFcf || !shares) return { available: false };

  const assumptions = {
    bear_growth: clampNumber(config.bear_growth, -0.5, 0.5, DCF_DEFAULT_CONFIG.bear_growth),
    base_growth: clampNumber(config.base_growth, -0.5, 0.5, DCF_DEFAULT_CONFIG.base_growth),
    bull_growth: clampNumber(config.bull_growth, -0.5, 0.5, DCF_DEFAULT_CONFIG.bull_growth),
    discount_rate: clampNumber(config.discount_rate, 0.01, 0.5, DCF_DEFAULT_CONFIG.discount_rate),
    terminal_growth: clampNumber(config.terminal_growth, -0.05, 0.08, DCF_DEFAULT_CONFIG.terminal_growth),
    horizon_years: Math.round(clampNumber(config.horizon_years, 1, 20, DCF_DEFAULT_CONFIG.horizon_years)),
  };

  if (assumptions.discount_rate <= assumptions.terminal_growth) {
    assumptions.discount_rate = assumptions.terminal_growth + 0.01;
  }

  const npv = (growth) => {
    let presentValue = 0;
    let fcf = baseFcf;
    for (let year = 1; year <= assumptions.horizon_years; year += 1) {
      fcf *= 1 + growth;
      presentValue += fcf / (1 + assumptions.discount_rate) ** year;
    }
    const terminal =
      (fcf * (1 + assumptions.terminal_growth)) /
      (assumptions.discount_rate - assumptions.terminal_growth);
    presentValue += terminal / (1 + assumptions.discount_rate) ** assumptions.horizon_years;
    return presentValue;
  };

  return {
    available: true,
    assumptions,
    fair_value_bear: Number((npv(assumptions.bear_growth) / shares).toFixed(2)),
    fair_value_base: Number((npv(assumptions.base_growth) / shares).toFixed(2)),
    fair_value_bull: Number((npv(assumptions.bull_growth) / shares).toFixed(2)),
  };
};

const percentInputValue = (value) => {
  const n = asFiniteNumber(value);
  return n === null ? "" : Number((n * 100).toFixed(2));
};


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
          {display.value === null ? "â€”" : Math.round(display.value)}
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

const DcfScenarioCards = ({ value }) => {
  const scenarios = [
    { key: "bear_case", label: "Pesimista", color: "text-[#E07A7A]" },
    { key: "base_case", label: "Base", color: "text-[var(--hc-gold)]" },
    { key: "bull_case", label: "Optimista", color: "text-[#7BD3A0]" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 not-italic">
      {scenarios.map((scenario) => (
        <div key={scenario.key} className="border border-[var(--hc-border)] bg-[var(--hc-surface-elevated)] p-4">
          <div className="hc-overline mb-2">{scenario.label}</div>
          <div className={`text-lg font-medium tracking-tight ${scenario.color}`}>
            {fmtNum(value?.[scenario.key], { currency: true })}
          </div>
        </div>
      ))}
    </div>
  );
};

const NarrativeValue = ({ value }) => {
  if (value === null || value === undefined || value === "") return null;

  if (hasDcfScenarioValues(value)) {
    return <DcfScenarioCards value={value} />;
  }

  if (Array.isArray(value)) {
    return (
      <ul className="space-y-2">
        {value.map((item, index) => (
          <li key={index} className="flex gap-2">
            <span className="text-[var(--hc-gold)] shrink-0">-</span>
            <div className="flex-1">{hasDcfScenarioValues(item) ? <DcfScenarioCards value={item} /> : toDisplayText(item)}</div>
          </li>
        ))}
      </ul>
    );
  }

  if (typeof value === "object") {
    return (
      <div className="space-y-2">
        {Object.entries(value).map(([key, item]) => (
          <div key={key}>
            <span className="font-medium text-[var(--hc-text)]">{humanizeKey(key)}: </span>
            <span>{toDisplayText(item)}</span>
          </div>
        ))}
      </div>
    );
  }

  return <>{toDisplayText(value)}</>;
};

const DcfInput = ({ label, value, suffix = "%", min, max, step = "0.1", onChange }) => (
  <label className="block">
    <span className="hc-overline block mb-2">{label}</span>
    <div className="flex items-center border border-[var(--hc-border)] bg-[var(--hc-bg)] focus-within:border-[var(--hc-gold)] transition-colors">
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-transparent px-3 py-2.5 text-sm tracking-tight text-[var(--hc-text)] focus:outline-none"
      />
      <span className="px-3 text-xs tracking-tight text-[var(--hc-text-muted)] border-l border-[var(--hc-border)]">
        {suffix}
      </span>
    </div>
  </label>
);

const SkeletonBlock = ({ className = "" }) => (
  <div className={`animate-pulse bg-[var(--hc-surface-elevated)] ${className}`} />
);

const ValuationSkeleton = () => (
  <div className="mt-10 space-y-6" data-testid="valuation-skeleton">
    <div className="border border-[var(--hc-border)] bg-[var(--hc-surface)] p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <SkeletonBlock className="h-3 w-28 mb-4" />
          <SkeletonBlock className="h-8 w-full max-w-md mb-6" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SkeletonBlock className="h-16" />
            <SkeletonBlock className="h-16" />
            <SkeletonBlock className="h-16" />
          </div>
        </div>
        <SkeletonBlock className="h-10 w-36" />
      </div>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 border border-[var(--hc-border)] bg-[var(--hc-surface)] p-6">
        <SkeletonBlock className="h-3 w-24 mb-4" />
        <SkeletonBlock className="h-7 w-56 mb-6" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <SkeletonBlock className="h-28" />
          <SkeletonBlock className="h-28" />
          <SkeletonBlock className="h-28" />
        </div>
      </div>
      <div className="border border-[var(--hc-border)] bg-[var(--hc-surface)] p-6">
        <SkeletonBlock className="h-3 w-20 mb-4" />
        <SkeletonBlock className="h-7 w-40 mb-6" />
        <div className="space-y-3">
          <SkeletonBlock className="h-8" />
          <SkeletonBlock className="h-8" />
          <SkeletonBlock className="h-8" />
          <SkeletonBlock className="h-8" />
        </div>
      </div>
    </div>
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
  const [dcfConfig, setDcfConfig] = useState(DCF_DEFAULT_CONFIG);
  const valuationCacheRef = useRef(new Map());
  const inFlightTickerRef = useRef("");
  const debounceTimerRef = useRef(null);
  const requestSeqRef = useRef(0);

  const scoreTotal = getScoreTotal(result?.analysis?.score);
  const hasScoreBreakdown = isScoreBreakdown(result?.analysis?.score);
  const resultWarning =
    result && (!result.data || !result.analysis)
      ? "La valoraciÃ³n se completÃ³, pero la respuesta llegÃ³ incompleta. Se muestran los campos disponibles."
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

  useEffect(() => {
    if (result?.dcf) {
      setDcfConfig(getDcfConfigFromResult(result.dcf));
    }
  }, [result?.ticker, result?.fetched_at, result?.dcf]);

  useEffect(
    () => () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    },
    []
  );

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

  const runValuation = async (query) => {
    if (!query) return;
    const cacheKey = getValuationCacheKey(query);
    if (!cacheKey) return;

    const cachedResult = valuationCacheRef.current.get(cacheKey);
    if (cachedResult) {
      setTicker(query);
      setResult(cachedResult);
      setError("");
      return;
    }

    if (loading && inFlightTickerRef.current === cacheKey) return;

    setLoading(true);
    setError("");
    setTicker(query);
    setAnalysisTarget(getAnalysisTargetLabel(query));
    inFlightTickerRef.current = cacheKey;
    const requestId = requestSeqRef.current + 1;
    requestSeqRef.current = requestId;
    try {
      const { data } = await api.post("/valuation", { ticker: query });
      const resolvedKey = getValuationCacheKey(data?.ticker || cacheKey);
      valuationCacheRef.current.set(cacheKey, data);
      valuationCacheRef.current.set(resolvedKey, data);
      if (requestSeqRef.current === requestId) {
        setResult(data);
        loadHistory();
      }
    } catch (err) {
      if (requestSeqRef.current === requestId) {
        setError(
          formatApiErrorDetail(err.response?.data?.detail) ||
            err.message ||
            "No se pudo completar la valoraciÃ³n."
        );
      }
    } finally {
      if (requestSeqRef.current === requestId) {
        setLoading(false);
        setPhase(0);
        setAnalysisTarget("");
        inFlightTickerRef.current = "";
      }
    }
  };

  const submit = (e, tickerOverride = "") => {
    e?.preventDefault();
    const query = (tickerOverride || ticker).trim();
    if (!query) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => runValuation(query), 350);
  };

  const displayDcf = useMemo(() => {
    if (!result?.dcf?.available) return result?.dcf || null;
    const recalculated = recalculateDcf(result.data, dcfConfig);
    return recalculated.available ? recalculated : result.dcf;
  }, [result, dcfConfig]);

  const updateDcfPercent = (key, value) => {
    const n = Number(value);
    setDcfConfig((current) => ({
      ...current,
      [key]: Number.isFinite(n) ? n / 100 : current[key],
    }));
  };

  const updateDcfYears = (value) => {
    const n = Number(value);
    setDcfConfig((current) => ({
      ...current,
      horizon_years: Number.isFinite(n) ? Math.round(n) : current.horizon_years,
    }));
  };

  const resetDcfConfig = () => {
    setDcfConfig(getDcfConfigFromResult(result?.dcf));
  };

  const upside = useMemo(() => {
    if (!displayDcf?.available || !result?.data?.price) return null;
    const base = displayDcf.fair_value_base;
    const price = result.data.price;
    if (!base || !price) return null;
    return (base - price) / price;
  }, [displayDcf, result]);

  return (
    <div data-testid="valuation-page">
      <PageHeader
        overline="Academia Â· Inteligencia"
        title="ValoraciÃ³n de Activos"
        description="AnÃ¡lisis institucional impulsado por IA. Datos reales de mercado, DCF propietario en tres escenarios y tesis de calidad hedge fund â€” en menos de 30 segundos."
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
              className="w-full bg-[var(--hc-bg)] border border-[var(--hc-border)] text-[var(--hc-text)] pl-11 pr-4 py-3.5 text-base tracking-tight placeholder:text-[var(--hc-text-muted)] placeholder:tracking-tight focus:outline-none focus:border-[var(--hc-gold)] transition-colors disabled:opacity-60"
            />
          </div>
          <button
            type="submit"
            disabled={!ticker.trim()}
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

        {loading && result && (
          <div className="mt-4 text-xs tracking-tight text-[var(--hc-text-muted)]">
            Manteniendo la valoraciÃ³n anterior visible mientras llega la nueva respuesta.
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

      {loading && !result && <ValuationSkeleton />}

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
                      â˜… {RATING_STYLES[result.analysis.rating]?.label || toDisplayText(result.analysis.rating)}
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
              <div className="mt-6 text-[var(--hc-text-secondary)] tracking-tight leading-relaxed max-w-4xl">
                <NarrativeValue value={result.analysis.executive_summary} />
              </div>
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
                        El anÃ¡lisis devolviÃ³ una puntuaciÃ³n total sin desglose por categorÃ­as.
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
                  <div className="text-[var(--hc-text)] tracking-tight leading-relaxed">
                    <NarrativeValue value={result.analysis.verdict_explanation} />
                  </div>
                </div>
              )}
            </Panel>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* DCF */}
            <div className="lg:col-span-2">
              <Panel
                overline="Modelo DCF"
                title="Valor justo Â· 3 escenarios"
                testid="panel-dcf"
              >
                {displayDcf?.available ? (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        {
                          key: "bear",
                          label: "Pesimista",
                          fv: displayDcf.fair_value_bear,
                          g: displayDcf.assumptions?.bear_growth,
                          color: "text-[#E07A7A]",
                        },
                        {
                          key: "base",
                          label: "Base",
                          fv: displayDcf.fair_value_base,
                          g: displayDcf.assumptions?.base_growth,
                          color: "text-[var(--hc-gold)]",
                          highlight: true,
                        },
                        {
                          key: "bull",
                          label: "Optimista",
                          fv: displayDcf.fair_value_bull,
                          g: displayDcf.assumptions?.bull_growth,
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
                        {fmtNum(displayDcf.assumptions?.discount_rate, { pct: true, digits: 1 })}
                      </div>
                      <div>
                        <span className="hc-overline block mb-1">Crecimiento terminal</span>
                        {fmtNum(displayDcf.assumptions?.terminal_growth, { pct: true, digits: 1 })}
                      </div>
                      <div>
                        <span className="hc-overline block mb-1">Horizonte</span>
                        {displayDcf.assumptions?.horizon_years || 5} aÃ±os
                      </div>
                      <div>
                        <span className="hc-overline block mb-1">Precio actual</span>
                        {fmtNum(result.data?.price, { currency: true })}
                      </div>
                    </div>
                    <div className="mt-5 pt-5 border-t border-[var(--hc-border)]">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                        <div>
                          <div className="hc-overline text-[var(--hc-gold)]">Supuestos editables</div>
                          <p className="mt-1 text-xs tracking-tight text-[var(--hc-text-muted)]">
                            Ajusta el DCF localmente sin modificar la valoración guardada por el backend.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={resetDcfConfig}
                          className="self-start sm:self-auto px-3 py-2 border border-[var(--hc-border)] text-[0.68rem] tracking-[0.18em] uppercase text-[var(--hc-text-secondary)] hover:border-[var(--hc-gold)] hover:text-[var(--hc-gold)] transition-colors"
                        >
                          Restaurar
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                        <DcfInput
                          label="Tasa de descuento"
                          value={percentInputValue(dcfConfig.discount_rate)}
                          min="1"
                          max="50"
                          onChange={(value) => updateDcfPercent("discount_rate", value)}
                        />
                        <DcfInput
                          label="Crecimiento pesimista"
                          value={percentInputValue(dcfConfig.bear_growth)}
                          min="-50"
                          max="50"
                          onChange={(value) => updateDcfPercent("bear_growth", value)}
                        />
                        <DcfInput
                          label="Crecimiento base"
                          value={percentInputValue(dcfConfig.base_growth)}
                          min="-50"
                          max="50"
                          onChange={(value) => updateDcfPercent("base_growth", value)}
                        />
                        <DcfInput
                          label="Crecimiento optimista"
                          value={percentInputValue(dcfConfig.bull_growth)}
                          min="-50"
                          max="50"
                          onChange={(value) => updateDcfPercent("bull_growth", value)}
                        />
                        <DcfInput
                          label="Crecimiento terminal"
                          value={percentInputValue(dcfConfig.terminal_growth)}
                          min="-5"
                          max="8"
                          onChange={(value) => updateDcfPercent("terminal_growth", value)}
                        />
                        <DcfInput
                          label="Horizonte"
                          value={dcfConfig.horizon_years}
                          suffix="años"
                          min="1"
                          max="20"
                          step="1"
                          onChange={updateDcfYears}
                        />
                      </div>
                    </div>
                    {result.analysis?.fair_value_summary &&
                      !hasDcfScenarioValues(result.analysis.fair_value_summary) && (
                      <div className="mt-5 pt-5 border-t border-[var(--hc-border)] text-sm text-[var(--hc-text)] tracking-tight leading-relaxed">
                        <div className="mb-3 flex items-center gap-2 text-[var(--hc-gold)]">
                          <Gem className="h-4 w-4" strokeWidth={1.5} />
                          <span className="hc-overline">Resumen de valor justo</span>
                        </div>
                        <NarrativeValue value={result.analysis.fair_value_summary} />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-[var(--hc-text-muted)] italic">
                    DCF no disponible â€” FCF histÃ³rico insuficiente o negativo.
                  </div>
                )}
              </Panel>
            </div>

            {/* MÃºltiplos */}
            <Panel overline="MÃºltiplos" title="ValoraciÃ³n relativa" testid="panel-multiples">
              <Metric
                label="PE (TTM)"
                value={fmtNum(result.data?.pe_trailing, { digits: 1 })}
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
              overline="Tesis de InversiÃ³n"
              title="Drivers Â· Moat Â· Catalizadores Â· Riesgos"
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
                            <span className="text-[var(--hc-gold)] shrink-0">â–¸</span>
                            <div className="flex-1"><NarrativeValue value={d} /></div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                {result.analysis.thesis.moat && (
                  <div>
                    <div className="hc-overline mb-3 text-[var(--hc-gold)]">Moat</div>
                    <div className="text-sm text-[var(--hc-text)] tracking-tight leading-relaxed">
                      <NarrativeValue value={result.analysis.thesis.moat} />
                    </div>
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
                            <span className="text-[var(--hc-gold)] shrink-0">â—</span>
                            <div className="flex-1"><NarrativeValue value={d} /></div>
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
                            <span className="text-[#E07A7A] shrink-0">â–²</span>
                            <div className="flex-1"><NarrativeValue value={d} /></div>
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
                      <div className="text-sm text-[var(--hc-text)] tracking-tight leading-relaxed">
                        <NarrativeValue value={result.analysis.financial_quality_comment} />
                      </div>
                    </div>
                  )}
                  {result.analysis?.valuation_comment && (
                    <div>
                      <div className="hc-overline mb-2">Comentario de valoraciÃ³n</div>
                      <div className="text-sm text-[var(--hc-text)] tracking-tight leading-relaxed">
                        <NarrativeValue value={result.analysis.valuation_comment} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Panel>
          )}

          <p className="text-[0.7rem] tracking-tight text-[var(--hc-text-muted)] italic leading-relaxed max-w-3xl">
            Datos vÃ­a Yahoo Finance. AnÃ¡lisis generado por IA usando GPT-4o sobre datos reales de mercado. No constituye recomendaciÃ³n
            personalizada de inversiÃ³n â€” uso exclusivo para miembros de Hampton Crest Academy con fines educativos y analÃ­ticos.
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
            <div className="text-sm text-[var(--hc-text-muted)] py-6 text-center">Cargandoâ€¦</div>
          ) : history.length === 0 ? (
            <div className="text-sm text-[var(--hc-text-muted)] py-6 text-center italic">
              AÃºn no has valorado ningÃºn activo.
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
                      {h.name || "â€”"}
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

