import { useEffect, useRef, useState } from 'react'
import { createChart, ColorType } from 'lightweight-charts'
import { API_URL } from './utils'
import { Loader2, AlertCircle } from 'lucide-react'

const PERIODS = [
  { label: '1M',  value: '1mo',  interval: '1d'  },
  { label: '3M',  value: '3mo',  interval: '1d'  },
  { label: '6M',  value: '6mo',  interval: '1d'  },
  { label: '1A',  value: '1y',   interval: '1d'  },
  { label: '2A',  value: '2y',   interval: '1wk' },
  { label: '5A',  value: '5y',   interval: '1wk' },
]

export default function CandlestickChart({ ticker }) {
  const containerRef = useRef(null)
  const chartRef = useRef(null)
  const [period, setPeriod] = useState(PERIODS[3])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [ohlc, setOhlc] = useState(null)

  // Load data
  useEffect(() => {
    if (!ticker) return
    setLoading(true)
    setError(null)
    fetch(`${API_URL}/chart/${ticker}?period=${period.value}&interval=${period.interval}`)
      .then(r => r.json())
      .then(d => { setOhlc(d.candles); setLoading(false) })
      .catch(() => { setError('Error cargando datos del gráfico'); setLoading(false) })
  }, [ticker, period])

  // Build / update chart
  useEffect(() => {
    if (!ohlc || !containerRef.current) return

    // Destroy previous
    if (chartRef.current) { chartRef.current.remove(); chartRef.current = null }

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#64748B',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#1E2D40' },
        horzLines: { color: '#1E2D40' },
      },
      crosshair: { mode: 1 },
      rightPriceScale: {
        borderColor: '#1E2D40',
        scaleMargins: { top: 0.1, bottom: 0.25 },
      },
      timeScale: {
        borderColor: '#1E2D40',
        timeVisible: true,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      width:  containerRef.current.clientWidth,
      height: 360,
    })

    const candleSeries = chart.addCandlestickSeries({
      upColor:       '#10B981',
      downColor:     '#F43F5E',
      borderVisible: false,
      wickUpColor:   '#10B981',
      wickDownColor: '#F43F5E',
    })
    candleSeries.setData(ohlc)

    // Volume histogram
    const volSeries = chart.addHistogramSeries({
      color:     '#38BDF820',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    })
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    })
    volSeries.setData(
      ohlc.map(c => ({
        time:  c.time,
        value: c.volume,
        color: c.close >= c.open ? '#10B98130' : '#F43F5E30',
      }))
    )

    chart.timeScale().fitContent()
    chartRef.current = chart

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth })
      }
    }
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
      chartRef.current = null
    }
  }, [ohlc])

  return (
    <div className="glass rounded-2xl p-5 fade-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold text-text text-sm tracking-wider uppercase">
          Precio — Gráfico de Velas
        </h3>
        <div className="flex gap-1">
          {PERIODS.map(p => (
            <button
              key={p.label}
              onClick={() => setPeriod(p)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all
                ${period.value === p.value
                  ? 'bg-gold/20 text-gold border border-gold/30'
                  : 'text-muted hover:text-subtle hover:bg-surface'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative min-h-[360px]">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <Loader2 size={24} className="text-gold animate-spin" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-rose text-sm">
            <AlertCircle size={16} /> {error}
          </div>
        )}
        <div ref={containerRef} className={loading || error ? 'opacity-0' : 'opacity-100 transition-opacity'} />
      </div>
    </div>
  )
}
