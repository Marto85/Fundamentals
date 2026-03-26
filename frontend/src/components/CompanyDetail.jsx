import { useState } from 'react'
import {
  TrendingUp, TrendingDown, Building2, Globe, Users,
  DollarSign, BarChart2, Scale, Activity, ArrowUpRight,
  ChevronDown, ChevronUp, Info
} from 'lucide-react'
import MetricCard, { SectionHeader } from './MetricCard'
import CandlestickChart from './CandlestickChart'
import { fmt, fmtPct, fmtPrice, fmtRatio, colorClass, signPrefix } from './utils'

export default function CompanyDetail({ data }) {
  const [descOpen, setDescOpen] = useState(false)
  const { symbol, name, sector, industry, description, currency,
          market, revenue, profitability, balance_sheet, cash_flow } = data

  const priceUp = market.price_change >= 0

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

        {/* Description toggle */}
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

      {/* ── Market Data ──────────────────────────────────────── */}
      <div>
        <SectionHeader title="Datos de Mercado" icon={BarChart2} />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
          <MetricCard label="Market Cap"  value={fmt(market.market_cap)} sub="USD" tooltip="Capitalización bursátil" />
          <MetricCard label="EV"          value={fmt(market.ev)}         sub="Enterprise Value" tooltip="Valor empresa" />
          <MetricCard label="P/E Trailing" value={market.pe_ratio    ? market.pe_ratio.toFixed(1)+'x'    : '—'} tooltip="Price / Earnings (trailing 12m)" />
          <MetricCard label="P/E Forward"  value={market.forward_pe  ? market.forward_pe.toFixed(1)+'x'  : '—'} tooltip="P/E forward estimado" />
          <MetricCard label="P/B"          value={market.pb_ratio    ? market.pb_ratio.toFixed(2)+'x'    : '—'} tooltip="Price / Book Value" />
          <MetricCard label="P/S"          value={market.ps_ratio    ? market.ps_ratio.toFixed(2)+'x'    : '—'} tooltip="Price / Sales (12m)" />
          <MetricCard label="EV/EBITDA"    value={market.ev_ebitda   ? market.ev_ebitda.toFixed(1)+'x'   : '—'} tooltip="Enterprise Value / EBITDA" />
          <MetricCard label="Beta"         value={market.beta        ? market.beta.toFixed(2)            : '—'} tooltip="Volatilidad relativa al mercado" />
          <MetricCard label="Div. Yield"   value={fmtPct(market.dividend_yield)} color={market.dividend_yield ? 'text-emerald' : undefined} tooltip="Rendimiento por dividendo" />
          <MetricCard label="Avg 50d"      value={fmtPrice(market.avg_50d)}  sub="Media 50 días" />
        </div>
      </div>

      {/* ── Revenue ──────────────────────────────────────────── */}
      <div>
        <SectionHeader title="Ingresos" icon={DollarSign} />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          <MetricCard label="Ingresos Totales"   value={fmt(revenue.total)}       sub={currency} tooltip="Últimos resultados anuales" />
          <MetricCard label="Ingresos Recurrentes" value={fmt(revenue.recurring)}  sub="Ingresos operativos"
                      color="text-sky" tooltip="Ingresos provenientes de la operación principal" />
          <MetricCard label="Ingresos Ext. / No Rec." value={fmt(revenue.extraordinary)}
                      color={revenue.extraordinary ? colorClass(revenue.extraordinary) : undefined}
                      sub="Otros ingresos / gastos" tooltip="Partidas no operativas, extraordinarias o financieras" />
          <MetricCard label="Ganancia Bruta"     value={fmt(revenue.gross_profit)} sub={`Margen: ${fmtPct(revenue.gross_margin)}`}
                      color="text-emerald" tooltip="Ingresos – Costo de ventas" />
        </div>
      </div>

      {/* ── Rentabilidad ─────────────────────────────────────── */}
      <div>
        <SectionHeader title="Rentabilidad" icon={TrendingUp} />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          <MetricCard label="EBIT"           value={fmt(profitability.ebit)}
                      sub={`Margen: ${fmtPct(profitability.op_margin)}`}
                      color={colorClass(profitability.ebit)}
                      tooltip="Earnings Before Interest & Taxes (= Ingreso Operativo)" />
          <MetricCard label="D&A"            value={fmt(profitability.da)}
                      sub="Deprec. y Amort."
                      tooltip="Depreciación y Amortización (no-cash)" />
          <MetricCard label="EBITDA"         value={fmt(profitability.ebitda)}
                      color={colorClass(profitability.ebitda)}
                      tooltip="EBIT + Depreciación y Amortización" />
          <MetricCard label="Ingreso Neto"   value={fmt(profitability.net_income)}
                      sub={`Margen neto: ${fmtPct(profitability.net_margin)}`}
                      color={colorClass(profitability.net_income)}
                      tooltip="Ganancia final después de impuestos e intereses" />
          <MetricCard label="ROE"            value={fmtPct(profitability.roe)}
                      color={colorClass(profitability.roe)}
                      tooltip="Return on Equity = Ingreso Neto / Patrimonio" />
          <MetricCard label="ROA"            value={fmtPct(profitability.roa)}
                      color={colorClass(profitability.roa)}
                      tooltip="Return on Assets = Ingreso Neto / Activos Totales" />
          <MetricCard label="Margen Bruto"   value={fmtPct(revenue.gross_margin)}
                      color={colorClass(revenue.gross_margin)} />
          <MetricCard label="Margen Operativo" value={fmtPct(profitability.op_margin)}
                      color={colorClass(profitability.op_margin)} />
        </div>
      </div>

      {/* ── Balance ──────────────────────────────────────────── */}
      <div>
        <SectionHeader title="Balance" icon={Scale} />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          <MetricCard label="Activos Totales"  value={fmt(balance_sheet.total_assets)} />
          <MetricCard label="Pasivos Totales"  value={fmt(balance_sheet.total_liab)} />
          <MetricCard label="Patrimonio Neto"  value={fmt(balance_sheet.equity)}
                      color="text-sky" tooltip="Equity = Activos – Pasivos" />
          <MetricCard label="Deuda Total"      value={fmt(balance_sheet.total_debt)}
                      color={balance_sheet.total_debt > 0 ? 'text-rose' : 'text-emerald'}
                      tooltip="Deuda financiera total (corto + largo plazo)" />
          <MetricCard label="Deuda Neta"       value={fmt(balance_sheet.net_debt)}
                      color={colorClass(balance_sheet.net_debt ? -balance_sheet.net_debt : null)}
                      tooltip="Deuda Total − Caja y equivalentes" />
          <MetricCard label="Caja"             value={fmt(balance_sheet.cash)}
                      color="text-emerald" tooltip="Cash y equivalentes de corto plazo" />
          <MetricCard label="Deuda / Equity"   value={fmtRatio(balance_sheet.de_ratio)}
                      color={balance_sheet.de_ratio > 2 ? 'text-rose' : balance_sheet.de_ratio > 1 ? 'text-gold' : 'text-emerald'}
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
        </div>
      </div>

      {/* ── Chart ────────────────────────────────────────────── */}
      <CandlestickChart ticker={symbol} />

    </div>
  )
}
