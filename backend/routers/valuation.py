"""Hampton Crest Academy - Stock valuation router."""
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
from openai import AsyncOpenAI
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/valuation", tags=["valuation"])
logger = logging.getLogger(__name__)


class ValuationIn(BaseModel):
    ticker: str = Field(min_length=1, max_length=80)


COMPANY_ALIASES = {
    "apple": ("AAPL", "Apple Inc."),
    "apple inc": ("AAPL", "Apple Inc."),
    "apple stock": ("AAPL", "Apple Inc."),
    "microsoft": ("MSFT", "Microsoft Corporation"),
    "tesla": ("TSLA", "Tesla, Inc."),
    "nvidia": ("NVDA", "NVIDIA Corporation"),
    "amazon": ("AMZN", "Amazon.com, Inc."),
    "google": ("GOOGL", "Alphabet Inc."),
    "alphabet": ("GOOGL", "Alphabet Inc."),
    "meta": ("META", "Meta Platforms, Inc."),
    "facebook": ("META", "Meta Platforms, Inc."),
    "berkshire": ("BRK-B", "Berkshire Hathaway Inc."),
}


def _safe(v: Any, default=None):
    if v is None:
        return default
    try:
        if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
            return default
    except Exception:
        pass
    return v


def _cagr(series: list[float]) -> float | None:
    try:
        clean = [float(v) for v in series if v not in (None, 0) and not math.isnan(float(v))]
        if len(clean) < 2 or clean[0] <= 0 or clean[-1] <= 0:
            return None
        n = len(clean) - 1
        return (clean[-1] / clean[0]) ** (1 / n) - 1
    except Exception:
        return None


def _fmt_financials(stmt) -> dict[str, list[float | None]]:
    if stmt is None or stmt.empty:
        return {}
    df = stmt.iloc[:, ::-1]
    out = {}
    for row in df.index:
        out[str(row)] = [None if v is None or (isinstance(v, float) and math.isnan(v)) else float(v) for v in df.loc[row].tolist()]
    return out


def _row(d: dict, *names: str) -> list[float | None]:
    for n in names:
        if n in d:
            return d[n]
    return []


def _normalize_ticker(ticker: str) -> str:
    return re.sub(r"\s+", "", ticker or "").upper()


