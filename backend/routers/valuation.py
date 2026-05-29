"""Hampton Crest Academy — Stock valuation router.

Fetches market data via yfinance + uses GPT-4o (Emergent Universal Key) to
produce a hedge-fund-grade thesis, scoring (0-100) and final verdict.

Endpoint: POST /api/valuation  body: {ticker: "AAPL"}
"""
from __future__ import annotations

import asyncio
import json
import logging
import math
import os
import re
from datetime import datetime, timezone
from typing import Any

import yfinance as yf
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from emergentintegrations.llm.chat import LlmChat, UserMessage

router = APIRouter(prefix="/api/valuation", tags=["valuation"])
logger = logging.getLogger(__name__)


class ValuationIn(BaseModel):
    ticker: str = Field(min_length=1, max_length=20)


def _safe(v: Any, default=None):
    if v is None:
        return default
    try:
        if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
            return default
    except Exception:
        pass
    return v


def _pct(numerator, denominator):
    try:
        if numerator is None or denominator in (None, 0):
            return None
        return float(numerator) / float(denominator)
    except Exception:
        return None


def _cagr(series: list[float]) -> float | None:
    """CAGR over n periods (series[0] earliest, series[-1] latest)."""
    try:
        clean = [float(v) for v in series if v not in (None, 0) and not math.isnan(float(v))]
        if len(clean) < 2 or clean[0] <= 0 or clean[-1] <= 0:
            return None
        n = len(clean) - 1
        return (clean[-1] / clean[0]) ** (1 / n) - 1
    except Exception:
        return None


def _fmt_financials(stmt) -> dict[str, list[float | None]]:
    """Pandas DataFrame -> {row_name: [year0, year1, ...]} (oldest first)."""
    if stmt is None or stmt.empty:
        return {}
    df = stmt.iloc[:, ::-1]  # reverse so oldest is first
    out = {}
    for row in df.index:
        out[str(row)] = [None if v is None or (isinstance(v, float) and math.isnan(v)) else float(v) for v in df.loc[row].tolist()]
    return out


def _row(d: dict, *names: str) -> list[float | None]:
    for n in names:
        if n in d:
            return d[n]
    return []


