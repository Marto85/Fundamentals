from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import numpy as np
import requests
import requests.adapters
import math
import time
import random

app = FastAPI(title="Stock Analyzer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── requests session (solo para /api/search) ──────────────────────────────────
def make_requests_session():
    s = requests.Session()
    s.mount("https://", requests.adapters.HTTPAdapter(max_retries=3))
    s.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.5",
    })
    return s

_requests_session = make_requests_session()

# ── curl_cffi session para yfinance (bypasses Yahoo cloud blocks) ─────────────
try:
    from curl_cffi import requests as curl_requests
    _yf_session = curl_requests.Session(impersonate="chrome110")
    print("✅ curl_cffi session initialized with chrome110 impersonation")
except Exception as e:
    _yf_session = None
    print(f"⚠️  curl_cffi not available: {e}")

# ── caché en memoria ──────────────────────────────────────────────────────────
COMPANY_CACHE: dict = {}
CHART_CACHE:   dict = {}
CACHE_EXPIRE = 3600


def get_ticker(symbol: str):
    if _yf_session is not None:
        return yf.Ticker(symbol, session=_yf_session)
    return yf.Ticker(symbol)


def clean(val):
    if val is None:
        return None
    if isinstance(val, (np.integer,)):
        return int(val)
    if isinstance(val, (np.floating, float)):
        if math.isnan(val) or math.isinf(val):
            return None
        return float(val)
    return val


def get_recent(df, *fields):
    if df is None:
        return None
    try:
        if df.empty:
            return None
    except Exception:
        return None
    for field in fields:
        if field in df.index:
            for col in df.columns:
                try:
                    val = clean(df.loc[field, col])
                    if val is not None:
                        return val
                except Exception:
                    continue
    return None


def safe_fetch(fn, retries=3, delay=3):
    last_err = None
    for attempt in range(retries):
        try:
            return fn()
        except Exception as e:
            last_err = e
            if attempt < retries - 1:
                time.sleep(delay * (2 ** attempt) + random.uniform(0, 1))
    raise last_err


def validate_info(info, symbol):
    # Only reject if info is completely absent
    if info is None or not isinstance(info, dict):
        raise HTTPException(status_code=404, detail=f"No se encontró '{symbol}'")
    # Empty dict means Yahoo blocked us silently
    if len(info) == 0:
        raise HTTPException(status_code=503, detail=f"Yahoo Finance bloqueó la request para '{symbol}'. Intentá en unos segundos.")


# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/search")
async def search(q: str = Query(..., min_length=1)):
    try:
        url = "https://query2.finance.yahoo.com/v1/finance/search"
        params = {"q": q, "quotesCount": 12, "newsCount": 0, "enableFuzzyQuery": False}
        resp = _requests_session.get(url, params=params, timeout=8)
        resp.raise_for_status()
        data = resp.json()
        results = []
        for quote in data.get("quotes", []):
            if quote.get("quoteType") in ("EQUITY", "ETF"):
                results.append({
                    "symbol":   quote.get("symbol"),
                    "name":     quote.get("longname") or quote.get("shortname", ""),
                    "exchange": quote.get("exchange", ""),
                    "type":     quote.get("quoteType"),
                })
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))




@app.get("/api/debug/{ticker}")
async def debug_ticker(ticker: str):
    """Temporary debug endpoint - shows raw yfinance response"""
    import sys
    symbol = ticker.upper()
    try:
        t = get_ticker(symbol)
        info = safe_fetch(lambda: t.info)
        return {
            "symbol": symbol,
            "curl_cffi_active": _yf_session is not None,
            "info_type": str(type(info)),
            "info_len": len(info) if isinstance(info, dict) else -1,
            "info_keys": list(info.keys())[:20] if isinstance(info, dict) else [],
            "sample": {k: info.get(k) for k in ["longName","currentPrice","marketCap","regularMarketPrice","symbol"] if info.get(k)},
        }
    except Exception as e:
        return {"error": str(e), "curl_cffi_active": _yf_session is not None}

