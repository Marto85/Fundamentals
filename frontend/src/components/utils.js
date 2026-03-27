export const API_URL = import.meta.env.VITE_API_URL || 'https://fundamentals-ypwi.onrender.com'

export function fmt(val, decimals = 2) {
  if (val === null || val === undefined) return '—'
  const abs = Math.abs(val)
  if (abs >= 1e12) return `${(val / 1e12).toFixed(decimals)}T`
  if (abs >= 1e9)  return `${(val / 1e9).toFixed(decimals)}B`
  if (abs >= 1e6)  return `${(val / 1e6).toFixed(decimals)}M`
  if (abs >= 1e3)  return `${(val / 1e3).toFixed(decimals)}K`
  return val.toFixed(decimals)
}

export function fmtPct(val, decimals = 2) {
  if (val === null || val === undefined) return '—'
  return `${(val * 100).toFixed(decimals)}%`
}

export function fmtPrice(val) {
  if (val === null || val === undefined) return '—'
  return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function fmtRatio(val, decimals = 2) {
  if (val === null || val === undefined) return '—'
  return val.toFixed(decimals) + 'x'
}

export function colorClass(val) {
  if (val === null || val === undefined) return 'text-subtle'
  return val >= 0 ? 'text-emerald' : 'text-rose'
}

export function signPrefix(val) {
  if (val === null || val === undefined) return ''
  return val >= 0 ? '+' : ''
}
