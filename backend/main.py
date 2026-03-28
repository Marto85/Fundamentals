from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import numpy as np
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

# ── Manejo de Sesión Dinámico (Auto-Sanación) ─────────────────────────────────
from curl_cffi import requests as curl_requests

_curl = None
_crumb = None

def reset_session():
    """Destruye la sesión sospechosa y crea un navegador 'limpio' con cookies frescas"""
    global _curl, _crumb
    print("🔄 Reiniciando sesión blindada con Yahoo...")
    _curl = curl_requests.Session(impersonate="chrome116")
    _crumb = ""
    try:
        _curl.get("https://fc.yahoo.com", timeout=10, allow_redirects=True)
        r = _curl.get("https://query1.finance.yahoo.com/v1/test/getcrumb", timeout=10)
        if r.status_code == 200 and r.text and "html" not in r.text.lower():
            _crumb = r.text.strip()
    except Exception as e:
        print(f"Error al obtener crumb en reinicio: {e}")

# Inicializamos la primera vez que arranca el servidor
reset_session()
print("✅ curl_cffi session ready")

# ── caché en memoria ──────────────────────────────────────────────────────────
COMPANY_CACHE: dict = {}
CHART_CACHE:   dict = {}
CACHE_EXPIRE = 3600

def fetch_yahoo_info(symbol: str) -> dict:
    global _crumb
    if not _crumb:
        reset_session()

    modules = "financialData,quoteType,defaultKeyStatistics,assetProfile,summaryDetail,price"
    summary_url = f"https://query2.finance.yahoo.com/v10/finance/quoteSummary/{symbol}"
    summary_params = {"modules": modules, "crumb": _crumb, "formatted": "false"}

    r = _curl.get(summary_url, params=summary_params, timeout=15)

    # Si Yahoo se pone paranoico, destruimos todo y reintentamos
    if r.status_code in (401, 403, 429):
        reset_session()
        summary_params["crumb"] = _crumb
        r = _curl.get(summary_url, params=summary_params, timeout=15)

    if r.status_code != 200:
        raise HTTPException(status_code=r.status_code, detail=f"Yahoo bloqueó la petición: Status {r.status_code}")

    data = r.json()
    result = data.get("quoteSummary", {}).get("result", [])
    if not result:
        raise HTTPException(status_code=404, detail=f"Sin datos para '{symbol}'")

    return result[0]


def extract(d, *keys, default=None):
    if not isinstance(d, dict): return default
    for k in keys:
        if k in d:
            val = d[k]
            if isinstance(val, dict):
                val = val.get("raw", val.get("fmt", default))
            if val is not None and val != "" and val != "N/A":
                return val
    return default


