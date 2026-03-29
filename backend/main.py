from fastapi import FastAPI, HTTPException, Query, Response
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
        pass

reset_session()

COMPANY_CACHE: dict = {}
CHART_CACHE:   dict = {}
CACHE_EXPIRE = 3600

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
    "JPM": "jpmorganchase.com"
}

def fetch_yahoo_info(symbol: str) -> dict:
    global _crumb
    if not _crumb:
        reset_session()

    modules = "financialData,quoteType,defaultKeyStatistics,assetProfile,summaryDetail,price,cashflowStatementHistory,incomeStatementHistory,balanceSheetHistory"
    summary_url = f"https://query2.finance.yahoo.com/v10/finance/quoteSummary/{symbol}"
    summary_params = {"modules": modules, "crumb": _crumb, "formatted": "false"}

    r = _curl.get(summary_url, params=summary_params, timeout=15)

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

# ── NUEVA FUNCIÓN: EXTRACTOR DE HISTORIAL PROFUNDO DE YAHOO ──
def fetch_yahoo_history(symbol: str) -> list:
    """Extrae el historial usando el endpoint moderno y secreto de Yahoo"""
    try:
        url = f"https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/{symbol}"
        end_time = int(time.time())
        start_time = end_time - (5 * 366 * 24 * 3600) # Últimos 5 años
        
        # Le pedimos específicamente los datos exactos que necesitamos
        types = [
            "annualTotalRevenue", "annualNetIncomeCommonStockholders", "annualNetIncome",
            "annualTotalAssets", "annualTotalLiabilitiesNetMinorityInterest", "annualTotalDebt",
            "annualOperatingCashFlow", "annualCapitalExpenditure", "annualFreeCashFlow"
        ]
        
        params = {
            "period1": start_time,
            "period2": end_time,
            "type": ",".join(types),
            "merge": "false",
            "padTimeSeries": "true"
        }
        
        r = _curl.get(url, params=params, timeout=10)
        if r.status_code != 200:
            return []
            
        data = r.json()
        timeseries = data.get("timeseries", {}).get("result", [])
        
        history_dict = {}
        
        for item in timeseries:
            meta = item.get("meta", {})
            t_type = meta.get("type", [])
            if not t_type: continue
            t_type = t_type[0]
            
            for ts in item.get(t_type, []):
                date_str = ts.get("asOfDate")
                if not date_str: continue
                year = date_str.split("-")[0]
                val = ts.get("reportedValue", {}).get("raw")
                if val is None: continue
                
                if year not in history_dict:
                    history_dict[year] = {
                        "year": year, "revenue": None, "net_income": None,
                        "assets": None, "liabilities": None, "debt": None,
                        "op_cf": None, "capex": None, "fcf": None
                    }
                
                # Mapeamos los datos de Yahoo a nuestro formato
                if t_type == "annualTotalRevenue": history_dict[year]["revenue"] = val
                elif t_type in ("annualNetIncome", "annualNetIncomeCommonStockholders"): history_dict[year]["net_income"] = val
                elif t_type == "annualTotalAssets": history_dict[year]["assets"] = val
                elif t_type == "annualTotalLiabilitiesNetMinorityInterest": history_dict[year]["liabilities"] = val
                elif t_type == "annualTotalDebt": history_dict[year]["debt"] = val
                elif t_type == "annualOperatingCashFlow": history_dict[year]["op_cf"] = val
                elif t_type == "annualCapitalExpenditure": history_dict[year]["capex"] = val
                elif t_type == "annualFreeCashFlow": history_dict[year]["fcf"] = val

        # Cálculo de rescate por si Yahoo no manda el FCF directamente
        for y, d in history_dict.items():
            if d["fcf"] is None and d["op_cf"] is not None and d["capex"] is not None:
                d["fcf"] = d["op_cf"] - abs(d["capex"])

        return sorted(list(history_dict.values()), key=lambda x: x["year"])
    except Exception as e:
        print(f"Error extrayendo historia profunda: {e}")
        return []