def _fetch_company_data(ticker: str) -> dict:
    """Pull info + 10yr financials + key ratios from yfinance. Blocking → run in thread."""
    t = yf.Ticker(ticker)
    info = t.info or {}
    if not info or info.get("currentPrice") is None and info.get("regularMarketPrice") is None:
        raise ValueError(f"No data for ticker {ticker}")

    income = _fmt_financials(t.income_stmt)
    balance = _fmt_financials(t.balance_sheet)
    cashflow = _fmt_financials(t.cashflow)

    revenue = _row(income, "Total Revenue", "TotalRevenue")
    op_income = _row(income, "Operating Income", "OperatingIncome", "Ebit")
    net_income = _row(income, "Net Income", "NetIncome")
    fcf = _row(cashflow, "Free Cash Flow", "FreeCashFlow")
    if not fcf:
        op_cf = _row(cashflow, "Operating Cash Flow", "OperatingCashFlow")
        capex = _row(cashflow, "Capital Expenditure", "CapitalExpenditure", "CapitalExpenditures")
        if op_cf and capex and len(op_cf) == len(capex):
            fcf = [(o or 0) + (c or 0) for o, c in zip(op_cf, capex)]
    total_debt = _row(balance, "Total Debt", "TotalDebt")
    cash = _row(balance, "Cash And Cash Equivalents", "CashAndCashEquivalents", "Cash")

    price = _safe(info.get("currentPrice")) or _safe(info.get("regularMarketPrice"))

    return {
        "ticker": ticker.upper(),
        "name": info.get("shortName") or info.get("longName") or ticker.upper(),
        "long_name": info.get("longName"),
        "exchange": info.get("exchange"),
        "currency": info.get("currency"),
        "country": info.get("country"),
        "sector": info.get("sector"),
        "industry": info.get("industry"),
        "ceo": (info.get("companyOfficers") or [{}])[0].get("name") if info.get("companyOfficers") else None,
        "employees": _safe(info.get("fullTimeEmployees")),
        "website": info.get("website"),
        "long_business_summary": info.get("longBusinessSummary"),
        "price": price,
        "market_cap": _safe(info.get("marketCap")),
        "enterprise_value": _safe(info.get("enterpriseValue")),
        "shares_outstanding": _safe(info.get("sharesOutstanding")),
        # Multiples
        "pe_trailing": _safe(info.get("trailingPE")),
        "pe_forward": _safe(info.get("forwardPE")),
        "peg": _safe(info.get("pegRatio")),
        "ev_ebitda": _safe(info.get("enterpriseToEbitda")),
        "ev_revenue": _safe(info.get("enterpriseToRevenue")),
        "price_to_book": _safe(info.get("priceToBook")),
        "price_to_sales": _safe(info.get("priceToSalesTrailing12Months")),
        # Margins / profitability
        "gross_margin": _safe(info.get("grossMargins")),
        "operating_margin": _safe(info.get("operatingMargins")),
        "profit_margin": _safe(info.get("profitMargins")),
        "ebitda_margin": _safe(info.get("ebitdaMargins")),
        "roe": _safe(info.get("returnOnEquity")),
        "roa": _safe(info.get("returnOnAssets")),
        # Growth (from yfinance)
        "revenue_growth": _safe(info.get("revenueGrowth")),
        "earnings_growth": _safe(info.get("earningsGrowth")),
        # Financials health
        "total_debt": _safe(info.get("totalDebt")),
        "total_cash": _safe(info.get("totalCash")),
        "debt_to_equity": _safe(info.get("debtToEquity")),
        "current_ratio": _safe(info.get("currentRatio")),
        # Historical series (most recent → 4 years typically)
        "revenue_series": revenue,
        "operating_income_series": op_income,
        "net_income_series": net_income,
        "fcf_series": fcf,
        "total_debt_series": total_debt,
        "cash_series": cash,
        # CAGRs we compute
        "revenue_cagr": _cagr(revenue),
        "ni_cagr": _cagr(net_income),
        "fcf_cagr": _cagr(fcf),
        # Analyst targets
        "target_mean_price": _safe(info.get("targetMeanPrice")),
        "target_high_price": _safe(info.get("targetHighPrice")),
        "target_low_price": _safe(info.get("targetLowPrice")),
        "recommendation_key": info.get("recommendationKey"),
        # 52-week range
        "fifty_two_week_high": _safe(info.get("fiftyTwoWeekHigh")),
        "fifty_two_week_low": _safe(info.get("fiftyTwoWeekLow")),
        "dividend_yield": _safe(info.get("dividendYield")),
    }


def _simple_dcf(data: dict) -> dict:
    """Lightweight DCF: project FCF 5yr at growth, discount at WACC, add terminal."""
    fcf_series = [x for x in (data.get("fcf_series") or []) if x]
    base_fcf = fcf_series[-1] if fcf_series else None
    if not base_fcf or base_fcf <= 0:
        # fallback: use latest net income or revenue × margin
        ni = (data.get("net_income_series") or [None])[-1]
        base_fcf = ni if ni and ni > 0 else None
    shares = data.get("shares_outstanding")
    if not base_fcf or not shares:
        return {"available": False}

    # Scenario growth assumptions
    revenue_cagr = data.get("revenue_cagr") or 0.05
    base_growth = max(0.03, min(0.18, revenue_cagr))
    bear_growth = max(0.0, base_growth - 0.05)
    bull_growth = min(0.25, base_growth + 0.05)

    discount = 0.09  # blended WACC assumption
    terminal_growth = 0.025
    years = 5

    def npv(g: float) -> float:
        pv = 0.0
        fcf = base_fcf
        for yr in range(1, years + 1):
            fcf = fcf * (1 + g)
            pv += fcf / ((1 + discount) ** yr)
        terminal = fcf * (1 + terminal_growth) / (discount - terminal_growth)
        pv += terminal / ((1 + discount) ** years)
        return pv

    bear = npv(bear_growth) / shares
    base = npv(base_growth) / shares
    bull = npv(bull_growth) / shares
    return {
        "available": True,
        "assumptions": {
            "bear_growth": bear_growth,
            "base_growth": base_growth,
            "bull_growth": bull_growth,
            "discount_rate": discount,
            "terminal_growth": terminal_growth,
            "horizon_years": years,
        },
        "fair_value_bear": round(bear, 2),
        "fair_value_base": round(base, 2),
        "fair_value_bull": round(bull, 2),
    }