def clean(val):
    if val is None: return None
    if isinstance(val, (int,)) and not isinstance(val, bool): return val
    try:
        f = float(val)
        if math.isnan(f) or math.isinf(f): return None
        return f
    except (TypeError, ValueError):
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
        info = safe_fetch(lambda: fetch_yahoo_info(symbol))
        return {
            "symbol": symbol,
            "modules_available": list(info.keys()),
            "raw_financialData": info.get("financialData", {})
        }
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/search")
async def search(q: str = Query(..., min_length=1)):
    try:
        url = "https://query2.finance.yahoo.com/v1/finance/search"
        params = {"q": q, "quotesCount": 12, "newsCount": 0, "enableFuzzyQuery": False}
        r = _curl.get(url, params=params, timeout=8)
        
        # Auto-sanación para búsquedas
        if r.status_code in (401, 403, 429):
            reset_session()
            r = _curl.get(url, params=params, timeout=8)
            
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
        info = safe_fetch(lambda: fetch_yahoo_info(symbol))

        fd = info.get("financialData", {})
        ks = info.get("defaultKeyStatistics", {})
        sd = info.get("summaryDetail", {})
        ap = info.get("assetProfile", {})
        pr = info.get("price", {})
        qt = info.get("quoteType", {})

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

        # =====================================================================
        # MAGIA FINANCIERA: Cálculo de datos faltantes mediante ratios
        # =====================================================================
        total_rev    = clean(extract(fd, "totalRevenue"))
        gross_profit = clean(extract(fd, "grossProfits"))
        ebitda       = clean(extract(fd, "ebitda"))
        
        op_margin    = clean(extract(fd, "operatingMargins"))
        profit_margin= clean(extract(fd, "profitMargins"))
        roa          = clean(extract(fd, "returnOnAssets"))
        de_ratio_raw = clean(extract(fd, "debtToEquity"))
        
        op_income  = (total_rev * op_margin) if (total_rev and op_margin) else None
        net_income = clean(extract(ks, "netIncomeToCommon")) or ((total_rev * profit_margin) if (total_rev and profit_margin) else None)
        da         = abs(ebitda - op_income) if (ebitda and op_income) else None
        
        total_debt   = clean(extract(fd, "totalDebt"))
        cash         = clean(extract(fd, "totalCash"))
        
        de_ratio = de_ratio_raw / 100.0 if (de_ratio_raw and de_ratio_raw > 10) else de_ratio_raw
        equity = (total_debt / de_ratio) if (total_debt and de_ratio and de_ratio > 0) else None
        
        total_assets = (net_income / roa) if (net_income and roa and roa != 0) else None
        total_liab   = (total_assets - equity) if (total_assets and equity) else None

        op_cf  = clean(extract(fd, "operatingCashflow"))
        fcf    = clean(extract(fd, "freeCashflow"))
        capex  = -(abs(op_cf - fcf)) if (op_cf and fcf) else None 
        # =====================================================================

        def ratio(n, d):
            return n / d if (n is not None and d and d != 0) else None

        net_debt     = (total_debt - cash) if (total_debt is not None and cash is not None) else None
        ev           = clean(extract(ks, "enterpriseValue")) or (market_cap + net_debt) if (market_cap and net_debt is not None) else None
        
        # ── PARCHE: Acciones en circulación para el DCF ──
        shares_outstanding = clean(extract(ks, "sharesOutstanding"))
        if not shares_outstanding and market_cap and price:
            shares_outstanding = market_cap / price
        # ─────────────────────────────────────────────────

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
                "price_pct":      ratio(price_change, prev_close),
                "market_cap":     market_cap,
                "shares_outstanding": shares_outstanding, # <--- Dato inyectado acá
                "ev":             ev,
                "high_52w":       high_52w,
                "low_52w":        low_52w,
                "avg_50d":        avg_50d,
                "avg_200d":       avg_200d,
                "pe_ratio":       pe_ratio,
                "forward_pe":     forward_pe,
                "pb_ratio":       pb_ratio,
                "ps_ratio":       ps_ratio,
                "ev_ebitda":      ratio(ev, ebitda),
                "dividend_yield": div_yield,
                "beta":           beta,
            },
            "revenue": {
                "total":         total_rev,
                "recurring":     total_rev,
                "extraordinary": None,
                "gross_profit":  gross_profit,
                "gross_margin":  clean(extract(fd, "grossMargins")) or ratio(gross_profit, total_rev),
            },
            "profitability": {
                "ebit":       op_income,
                "ebitda":     ebitda,
                "da":         da,
                "net_income": net_income,
                "op_margin":  op_margin or ratio(op_income, total_rev),
                "net_margin": profit_margin or ratio(net_income, total_rev),
                "roe":        clean(extract(fd, "returnOnEquity")) or ratio(net_income, equity),
                "roa":        roa or ratio(net_income, total_assets),
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
                "fcf_yield":   ratio(fcf, market_cap),
                "fcf_margin":  ratio(fcf, total_rev),
                "fcf_quality": ratio(fcf, net_income),
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
        r = _curl.get(url, params=params, timeout=15)
        
        # Auto-sanación para gráficos
        if r.status_code in (401, 403, 429):
            reset_session()
            params["crumb"] = _crumb
            r = _curl.get(url, params=params, timeout=15)
            
        if r.status_code != 200:
            raise HTTPException(status_code=r.status_code, detail=f"Yahoo error chart: {r.status_code}")
            
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

STATIC_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")

if os.path.exists(STATIC_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend(full_path: str):
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))