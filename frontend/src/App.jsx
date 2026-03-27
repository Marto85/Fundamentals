import { useState, useCallback } from 'react'
import { BarChart2, GitCompare, Loader2, AlertCircle, X, RefreshCw } from 'lucide-react'
import SearchBar from './components/SearchBar'
import CompanyDetail from './components/CompanyDetail'
import ComparisonView from './components/ComparisonView'
import { API_URL } from './components/utils'

const TABS = [
  { id: 'single',  label: 'Análisis Individual', icon: BarChart2 },
  { id: 'compare', label: 'Comparar Empresas',    icon: GitCompare },
]

export default function App() {
  const [tab, setTab] = useState('single')

  // ── Single mode ────────────────────────────────────────
  const [singleData, setSingleData]  = useState(null)
  const [singleLoading, setSingleLoading] = useState(false)
  const [singleError, setSingleError] = useState(null)

  const loadCompany = useCallback(async (ticker) => {
    setSingleLoading(true)
    setSingleError(null)
    setSingleData(null)
    try {
      const res = await fetch(`${API_URL}/company/${ticker}`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Error desconocido')
      }
      const data = await res.json()
      setSingleData(data)
    } catch (e) {
      setSingleError(e.message)
    } finally {
      setSingleLoading(false)
    }
  }, [])

  // ── Compare mode ───────────────────────────────────────
  const [compareCompanies, setCompareCompanies] = useState([])
  const [loadingTickers, setLoadingTickers]     = useState({})
  const [errorTickers, setErrorTickers]         = useState({})

  const addCompany = useCallback(async (ticker) => {
    if (compareCompanies.find(c => c.symbol === ticker)) return
    if (compareCompanies.length >= 6) return

    setLoadingTickers(p => ({ ...p, [ticker]: true }))
    setErrorTickers(p => { const n = {...p}; delete n[ticker]; return n })

    try {
      const res = await fetch(`${API_URL}/company/${ticker}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setCompareCompanies(p => [...p, data])
    } catch {
      setErrorTickers(p => ({ ...p, [ticker]: 'Error' }))
    } finally {
      setLoadingTickers(p => { const n = {...p}; delete n[ticker]; return n })
    }
  }, [compareCompanies])

  const removeCompany = useCallback((ticker) => {
    setCompareCompanies(p => p.filter(c => c.symbol !== ticker))
    setErrorTickers(p => { const n = {...p}; delete n[ticker]; return n })
  }, [])

  return (
    <div className="min-h-screen">
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 bg-bg/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center gap-4">
          {/* Logo */}
          <button onClick={() => { setSingleData(null); setSingleError(null); setTab("single"); }} className="flex items-center gap-2 mr-2 hover:opacity-80 transition-opacity cursor-pointer">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-gold to-amber-600 flex items-center justify-center">
              <BarChart2 size={14} className="text-white" />
            </div>
            <span className="font-display font-bold text-text text-lg glow-gold">Fundamentals</span>
          </button>

          {/* Tabs */}
          <nav className="flex gap-1">
            {TABS.map(t => {
              const Icon = t.icon
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-body font-medium transition-all
                    ${tab === t.id
                      ? 'bg-gold/15 text-gold border border-gold/25'
                      : 'text-muted hover:text-subtle hover:bg-surface'}`}
                >
                  <Icon size={14} />
                  {t.label}
                </button>
              )
            })}
          </nav>

          {/* Search (single mode) */}
          {tab === 'single' && (
            <SearchBar
              onSelect={item => loadCompany(item.symbol)}
              className="flex-1 max-w-md ml-auto"
            />
          )}
        </div>
      </header>

      {/* ── Main ── */}
      <main className="max-w-7xl mx-auto px-4 py-8">

        {tab === 'single' && (
          <>
            {/* Empty state */}
            {!singleData && !singleLoading && !singleError && (
              <div className="flex flex-col items-center justify-center py-32 gap-5 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gold/20 to-amber-800/10
                                border border-gold/20 flex items-center justify-center">
                  <BarChart2 size={28} className="text-gold/60" />
                </div>
                <div>
                  <h2 className="font-display font-bold text-xl text-text mb-1">Análisis de Fundamentals</h2>
                  <p className="text-subtle text-sm max-w-sm">
                    Buscá una empresa en la barra superior para ver su último balance, métricas financieras y gráfico de precios.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2 mt-2">
                  {['AAPL','NVDA','JPM','MSFT','AMZN'].map(t => (
                    <button
                      key={t}
                      onClick={() => loadCompany(t)}
                      className="px-3 py-1.5 glass rounded-lg font-mono text-xs text-sky hover:text-sky
                                 hover:bg-sky/10 border border-border hover:border-sky/30 transition-all"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Loading */}
            {singleLoading && (
              <div className="flex flex-col items-center justify-center py-32 gap-4">
                <Loader2 size={32} className="text-gold animate-spin" />
                <p className="text-subtle text-sm font-body">Cargando datos financieros…</p>
              </div>
            )}

            {/* Error */}
            {singleError && !singleLoading && (
              <div className="flex flex-col items-center justify-center py-32 gap-4">
                <div className="flex items-center gap-2 text-rose">
                  <AlertCircle size={20} />
                  <p className="font-body">{singleError}</p>
                </div>
                <button
                  onClick={() => setSingleError(null)}
                  className="flex items-center gap-1 text-xs text-muted hover:text-subtle transition-colors"
                >
                  <X size={12} /> Cerrar
                </button>
              </div>
            )}

            {/* Data */}
            {singleData && !singleLoading && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs text-muted font-mono">
                    Última actualización: {new Date().toLocaleTimeString('es-AR')}
                  </p>
                  <button
                    onClick={() => loadCompany(singleData.symbol)}
                    className="flex items-center gap-1 text-xs text-muted hover:text-subtle transition-colors"
                  >
                    <RefreshCw size={12} /> Actualizar
                  </button>
                </div>
                <CompanyDetail data={singleData} />
              </div>
            )}
          </>
        )}

        {tab === 'compare' && (
          <ComparisonView
            companies={compareCompanies}
            loadingTickers={loadingTickers}
            errors={errorTickers}
            onAdd={addCompany}
            onRemove={removeCompany}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/30 mt-16 py-6 text-center">
        <p className="text-muted text-xs font-mono">
          Datos via Yahoo Finance · Solo fines informativos · No constituye asesoramiento financiero
        </p>
      </footer>
    </div>
  )
}