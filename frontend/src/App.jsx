import { useState, useCallback, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Link, useNavigate, useParams, useLocation } from 'react-router-dom'
// Agregamos 'Filter' a los imports de lucide-react
import { BarChart2, GitCompare, Loader2, AlertCircle, X, RefreshCw, Calculator, ActivitySquare, Filter } from 'lucide-react'
import SearchBar from './components/SearchBar'
import CompanyDetail from './components/CompanyDetail'
import ComparisonView from './components/ComparisonView'
import DCFView from './components/DCFView'
import FScoreView from './components/FScoreView'
import { API_URL } from './components/utils'
import Screener from './components/Screener';

function SingleCompanyView() {
  const { ticker } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const loadCompany = useCallback(async (symbol) => {
    setLoading(true)
    setError(null)
    setData(null)
    try {
      const res = await fetch(`${API_URL}/company/${symbol}`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Error desconocido')
      }
      const fetchedData = await res.json()
      setData(fetchedData)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (ticker) {
      loadCompany(ticker)
    }
  }, [ticker, loadCompany])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Loader2 size={32} className="text-gold animate-spin" />
        <p className="text-subtle text-sm font-body">Cargando datos financieros…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <div className="flex items-center gap-2 text-rose">
          <AlertCircle size={20} />
          <p className="font-body">{error}</p>
        </div>
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 text-xs text-muted hover:text-subtle transition-colors mt-2"
        >
          <X size={12} /> Volver al inicio
        </button>
      </div>
    )
  }

  if (data) {
    return (
      <div className="fade-in">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-muted font-mono">
            Última actualización: {new Date().toLocaleTimeString('es-AR')}
          </p>
          <button
            onClick={() => loadCompany(ticker)}
            className="flex items-center gap-1 text-xs text-muted hover:text-subtle transition-colors"
          >
            <RefreshCw size={12} /> Actualizar
          </button>
        </div>
        <CompanyDetail data={data} />
      </div>
    )
  }

  return null
}

function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()

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
          <Link to="/" className="flex items-center gap-2 mr-2 hover:opacity-80 transition-opacity cursor-pointer">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-gold to-amber-600 flex items-center justify-center">
              <BarChart2 size={14} className="text-white" />
            </div>
            <span className="font-display font-bold text-text text-lg glow-gold">Fundamentals</span>
          </Link>

          <nav className="flex gap-1 overflow-x-auto pb-1 sm:pb-0">
            <Link
              to="/"
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-body font-medium transition-all whitespace-nowrap
                ${location.pathname === '/' || location.pathname.startsWith('/company')
                  ? 'bg-gold/15 text-gold border border-gold/25'
                  : 'text-muted hover:text-subtle hover:bg-surface'}`}
            >
              <BarChart2 size={14} /> Análisis Individual
            </Link>
            <Link
              to="/compare"
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-body font-medium transition-all whitespace-nowrap
                ${location.pathname === '/compare'
                  ? 'bg-gold/15 text-gold border border-gold/25'
                  : 'text-muted hover:text-subtle hover:bg-surface'}`}
            >
              <GitCompare size={14} /> Comparar Empresas
            </Link>
            <button
              onClick={() => navigate('/dcf')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-body font-medium transition-all whitespace-nowrap
                ${location.pathname.startsWith('/dcf')
                  ? 'bg-gold/15 text-gold border border-gold/25'
                  : 'text-muted hover:text-subtle hover:bg-surface'}`}
            >
              <Calculator size={14} /> Calculadora DCF
            </button>
            <button
              onClick={() => navigate('/fscore')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-body font-medium transition-all whitespace-nowrap
                ${location.pathname.startsWith('/fscore')
                  ? 'bg-gold/15 text-gold border border-gold/25'
                  : 'text-muted hover:text-subtle hover:bg-surface'}`}
            >
              <ActivitySquare size={14} /> F-Score (Salud)
            </button>

            {/* ── NUEVA PESTAÑA SCREENER ── */}
            <Link
              to="/screener"
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-body font-medium transition-all whitespace-nowrap
                ${location.pathname === '/screener'
                  ? 'bg-gold/15 text-gold border border-gold/25'
                  : 'text-muted hover:text-subtle hover:bg-surface'}`}
            >
              <Filter size={14} /> Screener
            </Link>
          </nav>

          {!location.pathname.startsWith('/compare') && 
           !location.pathname.startsWith('/dcf') && 
           !location.pathname.startsWith('/fscore') && 
           !location.pathname.startsWith('/screener') && ( // Ocultamos barra de búsqueda en screener si querés más espacio
            <SearchBar
              onSelect={item => navigate(`/company/${item.symbol}`)}
              className="flex-1 max-w-md ml-auto"
            />
          )}
        </div>
      </header>

      {/* ── Main ── */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={
            <div className="flex flex-col items-center justify-center py-32 gap-5 text-center fade-in">
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
                    onClick={() => navigate(`/company/${t}`)}
                    className="px-3 py-1.5 glass rounded-lg font-mono text-xs text-sky hover:text-sky
                               hover:bg-sky/10 border border-border hover:border-sky/30 transition-all"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          } />

          <Route path="/company/:ticker" element={<SingleCompanyView />} />
          
          <Route path="/compare" element={
            <ComparisonView companies={compareCompanies} loadingTickers={loadingTickers} errors={errorTickers} onAdd={addCompany} onRemove={removeCompany} />
          } />

          <Route path="/dcf" element={<DCFView />} />
          <Route path="/dcf/:ticker" element={<DCFView />} />
          
          <Route path="/fscore" element={<FScoreView />} />
          <Route path="/fscore/:ticker" element={<FScoreView />} />

          <Route path="/screener" element={<Screener />} />

        </Routes>
      </main>

      <footer className="border-t border-border/30 mt-16 py-6 text-center">
        <p className="text-muted text-xs font-mono">
          Datos via Yahoo Finance · Solo fines informativos · No constituye asesoramiento financiero
        </p>
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  )
}