@app.get("/api/company/{ticker}")
async def get_company(ticker: str):
    symbol = ticker.upper()
    now = time.time()

    if symbol in COMPANY_CACHE:
        if now - COMPANY_CACHE[symbol]["timestamp"] < CACHE_EXPIRE:
            return COMPANY_CACHE[symbol]["data"]

    try:
        t = get_ticker(symbol)

        info    = safe_fetch(lambda: t.info)
        income  = safe_fetch(lambda: t.income_stmt)
        balance = safe_fetch(lambda: t.balance_sheet)
        cf      = safe_fetch(lambda: t.cashflow)

        # Log what we got for debugging
        import sys
        print(f"INFO keys for {symbol}: {list(info.keys())[:10] if info else 'EMPTY'}", file=sys.stderr)

        # ── Revenue ───────────────────────────────────────────────────────────
        total_rev    = get_recent(income, "Total Revenue")
        op_rev       = get_recent(income, "Operating Revenue") or total_rev
        other_income = get_recent(income, "Other Income Expense",
                                  "Non Operating Income", "Total Other Finance Income")
        gross_profit = get_recent(income, "Gross Profit")
        op_income    = get_recent(income, "Operating Income", "EBIT")
        ebitda       = get_recent(income, "EBITDA", "Normalized EBITDA")
        net_income   = get_recent(income, "Net Income", "Net Income Common Stockholders")
        da           = get_recent(cf, "Depreciation And Amortization",
                                  "Depreciation Depletion And Amortization")

        if ebitda is None and op_income is not None and da is not None:
            ebitda = op_income + abs(da)

        # ── Balance sheet ─────────────────────────────────────────────────────
        total_assets = get_recent(balance, "Total Assets")
        total_liab   = get_recent(balance, "Total Liabilities Net Minority Interest", "Total Liabilities")
        equity       = get_recent(balance, "Stockholders Equity", "Common Stock Equity",
                                  "Total Equity Gross Minority Interest")
        total_debt   = get_recent(balance, "Total Debt", "Long Term Debt And Capital Lease Obligation")
        cash         = get_recent(balance, "Cash And Cash Equivalents",
                                  "Cash Cash Equivalents And Short Term Investments",
                                  "Cash And Cash Equivalents And Short Term Investments")

        # ── Cash flow ─────────────────────────────────────────────────────────
        op_cf  = get_recent(cf, "Operating Cash Flow", "Cash Flows From Operations")
        capex  = get_recent(cf, "Capital Expenditure", "Purchase Of Property Plant And Equipment")
        fcf    = get_recent(cf, "Free Cash Flow")
        if fcf is None and op_cf is not None and capex is not None:
            fcf = op_cf + capex if capex < 0 else op_cf - capex

        # ── Ratios ────────────────────────────────────────────────────────────
        def ratio(n, d):
            if n is not None and d and d != 0:
                return n / d
            return None

        gross_margin = ratio(gross_profit, total_rev)
        op_margin    = ratio(op_income, total_rev)
        net_margin   = ratio(net_income, total_rev)
        roe          = ratio(net_income, equity)
        roa          = ratio(net_income, total_assets)
        de_ratio     = ratio(total_debt, equity)
        net_debt     = (total_debt - cash) if (total_debt is not None and cash is not None) else None

        market_cap  = clean(info.get("marketCap"))
        ev          = (market_cap + net_debt) if (market_cap and net_debt is not None) else None
        ev_ebitda   = ratio(ev, ebitda)
        fcf_yield   = ratio(fcf, market_cap)
        fcf_margin  = ratio(fcf, total_rev)
        fcf_quality = ratio(fcf, net_income)

        price        = clean(info.get("currentPrice") or info.get("regularMarketPrice"))
        prev_close   = clean(info.get("previousClose"))
        price_change = (price - prev_close) if (price and prev_close) else None
        price_pct    = ratio(price_change, prev_close)

        final_data = {
            "symbol":      symbol,
            "name":        info.get("longName") or info.get("shortName"),
            "sector":      info.get("sector"),
            "industry":    info.get("industry"),
            "exchange":    info.get("exchange"),
            "description": (info.get("longBusinessSummary") or "")[:600] or None,
            "currency":    info.get("currency", "USD"),
            "website":     info.get("website"),
            "employees":   clean(info.get("fullTimeEmployees")),
            "market": {
                "price":          price,
                "price_change":   price_change,
                "price_pct":      price_pct,
                "market_cap":     market_cap,
                "ev":             ev,
                "high_52w":       clean(info.get("fiftyTwoWeekHigh")),
                "low_52w":        clean(info.get("fiftyTwoWeekLow")),
                "avg_50d":        clean(info.get("fiftyDayAverage")),
                "avg_200d":       clean(info.get("twoHundredDayAverage")),
                "pe_ratio":       clean(info.get("trailingPE")),
                "forward_pe":     clean(info.get("forwardPE")),
                "pb_ratio":       clean(info.get("priceToBook")),
                "ps_ratio":       clean(info.get("priceToSalesTrailing12Months")),
                "ev_ebitda":      ev_ebitda,
                "dividend_yield": clean(info.get("dividendYield")),
                "beta":           clean(info.get("beta")),
            },
            "revenue": {
                "total":         total_rev,
                "recurring":     op_rev,
                "extraordinary": other_income,
                "gross_profit":  gross_profit,
                "gross_margin":  gross_margin,
            },
            "profitability": {
                "ebit":       op_income,
                "ebitda":     ebitda,
                "da":         da,
                "net_income": net_income,
                "op_margin":  op_margin,
                "net_margin": net_margin,
                "roe":        roe,
                "roa":        roa,
            },
            "balance_sheet": {
                "total_assets": total_assets,
                "total_liab":   total_liab,
                "equity":       equity,
                "total_debt":   total_debt,
                "net_debt":     net_debt,
                "cash":         cash,
                "de_ratio":     de_ratio,
            },
            "cash_flow": {
                "operating":   op_cf,
                "capex":       capex,
                "fcf":         fcf,
                "fcf_yield":   fcf_yield,
                "fcf_margin":  fcf_margin,
                "fcf_quality": fcf_quality,
            },
        }

        COMPANY_CACHE[symbol] = {"timestamp": now, "data": final_data}
        return final_data

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/chart/{ticker}")
async def get_chart(ticker: str, period: str = "1y", interval: str = "1d"):
    symbol = ticker.upper()
    now = time.time()

    cache_key = f"{symbol}_{period}_{interval}"
    if cache_key in CHART_CACHE:
        if now - CHART_CACHE[cache_key]["timestamp"] < CACHE_EXPIRE:
            return CHART_CACHE[cache_key]["data"]

    try:
        t = get_ticker(symbol)
        hist = safe_fetch(lambda: t.history(period=period, interval=interval))

        if hist is None or hist.empty:
            raise HTTPException(status_code=404, detail="No price data found")

        candles = []
        for ts, row in hist.iterrows():
            candles.append({
                "time":   ts.strftime("%Y-%m-%d"),
                "open":   round(float(row["Open"]),  4),
                "high":   round(float(row["High"]),  4),
                "low":    round(float(row["Low"]),   4),
                "close":  round(float(row["Close"]), 4),
                "volume": int(row["Volume"]),
            })

        final_data = {"ticker": symbol, "candles": candles}
        CHART_CACHE[cache_key] = {"timestamp": now, "data": final_data}
        return final_data

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/compare")
async def compare(tickers: str):
    ticker_list = [t.strip().upper() for t in tickers.split(",")][:8]
    results = []
    for ticker in ticker_list:
        try:
            data = await get_company(ticker)
            results.append(data)
            time.sleep(1)
        except Exception as e:
            results.append({"symbol": ticker, "error": str(e)})
    return results


# ── Serve React frontend (production build) ───────────────────────────────────
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

STATIC_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")

if os.path.exists(STATIC_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend(full_path: str):
        index = os.path.join(STATIC_DIR, "index.html")
        return FileResponse(index)