# ─────────────────────────────────────────────────────────────

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
    except:
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
            (f"https://icon.horse/icon/{cd}", 1000, False),
            (f"https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://{cd}&size=128", 1000, False)
        ])
        
    apis.extend([
        (f"https://financialmodelingprep.com/image-stock/{ticker_base}.png", 3000, False),
        (f"https://s3-symbol-logo.tradingview.com/{ticker_base.lower()}--big.svg", 300, True)
    ])
    
    for url, min_size, is_svg in apis:
        try:
            r = _curl.get(url, allow_redirects=True, timeout=2.5)
            ctype = r.headers.get("Content-Type", "")
            if r.status_code == 200 and len(r.content) > min_size:
                if is_svg:
                    if b"<svg" in r.content[:100].lower(): return Response(content=r.content, media_type="image/svg+xml")
                else:
                    if "image" in ctype: return Response(content=r.content, media_type=ctype)
        except Exception: continue
            
    raise HTTPException(status_code=404, detail="Logo real no encontrado")

@app.get("/api/search")
async def search(q: str = Query(..., min_length=1)):
    try:
        url = "https://query2.finance.yahoo.com/v1/finance/search"
        params = {"q": q, "quotesCount": 12, "newsCount": 0, "enableFuzzyQuery": False}
        r = _curl.get(url, params=params, timeout=8)
        if r.status_code in (401, 403, 429):
            reset_session()
            r = _curl.get(url, params=params, timeout=8)
        r.raise_for_status()
        data = r.json()
        results = []
        for quote in data.get("quotes", []):
            if quote.get("quoteType") in ("EQUITY", "ETF"):
                symbol_base = quote.get("symbol").split('.')[0].upper()
                guessed_domain = KNOWN_DOMAINS.get(symbol_base, None)
                results.append({
                    "symbol":   quote.get("symbol"),
                    "name":     quote.get("longname") or quote.get("shortname", ""),
                    "exchange": quote.get("exchange", ""),
                    "type":     quote.get("quoteType"),
                    "domain":   guessed_domain 
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
        
        # ── NUEVA EXTRACCIÓN DE HISTORIAL SEPARADA ──
        historical_data = safe_fetch(lambda: fetch_yahoo_history(symbol), retries=2)

        fd = info.get("financialData", {})
        ks = info.get("defaultKeyStatistics", {})
        sd = info.get("summaryDetail", {})
        ap = info.get("assetProfile", {})
        pr = info.get("price", {})
        qt = info.get("quoteType", {})
        
        inc_list = info.get("incomeStatementHistory", {}).get("incomeStatementHistory", [])
        cf_list  = info.get("cashflowStatementHistory", {}).get("cashflowStatements", [])
        bs_list  = info.get("balanceSheetHistory", {}).get("balanceSheetStatements", [])

        name     = extract(pr, "longName") or extract(qt, "longName", "shortName")
        sector   = extract(ap, "sector")
        industry = extract(ap, "industry")
        desc     = (extract(ap, "longBusinessSummary") or "")[:600]
        exchange = extract(qt, "exchange")
        currency = extract(pr, "currency") or "USD"
        fin_currency = extract(fd, "financialCurrency") or currency 
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
        
        fcf_history = []
        for stmt in cf_list:
            o_cf = clean(extract(stmt, "totalCashFromOperatingActivities", "operatingCashflow"))
            c_ex = clean(extract(stmt, "capitalExpenditures"))
            fcf_dir = clean(extract(stmt, "freeCashflow"))
            if fcf_dir is not None:
                fcf_history.append(fcf_dir)
            elif o_cf is not None and c_ex is not None:
                fcf_history.append(o_cf - abs(c_ex))
                
        fcf_cagr = None
        if len(fcf_history) >= 2 and fcf_history[0] > 0 and fcf_history[-1] > 0:
            years = len(fcf_history) - 1
            fcf_cagr = ((fcf_history[0] / fcf_history[-1]) ** (1 / years)) - 1
            
        ni_history = []
        rev_history = []
        for stmt in inc_list:
            ni = clean(extract(stmt, "netIncome", "netIncomeApplicableToCommonShares"))
            rev_val = clean(extract(stmt, "totalRevenue", "operatingRevenue"))
            if ni is not None:
                ni_history.append(ni)
            if rev_val is not None:
                rev_history.append(rev_val)
                
        ni_cagr = None
        if len(ni_history) >= 2 and ni_history[0] > 0 and ni_history[-1] > 0:
            years = len(ni_history) - 1
            ni_cagr = ((ni_history[0] / ni_history[-1]) ** (1 / years)) - 1

        rev_cagr = None
        if len(rev_history) >= 2 and rev_history[0] > 0 and rev_history[-1] > 0:
            years = len(rev_history) - 1
            rev_cagr = ((rev_history[0] / rev_history[-1]) ** (1 / years)) - 1

        applied_fx_rate = None
        if currency and fin_currency and currency != fin_currency:
            fx_pair = f"{fin_currency}{currency}=X" 
            try:
                r_fx = _curl.get(f"https://query2.finance.yahoo.com/v10/finance/quoteSummary/{fx_pair}", 
                                 params={"modules": "price", "crumb": _crumb}, timeout=5)
                if r_fx.status_code == 200:
                    fx_res = r_fx.json().get("quoteSummary", {}).get("result", [])
                    if fx_res:
                        rate = clean(extract(fx_res[0].get("price", {}), "regularMarketPrice"))
                        if rate:
                            applied_fx_rate = rate
                            total_rev = total_rev * rate if total_rev else None
                            gross_profit = gross_profit * rate if gross_profit else None
                            ebitda = ebitda * rate if ebitda else None
                            op_income = op_income * rate if op_income else None
                            net_income = net_income * rate if net_income else None
                            da = da * rate if da else None
                            total_debt = total_debt * rate if total_debt else None
                            cash = cash * rate if cash else None
                            equity = equity * rate if equity else None
                            total_assets = total_assets * rate if total_assets else None
                            total_liab = total_liab * rate if total_liab else None
                            op_cf = op_cf * rate if op_cf else None
                            fcf = fcf * rate if fcf else None
                            capex = capex * rate if capex else None
                            
                            # Aplicamos la conversión al historial nuevo
                            for d in historical_data:
                                for k in ["revenue", "net_income", "assets", "liabilities", "debt", "op_cf", "capex", "fcf"]:
                                    if d.get(k) is not None: d[k] *= rate
            except Exception as e:
                pass

        piotroski = {"score": 0, "is_valid": False, "is_fallback": False, "criteria": {}}
        
        bs0_temp = bs_list[0] if len(bs_list) > 0 else {}
        cr_ast0 = clean(extract(bs0_temp, "totalCurrentAssets", "currentAssets"))
        cr_liab0 = clean(extract(bs0_temp, "totalCurrentLiabilities", "currentLiabilities"))
        cfo0_temp = clean(extract(cf_list[0] if len(cf_list)>0 else {}, "totalCashFromOperatingActivities", "operatingCashflow"))
        if cfo0_temp is None: cfo0_temp = op_cf

        try:
            if len(inc_list) >= 2 and len(cf_list) >= 2 and len(bs_list) >= 2:
                inc0, inc1 = inc_list[0], inc_list[1]
                cf0 = cf_list[0]
                bs0, bs1 = bs_list[0], bs_list[1]

                ni0 = clean(extract(inc0, "netIncome", "netIncomeApplicableToCommonShares")) or net_income
                assets0 = clean(extract(bs0, "totalAssets", "assets"))

                if assets0 is not None:
                    assets1 = clean(extract(bs1, "totalAssets", "assets"))
                    lt_debt1 = clean(extract(bs1, "longTermDebt", "totalLongTermDebt")) or 0
                    cr_ast1 = clean(extract(bs1, "totalCurrentAssets", "currentAssets"))
                    cr_liab1 = clean(extract(bs1, "totalCurrentLiabilities", "currentLiabilities"))
                    gross1 = clean(extract(inc1, "grossProfit", "grossProfits"))
                    rev1 = clean(extract(inc1, "totalRevenue", "operatingRevenue"))

                    if assets1 is not None and lt_debt1 is not None:
                        lt_debt0 = clean(extract(bs0, "longTermDebt", "totalLongTermDebt")) or total_debt or 0
                        gross0 = clean(extract(inc0, "grossProfit", "grossProfits")) or gross_profit
                        rev0 = clean(extract(inc0, "totalRevenue", "operatingRevenue")) or total_rev
                        ni1 = clean(extract(inc1, "netIncome", "netIncomeApplicableToCommonShares"))

                        roa0 = (ni0 / assets0) if (ni0 is not None and assets0) else None
                        roa1 = (ni1 / assets1) if (ni1 is not None and assets1) else None
                        c1 = roa0 is not None and roa0 > 0
                        c2 = cfo0_temp is not None and cfo0_temp > 0
                        c3 = roa0 is not None and roa1 is not None and roa0 > roa1
                        c4 = cfo0_temp is not None and ni0 is not None and cfo0_temp > ni0

                        lev0 = (lt_debt0 / assets0) if (lt_debt0 is not None and assets0) else None
                        lev1 = (lt_debt1 / assets1) if (assets1) else None
                        c5 = lev0 is not None and lev1 is not None and lev0 <= lev1

                        cr0 = (cr_ast0 / cr_liab0) if (cr_ast0 is not None and cr_liab0) else None
                        cr1 = (cr_ast1 / cr_liab1) if (cr_ast1 is not None and cr_liab1) else None
                        c6 = cr0 is not None and cr1 is not None and cr0 > cr1

                        issued_stock = clean(extract(cf0, "issuanceOfStock", "issuanceOfCapitalStock")) or 0
                        c7 = issued_stock <= 0

                        gm0 = (gross0 / rev0) if (gross0 is not None and rev0) else None
                        gm1 = (gross1 / rev1) if (gross1 is not None and rev1) else None
                        c8 = gm0 is not None and gm1 is not None and gm0 > gm1

                        turn0 = (rev0 / assets0) if (rev0 is not None and assets0) else None
                        turn1 = (rev1 / assets1) if (rev1 is not None and assets1) else None
                        c9 = turn0 is not None and turn1 is not None and turn0 > turn1

                        checks = [c1, c2, c3, c4, c5, c6, c7, c8, c9]
                        piotroski["score"] = sum(1 for c in checks if c)
                        piotroski["is_valid"] = True
                        piotroski["criteria"] = {
                            "roa_positive": c1, "cfo_positive": c2, "roa_increasing": c3, "cfo_gt_ni": c4,
                            "leverage_decreasing": c5, "current_ratio_increasing": c6, "no_new_shares": c7,
                            "gross_margin_increasing": c8, "asset_turnover_increasing": c9
                        }
        except Exception:
            pass

        if not piotroski["is_valid"]:
            h1 = roa is not None and roa > 0
            h2 = fcf is not None and fcf > 0
            h3 = cfo0_temp is not None and net_income is not None and cfo0_temp > net_income
            h4 = de_ratio is not None and de_ratio < 1.5
            cr_calc = (cr_ast0 / cr_liab0) if (cr_ast0 is not None and cr_liab0) else None
            h5 = cr_calc is not None and cr_calc > 1.0

            checks_h = [h1, h2, h3, h4, h5]
            piotroski = {
                "score": sum(1 for c in checks_h if c),
                "is_valid": True,
                "is_fallback": True,
                "criteria": {
                    "roa_positive": h1,
                    "fcf_positive": h2,
                    "cfo_gt_ni": h3,
                    "leverage_safe": h4,
                    "liquid": h5
                }
            }

        def ratio(n, d):
            return n / d if (n is not None and d and d != 0) else None

        net_debt = (total_debt - cash) if (total_debt is not None and cash is not None) else None
        ev = (market_cap + net_debt) if (applied_fx_rate and market_cap and net_debt is not None) else clean(extract(ks, "enterpriseValue"))
        
        if market_cap and price:
            shares_outstanding = market_cap / price
        else:
            shares_outstanding = clean(extract(ks, "sharesOutstanding"))

        domain = None
        if website:
            domain = website.replace("https://","").replace("http://","").replace("www.","").split('/')[0]

        calc_eps = (net_income / shares_outstanding) if (net_income is not None and shares_outstanding) else None
        calc_bvps = (equity / shares_outstanding) if (equity is not None and shares_outstanding) else None

        graham_number = None
        if calc_eps and calc_bvps and calc_eps > 0 and calc_bvps > 0:
            graham_number = math.sqrt(22.5 * calc_eps * calc_bvps)

        lynch_value = None
        peg_ratio = clean(extract(ks, "pegRatio") or extract(sd, "pegRatio"))
        
        if peg_ratio and peg_ratio > 0 and price:
            lynch_value = price / peg_ratio
        elif calc_eps and calc_eps > 0:
            growth_rate = ni_cagr if (ni_cagr and ni_cagr > 0) else rev_cagr
            if growth_rate and growth_rate > 0:
                capped_cagr = min(growth_rate, 0.40) 
                lynch_value = calc_eps * (capped_cagr * 100)

        mean_reversion_value = None
        if len(ni_history) > 0 and shares_outstanding and shares_outstanding > 0:
            avg_ni = sum(ni_history) / len(ni_history)
            norm_eps = avg_ni / shares_outstanding
            if norm_eps > 0:
                mean_reversion_value = norm_eps * 15 
                
        implied_growth = None
        if fcf and fcf > 0 and price and shares_outstanding:
            target_ev = price * shares_outstanding + (net_debt if net_debt is not None else 0)
            low, high = -0.50, 1.0 
            r_rate, t_growth, proj_years = 0.10, 0.025, 5 
            
            for _ in range(30):
                mid = (low + high) / 2
                pv_sum = 0
                cf = fcf
                for i in range(1, proj_years + 1):
                    cf *= (1 + mid)
                    pv_sum += cf / ((1 + r_rate)**i)
                tv = (cf * (1 + t_growth)) / (r_rate - t_growth)
                pv_tv = tv / ((1 + r_rate)**proj_years)
                calc_ev = pv_sum + pv_tv
                
                if calc_ev < target_ev:
                    low = mid
                else:
                    high = mid
            implied_growth = (low + high) / 2

        final_data = {
            "symbol":      symbol,
            "name":        name,
            "sector":      sector,
            "industry":    industry,
            "exchange":    exchange,
            "description": desc or None,
            "currency":    currency,
            "financialCurrency": fin_currency, 
            "applied_fx_rate": applied_fx_rate, 
            "website":     website,
            "domain":      domain,
            "employees":   employees,
            "piotroski":   piotroski,
            "historical_data": historical_data,
            "gurus": {
                "graham_number": graham_number,
                "lynch_value": lynch_value,
                "mean_reversion_value": mean_reversion_value,
                "implied_growth": implied_growth,
                "eps": calc_eps,
                "bvps": calc_bvps
            },
            "market": {
                "price":          price,
                "price_change":   price_change,
                "price_pct":      ratio(price_change, prev_close),
                "market_cap":     market_cap,
                "shares_outstanding": shares_outstanding, 
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
                "roa":        roa or ratio(net_income, (net_income / roa) if (net_income and roa and roa!=0) else None),
                "ni_cagr":    ni_cagr,
            },
            "balance_sheet": {
                "total_assets": (net_income / roa) if (net_income and roa and roa != 0) else total_assets,
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
                "fcf_cagr":    fcf_cagr,
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
        params = {"interval": interval_map.get(interval, "1d"), "range": range_map.get(period, "1y"), "crumb": _crumb or ""}
        r = _curl.get(url, params=params, timeout=15)
        
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
                if None in (o, h, l, c): continue
                candles.append({
                    "time":   time.strftime("%Y-%m-%d", time.gmtime(ts)),
                    "open":   round(float(o), 4),
                    "high":   round(float(h), 4),
                    "low":    round(float(l), 4),
                    "close":  round(float(c), 4),
                    "volume": int(v) if v else 0,
                })
            except: continue

        if not candles:
            raise HTTPException(status_code=404, detail="No candle data found")

        final_data = {"ticker": symbol, "candles": candles}
        CHART_CACHE[cache_key] = {"timestamp": now, "data": final_data}
        return final_data

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

STATIC_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.exists(STATIC_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")
    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend(full_path: str):
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))