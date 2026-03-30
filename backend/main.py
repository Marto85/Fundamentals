from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import numpy as np
import math
import time
import random
import os
import json
import hashlib
import re

app = FastAPI(title="Stock Analyzer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

from curl_cffi import requests as curl_requests

_curl = None
_crumb = None

def reset_session():
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
        print(f"⚠️  reset_session error: {e}")

reset_session()

COMPANY_CACHE: dict = {}
CACHE_EXPIRE = 3600

# Screener results cache — keyed by hashed criteria (excl. page/per_page).
# Avoids re-fetching Yahoo + re-enriching 50 tickers on every page change.
SCREENER_CACHE: dict = {}
SCREENER_CACHE_TTL = 300  # 5 minutes

def screener_cache_key(criteria: dict) -> str:
    relevant = {k: v for k, v in criteria.items() if k not in ('page', 'per_page')}
    return hashlib.md5(json.dumps(relevant, sort_keys=True).encode()).hexdigest()

KNOWN_DOMAINS = {
    "AAPL": "apple.com", "MSFT": "microsoft.com", "NVDA": "nvidia.com",
    "AMZN": "amazon.com", "TSLA": "tesla.com", "META": "meta.com",
    "GOOG": "google.com", "GOOGL": "google.com", "NFLX": "netflix.com",
    "AMD": "amd.com", "INTC": "intel.com", "MELI": "mercadolibre.com",
    "NU": "nubank.com.br", "BABA": "alibaba.com", "PAM": "pampa.com",
    "TGS": "tgs.com.ar", "GGAL": "gfgsa.com", "GAL": "gfgsa.com",
    "SUPV": "gruposupervielle.com", "BMA": "macro.com.ar",
    "MACRO": "macro.com.ar", "MU": "micron.com", "TSM": "tsmc.com",
    "YPF": "ypf.com", "STONE": "stone.com.br", "STNE": "stone.com.br",
    "PAGS": "pagbank.com.br", "CEPU": "centralpuerto.com",
    "PBR": "petrobras.com.br", "KO": "coca-colacompany.com",
    "PEP": "pepsico.com", "JNJ": "jnj.com", "BRK-B": "berkshirehathaway.com",
    "BRK-A": "berkshirehathaway.com", "V": "visa.com", "MA": "mastercard.com",
    "WMT": "walmart.com", "DIS": "thewaltdisneycompany.com",
    "JPM": "jpmorganchase.com",
    # Extended — common large-caps that appear in screener results
    "UNH": "unitedhealthgroup.com", "LLY": "lilly.com",
    "XOM": "exxonmobil.com",        "CVX": "chevron.com",
    "PG":  "pg.com",                "ABBV": "abbvie.com",
    "MRK": "merck.com",             "COST": "costco.com",
    "BAC": "bankofamerica.com",     "CRM": "salesforce.com",
    "ORCL": "oracle.com",           "CSCO": "cisco.com",
    "ACN": "accenture.com",         "TMO": "thermofisher.com",
    "AVGO": "broadcom.com",         "ABT": "abbott.com",
    "VZ": "verizon.com",            "ADBE": "adobe.com",
    "TXN": "ti.com",                "NKE": "nike.com",
    "QCOM": "qualcomm.com",         "HON": "honeywell.com",
    "NEE": "nexteraenergy.com",     "RTX": "rtx.com",
    "UPS": "ups.com",               "MS": "morganstanley.com",
    "GS": "goldmansachs.com",       "BLK": "blackrock.com",
    "SCHW": "schwab.com",           "C": "citigroup.com",
    "WFC": "wellsfargo.com",        "USB": "usbank.com",
    "AXP": "americanexpress.com",   "SPGI": "spglobal.com",
    "MCO": "moodys.com",            "MMC": "mmc.com",
    "PFE": "pfizer.com",            "BMY": "bms.com",
    "AMGN": "amgen.com",            "GILD": "gilead.com",
    "REGN": "regeneron.com",        "VRTX": "vrtx.com",
    "ISRG": "intuitivesurgical.com","SYK": "stryker.com",
    "MDT": "medtronic.com",         "ELV": "elevancehealth.com",
    "CI": "cigna.com",              "HUM": "humana.com",
    "LOW": "lowes.com",             "HD": "homedepot.com",
    "TGT": "target.com",            "MCD": "mcdonalds.com",
    "SBUX": "starbucks.com",        "CMG": "chipotle.com",
    "F": "ford.com",                "GM": "gm.com",
    "CAT": "caterpillar.com",       "DE": "deere.com",
    "BA": "boeing.com",             "LMT": "lockheedmartin.com",
    "GE": "ge.com",                 "EMR": "emerson.com",
    "MMM": "3m.com",                "UNP": "up.com",
    "CSX": "csx.com",               "NSC": "nscorp.com",
    "AMT": "americantower.com",     "PLD": "prologis.com",
    "CCI": "crowncastle.com",       "EQIX": "equinix.com",
    "SO": "southerncompany.com",    "DUK": "duke-energy.com",
    "D": "dominionenergy.com",      "SRE": "sempra.com",
    "NOW": "servicenow.com",        "SNOW": "snowflake.com",
    "UBER": "uber.com",             "LYFT": "lyft.com",
    "ABNB": "airbnb.com",           "DASH": "doordash.com",
    "SHOP": "shopify.com",          "SQ": "squareup.com",
    "PYPL": "paypal.com",           "COIN": "coinbase.com",
    "PANW": "paloaltonetworks.com", "CRWD": "crowdstrike.com",
    "ZS": "zscaler.com",            "OKTA": "okta.com",
    "NET": "cloudflare.com",        "DDOG": "datadoghq.com",
    "MDB": "mongodb.com",           "ESTC": "elastic.co",
    "TTD": "thetradedesk.com",      "PLTR": "palantir.com",
    "ARM": "arm.com",               "AMAT": "appliedmaterials.com",
    "LRCX": "lamresearch.com",      "KLAC": "kla.com",
    "ASML": "asml.com",             "SMCI": "supermicro.com",
}

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
    try:
        f = float(val)
        if math.isnan(f) or math.isinf(f): return None
        return f
    except:
        return None

def safe_fetch(fn, retries=3, delay=2):
    last_err = None
    for attempt in range(retries):
        try:
            return fn()
        except Exception as e:
            last_err = e
            time.sleep(delay)
    raise last_err

def _sanitize_div_yield(v):
    """
    Yahoo Finance is inconsistent with dividend yield scale across endpoints.
    Canonical form is decimal: 0.03 = 3%.
    Values > 0.50 (50%) are almost certainly a scale error — Yahoo stores the
    value as a plain percentage for some OTC/ADR tickers (e.g. 1.2761 = 127.61%
    should be 0.012761 = 1.27%). We correct by dividing by 100; if the result is
    still > 50% we discard it. The 50% cap is generous enough to cover real
    high-yield instruments like some BDCs or preferred shares.
    """
    if v is None: return None
    try:
        f = float(v)
        if math.isnan(f) or math.isinf(f) or f < 0: return None
        if f > 0.50:                        # likely stored as %-not-decimal
            corrected = f / 100.0
            return corrected if corrected <= 0.50 else None
        return f
    except:
        return None

def fetch_yahoo_info(symbol: str) -> dict:
    global _crumb
    if not _crumb: reset_session()
    modules = "financialData,quoteType,defaultKeyStatistics,assetProfile,summaryDetail,price,cashflowStatementHistory,incomeStatementHistory,balanceSheetHistory"
    summary_url = f"https://query2.finance.yahoo.com/v10/finance/quoteSummary/{symbol}"
    r = _curl.get(summary_url, params={"modules": modules, "crumb": _crumb, "formatted": "false"}, timeout=15)
    data = r.json()
    result = data.get("quoteSummary", {}).get("result", [])
    if not result: raise HTTPException(status_code=404, detail="Ticker no encontrado")
    return result[0]

def fetch_yahoo_history(symbol: str) -> list:
    try:
        url = f"https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/{symbol}"
        end = int(time.time())
        params = {
            "period1": end - (5*366*24*3600),
            "period2": end,
            "type": "annualTotalRevenue,annualNetIncome,annualTotalAssets,annualTotalLiabilitiesNetMinorityInterest,annualTotalDebt,annualOperatingCashFlow,annualCapitalExpenditure,annualFreeCashFlow",
            "merge": "false"
        }
        r = _curl.get(url, params=params, timeout=10)
        timeseries = r.json().get("timeseries", {}).get("result", [])
        h = {}
        for item in timeseries:
            t = item.get("meta", {}).get("type", [None])[0]
            if not t: continue
            for ts in item.get(t, []):
                y = ts.get("asOfDate", "").split("-")[0]
                if not y: continue
                if y not in h: h[y] = {"year": y, "revenue": None, "net_income": None, "assets": None, "liabilities": None, "debt": None, "op_cf": None, "capex": None, "fcf": None}
                val = ts.get("reportedValue", {}).get("raw")
                if t == "annualTotalRevenue": h[y]["revenue"] = val
                elif t == "annualNetIncome": h[y]["net_income"] = val
                elif t == "annualTotalAssets": h[y]["assets"] = val
                elif t == "annualTotalLiabilitiesNetMinorityInterest": h[y]["liabilities"] = val
                elif t == "annualTotalDebt": h[y]["debt"] = val
                elif t == "annualOperatingCashFlow": h[y]["op_cf"] = val
                elif t == "annualCapitalExpenditure": h[y]["capex"] = val
                elif t == "annualFreeCashFlow": h[y]["fcf"] = val
        return sorted(list(h.values()), key=lambda x: x["year"])
    except: return []


# ── Fetch financial ratios for a single ticker via quoteSummary ──────────────
def fetch_financial_ratios(symbol: str) -> dict:
    """
    Fetches ROE, operating/net margin, D/E, FCF metrics, div yield from Yahoo.
    Also returns fcf_raw and total_rev_raw so the caller can compute
    MktCap/FCF and Price/Sales using the market_cap already known from screener
    (avoids missing-marketCap issue for OTC/preferred tickers in quoteSummary).
    Uses COMPANY_CACHE first to avoid redundant calls.
    """
    if symbol in COMPANY_CACHE:
        cached    = COMPANY_CACHE[symbol].get("data", {})
        prof      = cached.get("profitability", {})
        bal       = cached.get("balance_sheet", {})
        cf        = cached.get("cash_flow", {})
        mkt       = cached.get("market", {})
        rev       = cached.get("revenue", {})
        div_yield = _sanitize_div_yield(mkt.get("dividend_yield"))
        return {
            "roe":           prof.get("roe"),
            "op_margin":     prof.get("op_margin"),
            "net_margin":    prof.get("net_margin"),
            "de_ratio":      bal.get("de_ratio"),
            "fcf_margin":    cf.get("fcf_margin"),
            "fcf_yield":     cf.get("fcf_yield"),
            "div_yield":     div_yield,
            "fcf_raw":       cf.get("fcf"),
            "total_rev_raw": rev.get("total"),
            "_source":       "cache",
        }

    try:
        url = f"https://query2.finance.yahoo.com/v10/finance/quoteSummary/{symbol}"
        r = _curl.get(url, params={
            "modules": "financialData,defaultKeyStatistics,summaryDetail,assetProfile",
            "crumb": _crumb,
            "formatted": "false",
        }, timeout=10)

        if r.status_code != 200:
            return {}

        result = r.json().get("quoteSummary", {}).get("result", [])
        if not result:
            return {}

        fd = result[0].get("financialData", {})
        ks = result[0].get("defaultKeyStatistics", {})
        sd = result[0].get("summaryDetail", {})
        ap = result[0].get("assetProfile", {})

        # Extract clean domain from Yahoo's website field (e.g. "https://www.apple.com" → "apple.com")
        website_domain = None
        website = ap.get("website", "")
        if website:
            m = re.match(r'https?://(?:www\.)?([^/]+)', website)
            if m:
                website_domain = m.group(1)

        def c(v):
            if v is None: return None
            try:
                f = float(v)
                return None if (math.isnan(f) or math.isinf(f)) else f
            except: return None

        de_raw   = c(fd.get("debtToEquity"))
        de_ratio = de_raw / 100.0 if de_raw is not None else None

        fcf       = c(fd.get("freeCashflow"))
        total_rev = c(fd.get("totalRevenue"))
        # marketCap is often absent for OTC/preferred tickers in quoteSummary.
        # We return fcf_raw + total_rev_raw so enrich_screener_results can compute
        # the ratios using the market_cap obtained from the screener endpoint.
        market_cap_local = c(fd.get("marketCap")) or c(ks.get("marketCap"))
        fcf_margin = (fcf / total_rev)        if fcf and total_rev        else None
        fcf_yield  = (fcf / market_cap_local) if fcf and market_cap_local else None

        # _sanitize_div_yield handles Yahoo's scale inconsistency for OTC/ADR tickers
        div_yield = _sanitize_div_yield(c(sd.get("dividendYield")))

        return {
            "roe":           c(fd.get("returnOnEquity")),
            "op_margin":     c(fd.get("operatingMargins")),
            "net_margin":    c(fd.get("profitMargins")),
            "de_ratio":      de_ratio,
            "fcf_margin":    fcf_margin,
            "fcf_yield":     fcf_yield,
            "div_yield":     div_yield,
            "fcf_raw":       fcf,
            "total_rev_raw": total_rev,
            "website_domain": website_domain,
            "_source":       "quoteSummary",
        }
    except Exception as e:
        print(f"⚠️  fetch_financial_ratios({symbol}): {e}")
        return {}


# ── Enrich screener results with real financial ratios ────────────────────────
def enrich_screener_results(quotes: list, max_enrich: int = 25) -> list:
    """
    For each screener quote (which lacks ROE/margins), fetch financialData
    via quoteSummary. Limits to max_enrich to avoid too many sequential calls.
    MktCap/FCF and Price/Sales are computed here using the market_cap already
    known from the screener, which is more reliable for OTC/preferred tickers.
    """
    for i, q in enumerate(quotes[:max_enrich]):
        sym = q.get("symbol", "")
        if not sym:
            continue

        ratios = fetch_financial_ratios(sym)

        q["roe"]        = ratios.get("roe")
        q["margin"]     = ratios.get("op_margin")
        q["net_margin"] = ratios.get("net_margin")
        q["de_ratio"]   = ratios.get("de_ratio")
        q["fcf_margin"] = ratios.get("fcf_margin")
        q["fcf_yield"]  = ratios.get("fcf_yield")

        # Use screener market_cap as source of truth for ratio calculations
        market_cap = q.get("market_cap")
        fcf_raw    = ratios.get("fcf_raw")
        rev_raw    = ratios.get("total_rev_raw")
        q["mkcap_fcf"] = (market_cap / fcf_raw) if (market_cap and fcf_raw and fcf_raw > 0) else None
        q["ps_ratio"]  = (market_cap / rev_raw)  if (market_cap and rev_raw  and rev_raw  > 0) else None

        # Override domain with live website from Yahoo assetProfile when available
        if ratios.get("website_domain"):
            q["domain"] = ratios["website_domain"]

        # Override div_yield with sanitized summaryDetail value when available
        if ratios.get("div_yield") is not None:
            q["div_yield"] = ratios.get("div_yield")

        q["_enriched"]      = True
        q["_enrich_source"] = ratios.get("_source", "unknown")

        if ratios.get("_source") != "cache":
            time.sleep(0.3)

    return quotes


@app.get("/api/logo/{ticker}")
async def proxy_logo(ticker: str, domain: str = None):
    ticker_base = ticker.split('.')[0].upper()
    target_domain = domain if (domain and domain not in ["null", "", "None"]) else KNOWN_DOMAINS.get(ticker_base)
    apis = []
    if target_domain:
        cd = target_domain.replace("https://", "").replace("http://", "").replace("www.", "").strip("/")
        apis.extend([
            (f"https://logos.hunter.io/{cd}", 500, False),
            (f"https://api.companyenrich.com/logo/{cd}", 500, False),
            (f"https://fivicon.com/api/v1/logos/{cd}", 500, False),
            (f"https://icons.duckduckgo.com/ip3/{cd}.ico", 500, False),
            (f"https://icon.horse/icon/{cd}", 1000, False),
            (f"https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://{cd}&size=128", 1000, False),
        ])
    apis.extend([
        (f"https://financialmodelingprep.com/image-stock/{ticker_base}.png", 3000, False),
        (f"https://s3-symbol-logo.tradingview.com/{ticker_base.lower()}--big.svg", 300, True),
    ])
    for url, min_size, is_svg in apis:
        try:
            r = _curl.get(url, allow_redirects=True, timeout=2.5)
            if r.status_code == 200 and len(r.content) > min_size:
                ctype = r.headers.get("Content-Type", "image/png")
                if is_svg: ctype = "image/svg+xml"
                return Response(content=r.content, media_type=ctype)
        except: continue
    raise HTTPException(status_code=404)


@app.get("/api/search")
async def search(q: str = Query(..., min_length=1)):
    try:
        r = _curl.get("https://query2.finance.yahoo.com/v1/finance/search",
                      params={"q": q, "quotesCount": 12})
        data = r.json()
        results = []
        for quote in data.get("quotes", []):
            if quote.get("quoteType") in ("EQUITY", "ETF"):
                symbol = quote.get("symbol")
                results.append({
                    "symbol":   symbol,
                    "name":     quote.get("longname") or quote.get("shortname", ""),
                    "exchange": quote.get("exchange", ""),
                    "type":     quote.get("quoteType"),
                    "domain":   KNOWN_DOMAINS.get(symbol.split('.')[0].upper()),
                })
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/company/{ticker}")
async def get_company(ticker: str):
    symbol = ticker.upper()
    now = time.time()
    if symbol in COMPANY_CACHE and (now - COMPANY_CACHE[symbol]["timestamp"] < CACHE_EXPIRE):
        return COMPANY_CACHE[symbol]["data"]

    try:
        info = fetch_yahoo_info(symbol)
        h_data = fetch_yahoo_history(symbol)
        fd  = info.get("financialData", {})
        ks  = info.get("defaultKeyStatistics", {})
        sd  = info.get("summaryDetail", {})
        ap  = info.get("assetProfile", {})
        pr  = info.get("price", {})
        qt  = info.get("quoteType", {})
        inc_list = info.get("incomeStatementHistory", {}).get("incomeStatementHistory", [])
        bs_list  = info.get("balanceSheetHistory", {}).get("balanceSheetStatements", [])
        cf_list  = info.get("cashflowStatementHistory", {}).get("cashflowStatements", [])

        currency     = extract(pr, "currency") or "USD"
        fin_currency = extract(fd, "financialCurrency") or currency
        price        = clean(extract(pr, "regularMarketPrice"))
        prev_close   = clean(extract(sd, "previousClose", "regularMarketPreviousClose"))
        market_cap   = clean(extract(pr, "marketCap"))
        total_rev    = clean(extract(fd, "totalRevenue"))
        net_income   = clean(extract(ks, "netIncomeToCommon")) or clean(
                         extract(fd, "profitMargins", default=0) * total_rev if total_rev else None)
        total_debt   = clean(extract(fd, "totalDebt"))
        cash         = clean(extract(fd, "totalCash"))
        equity       = clean(extract(ks, "bookValue", default=0) * extract(ks, "sharesOutstanding", default=0)) or \
                       clean(market_cap / extract(ks, "priceToBook") if extract(ks, "priceToBook") else None)
        op_cf        = clean(extract(fd, "operatingCashflow"))
        fcf          = clean(extract(fd, "freeCashflow"))

        rate = 1.0
        if currency != fin_currency:
            try:
                r_fx = _curl.get(
                    f"https://query2.finance.yahoo.com/v10/finance/quoteSummary/{fin_currency}{currency}=X",
                    params={"modules": "price", "crumb": _crumb})
                rate = clean(extract(r_fx.json()["quoteSummary"]["result"][0]["price"],
                                     "regularMarketPrice")) or 1.0
            except: pass

        def ar(v): return v * rate if v is not None else None

        shares   = clean(extract(ks, "sharesOutstanding")) or (market_cap / price if market_cap and price else 1)
        calc_eps  = ar(net_income) / shares if net_income and shares else None
        calc_bvps = ar(equity) / shares if equity and shares else None
        graham    = math.sqrt(22.5 * calc_eps * calc_bvps) if calc_eps and calc_bvps and calc_eps > 0 and calc_bvps > 0 else None
        peg       = clean(extract(ks, "pegRatio"))
        lynch     = price / peg if peg and peg > 0 and price else None
        ni_history = [clean(extract(s, "netIncome")) for s in inc_list if clean(extract(s, "netIncome")) is not None]
        mean_rev  = (ar(sum(ni_history) / len(ni_history)) / shares) * 15 if ni_history and shares else None

        f_score = {"score": 0, "is_valid": False, "criteria": {}}
        try:
            if len(inc_list) >= 2 and len(bs_list) >= 2:
                roa_now = (net_income / ar(clean(extract(bs_list[0], "totalAssets")))) \
                          if net_income and extract(bs_list[0], "totalAssets") else 0
                f_score["score"]    = sum([roa_now > 0, (op_cf or 0) > 0, (op_cf or 0) > (net_income or 0)])
                f_score["is_valid"] = True
        except: pass

        final_data = {
            "symbol":      symbol,
            "name":        extract(pr, "longName") or symbol,
            "sector":      extract(ap, "sector"),
            "industry":    extract(ap, "industry"),
            "description": extract(ap, "longBusinessSummary"),
            "exchange":    extract(qt, "exchange"),
            "currency":    currency,
            "domain":      KNOWN_DOMAINS.get(symbol.split('.')[0].upper()),
            "applied_fx_rate":  rate if rate != 1.0 else None,
            "historical_data":  h_data,
            "market": {
                "price":          price,
                "price_change":   (price - prev_close) if price and prev_close else 0,
                "price_pct":      (price - prev_close) / prev_close if price and prev_close else 0,
                "market_cap":     market_cap,
                "shares_outstanding": shares,
                "pe_ratio":       clean(extract(sd, "trailingPE")),
                "forward_pe":     clean(extract(ks, "forwardPE")),
                "pb_ratio":       clean(extract(ks, "priceToBook")),
                "ps_ratio":       clean(extract(sd, "priceToSalesTrailing12Months")),
                "ev":             clean(extract(ks, "enterpriseValue")),
                "ev_ebitda":      clean(extract(ks, "enterpriseValueToEbitda")),
                "beta":           clean(extract(sd, "beta")),
                "dividend_yield": clean(extract(sd, "dividendYield")),
                "high_52w":       clean(extract(sd, "fiftyTwoWeekHigh")),
                "low_52w":        clean(extract(sd, "fiftyTwoWeekLow")),
                "avg_50d":        clean(extract(sd, "fiftyDayAverage")),
            },
            "revenue": {
                "total":        ar(total_rev),
                "gross_profit": ar(clean(extract(fd, "grossProfits"))),
                "gross_margin": clean(extract(fd, "grossMargins")),
            },
            "profitability": {
                "ebit":       ar(clean(extract(fd, "ebitda", default=0) * 0.8)),
                "ebitda":     ar(clean(extract(fd, "ebitda"))),
                "da":         None,
                "net_income": ar(net_income),
                "roe":        clean(extract(fd, "returnOnEquity")),
                "roa":        clean(extract(fd, "returnOnAssets")),
                "op_margin":  clean(extract(fd, "operatingMargins")),
                "net_margin": clean(extract(fd, "profitMargins")),
            },
            "balance_sheet": {
                "total_assets": ar(clean(extract(bs_list[0] if bs_list else {}, "totalAssets"))),
                "total_liab":   None,
                "equity":       ar(equity),
                "total_debt":   ar(total_debt),
                "net_debt":     ar(total_debt - cash if total_debt and cash else None),
                "cash":         ar(cash),
                "de_ratio":     clean(extract(fd, "debtToEquity", default=0)) / 100.0,
            },
            "cash_flow": {
                "operating":   ar(op_cf),
                "capex":       ar((op_cf - fcf) * -1 if op_cf and fcf else None),
                "fcf":         ar(fcf),
                "fcf_yield":   (ar(fcf) / market_cap) if fcf and market_cap else None,
                "fcf_margin":  (fcf / total_rev) if fcf and total_rev else None,
                "fcf_quality": (fcf / net_income) if fcf and net_income else None,
            },
            "gurus": {
                "graham_number":     graham,
                "lynch_value":       lynch,
                "mean_reversion_value": mean_rev,
                "implied_growth":    0.05,
            },
            "piotroski": f_score,
        }
        COMPANY_CACHE[symbol] = {"timestamp": now, "data": final_data}
        return final_data

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── DEBUG: raw screener response ──────────────────────────────────────────────
@app.post("/api/screener/debug")
async def screener_debug(criteria: dict):
    """Returns raw Yahoo screener response without processing — for debugging."""
    global _crumb
    if not _crumb: reset_session()
    try:
        operands = [
            {"operator": "eq",  "operands": ["region", "us"]},
            {"operator": "gt",  "operands": ["intradaymarketcap", criteria.get("min_market_cap", 2_000_000_000)]},
            {"operator": "gt",  "operands": ["operatingmargins",  criteria.get("min_margin", 0) / 100]},
            {"operator": "gt",  "operands": ["returnonequity",    criteria.get("min_roe", 0) / 100]},
        ]
        payload = {
            "size": 5,
            "sortField": "intradaymarketcap",
            "sortType": "DESC",
            "quoteType": "EQUITY",
            "query": {"operator": "and", "operands": operands},
        }
        r = _curl.post(
            f"https://query2.finance.yahoo.com/v1/finance/screener?crumb={_crumb}",
            json=payload, timeout=15)
        raw = r.json()
        quotes = raw.get("finance", {}).get("result", [{}])[0].get("quotes", [])
        return {
            "crumb":             _crumb,
            "http_status":       r.status_code,
            "total_quotes":      len(quotes),
            "first_quote_keys":  list(quotes[0].keys()) if quotes else [],
            "first_quote_raw":   quotes[0] if quotes else {},
            "first_5_symbols":   [q.get("symbol") for q in quotes[:5]],
        }
    except Exception as e:
        return {"error": str(e), "crumb": _crumb}


# ── SCREENER ──────────────────────────────────────────────────────────────────
@app.post("/api/screener")
async def stock_screener(criteria: dict):
    """
    Two-phase screener:
    1. Yahoo screener: broad pre-filter (fetches up to 50 candidates)
    2. quoteSummary enrichment: get real ROE, margins, FCF per ticker
    3. Post-filter: apply exact criteria against enriched values
    Returns paginated results + total count.
    """
    global _crumb
    if not _crumb: reset_session()
    try:
        page     = int(criteria.get("page", 1))
        per_page = int(criteria.get("per_page", 15))
        offset   = (page - 1) * per_page

        # ── Cache check: if same criteria was run recently, skip re-fetching ──
        cache_key = screener_cache_key(criteria)
        now = time.time()
        if cache_key in SCREENER_CACHE and (now - SCREENER_CACHE[cache_key]["timestamp"] < SCREENER_CACHE_TTL):
            filtered = SCREENER_CACHE[cache_key]["filtered"]
            total      = len(filtered)
            page_items = filtered[offset: offset + per_page]
            return {
                "total":    total,
                "page":     page,
                "per_page": per_page,
                "pages":    max(1, math.ceil(total / per_page)),
                "results":  page_items,
                "_cached":  True,
            }

        # Phase 1: Yahoo screener broad pre-filter
        operands = [
            {"operator": "eq",  "operands": ["region", "us"]},
            {"operator": "gt",  "operands": ["intradaymarketcap", criteria.get("min_market_cap", 2_000_000_000)]},
        ]
        if criteria.get("min_roe", 0) > 0:
            operands.append({"operator": "gt", "operands": ["returnonequity", max(0, criteria.get("min_roe", 0) / 100 - 0.05)]})
        if criteria.get("min_margin", 0) > 0:
            operands.append({"operator": "gt", "operands": ["operatingmargins", max(0, criteria.get("min_margin", 0) / 100 - 0.05)]})
        if criteria.get("max_pe") and criteria.get("max_pe") < 100:
            operands.append({"operator": "lt", "operands": ["pe_ratio", criteria.get("max_pe") + 10]})

        payload = {
            "size": 50,
            "sortField": "intradaymarketcap",
            "sortType": "DESC",
            "quoteType": "EQUITY",
            "query": {"operator": "and", "operands": operands},
        }
        r = _curl.post(
            f"https://query2.finance.yahoo.com/v1/finance/screener?crumb={_crumb}",
            json=payload, timeout=15)
        raw_quotes = r.json().get("finance", {}).get("result", [{}])[0].get("quotes", [])

        # Build initial list from screener data
        candidates = []
        for q in raw_quotes:
            # _sanitize_div_yield corrects Yahoo's scale errors for OTC/ADR tickers
            div_yield = _sanitize_div_yield(q.get("trailingAnnualDividendYield"))
            if div_yield is None:
                dy_raw = q.get("dividendYield")
                div_yield = _sanitize_div_yield(float(dy_raw) / 100.0 if dy_raw is not None else None)

            sym = q.get("symbol", "")
            candidates.append({
                "symbol":     sym,
                "name":       q.get("shortName") or q.get("longName"),
                "price":      q.get("regularMarketPrice"),
                "change_pct": q.get("regularMarketChangePercent"),
                "market_cap": q.get("marketCap"),
                "pe":         q.get("trailingPE") or q.get("forwardPE"),
                "domain":     KNOWN_DOMAINS.get(sym.split('-')[0].split('.')[0].upper()),
                "roe":        None,
                "margin":     None,
                "net_margin": None,
                "de_ratio":   None,
                "fcf_margin": None,
                "fcf_yield":  None,
                "mkcap_fcf":  None,
                "ps_ratio":   None,
                "div_yield":  div_yield,
                "_screener_raw": {
                    "trailingAnnualDividendYield": q.get("trailingAnnualDividendYield"),
                    "dividendYield":               q.get("dividendYield"),
                },
            })

        # Phase 2: Enrich all candidates with real financial ratios
        candidates = enrich_screener_results(candidates, max_enrich=50)

        # Phase 3: Post-filter — apply exact criteria against enriched values
        def passes(c: dict) -> bool:
            min_roe        = criteria.get("min_roe", 0)
            min_margin     = criteria.get("min_margin", 0)
            min_net_margin = criteria.get("min_net_margin", 0)
            min_fcf_margin = criteria.get("min_fcf_margin", 0)
            max_pe         = criteria.get("max_pe")
            max_de_eb      = criteria.get("max_debt_ebitda")
            min_dy         = criteria.get("min_div_yield", 0)
            max_mkcap_fcf  = criteria.get("max_mkcap_fcf")
            max_ps         = criteria.get("max_price_sales")

            if min_roe > 0:
                roe = c.get("roe")
                if roe is None or roe * 100 < min_roe: return False

            if min_margin > 0:
                margin = c.get("margin")
                if margin is None or margin * 100 < min_margin: return False

            if min_net_margin > 0:
                nm = c.get("net_margin")
                if nm is None or nm * 100 < min_net_margin: return False

            if min_fcf_margin > 0:
                fm = c.get("fcf_margin")
                if fm is None or fm * 100 < min_fcf_margin: return False

            if max_pe:
                pe = c.get("pe")
                if pe is None or pe > max_pe: return False

            if min_dy > 0:
                dy = c.get("div_yield")
                if dy is None or dy * 100 < min_dy: return False

            if max_de_eb:
                de = c.get("de_ratio")
                if de is not None and de > max_de_eb: return False

            if max_mkcap_fcf:
                mf = c.get("mkcap_fcf")
                if mf is None or mf > max_mkcap_fcf: return False

            if max_ps:
                ps = c.get("ps_ratio")
                if ps is None or ps > max_ps: return False

            return True

        filtered   = [c for c in candidates if passes(c)]

        # Store in cache so page changes are instant (TTL = SCREENER_CACHE_TTL)
        SCREENER_CACHE[cache_key] = {"timestamp": now, "filtered": filtered}

        total      = len(filtered)
        page_items = filtered[offset: offset + per_page]

        return {
            "total":    total,
            "page":     page,
            "per_page": per_page,
            "pages":    max(1, math.ceil(total / per_page)),
            "results":  page_items,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/chart/{ticker}")
async def get_chart(ticker: str, period: str = "1y"):
    try:
        r = _curl.get(
            f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker.upper()}",
            params={"range": period, "interval": "1d"})
        res = r.json()["chart"]["result"][0]
        ts  = res.get("timestamp", [])
        q   = res["indicators"]["quote"][0]
        candles = []
        for i in range(len(ts)):
            if q.get("open") and q["open"][i] is not None:
                candles.append({
                    "time":   time.strftime("%Y-%m-%d", time.gmtime(ts[i])),
                    "open":   q["open"][i],
                    "high":   q["high"][i],
                    "low":    q["low"][i],
                    "close":  q["close"][i],
                    "volume": q["volume"][i],
                })
        return {"ticker": ticker.upper(), "candles": candles}
    except:
        raise HTTPException(status_code=404)


STATIC_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.exists(STATIC_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend(full_path: str):
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))