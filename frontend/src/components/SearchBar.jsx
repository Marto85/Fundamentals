import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Loader2, FileText, ChevronRight } from 'lucide-react'
import CompanyLogo from './CompanyLogo'
import { API_URL } from './utils'

// Hook para cerrar el menú al hacer clic afuera
function useOutsideClick(ref, callback) {
  useEffect(() => {
    function handleClickOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        callback()
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [ref, callback])
}

export default function SearchBar({ onSelect, className = "" }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  
  const searchTimeout = useRef(null)
  const dropdownRef = useRef(null)
  const navigate = useNavigate()

  useOutsideClick(dropdownRef, () => setShowDropdown(false))

  const handleSearch = async (q) => {
    if (!q.trim()) {
      setResults([]); setLoading(false); setShowDropdown(false); return;
    }
    setLoading(true); setShowDropdown(true);
    try {
      const res = await fetch(`${API_URL}/search?q=${encodeURIComponent(q)}`)
      if (!res.ok) throw new Error('Search failed')
      const data = await res.json()
      // Tomamos solo los primeros 7 resultados para que el dropdown no sea gigante
      setResults(data.slice(0, 7))
    } catch (e) { 
      console.error(e) 
    } finally { 
      setLoading(false) 
    }
  }

  const onChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(searchTimeout.current);
    if (!val.trim()) { setShowDropdown(false); return; }
    setShowDropdown(true);
    searchTimeout.current = setTimeout(() => { handleSearch(val) }, 250);
  }

  const handleSelect = (item) => {
    setQuery(''); setShowDropdown(false);
    if (onSelect) { onSelect(item) }
  }

  const onSubmit = (e) => {
    e.preventDefault();
    if (results.length > 0) {
      handleSelect(results[0]); // Selecciona el primero si presiona Enter
    }
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <form onSubmit={onSubmit} className="relative">
        <Search className="absolute left-3 top-2.5 text-muted/60" size={16} />
        <input 
          type="search" 
          value={query} 
          onChange={onChange}
          onFocus={() => { if (query) setShowDropdown(true) }}
          placeholder="Ej: AAPL, MercadoLibre, Nvidia..." 
          className="w-full bg-surface border border-border/70 rounded-xl py-2 pl-9 pr-8 text-text text-sm font-body focus:outline-none focus:border-gold/50 transition-colors shadow-inner"
        />
        {loading && <Loader2 className="absolute right-3 top-2.5 text-gold/60 animate-spin" size={16} />}
      </form>

      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border/80 rounded-2xl shadow-2xl z-50 p-2 overflow-hidden fade-in">
          {results.length > 0 ? (
            results.map(item => (
              <button 
                key={item.symbol} 
                onClick={() => handleSelect(item)}
                className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-surface/60 transition-colors cursor-pointer text-left focus:outline-none focus:bg-surface/60"
              >
                {/* ACÁ SUCEDE LA MAGIA: Le pasamos el domain adivinado por el backend */}
                <CompanyLogo domain={item.domain} ticker={item.symbol} size={32} className="shrink-0" />
                
                <div className="flex-1 overflow-hidden">
                    <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono text-sky text-xs font-semibold">{item.symbol}</span>
                        {item.type && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-surface text-muted border border-border font-mono">{item.type}</span>
                        )}
                    </div>
                    <p className="font-body text-text text-sm truncate">{item.name}</p>
                    <p className="font-mono text-[10px] text-muted truncate">{item.exchange}</p>
                </div>
                <ChevronRight size={14} className="text-muted/40" />
              </button>
            ))
          ) : !loading && query && (
            <div className="flex items-center gap-2 p-3 text-sm text-subtle bg-surface/40 rounded-xl font-body">
              <FileText size={16} className="text-muted" /> Sin resultados para "{query}".
            </div>
          )}
        </div>
      )}
    </div>
  )
}