def _normalize_company_query(value: str) -> str:
    cleaned = (value or "").strip().lower()
    cleaned = cleaned.replace(".", " ")
    cleaned = re.sub(r"[^\w\s-]", " ", cleaned)
    cleaned = re.sub(r"\b(inc|incorporated|corporation|corp|company|co)\b", "", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def _resolve_ticker_input(value: str) -> tuple[str, str | None]:
    normalized_query = _normalize_company_query(value)
    if normalized_query in COMPANY_ALIASES:
        return COMPANY_ALIASES[normalized_query]
    return _normalize_ticker(value), None


def _fetch_company_data(ticker: str) -> dict:
    normalized = _normalize_ticker(ticker)
    logger.info("[valuation:data-fetch-start] provider=yfinance ticker=%s", normalized)
    t = yf.Ticker(normalized)
    try:
        info = t.info or {}
    except Exception as e:
        logger.exception("[valuation:yfinance-info-error] ticker=%s error=%s", normalized, e)
        info = {}
    try:
        fast_info = dict(t.fast_info or {})
    except Exception as e:
        logger.warning("[valuation:yfinance-fast-info-error] ticker=%s error=%s", normalized, e)
        fast_info = {}

    logger.info(
        "[valuation:yfinance-response] ticker=%s info_keys=%s fast_info_keys=%s",
        normalized,
        sorted(list(info.keys()))[:40],
        sorted(list(fast_info.keys()))[:40],
    )

    price = (
        _safe(info.get("currentPrice"))
        or _safe(info.get("regularMarketPrice"))
        or _safe(fast_info.get("last_price"))
        or _safe(fast_info.get("lastPrice"))
        or _safe(fast_info.get("regularMarketPrice"))
    )
    company_name = info.get("shortName") or info.get("longName") or normalized
    if not info and not fast_info:
        raise ValueError(f"No yfinance payload for ticker {normalized}")
    if price is None and company_name == normalized:
        raise ValueError(f"No usable price or company profile for ticker {normalized}")

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
    return {
        "ticker": normalized,
        "name": company_name,
        "long_name": info.get("longName"),
        "exchange": info.get("exchange"),
        "currency": info.get("currency") or fast_info.get("currency"),
        "country": info.get("country"),
        "sector": info.get("sector"),
        "industry": info.get("industry"),
        "ceo": (info.get("companyOfficers") or [{}])[0].get("name") if info.get("companyOfficers") else None,
        "employees": _safe(info.get("fullTimeEmployees")),
        "website": info.get("website"),
        "long_business_summary": info.get("longBusinessSummary"),
        "price": price,
        "market_cap": _safe(info.get("marketCap")) or _safe(fast_info.get("market_cap")),
        "enterprise_value": _safe(info.get("enterpriseValue")),
        "shares_outstanding": _safe(info.get("sharesOutstanding")) or _safe(fast_info.get("shares")),
        "pe_trailing": _safe(info.get("trailingPE")),
        "pe_forward": _safe(info.get("forwardPE")),
        "peg": _safe(info.get("pegRatio")),
        "ev_ebitda": _safe(info.get("enterpriseToEbitda")),
        "ev_revenue": _safe(info.get("enterpriseToRevenue")),
        "price_to_book": _safe(info.get("priceToBook")),
        "price_to_sales": _safe(info.get("priceToSalesTrailing12Months")),
        "gross_margin": _safe(info.get("grossMargins")),
        "operating_margin": _safe(info.get("operatingMargins")),
        "profit_margin": _safe(info.get("profitMargins")),
        "ebitda_margin": _safe(info.get("ebitdaMargins")),
        "roe": _safe(info.get("returnOnEquity")),
        "roa": _safe(info.get("returnOnAssets")),
        "revenue_growth": _safe(info.get("revenueGrowth")),
        "earnings_growth": _safe(info.get("earningsGrowth")),
        "total_debt": _safe(info.get("totalDebt")),
        "total_cash": _safe(info.get("totalCash")),
        "debt_to_equity": _safe(info.get("debtToEquity")),
        "current_ratio": _safe(info.get("currentRatio")),
        "revenue_series": revenue,
        "operating_income_series": op_income,
        "net_income_series": net_income,
        "fcf_series": fcf,
        "total_debt_series": total_debt,
        "cash_series": cash,
        "revenue_cagr": _cagr(revenue),
        "ni_cagr": _cagr(net_income),
        "fcf_cagr": _cagr(fcf),
        "target_mean_price": _safe(info.get("targetMeanPrice")),
        "target_high_price": _safe(info.get("targetHighPrice")),
        "target_low_price": _safe(info.get("targetLowPrice")),
        "recommendation_key": info.get("recommendationKey"),
        "fifty_two_week_high": _safe(info.get("fiftyTwoWeekHigh")),
        "fifty_two_week_low": _safe(info.get("fiftyTwoWeekLow")),
        "dividend_yield": _safe(info.get("dividendYield")),
    }


def _simple_dcf(data: dict) -> dict:
    fcf_series = [x for x in (data.get("fcf_series") or []) if x]
    base_fcf = fcf_series[-1] if fcf_series else None
    if not base_fcf or base_fcf <= 0:
        ni = (data.get("net_income_series") or [None])[-1]
        base_fcf = ni if ni and ni > 0 else None
    shares = data.get("shares_outstanding")
    if not base_fcf or not shares:
        return {"available": False}

    revenue_cagr = data.get("revenue_cagr") or 0.05
    base_growth = max(0.03, min(0.18, revenue_cagr))
    bear_growth = max(0.0, base_growth - 0.05)
    bull_growth = min(0.25, base_growth + 0.05)
    discount = 0.09
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
        "fair_value_bear": round(npv(bear_growth) / shares, 2),
        "fair_value_base": round(npv(base_growth) / shares, 2),
        "fair_value_bull": round(npv(bull_growth) / shares, 2),
    }