def _build_llm_prompt(data: dict, dcf: dict) -> str:
    """Compact JSON payload the model uses to produce the thesis + scoring."""
    payload = {
        "company": {
            "ticker": data["ticker"],
            "name": data["name"],
            "sector": data.get("sector"),
            "industry": data.get("industry"),
            "country": data.get("country"),
            "currency": data.get("currency"),
            "business_summary": (data.get("long_business_summary") or "")[:1200],
        },
        "market": {
            "price": data.get("price"),
            "market_cap": data.get("market_cap"),
            "enterprise_value": data.get("enterprise_value"),
            "fifty_two_week_high": data.get("fifty_two_week_high"),
            "fifty_two_week_low": data.get("fifty_two_week_low"),
            "analyst_target_mean": data.get("target_mean_price"),
        },
        "multiples": {
            "pe_trailing": data.get("pe_trailing"),
            "pe_forward": data.get("pe_forward"),
            "ev_ebitda": data.get("ev_ebitda"),
            "ev_revenue": data.get("ev_revenue"),
            "peg": data.get("peg"),
            "price_to_book": data.get("price_to_book"),
            "price_to_sales": data.get("price_to_sales"),
        },
        "profitability": {
            "gross_margin": data.get("gross_margin"),
            "operating_margin": data.get("operating_margin"),
            "profit_margin": data.get("profit_margin"),
            "ebitda_margin": data.get("ebitda_margin"),
            "roe": data.get("roe"),
            "roa": data.get("roa"),
        },
        "growth": {
            "revenue_cagr": data.get("revenue_cagr"),
            "ni_cagr": data.get("ni_cagr"),
            "fcf_cagr": data.get("fcf_cagr"),
            "revenue_growth_yoy": data.get("revenue_growth"),
            "earnings_growth_yoy": data.get("earnings_growth"),
        },
        "balance_sheet": {
            "total_debt": data.get("total_debt"),
            "total_cash": data.get("total_cash"),
            "debt_to_equity": data.get("debt_to_equity"),
            "current_ratio": data.get("current_ratio"),
            "dividend_yield": data.get("dividend_yield"),
        },
        "dcf": dcf,
    }
    return (
        "Eres un analista senior de un hedge fund institucional con 20 años de experiencia. "
        "Analizas la empresa abajo y devuelves un JSON ESTRICTO en español que será renderizado "
        "directamente en una plataforma para miembros premium. Sé directo, claro, accionable. "
        "NO uses jerga innecesaria. NO inventes números — usa solo los datos provistos.\n\n"
        f"DATOS DE LA EMPRESA:\n{json.dumps(payload, default=str)}\n\n"
        "DEVUELVE SOLO ESTE JSON (sin markdown, sin texto antes/después):\n"
        "{\n"
        '  "executive_summary": "Máximo 150 palabras. Qué hace, por qué interesante, riesgos clave, conclusión rápida. Lenguaje simple.",\n'
        '  "thesis": {"drivers": ["..."], "moat": "...", "catalysts": ["..."], "risks": ["top 5 riesgos reales, uno por elemento"]},\n'
        '  "financial_quality_comment": "2-3 frases sobre la calidad de los ingresos, márgenes, FCF y balance.",\n'
        '  "valuation_comment": "2-3 frases. ¿Cotiza cara, justa o barata? ¿Vs histórico propio y vs sector? Cita múltiplos.",\n'
        '  "score": {"business_quality": 0-100, "growth": 0-100, "financial_health": 0-100, "valuation": 0-100, "risk": 0-100, "total": 0-100},\n'
        '  "rating": "EXCEPTIONAL | HIGH_QUALITY | WATCHLIST | SPECULATIVE | AVOID",\n'
        '  "verdict": "STRONG_BUY | BUY | HOLD | AVOID",\n'
        '  "verdict_explanation": "2-3 frases. Razonamiento simple. Menciona condiciones (si cae a $X mejora).",\n'
        '  "fair_value_summary": "Una frase con el rango de valor justo y el upside estimado."\n'
        "}\n\n"
        "REGLAS DE SCORING (peso explícito):\n"
        "- business_quality (25%): moat, recurrencia, pricing power, márgenes, ROIC/ROE\n"
        "- growth (20%): CAGRs históricos y esperados, TAM\n"
        "- financial_health (20%): deuda, liquidez, generación de caja\n"
        "- valuation (20%): múltiplos vs sector, margen de seguridad del DCF\n"
        "- risk (15%): ciclicidad, concentración, regulación, competencia. Score más alto = MENOS riesgo.\n"
        "El total debe ser el promedio ponderado redondeado.\n"
        "Mapeo total -> rating: >=90 EXCEPTIONAL, 75-89 HIGH_QUALITY, 60-74 WATCHLIST, 40-59 SPECULATIVE, <40 AVOID."
    )


