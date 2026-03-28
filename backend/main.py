from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import yfinance as yf
import numpy as np
import requests
import requests.adapters
import math
import time
import random
import os

app = FastAPI(title="Stock Analyzer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── curl_cffi session (bypasses Yahoo cloud blocks) ───────────────────────────
from curl_cffi import requests as curl_requests
_curl = curl_requests.Session(impersonate="chrome110")
print("✅ curl_cffi session ready")

# ── requests session (fallback for search) ────────────────────────────────────
_session = requests.Session()
_session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
})

# ── caché en memoria ──────────────────────────────────────────────────────────
COMPANY_CACHE: dict = {}
CHART_CACHE:   dict = {}
CACHE_EXPIRE = 3600

YAHOO_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://finance.yahoo.com",
}


def get_crumb():
    """Fetch Yahoo crumb token usando el truco de fc.yahoo.com"""
    try:
        # 1. Visitar la URL de cookies de Yahoo (suele devolver 404 o 302, pero te instala la cookie 'A3' obligatoria)
        _curl.get("https://fc.yahoo.com", headers=YAHOO_HEADERS, timeout=10, allow_redirects=True)
        
        # 2. Ahora sí, con la cookie en mano, pedimos el crumb
        r = _curl.get("https://query1.finance.yahoo.com/v1/test/getcrumb", headers=YAHOO_HEADERS, timeout=10)
        
        if r.status_code == 200 and r.text and r.text != "null":
            return r.text.strip()
            
    except Exception as e:
        print(f"Error al obtener crumb primario: {e}")

    # 3. Fallback: El método viejo por si el nuevo falla
    try:
        _curl.get("https://finance.yahoo.com", headers=YAHOO_HEADERS, timeout=10, allow_redirects=True)
        r = _curl.get("https://query1.finance.yahoo.com/v1/test/getcrumb", headers=YAHOO_HEADERS, timeout=10)
        return r.text.strip() if r.status_code == 200 else ""
    except:
        return ""

_crumb = None

def fetch_yahoo_info(symbol: str) -> dict:
    """Fetch stock info directly from Yahoo Finance v8 API using curl_cffi."""
    global _crumb
    if not _crumb:
        _crumb = get_crumb()

    modules = "financialData,quoteType,defaultKeyStatistics,assetProfile,summaryDetail,price"
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
    params = {"interval": "1d", "range": "5d"}

    # Also fetch summary
    summary_url = f"https://query2.finance.yahoo.com/v10/finance/quoteSummary/{symbol}"
    summary_params = {
        "modules": modules,
        "crumb": _crumb,
        "formatted": "false",
    }

    r = _curl.get(summary_url, params=summary_params, headers=YAHOO_HEADERS, timeout=15)

    if r.status_code == 401 or r.status_code == 403:
        # Refresh crumb and retry
        _crumb = get_crumb()
        summary_params["crumb"] = _crumb
        r = _curl.get(summary_url, params=summary_params, headers=YAHOO_HEADERS, timeout=15)

    if r.status_code != 200:
        raise HTTPException(status_code=404, detail=f"Yahoo devolvió {r.status_code} para '{symbol}'")

    data = r.json()
    result = data.get("quoteSummary", {}).get("result", [])
    if not result:
        error = data.get("quoteSummary", {}).get("error", {})
        raise HTTPException(status_code=404, detail=f"Sin datos para '{symbol}': {error}")

    # Flatten all modules into a single dict
    info = {}
    for module in result:
        info.update(module)
    return info


def extract(d, *keys, default=None):
    """Extract first found key from nested dict, handling {raw, fmt} format."""
    if not isinstance(d, dict):
        return default
    for k in keys:
        if k in d:
            val = d[k]
            if isinstance(val, dict):
                val = val.get("raw", val.get("fmt", default))
            if val is not None and val != "" and val != "N/A":
                return val
    return default


