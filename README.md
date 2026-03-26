# 📊 Fundamentals — Stock Analyzer

Herramienta de análisis financiero para empresas cotizantes en mercados de USA.
Consulta balance, ingresos, EBIT, EBITDA, ROE, FCF, deuda y mucho más directo desde la SEC/Yahoo Finance.

---

## ✨ Funcionalidades

- **Búsqueda en tiempo real** por nombre o ticker (NYSE, NASDAQ, etc.)
- **Análisis individual**: métricas completas de fundamentals + gráfico de velas interactivo
- **Comparación múltiple**: hasta 6 empresas lado a lado en una tabla
- Discriminación de **ingresos recurrentes vs extraordinarios**
- Métricas: Market Cap, EV, P/E, P/B, EBIT, EBITDA, ROE, ROA, FCF, Deuda/Equity y más
- Gráfico de velas con volumen, períodos: 1M / 3M / 6M / 1A / 2A / 5A

---

## 🛠 Setup local

### Requisitos
- Python 3.10+
- Node.js 18+

---

### 1. Backend (FastAPI)

```bash
cd backend
python -m venv venv

# macOS / Linux:
source venv/bin/activate

# Windows:
venv\Scripts\activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

El backend corre en **http://localhost:8000**
Podés probar los endpoints en **http://localhost:8000/docs**

---

### 2. Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

La app corre en **http://localhost:5173**

---

## 🚀 Deploy

### Backend → [Railway](https://railway.app) (gratis, recomendado)

1. Crear cuenta en railway.app
2. New Project → Deploy from GitHub repo
3. Seleccionar la carpeta `/backend` como root directory
4. Railway detecta FastAPI automáticamente
5. Agregar variable de entorno: `PORT=8000`
6. Copiar la URL pública del deploy (ej: `https://tu-app.railway.app`)

### Frontend → [Vercel](https://vercel.com) (gratis)

1. Crear cuenta en vercel.com
2. Import Git Repository → seleccionar tu repo
3. Framework: Vite
4. Root Directory: `frontend`
5. Agregar variable de entorno:
   ```
   VITE_API_URL=https://tu-app.railway.app
   ```
6. Deploy

---

## 📁 Estructura del proyecto

```
stock-analyzer/
├── backend/
│   ├── main.py           ← FastAPI + yfinance
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx                    ← App principal, tabs
│   │   ├── index.css                  ← Estilos globales
│   │   └── components/
│   │       ├── SearchBar.jsx          ← Búsqueda con autocomplete
│   │       ├── CompanyDetail.jsx      ← Vista individual
│   │       ├── CandlestickChart.jsx   ← Gráfico de velas (TradingView)
│   │       ├── ComparisonView.jsx     ← Tabla comparativa
│   │       ├── MetricCard.jsx         ← Tarjeta de métrica
│   │       └── utils.js               ← Formateo de números
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
└── README.md
```

---

## 🔑 APIs utilizadas

| Fuente | Uso | API Key |
|--------|-----|---------|
| Yahoo Finance (via yfinance) | Balances, precios, fundamentals | ❌ No necesaria |
| Yahoo Finance Search | Búsqueda de empresas | ❌ No necesaria |

> **Todo gratuito y sin registro.**

---

## 📝 Notas

- Los datos provienen de Yahoo Finance que los obtiene de los reportes presentados ante la SEC
- La discriminación de ingresos recurrentes/extraordinarios se basa en Ingresos Operativos vs Otros Ingresos
- El EBITDA se calcula como EBIT + D&A cuando no está disponible directamente
- Los datos no son en tiempo real para balances (son anuales/trimestrales del último reporte)
- **No constituye asesoramiento financiero**
