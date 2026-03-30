import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Filter, Search, ArrowRight, Zap, Activity, Bug, AlertCircle,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, RotateCcw
} from 'lucide-react';
import { API_URL } from './utils';
import CompanyLogo from './CompanyLogo';

// ── Formatters ────────────────────────────────────────────────────────────────
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

// ── Color helpers ─────────────────────────────────────────────────────────────
const roeColor   = (v) => v == null ? 'text-subtle' : v > 0.15 ? 'text-emerald' : v > 0 ? 'text-gold' : 'text-rose';
const marginColor= (v) => v == null ? 'text-subtle' : v > 0.15 ? 'text-sky'     : v > 0 ? 'text-gold' : 'text-rose';
const deColor    = (v) => v == null ? 'text-subtle' : v < 1    ? 'text-emerald' : v < 2  ? 'text-gold' : 'text-rose';
const fcfColor   = (v) => v == null ? 'text-subtle' : v > 0.10 ? 'text-emerald' : v > 0  ? 'text-gold' : 'text-rose';
const dyColor    = (v) => v == null ? 'text-subtle' : v > 0.03 ? 'text-emerald' : v > 0  ? 'text-gold' : 'text-subtle';
const mfColor    = (v) => v == null ? 'text-subtle' : v < 15   ? 'text-emerald' : v < 25 ? 'text-gold' : 'text-rose';
const psColor    = (v) => v == null ? 'text-subtle' : v < 5    ? 'text-emerald' : v < 15 ? 'text-gold' : 'text-rose';

// ── Default filter values ─────────────────────────────────────────────────────
const DEFAULTS = {
  min_roe:         15,
  max_pe:          25,
  min_margin:      15,
  min_net_margin:  0,
  min_fcf_margin:  0,
  min_div_yield:   0,
  max_debt_ebitda: 3,
  max_mkcap_fcf:   0,
  max_price_sales: 0,
  min_market_cap:  2000000000,
};