def _build_llm_prompt(data: dict, dcf: dict) -> str:
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
        "Eres un analista senior de un hedge fund institucional. Analiza la empresa abajo "
        "y devuelve solo JSON válido en español. No inventes números; usa solo los datos provistos.\n\n"
        f"DATOS DE LA EMPRESA:\n{json.dumps(payload, default=str)}\n\n"
        "Devuelve este objeto JSON: executive_summary, thesis, financial_quality_comment, "
        "valuation_comment, score, rating, verdict, verdict_explanation, fair_value_summary."
    )


def _parse_json_strict(text: str) -> dict:
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?", "", cleaned)
    cleaned = re.sub(r"```$", "", cleaned).strip()
    first = cleaned.find("{")
    last = cleaned.rfind("}")
    if first != -1 and last != -1:
        cleaned = cleaned[first : last + 1]
    return json.loads(cleaned)


def _extract_score_total(analysis: dict) -> int | float | None:
    if not isinstance(analysis, dict):
        return None

    score = analysis.get("score")
    if isinstance(score, dict):
        total = score.get("total")
        return total if isinstance(total, (int, float)) and not isinstance(total, bool) else None
    if isinstance(score, (int, float)) and not isinstance(score, bool):
        return score
    return None


def register_valuation_routes(*, db, require_member):
    api_key = os.environ.get("OPENAI_API_KEY", "")
    model = os.environ.get("VALUATION_MODEL", os.environ.get("CHAT_MODEL", "gpt-4o"))
    client = AsyncOpenAI(api_key=api_key) if api_key else None

    @router.post("")
    async def run_valuation(payload: ValuationIn, current_user: dict = Depends(require_member)):
        original_input = payload.ticker.strip()
        ticker, resolved_name = _resolve_ticker_input(original_input)
        logger.info(
            "[valuation:request] user_id=%s input_original=%s ticker_resuelto=%s nombre_resuelto=%s",
            current_user["id"],
            original_input,
            ticker,
            resolved_name,
        )
        if not ticker:
            raise HTTPException(400, "Ticker inválido.")
        if client is None:
            logger.warning("[valuation:openai-not-configured] ticker=%s", ticker)
            raise HTTPException(503, "El análisis con IA no está configurado.")

        try:
            data = await asyncio.to_thread(_fetch_company_data, ticker)
        except Exception as e:
            logger.exception("[valuation:data-fetch-failed] provider=yfinance ticker=%s error=%s", ticker, e)
            raise HTTPException(404, f"No se encontró información para «{ticker}». Verifica el ticker.")

        dcf = _simple_dcf(data)
        logger.info(
            "[valuation:data-fetch-success] ticker=%s name=%s price=%s dcf_available=%s",
            ticker,
            data.get("name"),
            data.get("price"),
            dcf.get("available"),
        )

        try:
            logger.info("[valuation:openai-start] ticker=%s model=%s", ticker, model)
            response = await client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": "Eres un analista senior de hedge fund. Responde solo con JSON válido en español.",
                    },
                    {"role": "user", "content": _build_llm_prompt(data, dcf)},
                ],
                temperature=0.2,
                response_format={"type": "json_object"},
            )
            raw = response.choices[0].message.content or "{}"
            analysis = _parse_json_strict(raw)
        except Exception as e:
            logger.exception("[valuation:openai-failed] ticker=%s model=%s error=%s", ticker, model, e)
            raise HTTPException(502, "No se pudo generar el análisis. Inténtalo de nuevo.")

        record = {
            "user_id": current_user["id"],
            "ticker": ticker,
            "name": data["name"],
            "price": data.get("price"),
            "rating": analysis.get("rating"),
            "verdict": analysis.get("verdict"),
            "score_total": _extract_score_total(analysis),
            "created_at": datetime.now(timezone.utc),
        }
        await db.valuations.insert_one(record)

        return {
            "input": original_input,
            "ticker": ticker,
            "resolved_name": resolved_name or data.get("name"),
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
                "ticker": d.get("ticker"),
                "name": d.get("name"),
                "price": d.get("price"),
                "rating": d.get("rating"),
                "verdict": d.get("verdict"),
                "score_total": d.get("score_total"),
                "status": d.get("status"),
                "created_at": d["created_at"].isoformat() if hasattr(d.get("created_at"), "isoformat") else d.get("created_at"),
            }
            for d in docs
        ]

    return router
