import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Calculator, Loader2, AlertCircle, Search, Settings2, FileText, Info, Grid } from 'lucide-react'
import SearchBar from './SearchBar'
import { API_URL, fmtPrice, fmt, fmtPct } from './utils'

// ── Componente Popover Corregido (Anti-Bugs) ─────────────────────────────────
function PopoverInfo({ title, content }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative inline-block ml-2">
      <button 
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen(!open)
        }} 
        className="text-muted hover:text-gold transition-colors p-0.5 rounded-full bg-surface focus:outline-none"
      >
        <Info size={14} />
      </button>
      
      {open && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setOpen(false)
            }}
          />
          <div 
            className="absolute z-50 bottom-full mb-2 w-64 -left-28 sm:left-1/2 sm:-translate-x-1/2 bg-card border border-gold/30 p-4 rounded-xl shadow-2xl text-xs text-subtle text-left font-body fade-in cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <strong className="block text-text font-display mb-1.5 text-sm">{title}</strong>
            <div className="space-y-2">{content}</div>
          </div>
        </>
      )}
    </div>
  )
}

export default function DCFView() {
  const { ticker } = useParams()
  const navigate = useNavigate()
  
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Inputs del usuario (Supuestos)
  const [growthRate, setGrowthRate] = useState('')
  const [terminalGrowth, setTerminalGrowth] = useState('2.5')
  const [discountRate, setDiscountRate] = useState('10')

  // Estado del resultado calculado
  const [result, setResult] = useState(null)

  const loadCompany = useCallback(async (symbol) => {
    setLoading(true)
    setError(null)
    setData(null)
    setResult(null)
    setGrowthRate('') 
    try {
      const res = await fetch(`${API_URL}/company/${symbol}`)
      if (!res.ok) throw new Error('Error al conectar con el servidor')
      const fetchedData = await res.json()
      setData(fetchedData)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (ticker) loadCompany(ticker)
  }, [ticker, loadCompany])

  useEffect(() => {
    if (!ticker) {
      setData(null)
      setResult(null)
      setGrowthRate('')
    }
  }, [ticker])

  // ── Función Pura del DCF (Reutilizable para la tabla) ──
  const calculateDCF = (fcf, netDebt, shares, g, tg, r) => {
    if (r <= tg) return null // Error matemático: WACC debe ser mayor a TG

    let pvSum = 0
    let currentFcf = fcf
    let projectedFlows = []

    for (let i = 1; i <= 5; i++) {
      currentFcf *= (1 + g)
      const discounted = currentFcf / Math.pow(1 + r, i)
      pvSum += discounted
      projectedFlows.push({ year: i, fcf: currentFcf, discounted: discounted })
    }

    const terminalValue = (projectedFlows[4].fcf * (1 + tg)) / (r - tg)
    const discountedTv = terminalValue / Math.pow(1 + r, 5)

    const enterpriseValue = pvSum + discountedTv
    const equityValue = enterpriseValue - netDebt
    const intrinsicValue = Math.max(0, equityValue / shares)

    return { projectedFlows, pvSum, terminalValue, discountedTv, enterpriseValue, equityValue, intrinsicValue }
  }

  const handleCalculate = () => {
    if (!data) return

    const fcf = data.cash_flow?.fcf
    const netDebt = data.balance_sheet?.net_debt || 0
    const shares = data.market?.shares_outstanding
    const currentPrice = data.market?.price

    const g = parseFloat(growthRate) / 100
    const tg = parseFloat(terminalGrowth) / 100
    const r = parseFloat(discountRate) / 100

    if (isNaN(g) || isNaN(tg) || isNaN(r)) {
      alert("Por favor, ingresá valores numéricos válidos en todas las tasas.")
      return
    }

    if (r <= tg) {
      alert("Error Matemático: La Tasa de Descuento (WACC) debe ser estrictamente mayor a la Tasa de Crecimiento Terminal.")
      return
    }

    // 1. Cálculo del Escenario Base
    const baseCalc = calculateDCF(fcf, netDebt, shares, g, tg, r)
    const marginOfSafety = baseCalc.intrinsicValue > 0 ? ((baseCalc.intrinsicValue - currentPrice) / currentPrice) * 100 : 0

    // 2. Cálculo de la Matriz de Sensibilidad (Crecimiento vs WACC)
    const waccSteps = [-0.02, -0.01, 0, 0.01, 0.02]   // -2%, -1%, Base, +1%, +2%
    const growthSteps = [-0.02, -0.01, 0, 0.01, 0.02] // -2%, -1%, Base, +1%, +2%

    const sensitivityMatrix = waccSteps.map(wDelta => {
      const testWacc = r + wDelta
      return {
        wacc: testWacc,
        row: growthSteps.map(gDelta => {
          const testG = g + gDelta
          const calc = calculateDCF(fcf, netDebt, shares, testG, tg, testWacc)
          return {
            g: testG,
            val: calc ? calc.intrinsicValue : null
          }
        })
      }
    })

    setResult({
      ...baseCalc,
      marginOfSafety,
      currentPrice,
      sensitivityMatrix,
      baseG: g,
      baseR: r
    })
  }

  const renderContent = () => {
    if (!data) return null

    const fcf = data.cash_flow?.fcf
    const netDebt = data.balance_sheet?.net_debt
    const shares = data.market?.shares_outstanding
    
    const fcfCagr = data.cash_flow?.fcf_cagr
    const niCagr = data.profitability?.ni_cagr

    if (!fcf || fcf <= 0 || !shares) {
      return (
        <div className="glass rounded-2xl p-8 text-center mt-8 border border-border/50 fade-in">
          <AlertCircle size={32} className="text-gold/60 mx-auto mb-4" />
          <h3 className="font-display font-semibold text-text mb-2">Datos insuficientes para el modelo DCF</h3>
          <p className="text-subtle text-sm max-w-md mx-auto">
            La empresa no reporta Flujo Libre de Caja positivo o faltan datos de acciones. Un modelo DCF profesional no se puede aplicar a empresas en fase de quema de efectivo.
          </p>
        </div>
      )
    }

    return (
      <div className="mt-8 space-y-6 fade-in">
        
        {/* Cabecera de la Empresa */}
        <div className="flex items-center gap-4">
          <div>
            <span className="font-mono text-sky text-sm font-semibold tracking-widest uppercase">{data.symbol}</span>
            <h2 className="font-display font-bold text-3xl text-text glow-gold">{data.name}</h2>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          
          {/* PANEL 1: Datos Base (Pasado inmutable) */}
          <div className="glass rounded-2xl p-6 border border-border/50">
            <h3 className="flex items-center gap-2 text-sm font-display uppercase tracking-widest text-muted mb-6">
              <FileText size={16} /> 1. Datos del Balance (TTM)
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-subtle mb-1">Free Cash Flow Inicial (Base)</p>
                <p className="font-mono text-lg text-text">{fmtPrice(fcf)}</p>
              </div>
              <div>
                <p className="text-xs text-subtle mb-1">Deuda Neta Actual</p>
                <p className="font-mono text-lg text-text">{fmtPrice(netDebt)}</p>
              </div>
              <div>
                <p className="text-xs text-subtle mb-1">Acciones en Circulación</p>
                <p className="font-mono text-lg text-text">{fmt(shares)}</p>
              </div>
            </div>
          </div>

          {/* PANEL 2: Tesis del Usuario */}
          <div className="glass rounded-2xl p-6 border border-gold/30 lg:col-span-2 shadow-lg">
            <h3 className="flex items-center gap-2 text-sm font-display uppercase tracking-widest text-gold mb-6">
              <Settings2 size={16} /> 2. Premisas del Analista
            </h3>
            <div className="grid sm:grid-cols-3 gap-6">
              
              {/* Input: Crecimiento */}
              <div>
                <label className="block text-xs text-subtle mb-2">Crecimiento FCF (Años 1-5)</label>
                <div className="relative">
                  <input type="number" value={growthRate} onChange={e => setGrowthRate(e.target.value)} placeholder="Ej: 12" className="w-full bg-surface border border-border rounded-lg py-2 pl-3 pr-8 text-text font-mono text-sm focus:outline-none focus:border-gold/50 transition-colors" />
                  <span className="absolute right-3 top-2 text-muted text-sm">%</span>
                </div>
                <p className="text-[10px] text-muted mt-2 border-t border-border/50 pt-1.5 leading-tight">
                  Promedio anual histórico:<br/>
                  {fcfCagr !== null && fcfCagr !== undefined ? (
                    <><span className="text-emerald font-mono font-medium">{fmtPct(fcfCagr)}</span> en Flujo de Caja Libre (FCF)</>
                  ) : (niCagr !== null && niCagr !== undefined ? (
                    <><span className="text-sky font-mono font-medium">{fmtPct(niCagr)}</span> en Beneficio Neto (Proxy del FCF)</>
                  ) : (
                    <span className="text-subtle">No hay datos históricos suficientes</span>
                  ))}
                </p>
              </div>

              {/* Input: Tasa Terminal */}
              <div>
                <div className="flex items-center mb-2">
                  <label className="block text-xs text-subtle">Tasa Terminal</label>
                  <PopoverInfo 
                    title="Tasa de Crecimiento a Perpetuidad" 
                    content={
                      <>
                        <p>Es el ritmo al que la empresa crecerá <strong>para siempre</strong> después del año 5.</p>
                        <p className="mt-2 text-gold"><strong>Estándar: 2% a 3%</strong></p>
                        <p className="mt-1">Regla de oro: Ninguna empresa puede crecer a perpetuidad más rápido que la inflación mundial o el PBI global.</p>
                      </>
                    } 
                  />
                </div>
                <div className="relative">
                  <input type="number" value={terminalGrowth} onChange={e => setTerminalGrowth(e.target.value)} placeholder="2.5" className="w-full bg-surface border border-border rounded-lg py-2 pl-3 pr-8 text-text font-mono text-sm focus:outline-none focus:border-gold/50 transition-colors" />
                  <span className="absolute right-3 top-2 text-muted text-sm">%</span>
                </div>
              </div>

              {/* Input: WACC */}
              <div>
                <div className="flex items-center mb-2">
                  <label className="block text-xs text-subtle">Tasa de Descuento (WACC)</label>
                  <PopoverInfo 
                    title="Costo Promedio Ponderado del Capital (WACC)" 
                    content={
                      <>
                        <p>Es el rendimiento <strong>mínimo</strong> que le exigís a la inversión para asumir el riesgo de comprar estas acciones.</p>
                        <p className="mt-2 text-gold"><strong>Estándar: 8% a 12%</strong></p>
                        <p className="mt-1">Usá un 8-9% para empresas ultra estables y un 10-12% para tecnológicas o empresas con deuda alta y mucho riesgo.</p>
                      </>
                    } 
                  />
                </div>
                <div className="relative">
                  <input type="number" value={discountRate} onChange={e => setDiscountRate(e.target.value)} placeholder="10" className="w-full bg-surface border border-border rounded-lg py-2 pl-3 pr-8 text-text font-mono text-sm focus:outline-none focus:border-gold/50 transition-colors" />
                  <span className="absolute right-3 top-2 text-muted text-sm">%</span>
                </div>
              </div>

            </div>
            
            <button onClick={handleCalculate} disabled={!growthRate || !terminalGrowth || !discountRate} className="w-full mt-6 bg-gold hover:bg-gold/80 text-bg font-display font-bold py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md">
              Correr Modelo DCF
            </button>
          </div>
        </div>

        {/* PANEL 3: Resultados y Sensibilidad */}
        {result && (
          <div className="glass rounded-2xl p-8 border border-emerald/20 mt-8 fade-in bg-surface/30">
            <h3 className="font-display text-xl text-text font-bold mb-6 text-center">Resultados de la Valuación</h3>
            
            <div className="grid md:grid-cols-2 gap-12 mb-12">
              {/* Desglose Matemático */}
              <div>
                <h4 className="text-xs uppercase tracking-widest text-muted mb-4 font-mono">1. Proyección de Flujos</h4>
                <div className="space-y-2 mb-6">
                  {result.projectedFlows.map(f => (
                    <div key={f.year} className="flex justify-between text-sm font-mono border-b border-border/50 pb-1">
                      <span className="text-subtle">Año {f.year}</span>
                      <div className="text-right">
                        <span className="text-text mr-4">{fmtPrice(f.fcf)}</span>
                        <span className="text-emerald/70 text-xs">PV: {fmtPrice(f.discounted)}</span>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-mono font-bold pt-2">
                    <span className="text-text">Suma PV Flujos (1-5)</span>
                    <span className="text-emerald">{fmtPrice(result.pvSum)}</span>
                  </div>
                </div>

                <h4 className="text-xs uppercase tracking-widest text-muted mb-4 font-mono">2. De la Empresa a la Acción</h4>
                <div className="space-y-2 text-sm font-mono">
                  <div className="flex justify-between">
                    <span className="text-subtle">Suma PV Flujos (1-5)</span>
                    <span className="text-text">{fmtPrice(result.pvSum)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-subtle">+ Valor Terminal (PV)</span>
                    <span className="text-text">{fmtPrice(result.discountedTv)}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t border-border/50 pt-1">
                    <span className="text-text">Enterprise Value</span>
                    <span className="text-sky">{fmtPrice(result.enterpriseValue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-subtle">- Deuda Neta</span>
                    <span className="text-text">{fmtPrice(netDebt)}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t border-border/50 pt-1">
                    <span className="text-text">Equity Value</span>
                    <span className="text-gold">{fmtPrice(result.equityValue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-subtle">/ Acciones en Circ.</span>
                    <span className="text-text">{fmt(shares)}</span>
                  </div>
                </div>
              </div>

              {/* Resultado Final Destacado */}
              <div className="flex flex-col items-center justify-center bg-bg/80 rounded-2xl p-8 border border-border shadow-2xl relative overflow-hidden">
                <span className="text-sm text-muted uppercase tracking-widest font-display mb-2 z-10">Escenario Base: Valor Intrínseco</span>
                <div className="text-6xl font-mono font-bold text-text mb-4 z-10 drop-shadow-lg">
                  {fmtPrice(result.intrinsicValue)}
                </div>
                
                <div className="w-full border-t border-border/50 my-4 z-10"></div>
                
                <div className="flex w-full justify-between items-center z-10">
                  <span className="text-sm text-subtle">Cotización Actual de Mercado</span>
                  <span className="text-lg font-mono font-bold text-text">{fmtPrice(result.currentPrice)}</span>
                </div>
                
                <div className="flex w-full justify-between items-center mt-3 z-10">
                  <span className="text-sm text-subtle">Margen de Seguridad</span>
                  <span className={`text-base font-semibold px-3 py-1 rounded-md shadow-sm ${result.marginOfSafety > 0 ? 'bg-emerald/20 text-emerald border border-emerald/30' : 'bg-rose/20 text-rose border border-rose/30'}`}>
                    {result.marginOfSafety > 0 ? '+' : ''}{result.marginOfSafety.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>

            {/* TABLA DE SENSIBILIDAD (MAPA DE CALOR) */}
            <div className="border-t border-border/50 pt-8">
              <div className="flex items-center gap-2 mb-4 justify-center">
                <Grid size={18} className="text-gold" />
                <h3 className="font-display text-lg text-text font-bold">Análisis de Sensibilidad</h3>
              </div>
              <p className="text-xs text-subtle text-center mb-6 max-w-lg mx-auto">
                ¿Qué pasaría con el valor de la acción si tus proyecciones fallan por un 1% o 2%? 
                Esta matriz muestra el Precio Justo para diferentes escenarios.
              </p>

              <div className="overflow-x-auto pb-4">
                <table className="w-full max-w-2xl mx-auto border-collapse">
                  <thead>
                    <tr>
                      <th className="p-2 border border-border/50 bg-bg/50 text-xs text-muted font-display uppercase tracking-widest w-24">
                        WACC ↓ <br/> Crec. →
                      </th>
                      {result.sensitivityMatrix[0].row.map((col, idx) => (
                        <th key={idx} className={`p-2 border border-border/50 font-mono text-sm ${col.g === result.baseG ? 'bg-gold/10 text-gold font-bold' : 'bg-bg/50 text-subtle'}`}>
                          {fmtPct(col.g)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.sensitivityMatrix.map((rowItem, rIdx) => (
                      <tr key={rIdx}>
                        <th className={`p-2 border border-border/50 font-mono text-sm text-right pr-4 ${rowItem.wacc === result.baseR ? 'bg-gold/10 text-gold font-bold' : 'bg-bg/50 text-subtle'}`}>
                          {fmtPct(rowItem.wacc)}
                        </th>
                        {rowItem.row.map((cell, cIdx) => {
                          if (cell.val === null) {
                            return <td key={cIdx} className="p-2 border border-border/50 text-center text-xs text-muted font-mono bg-surface">N/A</td>
                          }
                          
                          // Lógica del mapa de calor
                          const isBase = rowItem.wacc === result.baseR && cell.g === result.baseG
                          const margin = ((cell.val - result.currentPrice) / result.currentPrice)
                          let cellClass = "bg-surface text-text" // Neutral
                          
                          if (margin > 0.15) cellClass = "bg-emerald-900/40 text-emerald-400 font-medium"
                          else if (margin > 0) cellClass = "bg-emerald-900/20 text-emerald-500"
                          else if (margin < -0.15) cellClass = "bg-rose-900/40 text-rose-400 font-medium"
                          else if (margin < 0) cellClass = "bg-rose-900/20 text-rose-500"

                          if (isBase) cellClass += " border-2 border-gold ring-1 ring-inset ring-gold/50 font-bold"

                          return (
                            <td key={cIdx} className={`p-2 border border-border/50 text-center font-mono text-sm transition-colors hover:opacity-80 ${cellClass}`}>
                              {fmtPrice(cell.val)}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="flex justify-center gap-6 mt-4 text-[10px] text-muted font-mono uppercase tracking-wider">
                <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-emerald-900/40 border border-emerald-500/50"></div> Subvaluada</span>
                <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-rose-900/40 border border-rose-500/50"></div> Sobrevaluada</span>
                <span className="flex items-center gap-1.5"><div className="w-3 h-3 border-2 border-gold rounded-sm"></div> Tu Escenario</span>
              </div>
            </div>
            
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="fade-in max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-text flex items-center gap-2">
            <Calculator className="text-gold" />
            Laboratorio DCF
          </h1>
          <p className="text-subtle text-sm mt-1">Valuación por Flujos de Caja Descontados y Sensibilidad.</p>
        </div>
        <SearchBar 
          onSelect={item => navigate(`/dcf/${item.symbol}`)} 
          placeholder="Buscar empresa para valuar..." 
          className="w-full md:w-80" 
        />
      </div>

      {!ticker && !loading && !data && (
        <div className="glass rounded-2xl p-16 text-center mt-8 border border-border/50 border-dashed">
          <Search size={48} className="text-muted/50 mx-auto mb-4" />
          <p className="text-subtle max-w-sm mx-auto">Buscá una empresa para traer sus estados financieros y comenzar a armar tu propio modelo de valuación.</p>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <Loader2 size={32} className="text-gold animate-spin" />
          <p className="text-subtle text-sm">Extrayendo datos de balances...</p>
        </div>
      )}

      {error && !loading && (
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <div className="flex items-center gap-2 text-rose bg-rose/10 px-4 py-2 rounded-lg">
            <AlertCircle size={20} />
            <p className="font-body">{error}</p>
          </div>
        </div>
      )}

      {renderContent()}
    </div>
  )
}