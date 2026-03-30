import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Filter, Search, ArrowRight, Zap, TrendingUp, ShieldAlert,
  Coins, Percent, Activity, Bug, AlertCircle, ChevronLeft, ChevronRight,
  BarChart2, DollarSign, LineChart, TrendingDown
} from 'lucide-react';
import { API_URL } from './utils';
import CompanyLogo from './CompanyLogo';

// ── Safe formatters ───────────────────────────────────────────────────────────
const fmtPct  = (v, d = 2) => (v == null || isNaN(v)) ? '—' : `${(v * 100).toFixed(d)}%`;
const fmtX    = (v, d = 1) => (v == null || isNaN(v)) ? '—' : `${Number(v).toFixed(d)}×`;
const fmtPrice= (v)        => (v == null || isNaN(v)) ? '—' : `$${Number(v).toFixed(2)}`;
const fmtMCap = (v) => {
  if (!v) return '—';
  if (v >= 1e12) return `$${(v/1e12).toFixed(1)}T`;
  if (v >= 1e9)  return `$${(v/1e9).toFixed(1)}B`;
  if (v >= 1e6)  return `$${(v/1e6).toFixed(1)}M`;
  return `$${v}`;
};

// ── Color helpers (values in decimal form) ────────────────────────────────────
const roeColor   = (v) => (v == null) ? 'text-subtle' : v > 0.15 ? 'text-emerald' : v > 0 ? 'text-gold' : 'text-rose';
const marginColor= (v) => (v == null) ? 'text-subtle' : v > 0.15 ? 'text-sky'     : v > 0 ? 'text-gold' : 'text-rose';
const deColor    = (v) => (v == null) ? 'text-subtle' : v < 1    ? 'text-emerald' : v < 2  ? 'text-gold' : 'text-rose';
const fcfColor   = (v) => (v == null) ? 'text-subtle' : v > 0.10 ? 'text-emerald' : v > 0  ? 'text-gold' : 'text-rose';
const dyColor    = (v) => (v == null) ? 'text-subtle' : v > 0.03 ? 'text-emerald' : v > 0  ? 'text-gold' : 'text-subtle';
// Mkt Cap/FCF and Price/Sales: lower = better (like P/E)
const mfColor    = (v) => (v == null) ? 'text-subtle' : v < 15 ? 'text-emerald' : v < 25 ? 'text-gold' : 'text-rose';
const psColor    = (v) => (v == null) ? 'text-subtle' : v < 5  ? 'text-emerald' : v < 15 ? 'text-gold' : 'text-rose';

