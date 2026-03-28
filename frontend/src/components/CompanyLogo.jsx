import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { API_URL } from './utils' // <-- Importante: Trae la URL de tu backend

export default function CompanyLogo({ domain, ticker, size = 48, className = "", href = null }) {
  const [imgError, setImgError] = useState(false);

  // Reiniciamos el estado si el usuario busca una empresa nueva
  useEffect(() => {
    setImgError(false);
  }, [domain, ticker]);

  // ── EL DISEÑO DE EMERGENCIA (AVATAR ELEGANTE) ──
  const renderFallback = () => {
    const letter = ticker ? ticker.charAt(0).toUpperCase() : '?'
    
    return (
      <div 
        style={{ width: size, height: size, minWidth: size }} 
        className={`shrink-0 rounded-xl bg-gradient-to-br from-surface to-bg border border-border flex items-center justify-center text-text font-display font-bold shadow-inner ${className}`}
      >
        <span style={{ fontSize: size * 0.45 }}>{letter}</span>
      </div>
    )
  }

  const renderContent = () => {
    if (!domain || imgError) {
      return renderFallback();
    }

    // ── MAGIA ANTI-ADBLOCK: Le pedimos la imagen a NUESTRO propio backend ──
    const logoUrl = `${API_URL}/logo/${domain}`;

    return (
      <img 
        src={logoUrl} 
        alt={ticker} 
        onError={() => setImgError(true)} 
        style={{ width: size, height: size, minWidth: size }} 
        className={`rounded-xl object-contain bg-white p-1 border border-border shadow-sm shrink-0 ${className}`} 
      />
    )
  }

  if (!href) {
    return renderContent();
  }
  
  return (
    <Link to={href} className={`hover:opacity-80 transition-opacity ${className}`}>
      {renderContent()}
    </Link>
  );
}