export default function Screener() {
  const navigate = useNavigate();
  const [loading,     setLoading]     = useState(false);
  const [response,    setResponse]    = useState(null);
  const [page,        setPage]        = useState(1);
  const [showDebug,   setShowDebug]   = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [error,       setError]       = useState(null);
  const [criteria,    setCriteria]    = useState({ ...DEFAULTS });

  const set = (key) => (v) => setCriteria(p => ({ ...p, [key]: v }));
  const reset = () => setCriteria({ ...DEFAULTS });

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

  const companies = response?.results ?? [];
  const total     = response?.total   ?? 0;
  const pages     = response?.pages   ?? 1;

  // Badge: count filters changed from default (excluding min_market_cap)
  const activeCount = Object.entries(criteria).filter(([k, v]) =>
    k !== 'min_market_cap' && v !== DEFAULTS[k]
  ).length;

  return (
    <div className="fade-in space-y-4 w-full">

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gold/10 rounded-xl text-gold border border-gold/20">
            <Filter size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-text">Screener Pro</h1>
            <p className="text-muted text-[11px] uppercase tracking-widest">Filtro Dinámico · Wall Street</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDebug(v => !v)}
            className={`p-2.5 rounded-xl border transition-all ${showDebug ? 'bg-rose/20 border-rose/50 text-rose' : 'bg-surface border-border/50 text-muted hover:text-subtle'}`}
            title="Debug"
          >
            <Bug size={16} />
          </button>
          <button
            onClick={reset}
            className="flex items-center gap-1.5 px-3 py-2.5 glass rounded-xl border border-border/50 text-muted hover:text-subtle text-xs font-mono transition-all"
          >
            <RotateCcw size={13} /> Reset
          </button>
          <button
            onClick={() => doSearch(1)}
            disabled={loading}
            className="px-6 py-2.5 bg-gold hover:bg-amber-400 text-bg font-display font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-gold/20 active:scale-95 disabled:opacity-50"
          >
            {loading ? <Activity className="animate-spin" size={16} /> : <Search size={16} />}
            Escanear Mercado
          </button>
        </div>
      </div>

      {/* ══ FILTER PANEL ════════════════════════════════════════════════════ */}
      <div className="glass rounded-2xl border border-border/40 overflow-hidden">

        {/* Toggle bar */}
        <button
          onClick={() => setFiltersOpen(v => !v)}
          className="w-full flex items-center justify-between px-5 py-3 hover:bg-surface/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-[11px] uppercase tracking-[0.2em] text-gold font-bold">Filtros</span>
            {activeCount > 0 && (
              <span className="px-2 py-0.5 bg-gold/20 text-gold text-[10px] font-bold rounded-full border border-gold/30">
                {activeCount} activos
              </span>
            )}
            {response && (
              <span className="text-[11px] text-muted font-mono ml-1">
                → <span className="text-gold font-semibold">{total}</span> empresas encontradas
              </span>
            )}
          </div>
          {filtersOpen
            ? <ChevronUp size={14} className="text-muted" />
            : <ChevronDown size={14} className="text-muted" />}
        </button>

        {/* Grid of sliders — 5 columns, 2 rows visible, no scroll needed */}
        {filtersOpen && (
          <div className="border-t border-border/30 px-5 py-4">
            {/* Row labels */}
            <div className="grid grid-cols-5 gap-x-6 gap-y-5">

              {/* ── GROUP: CALIDAD ── */}
              <div className="col-span-5 flex items-center gap-3 -mb-1">
                <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-emerald">Calidad</span>
                <div className="flex-1 h-px bg-border/30" />
                <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-gold ml-4">Valuación</span>
                <div className="flex-1 h-px bg-border/30" />
                <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-rose ml-4">Riesgo & Dividendo</span>
                <div className="w-8 h-px bg-border/30" />
              </div>

              {/* ── ROW 1 ── */}
              <CompactSlider label="ROE Mínimo"          value={criteria.min_roe}         onChange={set('min_roe')}         min={0} max={60}  unit="%" color="emerald" />
              <CompactSlider label="Margen Operativo Mín" value={criteria.min_margin}      onChange={set('min_margin')}      min={0} max={60}  unit="%" color="sky" />
              <CompactSlider label="P/E Máximo"           value={criteria.max_pe}          onChange={set('max_pe')}          min={5} max={100} unit="x" color="gold" />
              <CompactSlider label="Mkt Cap / FCF Máx"    value={criteria.max_mkcap_fcf}   onChange={set('max_mkcap_fcf')}   min={0} max={100} unit="x" color="gold" zeroIsNoLimit />
              <CompactSlider label="Deuda / Equity Máx"   value={criteria.max_debt_ebitda} onChange={set('max_debt_ebitda')} min={0} max={10} step={0.5} unit="x" color="rose" />

              {/* ── ROW 2 ── */}
              <CompactSlider label="Margen Neto Mín"    value={criteria.min_net_margin}  onChange={set('min_net_margin')}  min={0} max={60}  unit="%" color="sky"     zeroIsNoLimit />
              <CompactSlider label="FCF Margin Mínimo"  value={criteria.min_fcf_margin}  onChange={set('min_fcf_margin')}  min={0} max={60}  unit="%" color="emerald" zeroIsNoLimit />
              <CompactSlider label="Price / Sales Máx"  value={criteria.max_price_sales} onChange={set('max_price_sales')} min={0} max={50}  unit="x" color="gold"    zeroIsNoLimit />
              <div /> {/* spacer to keep grid alignment */}
              <CompactSlider label="Div. Yield Mínimo"  value={criteria.min_div_yield}   onChange={set('min_div_yield')}  min={0} max={15} step={0.5} unit="%" color="emerald" zeroIsNoLimit />

            </div>
          </div>
        )}
      </div>

      {/* ══ ERROR ═══════════════════════════════════════════════════════════ */}
      {error && (
        <div className="glass rounded-xl p-3 flex items-center gap-3 border border-rose/30 bg-rose/5 text-rose">
          <AlertCircle size={16} />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* ══ DEBUG ════════════════════════════════════════════════════════════ */}
      {showDebug && companies.length > 0 && (
        <div className="glass p-4 rounded-xl border border-gold/20">
          <p className="text-[10px] font-mono text-gold uppercase tracking-widest mb-2">// Debug — primeros 2 resultados</p>
          <pre className="text-[10px] text-emerald/80 overflow-auto max-h-48">
            {JSON.stringify(companies.slice(0, 2).map(r => ({
              symbol: r.symbol,
              roe:        r.roe        != null ? (r.roe*100).toFixed(2)+'%'        : '—',
              margin:     r.margin     != null ? (r.margin*100).toFixed(2)+'%'     : '—',
              fcf_margin: r.fcf_margin != null ? (r.fcf_margin*100).toFixed(2)+'%' : '—',
              mkcap_fcf: r.mkcap_fcf, ps_ratio: r.ps_ratio,
              div_yield:  r.div_yield  != null ? (r.div_yield*100).toFixed(3)+'%'  : '—',
              _raw: r._screener_raw, src: r._enrich_source,
            })), null, 2)}
          </pre>
        </div>
      )}

      {/* ══ RESULTS ══════════════════════════════════════════════════════════ */}
      {companies.length > 0 ? (
        <div className="space-y-3">
          <div className="glass rounded-2xl border border-border/50 shadow-xl overflow-hidden">
            <div className="px-4 py-2 bg-surface/40 border-b border-border/30 flex items-center justify-between">
              <p className="text-xs text-muted font-mono">
                <span className="text-gold font-semibold">{total}</span> empresas · página {page}/{pages}
                {companies[0]?._enriched && <span className="text-gold/40 ml-2">· via quoteSummary</span>}
              </p>
              <p className="text-[10px] text-muted/60">Todas cumplen cada criterio activo</p>
            </div>

            {/*
              Table designed to fit ~1280px without horizontal scroll.
              Column widths are percentage-based so they scale with the container.
            */}
            <table className="w-full text-left border-collapse table-fixed">
              <thead className="bg-surface/60 border-b border-border/50">
                <tr className="text-[10px] uppercase tracking-wider text-muted">
                  <th className="px-3 py-3 w-[20%]">Empresa</th>
                  <th className="px-2 py-3 text-right w-[8%]">Precio</th>
                  <th className="px-2 py-3 text-right w-[5%]">P/E</th>
                  <th className="px-2 py-3 text-right w-[6%] text-emerald">ROE</th>
                  <th className="px-2 py-3 text-right w-[6%] text-sky">Mg.Op</th>
                  <th className="px-2 py-3 text-right w-[6%] text-sky">Mg.Neto</th>
                  <th className="px-2 py-3 text-right w-[6%] text-emerald">FCF Mg.</th>
                  <th className="px-2 py-3 text-right w-[8%] text-gold">MktCap/FCF</th>
                  <th className="px-2 py-3 text-right w-[7%] text-gold">P/Sales</th>
                  <th className="px-2 py-3 text-right w-[5%]">D/E</th>
                  <th className="px-2 py-3 text-right w-[7%] text-emerald">Div.Yield</th>
                  <th className="px-2 py-3 text-right w-[7%] text-muted">Mkt Cap</th>
                  <th className="px-1 py-3 w-[3%]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {companies.map(s => <StockRow key={s.symbol} stock={s} navigate={navigate} />)}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => doSearch(page - 1)} disabled={page <= 1 || loading}
                className="flex items-center gap-1 px-3 py-2 glass rounded-xl text-sm font-mono text-muted hover:text-text disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                <ChevronLeft size={13} /> Anterior
              </button>
              <div className="flex gap-1">
                {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
                  let p;
                  if (pages <= 7) p = i + 1;
                  else if (page <= 4) p = i + 1;
                  else if (page >= pages - 3) p = pages - 6 + i;
                  else p = page - 3 + i;
                  return (
                    <button key={p} onClick={() => doSearch(p)} disabled={loading}
                      className={`w-8 h-8 rounded-lg text-xs font-mono font-semibold transition-all
                        ${p === page ? 'bg-gold/20 text-gold border border-gold/30' : 'glass text-muted hover:text-text'}`}
                    >{p}</button>
                  );
                })}
              </div>
              <button onClick={() => doSearch(page + 1)} disabled={page >= pages || loading}
                className="flex items-center gap-1 px-3 py-2 glass rounded-xl text-sm font-mono text-muted hover:text-text disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                Siguiente <ChevronRight size={13} />
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="h-[380px] flex flex-col items-center justify-center border-2 border-dashed border-border/20 rounded-3xl glass">
          <Zap size={36} className="opacity-10 text-gold mb-3" />
          {loading
            ? <p className="font-display text-base opacity-50">Escaneando el mercado…</p>
            : <>
                <p className="font-display text-lg opacity-40 text-center px-8">Ajustá los filtros y presioná Escanear</p>
                <p className="text-xs mt-2 text-muted text-center">Solo aparecen empresas que cumplen TODOS los criterios activos</p>
              </>
          }
        </div>
      )}
    </div>
  );
}

