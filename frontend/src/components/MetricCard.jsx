export default function MetricCard({ label, value, sub, color, accent, tooltip }) {
  return (
    <div
      className="glass rounded-xl p-4 group hover:border-gold/20 transition-all cursor-default"
      title={tooltip}
    >
      <p className="text-[10px] font-display uppercase tracking-widest text-muted mb-1">{label}</p>
      <p className={`font-mono text-lg font-semibold animate-count ${color || 'text-text'}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted mt-0.5">{sub}</p>}
    </div>
  )
}

export function SectionHeader({ title, icon: Icon }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {Icon && <Icon size={14} className="text-gold" />}
      <h3 className="font-display font-semibold text-[11px] uppercase tracking-widest text-gold/80">{title}</h3>
      <div className="flex-1 h-px bg-gradient-to-r from-gold/20 to-transparent ml-1" />
    </div>
  )
}
