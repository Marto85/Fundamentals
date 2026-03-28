import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp, TrendingDown, DollarSign, BarChart2,
  Scale, Activity, ChevronDown, ChevronUp, Info, Gauge, Calculator, ActivitySquare, CheckCircle2
} from 'lucide-react'
import MetricCard, { SectionHeader } from './MetricCard'
import CandlestickChart from './CandlestickChart'
import CompanyLogo from './CompanyLogo'
import { fmt, fmtPct, fmtPrice, fmtRatio, colorClass, signPrefix, formatBigNumber } from './utils'

function Badge({ level, label }) {
  const styles = {
    good:    'bg-emerald/15 text-emerald border-emerald/30',
    warn:    'bg-gold/15 text-gold border-gold/30',
    bad:     'bg-rose/15 text-rose border-rose/30',
    neutral: 'bg-surface text-muted border-border',
  }
  return (
    <span className={`inline-block text-[9px] font-display font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${styles[level] || styles.neutral}`}>
      {label}
    </span>
  )
}

function ValCard({ label, value, badge, interpret, color, tooltip }) {
  return (
    <div className="glass rounded-xl p-4 hover:border-gold/20 transition-all cursor-default" title={tooltip}>
      <p className="text-[10px] font-display uppercase tracking-widest text-muted mb-1">{label}</p>
      <p className={`font-mono text-lg font-semibold animate-count mb-1.5 ${color || 'text-text'}`}>{value}</p>
      {badge && <div className="mb-1"><Badge {...badge} /></div>}
      {interpret && <p className="text-[10px] text-muted leading-tight">{interpret}</p>}
    </div>
  )
}

function peBadge(pe) {
  if (pe === null || pe === undefined) return null
  if (pe < 0)   return { level: 'bad',  label: 'Pérdidas' }
  if (pe < 12)  return { level: 'good', label: 'Posib. subvaluada' }
  if (pe < 25)  return { level: 'good', label: 'Valuación razonable' }
  if (pe < 40)  return { level: 'warn', label: 'Prima de crecimiento' }
  return              { level: 'bad',  label: 'Valuación cara' }
}

function roeBadge(roe) {
  if (roe === null || roe === undefined) return null
  const p = roe * 100
  if (p < 0)   return { level: 'bad',  label: 'ROE negativo' }
  if (p < 10)  return { level: 'warn', label: 'Bajo' }
  if (p < 20)  return { level: 'good', label: 'Bueno' }
  return             { level: 'good', label: 'Excelente' }
}

function deBadge(de) {
  if (de === null || de === undefined) return null
  if (de < 0)    return { level: 'warn', label: 'Equity negativo' }
  if (de < 1)    return { level: 'good', label: 'Conservador' }
  if (de < 1.5)  return { level: 'warn', label: 'Moderado' }
  return               { level: 'bad',  label: 'Alto apalancamiento' }
}

function fcfYieldBadge(y) {
  if (y === null || y === undefined) return null
  const p = y * 100
  if (p < 0)  return { level: 'bad',  label: 'FCF negativo' }
  if (p < 2)  return { level: 'bad',  label: 'Yield muy bajo' }
  if (p < 5)  return { level: 'warn', label: 'Yield moderado' }
  return            { level: 'good', label: 'Yield atractivo' }
}

function fcfMarginBadge(m) {
  if (m === null || m === undefined) return null
  const p = m * 100
  if (p < 0)   return { level: 'bad',  label: 'FCF negativo' }
  if (p < 5)   return { level: 'warn', label: 'Margen delgado' }
  if (p < 15)  return { level: 'good', label: 'Margen sólido' }
  return             { level: 'good', label: 'Margen excelente' }
}

function fcfQualityBadge(q) {
  if (q === null || q === undefined) return null
  if (q < 0)    return { level: 'warn', label: 'Señal de alerta' }
  if (q < 0.5)  return { level: 'bad',  label: 'Calidad cuestionable' }
  if (q < 0.8)  return { level: 'warn', label: 'Aceptable' }
  return              { level: 'good', label: 'Ganancias reales' }
}

function opMarginBadge(m) {
  if (m === null || m === undefined) return null
  const p = m * 100
  if (p < 0)   return { level: 'bad',  label: 'Operación con pérdida' }
  if (p < 5)   return { level: 'warn', label: 'Margen delgado' }
  if (p < 15)  return { level: 'warn', label: 'Margen moderado' }
  if (p < 25)  return { level: 'good', label: 'Margen sólido' }
  return             { level: 'good', label: 'Margen excelente' }
}