export default function Screener() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [page, setPage] = useState(1);
  const [showDebug, setShowDebug] = useState(false);
  const [error, setError] = useState(null);

  const [criteria, setCriteria] = useState({
    min_roe:         15,
    max_pe:          25,
    min_margin:      15,
    min_net_margin:  0,
    min_fcf_margin:  0,
    min_div_yield:   0,
    max_debt_ebitda: 3,
    max_mkcap_fcf:   0,   // 0 = sin límite
    max_price_sales: 0,   // 0 = sin límite
    min_market_cap:  2000000000,
  });

  const set = (key) => (v) => setCriteria(p => ({ ...p, [key]: v }));

  const doSearch = async (targetPage = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/screener`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...criteria, page: targetPage, per_page: 15 }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || 'Error en el screener'); return; }
      setResponse(data);
      setPage(targetPage);
    } catch (err) {
      setError(`Error de conexión: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => doSearch(1);

  const companies = response?.results ?? [];
  const total     = response?.total ?? 0;
  const pages     = response?.pages ?? 1;

  return (
    <div className="fade-in space-y-6 w-full">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gold/10 rounded-2xl text-gold border border-gold/20">
            <Filter size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-text">Screener Pro</h1>
            <p className="text-muted text-xs uppercase tracking-widest">Filtro Dinámico de Calidad en Wall Street</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowDebug(v => !v)}
            className={`p-4 rounded-2xl border transition-all ${showDebug ? 'bg-rose/20 border-rose/50 text-rose' : 'bg-surface border-border/50 text-muted hover:text-subtle'}`}
            title="Debug"
          >
            <Bug size={20} />
          </button>
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-10 py-4 bg-gold hover:bg-amber-400 text-bg font-display font-bold rounded-2xl transition-all flex items-center gap-2 shadow-xl shadow-gold/20 active:scale-95 disabled:opacity-50"
          >
            {loading ? <Activity className="animate-spin" size={20} /> : <Search size={20} />}
            Escanear Mercado
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="glass rounded-2xl p-4 flex items-center gap-3 border border-rose/30 bg-rose/5 text-rose">
          <AlertCircle size={18} />
          <div>
            <p className="font-semibold text-sm">Error al ejecutar el screener</p>
            <p className="text-xs mt-0.5 text-rose/80">{error}</p>
          </div>
        </div>
      )}

      {/* ── Debug ── */}
      {showDebug && companies.length > 0 && (
        <div className="glass p-5 rounded-2xl border border-gold/20">
          <p className="text-[10px] font-mono text-gold uppercase tracking-widest mb-2">
            // Debug — primeros 2 resultados procesados
          </p>
          <pre className="text-[10px] text-emerald/80 overflow-auto max-h-64">
            {JSON.stringify(companies.slice(0, 2).map(r => ({
              symbol:     r.symbol,
              roe:        { decimal: r.roe,        pct: r.roe        != null ? (r.roe*100).toFixed(2)+'%'        : '—' },
              margin:     { decimal: r.margin,     pct: r.margin     != null ? (r.margin*100).toFixed(2)+'%'     : '—' },
              net_margin: { decimal: r.net_margin, pct: r.net_margin != null ? (r.net_margin*100).toFixed(2)+'%' : '—' },
              fcf_margin: { decimal: r.fcf_margin, pct: r.fcf_margin != null ? (r.fcf_margin*100).toFixed(2)+'%' : '—' },
              mkcap_fcf:  r.mkcap_fcf,
              ps_ratio:   r.ps_ratio,
              de_ratio:   r.de_ratio,
              div_yield:  { decimal: r.div_yield,  pct: r.div_yield  != null ? (r.div_yield*100).toFixed(3)+'%'  : '—' },
              _raw:       r._screener_raw,
              enrich_source: r._enrich_source,
            })), null, 2)}
          </pre>
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-6">

        {/* ── Filter panel ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Calidad */}
          <div className="glass p-5 rounded-3xl border border-border/40 space-y-7">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-emerald font-bold border-b border-border/30 pb-3">Calidad</h3>
            <ModernSlider label="ROE Mín"          icon={TrendingUp}  value={criteria.min_roe}         unit="%" onChange={set('min_roe')}         min={0} max={60}  color="text-emerald" />
            <ModernSlider label="Margen Op. Mín"   icon={Percent}     value={criteria.min_margin}      unit="%" onChange={set('min_margin')}      min={0} max={60}  color="text-sky" />
            <ModernSlider label="Margen Neto Mín"  icon={BarChart2}   value={criteria.min_net_margin}  unit="%" onChange={set('min_net_margin')}  min={0} max={60}  color="text-sky" />
            <ModernSlider label="FCF Margin Mín"   icon={LineChart}   value={criteria.min_fcf_margin}  unit="%" onChange={set('min_fcf_margin')}  min={0} max={60}  color="text-emerald" />
          </div>

          {/* Valuación */}
          <div className="glass p-5 rounded-3xl border border-border/40 space-y-7">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-gold font-bold border-b border-border/30 pb-3">Valuación</h3>
            <ModernSlider label="P/E Máx"              icon={Filter}      value={criteria.max_pe}          unit="x" onChange={set('max_pe')}          min={5}  max={100} color="text-gold" />
            <ModernSlider label="Mkt Cap/FCF Máx"      icon={DollarSign}  value={criteria.max_mkcap_fcf}   unit="x" onChange={set('max_mkcap_fcf')}   min={0}  max={100} color="text-gold"
              zeroLabel="Sin límite" />
            <ModernSlider label="Price/Sales Máx"      icon={TrendingDown} value={criteria.max_price_sales} unit="x" onChange={set('max_price_sales')} min={0}  max={50}  color="text-gold"
              zeroLabel="Sin límite" />
          </div>

          {/* Riesgo */}
          <div className="glass p-5 rounded-3xl border border-border/40 space-y-7">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-rose font-bold border-b border-border/30 pb-3">Riesgo</h3>
            <ModernSlider label="Deuda/Equity Máx" icon={ShieldAlert} value={criteria.max_debt_ebitda} unit="x" onChange={set('max_debt_ebitda')} min={0} max={10} step={0.5} color="text-rose" />
          </div>

          {/* Dividendo */}
          <div className="glass p-5 rounded-3xl border border-border/40 space-y-7">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-emerald font-bold border-b border-border/30 pb-3">Dividendo</h3>
            <ModernSlider label="Div. Yield Mín" icon={Coins} value={criteria.min_div_yield} unit="%" onChange={set('min_div_yield')} min={0} max={15} step={0.5} color="text-emerald" />
          </div>

          {/* Resultado */}
          {response && (
            <div className="glass p-4 rounded-2xl border border-border/40">
              <p className="text-[10px] font-mono text-gold uppercase tracking-widest mb-2">Resultado</p>
              <p className="text-text font-mono font-bold text-lg">{total}</p>
              <p className="text-muted text-xs">empresas cumplen todos los criterios</p>
              {pages > 1 && (
                <p className="text-subtle text-xs mt-1">
                  Página {page} de {pages} · {Math.min(15, total - (page-1)*15)} mostradas
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Results ── */}
        <div className="lg:col-span-10 space-y-4">
          {companies.length > 0 ? (
            <>
              <div className="glass rounded-3xl overflow-hidden border border-border/50 shadow-2xl overflow-x-auto">
                <div className="px-6 py-3 bg-surface/40 border-b border-border/30 flex items-center justify-between">
                  <p className="text-xs text-muted font-mono">
                    <span className="text-gold font-semibold">{total}</span> empresas cumplen los filtros
                    {companies[0]?._enriched && <span className="text-gold/50 ml-2">· datos via quoteSummary</span>}
                  </p>
                  <p className="text-[10px] text-muted">Solo se muestran empresas que pasan TODOS los criterios</p>
                </div>

                <table className="w-full text-left border-collapse min-w-[1100px]">
                  <thead className="bg-surface/60 border-b border-border/50 text-[10px] uppercase tracking-widest text-muted">
                    <tr>
                      <th className="px-4 py-4">Empresa</th>
                      <th className="px-3 py-4 text-right">Precio</th>
                      <th className="px-3 py-4 text-right">P/E</th>
                      <th className="px-3 py-4 text-right text-emerald">ROE</th>
                      <th className="px-3 py-4 text-right text-sky">Mg. Op.</th>
                      <th className="px-3 py-4 text-right text-sky">Mg. Neto</th>
                      <th className="px-3 py-4 text-right text-emerald">FCF Margin</th>
                      <th className="px-3 py-4 text-right text-gold">Mkt Cap / FCF</th>
                      <th className="px-3 py-4 text-right text-gold">Price / Sales</th>
                      <th className="px-3 py-4 text-right">D/E</th>
                      <th className="px-3 py-4 text-right text-emerald">Div. Yield</th>
                      <th className="px-3 py-4 text-right text-muted">Mkt Cap</th>
                      <th className="px-3 py-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {companies.map(s => <StockRow key={s.symbol} stock={s} navigate={navigate} />)}
                  </tbody>
                </table>
              </div>

              {/* ── Pagination ── */}
              {pages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => doSearch(page - 1)}
                    disabled={page <= 1 || loading}
                    className="flex items-center gap-1 px-4 py-2 glass rounded-xl text-sm font-mono
                               text-muted hover:text-text disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft size={14} /> Anterior
                  </button>

                  <div className="flex gap-1">
                    {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
                      let p;
                      if (pages <= 7) p = i + 1;
                      else if (page <= 4) p = i + 1;
                      else if (page >= pages - 3) p = pages - 6 + i;
                      else p = page - 3 + i;
                      return (
                        <button
                          key={p}
                          onClick={() => doSearch(p)}
                          disabled={loading}
                          className={`w-9 h-9 rounded-xl text-xs font-mono font-semibold transition-all
                            ${p === page ? 'bg-gold/20 text-gold border border-gold/30' : 'glass text-muted hover:text-text'}`}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => doSearch(page + 1)}
                    disabled={page >= pages || loading}
                    className="flex items-center gap-1 px-4 py-2 glass rounded-xl text-sm font-mono
                               text-muted hover:text-text disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    Siguiente <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="h-[580px] flex flex-col items-center justify-center border-2 border-dashed border-border/20 rounded-[40px] glass">
              <Zap size={48} className="opacity-10 text-gold mb-4" />
              {loading
                ? <p className="font-display text-lg opacity-50">Escaneando el mercado…</p>
                : <>
                    <p className="font-display text-xl opacity-40 text-center px-8">
                      Ajustá los filtros y presioná el botón para buscar
                    </p>
                    <p className="text-xs mt-3 text-muted text-center px-8">
                      Solo se muestran empresas que cumplen TODOS los criterios seleccionados
                    </p>
                  </>
              }
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Table row ─────────────────────────────────────────────────────────────────
function StockRow({ stock: s, navigate }) {
  const priceUp = (s.change_pct ?? 0) >= 0;
  return (
    <tr
      onClick={() => navigate(`/company/${s.symbol}`)}
      className="hover:bg-gold/10 cursor-pointer transition-all group"
    >
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <CompanyLogo ticker={s.symbol} size={36} className="rounded-xl shadow-sm flex-shrink-0" />
          <div>
            <p className="font-mono text-xs font-bold text-sky leading-none mb-1">{s.symbol}</p>
            <p className="text-sm font-semibold text-text truncate max-w-[150px]">{s.name}</p>
          </div>
        </div>
      </td>
      <td className="px-3 py-4 text-right">
        <p className="font-mono text-sm text-text font-bold">{fmtPrice(s.price)}</p>
        <p className={`text-[10px] font-bold ${priceUp ? 'text-emerald' : 'text-rose'}`}>
          {s.change_pct != null ? `${priceUp?'+':''}${s.change_pct.toFixed(2)}%` : '—'}
        </p>
      </td>
      <td className="px-3 py-4 text-right font-mono text-sm text-subtle">
        {s.pe != null ? s.pe.toFixed(1)+'x' : '—'}
      </td>
      <td className={`px-3 py-4 text-right font-mono text-sm font-semibold ${roeColor(s.roe)}`}>
        {fmtPct(s.roe)}
      </td>
      <td className={`px-3 py-4 text-right font-mono text-sm ${marginColor(s.margin)}`}>
        {fmtPct(s.margin)}
      </td>
      <td className={`px-3 py-4 text-right font-mono text-sm ${marginColor(s.net_margin)}`}>
        {fmtPct(s.net_margin)}
      </td>
      <td className={`px-3 py-4 text-right font-mono text-sm ${fcfColor(s.fcf_margin)}`}>
        {fmtPct(s.fcf_margin)}
      </td>
      {/* Mkt Cap / FCF — campo: mkcap_fcf */}
      <td className={`px-3 py-4 text-right font-mono text-sm ${mfColor(s.mkcap_fcf)}`}>
        {fmtX(s.mkcap_fcf)}
      </td>
      {/* Price / Sales — campo: ps_ratio */}
      <td className={`px-3 py-4 text-right font-mono text-sm ${psColor(s.ps_ratio)}`}>
        {fmtX(s.ps_ratio)}
      </td>
      <td className={`px-3 py-4 text-right font-mono text-sm ${deColor(s.de_ratio)}`}>
        {fmtX(s.de_ratio)}
      </td>
      <td className={`px-3 py-4 text-right font-mono text-sm font-semibold ${dyColor(s.div_yield)}`}>
        {fmtPct(s.div_yield, 2)}
      </td>
      <td className="px-3 py-4 text-right font-mono text-xs text-muted">
        {fmtMCap(s.market_cap)}
      </td>
      <td className="px-3 py-4">
        <ArrowRight size={18} className="text-muted group-hover:text-gold group-hover:translate-x-1 transition-all inline-block" />
      </td>
    </tr>
  );
}

// ── Slider ────────────────────────────────────────────────────────────────────
function ModernSlider({ label, value, onChange, min, max, step = 1, unit = "", icon: Icon, color = "text-gold", zeroLabel = null }) {
  const displayVal = (zeroLabel && value === 0) ? zeroLabel : `${value}${unit}`;
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-surface rounded-lg border border-border/50">
            <Icon size={12} className="text-muted" />
          </div>
          <label className="text-[11px] font-bold text-subtle uppercase tracking-wider">{label}</label>
        </div>
        <span className={`font-mono text-xs font-bold ${value === 0 && zeroLabel ? 'text-muted' : color} bg-surface px-2.5 py-1 rounded-full border border-border/60`}>
          {displayVal}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="modern-range w-full"
      />
    </div>
  );
}