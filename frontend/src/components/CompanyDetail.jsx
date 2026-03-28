import { useState } from 'react'
import {
  TrendingUp, TrendingDown, DollarSign, BarChart2,
  Scale, Activity, ChevronDown, ChevronUp, Info, Gauge
} from 'lucide-react'
import MetricCard, { SectionHeader } from './MetricCard'
import CandlestickChart from './CandlestickChart'
import { fmt, fmtPct, fmtPrice, fmtRatio, colorClass, signPrefix } from './utils'

// ── Interpretation badge ──────────────────────────────────────────────────────
function Badge({ level, label }) {
  const styles = {
    good:    'bg-emerald/15 text-emerald border-emerald/30',
    warn:    'bg-gold/15 text-gold border-gold/30',
    bad:     'bg-rose/15 text-rose border-rose/30',
    neutral: 'bg-surface text-muted border-border',
  }
  return (
    <span className={`inline-block text-[9px] font-display font-semibold uppercase tracking-wider
                      px-2 py-0.5 rounded-full border ${styles[level] || styles.neutral}`}>
      {label}
    </span>
  )
}

// ── Valuation card with badge + interpretation line ───────────────────────────
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

// ── Badge logic per metric ────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────

export default function CompanyDetail({ data }) {
  const [descOpen, setDescOpen] = useState(false)
  const { symbol, name, sector, industry, description, currency,
          market, revenue, profitability, balance_sheet, cash_flow } = data

  const priceUp = (market.price_change ?? 0) >= 0

  // Pre-compute valuation metrics for easy access
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
      <div className="glass rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
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
            <h1 className="font-display font-bold text-2xl text-text glow-gold">{name}</h1>
            {industry && <p className="text-subtle text-sm mt-0.5">{industry}</p>}
          </div>

          <div className="text-right">
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
          </div>
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

      {/* ── VALORACIÓN (sección nueva destacada) ─────────────── */}
      <div>
        <SectionHeader title="Métricas de Valoración" icon={Gauge} />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">

          {/* 1. P/E */}
          <ValCard
            label="P/E Ratio"
            value={pe ? pe.toFixed(1) + 'x' : '—'}
            color={pe && pe > 0 ? (pe < 25 ? 'text-emerald' : pe < 40 ? 'text-gold' : 'text-rose') : 'text-rose'}
            badge={peBadge(pe)}
            interpret={
              pe && pe > 0
                ? `Pagás $${pe.toFixed(0)} por cada $1 de ganancia anual`
                : pe && pe < 0 ? 'La empresa reportó pérdidas' : undefined
            }
            tooltip="Price / Earnings — Cuánto paga el mercado por cada dólar de ganancia. Muy dependiente del sector."
          />

          {/* 2. ROE */}
          <ValCard
            label="ROE"
            value={fmtPct(roe)}
            color={colorClass(roe)}
            badge={roeBadge(roe)}
            interpret={
              roe
                ? `Por cada $100 de capital propio genera $${Math.abs(roe * 100).toFixed(1)} de ganancia`
                : undefined
            }
            tooltip="Return on Equity — Rentabilidad sobre el patrimonio. >15% generalmente considerado bueno."
          />

          {/* 3. EBITDA + múltiplo */}
          <ValCard
            label="EBITDA"
            value={fmt(ebitda)}
            color={colorClass(ebitda)}
            badge={ebitdaBadge(ebitda, ev)}
            interpret={
              ev && ebitda && ebitda > 0
                ? `EV/EBITDA: ${(ev/ebitda).toFixed(1)}x — el mercado paga ${(ev/ebitda).toFixed(1)} años de EBITDA`
                : ebitda && ebitda < 0 ? 'EBITDA negativo: operación no rentable' : undefined
            }
            tooltip="Earnings Before Interest, Taxes, Depreciation & Amortization. Proxy del flujo operativo."
          />

          {/* 4. Margen Operativo */}
          <ValCard
            label="Margen Operativo"
            value={fmtPct(opMargin)}
            color={colorClass(opMargin)}
            badge={opMarginBadge(opMargin)}
            interpret={
              opMargin
                ? `De cada $100 vendidos, $${Math.abs(opMargin * 100).toFixed(1)} quedan como ganancia operativa`
                : undefined
            }
            tooltip="EBIT / Revenue — Qué porcentaje de los ingresos se convierte en ganancia operativa."
          />

          {/* 5. Deuda / Equity */}
          <ValCard
            label="Deuda / Equity"
            value={de !== null && de !== undefined ? de.toFixed(2) + 'x' : '—'}
            color={de !== null ? (de < 1 ? 'text-emerald' : de < 1.5 ? 'text-gold' : 'text-rose') : 'text-subtle'}
            badge={deBadge(de)}
            interpret={
              de !== null && de !== undefined
                ? de > 1.5
                  ? `Con D/E ${de.toFixed(2)}x la empresa opera con alto apalancamiento — mayor riesgo financiero`
                  : de < 1
                  ? `D/E ${de.toFixed(2)}x: financiamiento principalmente con capital propio`
                  : `D/E ${de.toFixed(2)}x: apalancamiento moderado, evaluar en contexto del sector`
                : undefined
            }
            tooltip="Deuda Total / Patrimonio Neto. >1.5x implica operación con apalancamiento significativo según sector."
          />

          {/* 6. FCF / Market Cap */}
          <ValCard
            label="FCF / Market Cap"
            value={fmtPct(fcfYield)}
            color={fcfYield !== null ? (fcfYield > 0.05 ? 'text-emerald' : fcfYield > 0.02 ? 'text-gold' : 'text-rose') : 'text-subtle'}
            badge={fcfYieldBadge(fcfYield)}
            interpret={
              fcfYield !== null
                ? `La empresa genera ${fmtPct(fcfYield)} de su capitalización en caja libre anualmente`
                : undefined
            }
            tooltip="Free Cash Flow Yield — FCF / Market Cap. Similar al dividend yield pero en caja real. >5% es atractivo."
          />

          {/* 7. FCF Margin */}
          <ValCard
            label="FCF Margin"
            value={fmtPct(fcfMargin)}
            color={colorClass(fcfMargin)}
            badge={fcfMarginBadge(fcfMargin)}
            interpret={
              fcfMargin !== null
                ? `De cada $100 de ingresos, $${Math.abs(fcfMargin * 100).toFixed(1)} se convierten en caja libre`
                : undefined
            }
            tooltip="FCF / Revenue — Qué porcentaje de los ingresos se convierte en Free Cash Flow real."
          />

          {/* 8. FCF / Net Income */}
          <ValCard
            label="FCF / Net Income"
            value={fcfQual !== null ? fcfQual.toFixed(2) + 'x' : '—'}
            color={
              fcfQual !== null
                ? fcfQual >= 0.8 ? 'text-emerald' : fcfQual >= 0.5 ? 'text-gold' : 'text-rose'
                : 'text-subtle'
            }
            badge={fcfQualityBadge(fcfQual)}
            interpret={
              fcfQual !== null
                ? fcfQual >= 0.8
                  ? 'Las ganancias contables se respaldan en efectivo real — bajo riesgo de manipulación'
                  : fcfQual >= 0.5
                  ? 'Divergencia moderada entre FCF y ganancias — monitorear'
                  : 'FCF muy inferior al Net Income — las ganancias podrían estar "maquilladas"'
                : undefined
            }
            tooltip="FCF / Net Income — Cuánto del ingreso neto se materializa como caja real. Cercano a 1x = ganancias de calidad."
          />

        </div>
      </div>

      {/* ── Datos de Mercado ──────────────────────────────────── */}
      <div>
        <SectionHeader title="Datos de Mercado" icon={BarChart2} />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
          <MetricCard label="Market Cap"   value={fmt(market.market_cap)} sub="USD" tooltip="Capitalización bursátil" />
          <MetricCard label="EV"           value={fmt(market.ev)}         sub="Enterprise Value" tooltip="Valor empresa" />
          <MetricCard label="P/E Trailing" value={pe ? pe.toFixed(1)+'x' : '—'} tooltip="Price / Earnings (trailing 12m)" />
          <MetricCard label="P/E Forward"  value={market.forward_pe ? market.forward_pe.toFixed(1)+'x' : '—'} tooltip="P/E forward estimado" />
          <MetricCard label="P/B"          value={market.pb_ratio ? market.pb_ratio.toFixed(2)+'x' : '—'} tooltip="Price / Book Value" />
          <MetricCard label="P/S"          value={market.ps_ratio ? market.ps_ratio.toFixed(2)+'x' : '—'} tooltip="Price / Sales (12m)" />
          <MetricCard label="EV/EBITDA"    value={market.ev_ebitda ? market.ev_ebitda.toFixed(1)+'x' : '—'} tooltip="Enterprise Value / EBITDA" />
          <MetricCard label="Beta"         value={market.beta ? market.beta.toFixed(2) : '—'} tooltip="Volatilidad relativa al mercado" />
          <MetricCard label="Div. Yield"   value={fmtPct(market.dividend_yield)} color={market.dividend_yield ? 'text-emerald' : undefined} tooltip="Rendimiento por dividendo" />
          <MetricCard label="Avg 50d"      value={fmtPrice(market.avg_50d)} sub="Media 50 días" />
        </div>
      </div>

      {/* ── Ingresos ──────────────────────────────────────────── */}
      <div>
        <SectionHeader title="Ingresos" icon={DollarSign} />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          <MetricCard label="Ingresos Totales"      value={fmt(revenue.total)}       sub={currency} tooltip="Últimos resultados anuales (TTM)" />
          <MetricCard label="Ganancia Bruta"        value={fmt(revenue.gross_profit)}
                      sub={`Margen: ${fmtPct(revenue.gross_margin)}`}
                      color="text-emerald" tooltip="Ingresos – Costo de ventas" />
        </div>
      </div>

      {/* ── Rentabilidad ─────────────────────────────────────── */}
      <div>
        <SectionHeader title="Rentabilidad" icon={TrendingUp} />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          <MetricCard label="EBIT"             value={fmt(profitability.ebit)}
                      sub={`Margen: ${fmtPct(profitability.op_margin)}`}
                      color={colorClass(profitability.ebit)}
                      tooltip="Earnings Before Interest & Taxes" />
          <MetricCard label="D&A"              value={fmt(profitability.da)}
                      sub="Deprec. y Amort."
                      tooltip="Depreciación y Amortización (no-cash)" />
          <MetricCard label="EBITDA"           value={fmt(profitability.ebitda)}
                      color={colorClass(profitability.ebitda)}
                      tooltip="EBIT + Depreciación y Amortización" />
          <MetricCard label="Ingreso Neto"     value={fmt(profitability.net_income)}
                      sub={`Margen neto: ${fmtPct(profitability.net_margin)}`}
                      color={colorClass(profitability.net_income)}
                      tooltip="Ganancia final después de impuestos e intereses" />
          <MetricCard label="ROE"              value={fmtPct(profitability.roe)}
                      color={colorClass(profitability.roe)}
                      tooltip="Return on Equity = Ingreso Neto / Patrimonio" />
          <MetricCard label="ROA"              value={fmtPct(profitability.roa)}
                      color={colorClass(profitability.roa)}
                      tooltip="Return on Assets = Ingreso Neto / Activos Totales" />
          <MetricCard label="Margen Bruto"     value={fmtPct(revenue.gross_margin)}
                      color={colorClass(revenue.gross_margin)} />
          <MetricCard label="Margen Operativo" value={fmtPct(profitability.op_margin)}
                      color={colorClass(profitability.op_margin)} />
        </div>
      </div>

      {/* ── Balance ──────────────────────────────────────────── */}
      <div>
        <SectionHeader title="Balance" icon={Scale} />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          <MetricCard label="Activos Totales" value={fmt(balance_sheet.total_assets)} />
          <MetricCard label="Pasivos Totales" value={fmt(balance_sheet.total_liab)} />
          <MetricCard label="Patrimonio Neto" value={fmt(balance_sheet.equity)}
                      color="text-sky" tooltip="Equity = Activos – Pasivos" />
          <MetricCard label="Deuda Total"     value={fmt(balance_sheet.total_debt)}
                      color={balance_sheet.total_debt > 0 ? 'text-rose' : 'text-emerald'}
                      tooltip="Deuda financiera total (corto + largo plazo)" />
          <MetricCard label="Deuda Neta"      value={fmt(balance_sheet.net_debt)}
                      color={colorClass(balance_sheet.net_debt ? -balance_sheet.net_debt : null)}
                      tooltip="Deuda Total − Caja y equivalentes" />
          <MetricCard label="Caja"            value={fmt(balance_sheet.cash)}
                      color="text-emerald" tooltip="Cash y equivalentes de corto plazo" />
          <MetricCard label="Deuda / Equity"  value={fmtRatio(balance_sheet.de_ratio)}
                      color={balance_sheet.de_ratio > 1.5 ? 'text-rose' : balance_sheet.de_ratio > 1 ? 'text-gold' : 'text-emerald'}
                      tooltip="Leverage: Deuda Total / Patrimonio" />
        </div>
      </div>

      {/* ── Flujo de Caja ────────────────────────────────────── */}
      <div>
        <SectionHeader title="Flujo de Caja" icon={Activity} />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          <MetricCard label="FCF Operativo"  value={fmt(cash_flow.operating)}
                      color={colorClass(cash_flow.operating)}
                      tooltip="Cash generado por la operación principal" />
          <MetricCard label="CapEx"          value={fmt(cash_flow.capex)}
                      sub="Gastos de capital"
                      tooltip="Inversiones en activos fijos (usualmente negativo)" />
          <MetricCard label="Free Cash Flow" value={fmt(cash_flow.fcf)}
                      color={colorClass(cash_flow.fcf)}
                      sub={`FCF Yield: ${fmtPct(cash_flow.fcf_yield)}`}
                      tooltip="FCF = Flujo operativo − CapEx" />
          <MetricCard label="FCF Margin"     value={fmtPct(cash_flow.fcf_margin)}
                      color={colorClass(cash_flow.fcf_margin)}
                      sub="FCF / Ingresos"
                      tooltip="Qué porcentaje de los ingresos se convierte en Free Cash Flow" />
          <MetricCard label="FCF / Net Income" value={cash_flow.fcf_quality !== null ? cash_flow.fcf_quality?.toFixed(2)+'x' : '—'}
                      color={cash_flow.fcf_quality >= 0.8 ? 'text-emerald' : cash_flow.fcf_quality >= 0.5 ? 'text-gold' : 'text-rose'}
                      sub="Calidad de ganancias"
                      tooltip="FCF / Net Income — cercano a 1x indica que las ganancias se respaldan en caja real" />
        </div>
      </div>

      {/* ── Gráfico ──────────────────────────────────────────── */}
      <CandlestickChart ticker={symbol} />

    </div>
  )
}