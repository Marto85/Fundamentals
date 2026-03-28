import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ActivitySquare, Loader2, AlertCircle, Search, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import SearchBar from './SearchBar'
import { API_URL } from './utils'

function CriterionRow({ title, desc, passed }) {
  return (
    <div className={`flex items-start gap-4 p-4 rounded-xl border ${passed ? 'bg-emerald/5 border-emerald/20' : 'bg-rose/5 border-rose/20'}`}>
      <div className="mt-0.5">
        {passed ? <CheckCircle2 size={20} className="text-emerald" /> : <XCircle size={20} className="text-rose" />}
      </div>
      <div>
        <h4 className={`font-display font-semibold text-sm ${passed ? 'text-emerald' : 'text-rose'}`}>{title}</h4>
        <p className="text-subtle text-xs mt-1">{desc}</p>
      </div>
    </div>
  )
}

export default function FScoreView() {
  const { ticker } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const loadCompany = useCallback(async (symbol) => {
    setLoading(true); setError(null); setData(null)
    try {
      const res = await fetch(`${API_URL}/company/${symbol}`)
      if (!res.ok) throw new Error('Error al conectar con el servidor')
      const fetchedData = await res.json()
      setData(fetchedData)
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }, [])

  useEffect(() => { if (ticker) loadCompany(ticker) }, [ticker, loadCompany])
  useEffect(() => { if (!ticker) setData(null) }, [ticker])

  const renderContent = () => {
    if (!data) return null

    const pio = data.piotroski
    const isFallback = pio.is_fallback
    const { score, criteria: c } = pio
    const maxScore = isFallback ? 5 : 9

    let statusColor, statusText, statusDesc
    
    // Logica de colores adaptable (sobre 5 o sobre 9)
    const ratio = score / maxScore
    if (ratio >= 0.8) {
      statusColor = 'text-emerald'
      statusText = 'Excelente'
      statusDesc = 'Empresa con fundamentos sólidos y bajo riesgo financiero a corto plazo.'
    } else if (ratio >= 0.5) {
      statusColor = 'text-gold'
      statusText = 'Estable'
      statusDesc = 'Salud financiera promedio. Existen puntos fuertes y áreas a monitorear.'
    } else {
      statusColor = 'text-rose'
      statusText = 'Riesgo Elevado'
      statusDesc = 'Señales preocupantes de deterioro en rentabilidad o liquidez.'
    }

    return (
      <div className="mt-8 space-y-8 fade-in">
        <div className="flex items-center gap-4">
          <div>
            <span className="font-mono text-sky text-sm font-semibold tracking-widest uppercase">{data.symbol}</span>
            <h2 className="font-display font-bold text-3xl text-text glow-gold">{data.name}</h2>
          </div>
        </div>

        {/* ALERTA DE FALLBACK */}
        {isFallback && (
          <div className="bg-gold/10 border border-gold/40 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="text-gold shrink-0 mt-0.5" size={20} />
            <div>
              <h4 className="text-gold font-display font-bold text-sm">Aviso: Modo de Salud Actual (TTM)</h4>
              <p className="text-subtle text-xs mt-1 leading-relaxed">
                El proveedor de datos bloqueó el acceso al balance del año anterior. En lugar del Piotroski clásico de 9 puntos, hemos generado un <strong>Termómetro de Salud Actual de 5 puntos</strong> evaluando los ratios críticos del año en curso.
              </p>
            </div>
          </div>
        )}

        {/* MEDIDOR VISUAL */}
        <div className="glass rounded-2xl p-8 border border-gold/20 flex flex-col items-center justify-center relative overflow-hidden shadow-xl">
          <span className="text-sm text-muted uppercase tracking-widest font-display mb-6">
            {isFallback ? "Termómetro de Salud (TTM)" : "Puntuación de Salud Piotroski"}
          </span>
          
          <div className="flex items-end gap-1 mb-4">
            {Array.from({length: maxScore}, (_, i) => i + 1).map(n => {
              const active = n <= score
              let blockColor = "bg-surface border-border"
              if (active) {
                if (n <= Math.ceil(maxScore * 0.33)) blockColor = "bg-rose border-rose shadow-[0_0_10px_rgba(244,63,94,0.5)]"
                else if (n <= Math.ceil(maxScore * 0.66)) blockColor = "bg-gold border-gold shadow-[0_0_10px_rgba(251,191,36,0.5)]"
                else blockColor = "bg-emerald border-emerald shadow-[0_0_10px_rgba(16,185,129,0.5)]"
              }
              return (
                <div key={n} className={`rounded-sm border-2 transition-all duration-700 ${blockColor} ${isFallback ? 'w-12' : 'w-8'}`} style={{ height: `${20 + n * (isFallback ? 14 : 8)}px`, opacity: active ? 1 : 0.3 }} />
              )
            })}
          </div>

          <div className="text-7xl font-mono font-bold text-text mb-2 drop-shadow-md">
            {score}<span className="text-3xl text-muted">/{maxScore}</span>
          </div>
          
          <div className="flex flex-col items-center mt-2 text-center">
            <span className={`text-xl font-display font-bold tracking-wide uppercase ${statusColor}`}>{statusText}</span>
            <span className="text-sm text-subtle mt-1 max-w-sm">{statusDesc}</span>
          </div>
        </div>

        {/* DESGLOSE (Se adapta si es de 9 o de 5 puntos) */}
        {!isFallback ? (
          <div className="grid md:grid-cols-3 gap-6">
            <div className="space-y-4">
              <h3 className="font-display text-sm uppercase tracking-widest text-muted border-b border-border/50 pb-2">1. Rentabilidad</h3>
              <CriterionRow title="ROA Positivo" desc="Genera ganancias en relación a sus activos." passed={c.roa_positive} />
              <CriterionRow title="CFO Positivo" desc="La operación genera efectivo real." passed={c.cfo_positive} />
              <CriterionRow title="ROA en Aumento" desc="El ROA actual es superior al del año anterior." passed={c.roa_increasing} />
              <CriterionRow title="Calidad de Ganancias" desc="El Flujo de Caja Operativo es mayor que el Ingreso Neto." passed={c.cfo_gt_ni} />
            </div>
            <div className="space-y-4">
              <h3 className="font-display text-sm uppercase tracking-widest text-muted border-b border-border/50 pb-2">2. Liquidez y Deuda</h3>
              <CriterionRow title="Apalancamiento a la baja" desc="La deuda a largo plazo se redujo vs el año pasado." passed={c.leverage_decreasing} />
              <CriterionRow title="Liquidez en Aumento" desc="Mejoró el Current Ratio (Activo Cte / Pasivo Cte)." passed={c.current_ratio_increasing} />
              <CriterionRow title="No Dilución" desc="La empresa no emitió nuevas acciones." passed={c.no_new_shares} />
            </div>
            <div className="space-y-4">
              <h3 className="font-display text-sm uppercase tracking-widest text-muted border-b border-border/50 pb-2">3. Eficiencia</h3>
              <CriterionRow title="Expansión de Márgenes" desc="El Margen Bruto superó al del año anterior." passed={c.gross_margin_increasing} />
              <CriterionRow title="Rotación en Aumento" desc="Vende más rápido sus activos (Ventas/Activos subió)." passed={c.asset_turnover_increasing} />
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="font-display text-sm uppercase tracking-widest text-muted border-b border-border/50 pb-2">Rentabilidad Actual</h3>
              <CriterionRow title="Rentabilidad Activa (ROA)" desc="La empresa genera utilidades operativas sobre los activos que posee." passed={c.roa_positive} />
              <CriterionRow title="Generación de Caja (FCF)" desc="El Flujo de Caja Libre es positivo (no quema efectivo)." passed={c.fcf_positive} />
              <CriterionRow title="Calidad de Ganancias" desc="El Efectivo Operativo es superior al Beneficio Contable (menor riesgo de manipulación)." passed={c.cfo_gt_ni} />
            </div>
            <div className="space-y-4">
              <h3 className="font-display text-sm uppercase tracking-widest text-muted border-b border-border/50 pb-2">Riesgo Estructural</h3>
              <CriterionRow title="Apalancamiento Seguro" desc="La Deuda Total no supera 1.5 veces el Capital Propio (Equity)." passed={c.leverage_safe} />
              <CriterionRow title="Liquidez a Corto Plazo" desc="Tiene más Activos Corrientes que Pasivos Corrientes (Current Ratio > 1)." passed={c.liquid} />
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
          <h1 className="font-display font-bold text-2xl text-text flex items-center gap-2"><ActivitySquare className="text-gold" />Evaluación de Salud</h1>
        </div>
        <SearchBar onSelect={item => navigate(`/fscore/${item.symbol}`)} placeholder="Buscar empresa..." className="w-full md:w-80" />
      </div>
      {!ticker && !loading && !data && (
        <div className="glass rounded-2xl p-16 text-center mt-8 border border-border/50 border-dashed">
          <Search size={48} className="text-muted/50 mx-auto mb-4" />
          <p className="text-subtle max-w-sm mx-auto">Buscá una empresa para generar un escáner automático de sus últimos balances.</p>
        </div>
      )}
      {loading && <div className="flex flex-col items-center justify-center py-32 gap-4"><Loader2 size={32} className="text-gold animate-spin" /></div>}
      {error && !loading && <div className="flex flex-col items-center justify-center py-32 gap-4"><div className="flex items-center gap-2 text-rose bg-rose/10 px-4 py-2 rounded-lg"><AlertCircle size={20} /><p className="font-body">{error}</p></div></div>}
      {renderContent()}
    </div>
  )
}