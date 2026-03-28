import { X, Plus, Loader2, AlertCircle } from 'lucide-react'
import SearchBar from './SearchBar'
import { fmt, fmtPct, fmtPrice, fmtRatio, colorClass } from './utils'

const METRICS = [
  { key: 'market.price',              label: 'Precio',               fmt: v => fmtPrice(v) },
  { key: 'market.market_cap',         label: 'Market Cap',           fmt: v => fmt(v) },
  { key: 'market.ev',                 label: 'Enterprise Value',      fmt: v => fmt(v) },
  { key: 'market.pe_ratio',           label: 'P/E (trailing)',        fmt: v => v ? v.toFixed(1)+'x' : '—', color: true },
  { key: 'market.forward_pe',         label: 'P/E (forward)',         fmt: v => v ? v.toFixed(1)+'x' : '—' },
  { key: 'market.pb_ratio',           label: 'P/B',                  fmt: v => v ? v.toFixed(2)+'x' : '—' },
  { key: 'market.ev_ebitda',          label: 'EV/EBITDA',            fmt: v => v ? v.toFixed(1)+'x' : '—' },
  { key: 'market.beta',               label: 'Beta',                 fmt: v => v ? v.toFixed(2) : '—' },
  { key: 'market.dividend_yield',     label: 'Div. Yield',           fmt: fmtPct, color: true },
  { sep: true, label: 'INGRESOS' },
  { key: 'revenue.total',             label: 'Ingresos Totales',     fmt: fmt },
  { key: 'revenue.gross_profit',      label: 'Ganancia Bruta',       fmt: fmt },
  { key: 'revenue.gross_margin',      label: 'Margen Bruto',         fmt: fmtPct, color: true },
  { sep: true, label: 'RENTABILIDAD' },
  { key: 'profitability.ebit',        label: 'EBIT',                 fmt: fmt, color: true },
  { key: 'profitability.ebitda',      label: 'EBITDA',               fmt: fmt, color: true },
  { key: 'profitability.net_income',  label: 'Ingreso Neto',         fmt: fmt, color: true },
  { key: 'profitability.op_margin',   label: 'Margen Operativo',     fmt: fmtPct, color: true },
  { key: 'profitability.net_margin',  label: 'Margen Neto',          fmt: fmtPct, color: true },
  { key: 'profitability.roe',         label: 'ROE',                  fmt: fmtPct, color: true },
  { key: 'profitability.roa',         label: 'ROA',                  fmt: fmtPct, color: true },
  { sep: true, label: 'BALANCE' },
  { key: 'balance_sheet.total_assets',label: 'Activos Totales',      fmt: fmt },
  { key: 'balance_sheet.equity',      label: 'Patrimonio Neto',      fmt: fmt },
  { key: 'balance_sheet.total_debt',  label: 'Deuda Total',          fmt: fmt },
  { key: 'balance_sheet.net_debt',    label: 'Deuda Neta',           fmt: fmt },
  { key: 'balance_sheet.cash',        label: 'Caja',                 fmt: fmt, color: true },
  { key: 'balance_sheet.de_ratio',    label: 'Deuda / Equity',       fmt: v => fmtRatio(v) },
  { sep: true, label: 'FLUJO DE CAJA' },
  { key: 'cash_flow.fcf',             label: 'Free Cash Flow',       fmt: fmt, color: true },
  { key: 'cash_flow.fcf_yield',       label: 'FCF / Market Cap',     fmt: fmtPct, color: true },
  { key: 'cash_flow.fcf_margin',      label: 'FCF Margin',           fmt: fmtPct, color: true },
  { key: 'cash_flow.fcf_quality',     label: 'FCF / Net Income',     fmt: v => v !== null && v !== undefined ? v.toFixed(2)+'x' : '—', color: true },
  { key: 'cash_flow.operating',       label: 'Flujo Operativo',      fmt: fmt, color: true },
]

function getVal(obj, path) {
  return path.split('.').reduce((o, k) => o?.[k], obj)
}