def _parse_json_strict(text: str) -> dict:
    """Strip code fences and parse JSON robustly."""
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?", "", cleaned)
    cleaned = re.sub(r"```$", "", cleaned).strip()
    # Find outermost braces if model added preamble
    first = cleaned.find("{")
    last = cleaned.rfind("}")
    if first != -1 and last != -1:
        cleaned = cleaned[first : last + 1]
    return json.loads(cleaned)


def register_valuation_routes(*, db, require_member):
    api_key = os.environ.get("EMERGENT_LLM_KEY", "")
    provider = os.environ.get("CHAT_PROVIDER", "openai")
    model = os.environ.get("VALUATION_MODEL", os.environ.get("CHAT_MODEL", "gpt-4o"))

    @router.post("")
    async def run_valuation(payload: ValuationIn, current_user: dict = Depends(require_member)):
        ticker = payload.ticker.strip().upper()
        if not api_key:
            raise HTTPException(503, "El asistente no está configurado.")

        # Fetch market data in a thread (yfinance is blocking)
        try:
            data = await asyncio.to_thread(_fetch_company_data, ticker)
        except Exception as e:
            logger.error("yfinance fetch failed: %s", e)
            raise HTTPException(404, f"No se encontró información para «{ticker}». Verifica el ticker.")

        dcf = _simple_dcf(data)

        # Run LLM analysis
        try:
            chat = (
                LlmChat(
                    api_key=api_key,
                    session_id=f"valuation-{ticker}-{current_user['id']}",
                    system_message="Eres un analista senior de hedge fund. Responde solo con JSON válido en español.",
                )
                .with_model(provider, model)
            )
            raw = await chat.send_message(UserMessage(text=_build_llm_prompt(data, dcf)))
            analysis = _parse_json_strict(raw)
        except Exception as e:
            logger.error("LLM analysis failed for %s: %s", ticker, e)
            raise HTTPException(502, "No se pudo generar el análisis. Inténtalo de nuevo.")

        # Persist
        record = {
            "user_id": current_user["id"],
            "ticker": ticker,
            "name": data["name"],
            "price": data.get("price"),
            "rating": analysis.get("rating"),
            "verdict": analysis.get("verdict"),
            "score_total": ((analysis.get("score") or {}).get("total")),
            "created_at": datetime.now(timezone.utc),
        }
        await db.valuations.insert_one(record)

        return {
            "ticker": ticker,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "data": data,
            "dcf": dcf,
            "analysis": analysis,
        }

    @router.get("/history")
    async def valuation_history(current_user: dict = Depends(require_member), limit: int = 20):
        docs = await (
            db.valuations.find({"user_id": current_user["id"]})
            .sort("created_at", -1)
            .limit(limit)
            .to_list(limit)
        )
        return [
            {
                "ticker": d["ticker"],
                "name": d.get("name"),
                "price": d.get("price"),
                "rating": d.get("rating"),
                "verdict": d.get("verdict"),
                "score_total": d.get("score_total"),
                "created_at": d["created_at"].isoformat() if isinstance(d.get("created_at"), datetime) else d.get("created_at"),
            }
            for d in docs
        ]

    return router