// ── Table row ─────────────────────────────────────────────────────────────────
function StockRow({ stock: s, navigate }) {
  const priceUp = (s.change_pct ?? 0) >= 0;
  return (
    <tr onClick={() => navigate(`/company/${s.symbol}`)} className="hover:bg-gold/10 cursor-pointer transition-all group">
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <CompanyLogo ticker={s.symbol} size={30} className="rounded-lg shadow-sm flex-shrink-0" />
          <div className="min-w-0">
            <p className="font-mono text-[11px] font-bold text-sky leading-none mb-0.5">{s.symbol}</p>
            <p className="text-xs font-semibold text-text truncate">{s.name}</p>
          </div>
        </div>
      </td>
      <td className="px-2 py-2.5 text-right">
        <p className="font-mono text-xs text-text font-bold">{fmtPrice(s.price)}</p>
        <p className={`text-[10px] font-bold ${priceUp ? 'text-emerald' : 'text-rose'}`}>
          {s.change_pct != null ? `${priceUp?'+':''}${s.change_pct.toFixed(2)}%` : '—'}
        </p>
      </td>
      <td className="px-2 py-2.5 text-right font-mono text-xs text-subtle">
        {s.pe != null ? s.pe.toFixed(1)+'x' : '—'}
      </td>
      <td className={`px-2 py-2.5 text-right font-mono text-xs font-semibold ${roeColor(s.roe)}`}>
        {fmtPct(s.roe)}
      </td>
      <td className={`px-2 py-2.5 text-right font-mono text-xs ${marginColor(s.margin)}`}>
        {fmtPct(s.margin)}
      </td>
      <td className={`px-2 py-2.5 text-right font-mono text-xs ${marginColor(s.net_margin)}`}>
        {fmtPct(s.net_margin)}
      </td>
      <td className={`px-2 py-2.5 text-right font-mono text-xs ${fcfColor(s.fcf_margin)}`}>
        {fmtPct(s.fcf_margin)}
      </td>
      <td className={`px-2 py-2.5 text-right font-mono text-xs ${mfColor(s.mkcap_fcf)}`}>
        {fmtX(s.mkcap_fcf)}
      </td>
      <td className={`px-2 py-2.5 text-right font-mono text-xs ${psColor(s.ps_ratio)}`}>
        {fmtX(s.ps_ratio)}
      </td>
      <td className={`px-2 py-2.5 text-right font-mono text-xs ${deColor(s.de_ratio)}`}>
        {fmtX(s.de_ratio)}
      </td>
      <td className={`px-2 py-2.5 text-right font-mono text-xs font-semibold ${dyColor(s.div_yield)}`}>
        {fmtPct(s.div_yield, 2)}
      </td>
      <td className="px-2 py-2.5 text-right font-mono text-[11px] text-muted">
        {fmtMCap(s.market_cap)}
      </td>
      <td className="px-1 py-2.5">
        <ArrowRight size={14} className="text-muted group-hover:text-gold group-hover:translate-x-0.5 transition-all inline-block" />
      </td>
    </tr>
  );
}

// ── Compact slider ────────────────────────────────────────────────────────────
function CompactSlider({ label, value, onChange, min, max, step = 1, unit = '', color = 'gold', zeroIsNoLimit = false }) {
  const palette = {
    gold:    ['text-gold',    'bg-gold/10    border-gold/25'],
    emerald: ['text-emerald', 'bg-emerald/10 border-emerald/25'],
    sky:     ['text-sky',     'bg-sky/10     border-sky/25'],
    rose:    ['text-rose',    'bg-rose/10    border-rose/25'],
  };
  const [textCls, bgCls] = palette[color] || palette.gold;
  const isNoLimit = zeroIsNoLimit && value === 0;

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-1">
        <span className="text-[10px] font-semibold text-subtle uppercase tracking-wide leading-tight">{label}</span>
        <span className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0
          ${isNoLimit ? 'text-muted/40 bg-surface border-border/20' : `${textCls} ${bgCls}`}`}>
          {isNoLimit ? '∞' : `${value}${unit}`}
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