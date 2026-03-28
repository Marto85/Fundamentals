import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Calculator, Loader2, AlertCircle, Search, Settings2, FileText } from 'lucide-react'
import SearchBar from './SearchBar'
import { API_URL, fmtPrice, fmt } from './utils'

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
    setResult(null) // Reseteamos el resultado al buscar nueva empresa
    setGrowthRate('') // Obligamos al usuario a pensar su propia tasa
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
    if (ticker) loadCompany(ticker)
  }, [ticker, loadCompany])

  // NUEVO: Si la URL no tiene ticker (ej: /dcf), borramos todo.
  useEffect(() => {
    if (!ticker) {
      setData(null)
      setResult(null)
      setGrowthRate('')
    }
  }, [ticker])

  // Motor de cálculo ejecutado por el usuario
  const handleCalculate = () => {
    if (!data) return

    const fcf = data.cash_flow?.fcf
    const netDebt = data.balance_sheet?.net_debt || 0
    const shares = data.market?.shares_outstanding

    const g = parseFloat(growthRate) / 100
    const tg = parseFloat(terminalGrowth) / 100
    const r = parseFloat(discountRate) / 100

    if (isNaN(g) || isNaN(tg) || isNaN(r)) {
      alert("Por favor, ingresá valores numéricos válidos en todas las tasas.")
      return
    }

    if (r <= tg) {
      alert("Error Matemático: La Tasa de Descuento debe ser estrictamente mayor a la Tasa de Crecimiento Terminal.")
      return
    }

    // 1. Proyección a 5 años
    let projectedFlows = []
    let pvSum = 0
    let currentFcf = fcf

    for (let i = 1; i <= 5; i++) {
      currentFcf *= (1 + g)
      const discounted = currentFcf / Math.pow(1 + r, i)
      pvSum += discounted
      projectedFlows.push({ year: i, fcf: currentFcf, discounted: discounted })
    }

    // 2. Valor Terminal (Modelo Gordon)
    const terminalValue = (projectedFlows[4].fcf * (1 + tg)) / (r - tg)
    const discountedTv = terminalValue / Math.pow(1 + r, 5)

    // 3. Enterprise Value y Equity Value
    const enterpriseValue = pvSum + discountedTv
    const equityValue = enterpriseValue - netDebt
    const intrinsicValue = Math.max(0, equityValue / shares)

    const currentPrice = data.market?.price
    const marginOfSafety = intrinsicValue > 0 ? ((intrinsicValue - currentPrice) / currentPrice) * 100 : 0

    setResult({
      projectedFlows,
      pvSum,
      terminalValue,
      discountedTv,
      enterpriseValue,
      equityValue,
      intrinsicValue,
      marginOfSafety,
      currentPrice
    })
  }

  const renderContent = () => {
    if (!data) return null

    const fcf = data.cash_flow?.fcf
    const netDebt = data.balance_sheet?.net_debt
    const shares = data.market?.shares_outstanding

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
          <div className="glass rounded-2xl p-6 border border-gold/30 lg:col-span-2">
            <h3 className="flex items-center gap-2 text-sm font-display uppercase tracking-widest text-gold mb-6">
              <Settings2 size={16} /> 2. Premisas del Analista
            </h3>
            <div className="grid sm:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs text-subtle mb-2">Crecimiento Est. (Años 1-5)</label>
                <div className="relative">
                  <input type="number" value={growthRate} onChange={e => setGrowthRate(e.target.value)} placeholder="Ej: 12" className="w-full bg-surface border border-border rounded-lg py-2 pl-3 pr-8 text-text font-mono text-sm focus:outline-none focus:border-gold/50 transition-colors" />
                  <span className="absolute right-3 top-2 text-muted text-sm">%</span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-subtle mb-2">Tasa Terminal (Perpetuidad)</label>
                <div className="relative">
                  <input type="number" value={terminalGrowth} onChange={e => setTerminalGrowth(e.target.value)} placeholder="2.5" className="w-full bg-surface border border-border rounded-lg py-2 pl-3 pr-8 text-text font-mono text-sm focus:outline-none focus:border-gold/50 transition-colors" />
                  <span className="absolute right-3 top-2 text-muted text-sm">%</span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-subtle mb-2">Tasa de Descuento (WACC)</label>
                <div className="relative">
                  <input type="number" value={discountRate} onChange={e => setDiscountRate(e.target.value)} placeholder="10" className="w-full bg-surface border border-border rounded-lg py-2 pl-3 pr-8 text-text font-mono text-sm focus:outline-none focus:border-gold/50 transition-colors" />
                  <span className="absolute right-3 top-2 text-muted text-sm">%</span>
                </div>
              </div>
            </div>
            
            <button onClick={handleCalculate} disabled={!growthRate || !terminalGrowth || !discountRate} className="w-full mt-6 bg-gold hover:bg-gold/80 text-bg font-display font-bold py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              Calcular Valor Intrínseco
            </button>
          </div>
        </div>

        {/* PANEL 3: Resultados (Solo visible al calcular) */}
        {result && (
          <div className="glass rounded-2xl p-8 border border-emerald/20 mt-8 fade-in bg-surface/30">
            <h3 className="font-display text-xl text-text font-bold mb-6 text-center">Desglose de Valuación</h3>
            
            <div className="grid md:grid-cols-2 gap-12">
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
                <span className="text-sm text-muted uppercase tracking-widest font-display mb-2 z-10">Valor Intrínseco Estimado</span>
                <div className="text-6xl font-mono font-bold text-text mb-4 z-10">
                  {fmtPrice(result.intrinsicValue)}
                </div>
                
                <div className="w-full border-t border-border/50 my-4 z-10"></div>
                
                <div className="flex w-full justify-between items-center z-10">
                  <span className="text-sm text-subtle">Cotización Actual</span>
                  <span className="text-lg font-mono font-bold text-text">{fmtPrice(result.currentPrice)}</span>
                </div>
                
                <div className="flex w-full justify-between items-center mt-3 z-10">
                  <span className="text-sm text-subtle">Margen de Seguridad</span>
                  <span className={`text-base font-semibold px-3 py-1 rounded-md ${result.marginOfSafety > 0 ? 'bg-emerald/20 text-emerald' : 'bg-rose/20 text-rose'}`}>
                    {result.marginOfSafety > 0 ? '+' : ''}{result.marginOfSafety.toFixed(2)}%
                  </span>
                </div>

                <p className="text-[10px] text-muted text-center mt-6 z-10">
                  Este cálculo representa el valor presente de los flujos de caja futuros asumiendo que tus proyecciones son correctas.
                </p>
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
          <p className="text-subtle text-sm mt-1">Valuación por Flujos de Caja Descontados.</p>
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