function ebitdaBadge(ebitda, ev) {
  if (!ebitda || !ev) return null
  const multiple = ev / ebitda
  if (multiple < 0)   return { level: 'warn', label: 'EBITDA negativo' }
  if (multiple < 8)   return { level: 'good', label: 'Valuación baja' }
  if (multiple < 15)  return { level: 'good', label: 'Valuación razonable' }
  if (multiple < 25)  return { level: 'warn', label: 'Valuación alta' }
  return                   { level: 'bad',  label: 'Muy cara vs EBITDA' }
}

export default function CompanyDetail({ data }) {
  const [descOpen, setDescOpen] = useState(false)
  const { symbol, name, sector, industry, description, currency, domain, applied_fx_rate,
          market, revenue, profitability, balance_sheet, cash_flow } = data

  const priceUp = (market.price_change ?? 0) >= 0

  const pe        = market.pe_ratio
  const roe       = profitability.roe
  const ebitda    = profitability.ebitda
  const opMargin  = profitability.op_margin
  const de        = balance_sheet.de_ratio
  const fcfYield  = cash_flow.fcf_yield
  const fcfMargin = cash_flow.fcf_margin
  const fcfQual   = cash_flow.fcf_quality
  const ev        = market.ev

  return (
    <div className="fade-in space-y-5">
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="glass rounded-2xl p-6 mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* LOGO AGREGADO AQUÍ */}
            <CompanyLogo domain={domain} ticker={symbol} size={64} className="shrink-0" />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-sky text-xs font-semibold tracking-widest uppercase">{symbol}</span>
                {market.exchange && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface text-muted border border-border font-mono">
                    {market.exchange}
                  </span>
                )}
                {sector && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-gold/10 text-gold border border-gold/20 font-body">
                    {sector}
                  </span>
                )}
              </div>
              <h1 className="font-display font-bold text-3xl text-text glow-gold">{name}</h1>
              {industry && <p className="text-subtle text-sm mt-0.5">{industry}</p>}
            </div>
          </div>

          <div className="text-right flex flex-col items-end">
            <div className="font-mono text-3xl font-semibold text-text">
              {fmtPrice(market.price)}
            </div>
            <div className={`flex items-center justify-end gap-1 mt-1 font-mono text-sm
              ${priceUp ? 'text-emerald' : 'text-rose'}`}>
              {priceUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              <span>{signPrefix(market.price_change)}{fmtPrice(market.price_change)}</span>
              <span>({signPrefix(market.price_pct)}{fmtPct(market.price_pct)})</span>
            </div>
            {market.high_52w && (
              <p className="text-[11px] text-muted mt-1 font-mono">
                52w: {fmtPrice(market.low_52w)} – {fmtPrice(market.high_52w)}
              </p>
            )}
            
            <div className="flex gap-2 mt-4">
              <Link 
                to={`/dcf/${symbol}`} 
                className="flex items-center gap-2 px-3 py-1.5 bg-surface hover:bg-gold/10 text-muted hover:text-gold border border-border hover:border-gold/30 rounded-lg text-xs font-medium transition-all shadow-sm"
              >
                <Calculator size={14} /> Modelar DCF
              </Link>
              <Link 
                to={`/fscore/${symbol}`} 
                className="flex items-center gap-2 px-3 py-1.5 bg-surface hover:bg-emerald/10 text-muted hover:text-emerald border border-border hover:border-emerald/30 rounded-lg text-xs font-medium transition-all shadow-sm"
              >
                <ActivitySquare size={14} /> F-Score
              </Link>
            </div>

          </div>
        </div>

        {/* MEJORA 1: CARTEL DE ÉXITO DE CONVERSIÓN FX */}
        {applied_fx_rate && (
          <div className="mt-5 bg-emerald/10 border border-emerald/30 rounded-xl p-4 flex items-start gap-3 fade-in">
            <CheckCircle2 className="text-emerald shrink-0 mt-0.5" size={20} />
            <div>
              <h4 className="text-emerald font-display font-bold text-sm">Ajuste de Moneda Automático (ADR)</h4>
              <p className="text-subtle text-xs mt-1 leading-relaxed">
                El sistema detectó que esta empresa reporta balances en moneda local pero cotiza en <strong>{currency}</strong> en este mercado. 
                Se aplicó automáticamente un tipo de cambio en tiempo real de <strong>{applied_fx_rate.toFixed(4)}</strong> a todos los flujos de caja y deuda para asegurar un cálculo DCF y ratios contables precisos y comparables.
              </p>
            </div>
          </div>
        )}

        {/* MEJORA 2: DATOS DE CAPITALIZACIÓN Y ACCIONES */}
        <div className="sep mb-4 mt-5"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <MetricCard label="Market Cap" value={formatBigNumber(market.market_cap)} sub="USD" />
            <MetricCard label="Acciones en Circ." value={formatBigNumber(market.shares_outstanding, '')} />
            <MetricCard label="Cotización USD" value={fmtPrice(market.price)} />
            <MetricCard label="P/E Trailing" value={pe ? pe.toFixed(2) + "x" : "—"} />
        </div>

        {description && (
          <div className="mt-4">
            <div className="sep mb-3" />
            <button
              onClick={() => setDescOpen(o => !o)}
              className="flex items-center gap-1 text-xs text-muted hover:text-subtle transition-colors"
            >
              <Info size={12} /> Descripción de la empresa
              {descOpen ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
            </button>
            {descOpen && (
              <p className="mt-2 text-subtle text-sm leading-relaxed font-body fade-in">
                {description}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── VALORACIÓN ─────────────── */}
      <div>
        <SectionHeader title="Métricas de Valoración" icon={Gauge} />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          <ValCard label="P/E Ratio" value={pe ? pe.toFixed(1) + 'x' : '—'} color={pe && pe > 0 ? (pe < 25 ? 'text-emerald' : pe < 40 ? 'text-gold' : 'text-rose') : 'text-rose'} badge={peBadge(pe)} interpret={pe && pe > 0 ? `Pagás $${pe.toFixed(0)} por cada $1 de ganancia anual` : pe && pe < 0 ? 'La empresa reportó pérdidas' : undefined} tooltip="Price / Earnings" />
          <ValCard label="ROE" value={fmtPct(roe)} color={colorClass(roe)} badge={roeBadge(roe)} interpret={roe ? `Por cada $100 de capital propio genera $${Math.abs(roe * 100).toFixed(1)} de ganancia` : undefined} tooltip="Return on Equity" />
          <ValCard label="EBITDA" value={fmt(ebitda)} color={colorClass(ebitda)} badge={ebitdaBadge(ebitda, ev)} interpret={ev && ebitda && ebitda > 0 ? `EV/EBITDA: ${(ev/ebitda).toFixed(1)}x` : undefined} tooltip="Proxy del flujo operativo" />
          <ValCard label="Margen Operativo" value={fmtPct(opMargin)} color={colorClass(opMargin)} badge={opMarginBadge(opMargin)} interpret={opMargin ? `De cada $100, $${Math.abs(opMargin * 100).toFixed(1)} quedan como ganancia` : undefined} tooltip="EBIT / Revenue" />
          <ValCard label="Deuda / Equity" value={de !== null && de !== undefined ? de.toFixed(2) + 'x' : '—'} color={de !== null ? (de < 1 ? 'text-emerald' : de < 1.5 ? 'text-gold' : 'text-rose') : 'text-subtle'} badge={deBadge(de)} interpret={de !== null && de !== undefined ? de > 1.5 ? 'Alto apalancamiento' : 'Apalancamiento moderado/bajo' : undefined} tooltip="Deuda Total / Patrimonio Neto" />
          <ValCard label="FCF / Market Cap" value={fmtPct(fcfYield)} color={fcfYield !== null ? (fcfYield > 0.05 ? 'text-emerald' : fcfYield > 0.02 ? 'text-gold' : 'text-rose') : 'text-subtle'} badge={fcfYieldBadge(fcfYield)} interpret={fcfYield !== null ? `Genera ${fmtPct(fcfYield)} de su cap. en caja` : undefined} tooltip="Free Cash Flow Yield" />
          <ValCard label="FCF Margin" value={fmtPct(fcfMargin)} color={colorClass(fcfMargin)} badge={fcfMarginBadge(fcfMargin)} interpret={fcfMargin !== null ? `De $100 de ingresos, $${Math.abs(fcfMargin * 100).toFixed(1)} son caja` : undefined} tooltip="FCF / Revenue" />
          <ValCard label="FCF / Net Income" value={fcfQual !== null ? fcfQual.toFixed(2) + 'x' : '—'} color={fcfQual !== null ? fcfQual >= 0.8 ? 'text-emerald' : fcfQual >= 0.5 ? 'text-gold' : 'text-rose' : 'text-subtle'} badge={fcfQualityBadge(fcfQual)} interpret={fcfQual !== null ? fcfQual >= 0.8 ? 'Ganancias en efectivo' : 'Divergencia FCF/Net Income' : undefined} tooltip="Calidad de las ganancias" />
        </div>
      </div>

      {/* ── Resto de las secciones (Mercado, Ingresos, etc) ───────────────── */}
      <div><SectionHeader title="Datos de Mercado" icon={BarChart2} /><div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2"><MetricCard label="Market Cap" value={fmt(market.market_cap)} sub="USD" /><MetricCard label="EV" value={fmt(market.ev)} sub="Enterprise Value" /><MetricCard label="P/E Trailing" value={pe ? pe.toFixed(1)+'x' : '—'} /><MetricCard label="P/E Forward" value={market.forward_pe ? market.forward_pe.toFixed(1)+'x' : '—'} /><MetricCard label="P/B" value={market.pb_ratio ? market.pb_ratio.toFixed(2)+'x' : '—'} /><MetricCard label="P/S" value={market.ps_ratio ? market.ps_ratio.toFixed(2)+'x' : '—'} /><MetricCard label="EV/EBITDA" value={market.ev_ebitda ? market.ev_ebitda.toFixed(1)+'x' : '—'} /><MetricCard label="Beta" value={market.beta ? market.beta.toFixed(2) : '—'} /><MetricCard label="Div. Yield" value={fmtPct(market.dividend_yield)} color={market.dividend_yield ? 'text-emerald' : undefined} /><MetricCard label="Avg 50d" value={fmtPrice(market.avg_50d)} sub="Media 50 días" /></div></div>
      <div><SectionHeader title="Ingresos" icon={DollarSign} /><div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2"><MetricCard label="Ingresos Totales" value={fmt(revenue.total)} sub={currency} /><MetricCard label="Ganancia Bruta" value={fmt(revenue.gross_profit)} sub={`Margen: ${fmtPct(revenue.gross_margin)}`} color="text-emerald" /></div></div>
      <div><SectionHeader title="Rentabilidad" icon={TrendingUp} /><div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2"><MetricCard label="EBIT" value={fmt(profitability.ebit)} sub={`Margen: ${fmtPct(profitability.op_margin)}`} color={colorClass(profitability.ebit)} /><MetricCard label="D&A" value={fmt(profitability.da)} sub="Deprec. y Amort." /><MetricCard label="EBITDA" value={fmt(profitability.ebitda)} color={colorClass(profitability.ebitda)} /><MetricCard label="Ingreso Neto" value={fmt(profitability.net_income)} sub={`Margen neto: ${fmtPct(profitability.net_margin)}`} color={colorClass(profitability.net_income)} /><MetricCard label="ROE" value={fmtPct(profitability.roe)} color={colorClass(profitability.roe)} /><MetricCard label="ROA" value={fmtPct(profitability.roa)} color={colorClass(profitability.roa)} /><MetricCard label="Margen Bruto" value={fmtPct(revenue.gross_margin)} color={colorClass(revenue.gross_margin)} /><MetricCard label="Margen Operativo" value={fmtPct(profitability.op_margin)} color={colorClass(profitability.op_margin)} /></div></div>
      <div><SectionHeader title="Balance" icon={Scale} /><div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2"><MetricCard label="Activos Totales" value={fmt(balance_sheet.total_assets)} /><MetricCard label="Pasivos Totales" value={fmt(balance_sheet.total_liab)} /><MetricCard label="Patrimonio Neto" value={fmt(balance_sheet.equity)} color="text-sky" /><MetricCard label="Deuda Total" value={fmt(balance_sheet.total_debt)} color={balance_sheet.total_debt > 0 ? 'text-rose' : 'text-emerald'} /><MetricCard label="Deuda Neta" value={fmt(balance_sheet.net_debt)} color={colorClass(balance_sheet.net_debt ? -balance_sheet.net_debt : null)} /><MetricCard label="Caja" value={fmt(balance_sheet.cash)} color="text-emerald" /><MetricCard label="Deuda / Equity" value={fmtRatio(balance_sheet.de_ratio)} color={balance_sheet.de_ratio > 1.5 ? 'text-rose' : balance_sheet.de_ratio > 1 ? 'text-gold' : 'text-emerald'} /></div></div>
      <div><SectionHeader title="Flujo de Caja" icon={Activity} /><div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2"><MetricCard label="FCF Operativo" value={fmt(cash_flow.operating)} color={colorClass(cash_flow.operating)} /><MetricCard label="CapEx" value={fmt(cash_flow.capex)} sub="Gastos de capital" /><MetricCard label="Free Cash Flow" value={fmt(cash_flow.fcf)} color={colorClass(cash_flow.fcf)} sub={`FCF Yield: ${fmtPct(cash_flow.fcf_yield)}`} /><MetricCard label="FCF Margin" value={fmtPct(cash_flow.fcf_margin)} color={colorClass(cash_flow.fcf_margin)} sub="FCF / Ingresos" /><MetricCard label="FCF / Net Income" value={cash_flow.fcf_quality !== null ? cash_flow.fcf_quality?.toFixed(2)+'x' : '—'} color={cash_flow.fcf_quality >= 0.8 ? 'text-emerald' : cash_flow.fcf_quality >= 0.5 ? 'text-gold' : 'text-rose'} sub="Calidad de ganancias" /></div></div>
      <CandlestickChart ticker={symbol} />
    </div>
  )
}