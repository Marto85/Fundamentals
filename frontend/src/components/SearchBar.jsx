import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, X, Loader2, TrendingUp } from 'lucide-react'
import { API_URL } from './utils'

export default function SearchBar({ onSelect, placeholder = 'Buscar empresa o ticker…', className = '' }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const inputRef = useRef(null)
  const timer = useRef(null)

  const search = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); setOpen(false); return }
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setResults(data.slice(0, 8))
      setOpen(true)
      setActiveIdx(-1)
    } catch { setResults([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => search(query), 320)
    return () => clearTimeout(timer.current)
  }, [query, search])

  function handleSelect(item) {
    setQuery('')
    setResults([])
    setOpen(false)
    onSelect(item)
  }

  function handleKey(e) {
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)) }
    if (e.key === 'Enter' && activeIdx >= 0) handleSelect(results[activeIdx])
    if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur() }
  }

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center gap-2 px-4 py-3 glass rounded-xl transition-all focus-within:border-gold/40 focus-within:ring-1 focus-within:ring-gold/20">
        {loading
          ? <Loader2 size={18} className="text-gold animate-spin flex-shrink-0" />
          : <Search size={18} className="text-subtle flex-shrink-0" />
        }
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKey}
          onFocus={() => results.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className="flex-1 bg-transparent outline-none text-text font-body text-sm placeholder-muted"
        />
        {query && (
          <button onClick={() => { setQuery(''); setResults([]); setOpen(false) }}>
            <X size={16} className="text-muted hover:text-subtle transition-colors" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-2 w-full glass rounded-xl overflow-hidden shadow-2xl border border-border/60">
          {results.map((r, i) => (
            <li
              key={r.symbol}
              onMouseDown={() => handleSelect(r)}
              className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors group
                ${i === activeIdx ? 'bg-gold/10 text-gold' : 'hover:bg-surface'}`}
            >
              <TrendingUp size={14} className={`flex-shrink-0 ${i === activeIdx ? 'text-gold' : 'text-muted'}`} />
              <span className="font-mono text-sm font-semibold w-20 flex-shrink-0
                               text-sky group-hover:text-sky">
                {r.symbol}
              </span>
              <span className="text-sm text-subtle truncate flex-1">{r.name}</span>
              <span className="text-xs text-muted flex-shrink-0">{r.exchange}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