def clean(val):
    if val is None:
        return None
    if isinstance(val, (int,)) and not isinstance(val, bool):
        return val
    try:
        f = float(val)
        if math.isnan(f) or math.isinf(f):
            return None
        return f
    except (TypeError, ValueError):
        return None


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
                    v = df.loc[field, col]
                    c = clean(v)
                    if c is not None:
                        return c
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


# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/debug/{ticker}")
async def debug_ticker(ticker: str):
    symbol = ticker.upper()
    try:
        info = fetch_yahoo_info(symbol)
        return {
            "symbol": symbol,
            "crumb": _crumb,
            "info_keys": list(info.keys()),
            "sample": {k: info.get(k) for k in [
                "longName","regularMarketPrice","marketCap","trailingPE","symbol"
            ]},
        }
    except Exception as e:
        return {"error": str(e), "crumb": _crumb}


@app.get("/api/search")
async def search(q: str = Query(..., min_length=1)):
    try:
        url = "https://query2.finance.yahoo.com/v1/finance/search"
        params = {"q": q, "quotesCount": 12, "newsCount": 0, "enableFuzzyQuery": False}
        r = _curl.get(url, params=params, headers=YAHOO_HEADERS, timeout=8)
        r.raise_for_status()
        data = r.json()
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


@app.get("/api/company/{ticker}")
async def get_company(ticker: str):
    symbol = ticker.upper()
    now = time.time()

    if symbol in COMPANY_CACHE:
        if now - COMPANY_CACHE[symbol]["timestamp"] < CACHE_EXPIRE:
            return COMPANY_CACHE[symbol]["data"]

    try:
        # Fetch info via direct Yahoo API with curl_cffi
        info = safe_fetch(lambda: fetch_yahoo_info(symbol))

        # Financial statements via yfinance (uses its own session)
        t = yf.Ticker(symbol)
        income  = safe_fetch(lambda: t.income_stmt)
        balance = safe_fetch(lambda: t.balance_sheet)
        cf      = safe_fetch(lambda: t.cashflow)

        # ── Extract from flattened modules ────────────────────────────────────
        fd  = info.get("financialData", {})
        ks  = info.get("defaultKeyStatistics", {})
        sd  = info.get("summaryDetail", {})
        ap  = info.get("assetProfile", {})
        pr  = info.get("price", {})
        qt  = info.get("quoteType", {})

        name     = extract(pr, "longName") or extract(qt, "longName", "shortName")
        sector   = extract(ap, "sector")
        industry = extract(ap, "industry")
        desc     = (extract(ap, "longBusinessSummary") or "")[:600]
        exchange = extract(qt, "exchange")
        currency = extract(pr, "currency") or "USD"
        website  = extract(ap, "website")
        employees = clean(extract(ap, "fullTimeEmployees"))

        price        = clean(extract(pr, "regularMarketPrice"))
        prev_close   = clean(extract(sd, "previousClose", "regularMarketPreviousClose"))
        market_cap   = clean(extract(pr, "marketCap") or extract(sd, "marketCap"))
        high_52w     = clean(extract(sd, "fiftyTwoWeekHigh"))
        low_52w      = clean(extract(sd, "fiftyTwoWeekLow"))
        avg_50d      = clean(extract(sd, "fiftyDayAverage"))
        avg_200d     = clean(extract(sd, "twoHundredDayAverage"))
        pe_ratio     = clean(extract(sd, "trailingPE") or extract(ks, "trailingPE"))
        forward_pe   = clean(extract(ks, "forwardPE"))
        pb_ratio     = clean(extract(ks, "priceToBook"))
        ps_ratio     = clean(extract(sd, "priceToSalesTrailing12Months"))
        div_yield    = clean(extract(sd, "dividendYield") or extract(sd, "trailingAnnualDividendYield"))
        beta         = clean(extract(sd, "beta") or extract(ks, "beta"))

        price_change = (price - prev_close) if (price and prev_close) else None

        # ── Revenue ───────────────────────────────────────────────────────────
        total_rev    = get_recent(income, "Total Revenue")
        op_rev       = get_recent(income, "Operating Revenue") or total_rev
        other_income = get_recent(income, "Other Income Expense",
                                  "Non Operating Income", "Total Other Finance Income")
        gross_profit = get_recent(income, "Gross Profit")
        op_income    = get_recent(income, "Operating Income", "EBIT")
        ebitda_raw   = get_recent(income, "EBITDA", "Normalized EBITDA")
        net_income   = get_recent(income, "Net Income", "Net Income Common Stockholders")
        da           = get_recent(cf, "Depreciation And Amortization",
                                  "Depreciation Depletion And Amortization")

        ebitda = ebitda_raw
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
        ev           = (market_cap + net_debt) if (market_cap and net_debt is not None) else None
        ev_ebitda    = ratio(ev, ebitda)
        fcf_yield    = ratio(fcf, market_cap)
        fcf_margin   = ratio(fcf, total_rev)
        fcf_quality  = ratio(fcf, net_income)
        price_pct    = ratio(price_change, prev_close)

        final_data = {
            "symbol":      symbol,
            "name":        name,
            "sector":      sector,
            "industry":    industry,
            "exchange":    exchange,
            "description": desc or None,
            "currency":    currency,
            "website":     website,
            "employees":   employees,
            "market": {
                "price":          price,
                "price_change":   price_change,
                "price_pct":      price_pct,
                "market_cap":     market_cap,
                "ev":             ev,
                "high_52w":       high_52w,
                "low_52w":        low_52w,
                "avg_50d":        avg_50d,
                "avg_200d":       avg_200d,
                "pe_ratio":       pe_ratio,
                "forward_pe":     forward_pe,
                "pb_ratio":       pb_ratio,
                "ps_ratio":       ps_ratio,
                "ev_ebitda":      ev_ebitda,
                "dividend_yield": div_yield,
                "beta":           beta,
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
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
        range_map = {"1mo":"1mo","3mo":"3mo","6mo":"6mo","1y":"1y","2y":"2y","5y":"5y"}
        interval_map = {"1d":"1d","1wk":"1wk"}
        params = {
            "interval": interval_map.get(interval, "1d"),
            "range":    range_map.get(period, "1y"),
            "crumb":    _crumb or "",
        }
        r = _curl.get(url, params=params, headers=YAHOO_HEADERS, timeout=15)
        r.raise_for_status()
        data = r.json()

        result = data.get("chart", {}).get("result", [])
        if not result:
            raise HTTPException(status_code=404, detail="No price data found")

        res       = result[0]
        timestamps = res.get("timestamp", [])
        quote     = res.get("indicators", {}).get("quote", [{}])[0]
        opens     = quote.get("open", [])
        highs     = quote.get("high", [])
        lows      = quote.get("low", [])
        closes    = quote.get("close", [])
        volumes   = quote.get("volume", [])

        candles = []
        for i, ts in enumerate(timestamps):
            try:
                o = opens[i]; h = highs[i]; l = lows[i]; c = closes[i]; v = volumes[i]
                if None in (o, h, l, c):
                    continue
                candles.append({
                    "time":   time.strftime("%Y-%m-%d", time.gmtime(ts)),
                    "open":   round(float(o), 4),
                    "high":   round(float(h), 4),
                    "low":    round(float(l), 4),
                    "close":  round(float(c), 4),
                    "volume": int(v) if v else 0,
                })
            except Exception:
                continue

        if not candles:
            raise HTTPException(status_code=404, detail="No candle data found")

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
            time.sleep(0.5)
        except Exception as e:
            results.append({"symbol": ticker, "error": str(e)})
    return results


# ── Serve React frontend (production build) ───────────────────────────────────
STATIC_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")

if os.path.exists(STATIC_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend(full_path: str):
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))