export default function ComparisonView({ companies, loadingTickers, errors, onAdd, onRemove }) {
  return (
    <div className="fade-in">
      {/* Search bar to add more */}
      <div className="flex gap-3 mb-6">
        <SearchBar
          onSelect={item => onAdd(item.symbol)}
          placeholder="Agregar empresa para comparar…"
          className="flex-1 max-w-sm"
        />
        <div className="text-xs text-muted self-center">
          {companies.length} / 6 empresas
        </div>
      </div>

      {companies.length === 0 && Object.keys(loadingTickers).length === 0 && (
        <div className="glass rounded-2xl p-16 text-center">
          <p className="text-muted text-sm">Buscá empresas para compararlas aquí</p>
        </div>
      )}

      {(companies.length > 0 || Object.keys(loadingTickers).length > 0) && (
        <div className="overflow-x-auto rounded-2xl glass">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-4 text-xs font-display uppercase tracking-widest text-muted w-44 sticky left-0 bg-card z-10">
                  Métrica
                </th>
                {/* Loading placeholder columns */}
                {Object.keys(loadingTickers).map(t => (
                  <th key={t} className="p-4 min-w-[140px]">
                    <div className="flex flex-col items-center gap-1">
                      <span className="font-mono text-sky text-xs font-semibold">{t}</span>
                      <Loader2 size={14} className="text-gold animate-spin" />
                    </div>
                  </th>
                ))}
                {/* Error columns */}
                {Object.entries(errors).map(([t, err]) => (
                  <th key={t} className="p-4 min-w-[140px]">
                    <div className="flex flex-col items-center gap-1">
                      <span className="font-mono text-rose text-xs font-semibold">{t}</span>
                      <AlertCircle size={14} className="text-rose" />
                    </div>
                  </th>
                ))}
                {companies.map(c => (
                  <th key={c.symbol} className="p-4 min-w-[150px]">
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-sky text-xs font-semibold">{c.symbol}</span>
                        <button
                          onClick={() => onRemove(c.symbol)}
                          className="text-muted hover:text-rose transition-colors ml-1"
                        >
                          <X size={12} />
                        </button>
                      </div>
                      <span className="text-[10px] text-subtle text-center leading-tight max-w-[120px] truncate">
                        {c.name}
                      </span>
                      <span className={`font-mono text-sm font-semibold ${
                        c.market.price_change >= 0 ? 'text-emerald' : 'text-rose'
                      }`}>
                        {c.market.price ? `$${c.market.price.toFixed(2)}` : '—'}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {METRICS.map((m, i) => {
                if (m.sep) return (
                  <tr key={`sep-${i}`} className="bg-surface/60">
                    <td colSpan={99} className="px-4 py-1.5">
                      <span className="text-[9px] font-display font-semibold uppercase tracking-[3px] text-gold/60">
                        {m.label}
                      </span>
                    </td>
                  </tr>
                )

                const values = companies.map(c => getVal(c, m.key))
                // Highlight best value
                const numVals = values.map(v => typeof v === 'number' ? v : null)
                const maxVal  = Math.max(...numVals.filter(v => v !== null))
                const minVal  = Math.min(...numVals.filter(v => v !== null))

                return (
                  <tr key={m.key} className="border-b border-border/30 hover:bg-surface/40 transition-colors">
                    <td className="p-4 text-muted text-xs font-body sticky left-0 bg-card/95 z-10">{m.label}</td>
                    {/* Loading cells */}
                    {Object.keys(loadingTickers).map(t => (
                      <td key={t} className="p-4 text-center">
                        <div className="shimmer h-4 w-16 mx-auto" />
                      </td>
                    ))}
                    {/* Error cells */}
                    {Object.keys(errors).map(t => (
                      <td key={t} className="p-4 text-center text-rose text-xs">—</td>
                    ))}
                    {companies.map((c, ci) => {
                      const raw = values[ci]
                      const formatted = m.fmt(raw)
                      const isMax = numVals[ci] !== null && numVals[ci] === maxVal && numVals.filter(v => v !== null).length > 1
                      const isMin = numVals[ci] !== null && numVals[ci] === minVal && numVals.filter(v => v !== null).length > 1

                      let cls = 'text-subtle'
                      if (m.color && raw !== null && raw !== undefined) cls = colorClass(raw)

                      return (
                        <td key={c.symbol} className="p-4 text-center">
                          <span className={`font-mono text-xs font-medium ${cls} ${
                            isMax ? 'text-emerald font-semibold' : ''
                          } ${isMin && m.color ? 'text-rose' : ''}`}>
                            {formatted}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}