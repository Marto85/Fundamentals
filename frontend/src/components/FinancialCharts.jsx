import { useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  ComposedChart, Line 
} from 'recharts';

const formatAxis = (num) => {
  if (num === 0) return '0';
  const absNum = Math.abs(num);
  if (absNum >= 1e9) return (num / 1e9).toFixed(1) + 'B';
  if (absNum >= 1e6) return (num / 1e6).toFixed(1) + 'M';
  return num.toLocaleString();
};

export default function FinancialCharts({ data, currency }) {
  const [activeTab, setActiveTab] = useState('income');
  const [showDebug, setShowDebug] = useState(false);

  if (!data || data.length === 0) return <div className="text-center text-muted p-4">No hay datos históricos.</div>;

  // ── EL TRUCO VISUAL PARA EL CAPEX ──
  // Creamos una copia de los datos donde forzamos al CapEx a ser siempre positivo
  // para que la barra se dibuje hacia arriba.
  const chartData = data.map(d => ({
    ...d,
    capex_positivo: d.capex ? Math.abs(d.capex) : null
  }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border/50 p-3 rounded-lg shadow-xl font-mono text-xs">
          <p className="font-display text-muted mb-2 font-bold">{label}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex justify-between gap-4 mb-1">
              <span style={{ color: entry.color }}>{entry.name}:</span>
              <span className="text-text font-semibold">
                {currency} {entry.value ? formatAxis(entry.value) : 'N/A'}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="glass rounded-2xl p-6 border border-border/50 fade-in mt-6">
      
      <div className="flex justify-between items-center border-b border-border/50 mb-6">
        <div className="flex overflow-x-auto no-scrollbar">
          <button 
            onClick={() => setActiveTab('income')}
            className={`px-4 py-2 font-display text-sm tracking-wider uppercase border-b-2 transition-all shrink-0 ${activeTab === 'income' ? 'border-sky text-sky font-bold' : 'border-transparent text-muted hover:text-subtle'}`}
          >
            Evolución del Negocio
          </button>
          <button 
            onClick={() => setActiveTab('cashflow')}
            className={`px-4 py-2 font-display text-sm tracking-wider uppercase border-b-2 transition-all shrink-0 ${activeTab === 'cashflow' ? 'border-emerald text-emerald font-bold' : 'border-transparent text-muted hover:text-subtle'}`}
          >
            Máquina de Efectivo
          </button>
          <button 
            onClick={() => setActiveTab('balance')}
            className={`px-4 py-2 font-display text-sm tracking-wider uppercase border-b-2 transition-all shrink-0 ${activeTab === 'balance' ? 'border-gold text-gold font-bold' : 'border-transparent text-muted hover:text-subtle'}`}
          >
            Salud del Balance
          </button>
        </div>

        <button 
          onClick={() => setShowDebug(!showDebug)}
          className="text-[10px] uppercase font-mono px-2 py-1 bg-rose/10 text-rose border border-rose/30 rounded hidden"
        >
          {showDebug ? 'Ocultar Debug' : '🐞 Ver Raw Data'}
        </button>
      </div>

      {showDebug && (
        <div className="mb-6 p-4 bg-black border border-rose/50 rounded-xl overflow-auto max-h-64 font-mono text-xs text-emerald/80">
          <p className="text-rose mb-2 font-bold">// COPIÁ ESTE TEXTO Y PASÁSELO A LA IA:</p>
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}

      <div className="h-72 w-full">
        
        {activeTab === 'income' && (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="year" stroke="#ffffff50" tick={{ fill: '#ffffff50', fontSize: 12 }} />
              <YAxis stroke="#ffffff50" tick={{ fill: '#ffffff50', fontSize: 10 }} tickFormatter={formatAxis} width={50} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Bar dataKey="revenue" name="Ingresos Totales" fill="#0ea5e9" radius={[4, 4, 0, 0]} opacity={0.6} />
              <Bar dataKey="net_income" name="Ganancia Neta" fill="#fbbf24" radius={[4, 4, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        )}

        {activeTab === 'cashflow' && (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="year" stroke="#ffffff50" tick={{ fill: '#ffffff50', fontSize: 12 }} />
              <YAxis stroke="#ffffff50" tick={{ fill: '#ffffff50', fontSize: 10 }} tickFormatter={formatAxis} width={50} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              {/* AHORA USAMOS capex_positivo PARA QUE LA BARRA VAYA HACIA ARRIBA */}
              <Bar dataKey="capex_positivo" name="CapEx (Inversión)" fill="#f43f5e" radius={[4, 4, 0, 0]} opacity={0.8} />
              <Bar dataKey="op_cf" name="Efectivo Operativo" fill="#10b981" radius={[4, 4, 0, 0]} opacity={0.4} />
              <Line type="monotone" dataKey="fcf" name="Free Cash Flow" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981' }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}

        {activeTab === 'balance' && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="year" stroke="#ffffff50" tick={{ fill: '#ffffff50', fontSize: 12 }} />
              <YAxis stroke="#ffffff50" tick={{ fill: '#ffffff50', fontSize: 10 }} tickFormatter={formatAxis} width={50} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Bar dataKey="assets" name="Activos Totales" fill="#0284c7" radius={[4, 4, 0, 0]} opacity={0.8} />
              <Bar dataKey="liabilities" name="Pasivos Totales" fill="#f59e0b" radius={[4, 4, 0, 0]} opacity={0.5} />
              <Bar dataKey="debt" name="Deuda Financiera" fill="#e11d48" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}

      </div>
    </div>
  );
}