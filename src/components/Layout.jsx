import { useAuth } from '../context/AuthContext'

const TIPO_CONFIG = {
  venta_efectivo:              { label: 'Venta Efectivo',        color: 'bg-green-900/40 text-green-400' },
  venta_transferencia:         { label: 'Venta Transf.',         color: 'bg-green-900/40 text-green-400' },
  gasto_efectivo:              { label: 'Gasto Efectivo',        color: 'bg-red-900/40 text-red-400' },
  gasto_transferencia:         { label: 'Gasto Transf.',         color: 'bg-red-900/40 text-red-400' },
  mercaderia_recibida:         { label: 'Mercadería',            color: 'bg-blue-900/40 text-blue-400' },
  entrega_dueno_efectivo:      { label: 'Entrega Dueño Ef.',     color: 'bg-yellow-900/40 text-yellow-400' },
  entrega_dueno_transferencia: { label: 'Entrega Dueño Trans.',  color: 'bg-yellow-900/40 text-yellow-400' },
  ingreso_caja:                { label: 'Ingreso a Caja',        color: 'bg-purple-900/40 text-purple-400' },
}

export { TIPO_CONFIG }

export default function Layout({ children }) {
  const { perfil, logout } = useAuth()
  return (
    <div className="min-h-screen bg-criterio-negro">
      <header className="border-b border-criterio-gris3 bg-criterio-gris/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-semibold text-criterio-blanco leading-none">Criterio</h1>
            <p className="text-criterio-acento font-mono text-[10px] tracking-[0.2em] uppercase">
              {perfil?.rol === 'gerencia' ? 'Gerencia' : perfil?.locales?.nombre || 'Local Flores'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-criterio-texto/40 font-mono text-xs hidden sm:block">{perfil?.nombre}</span>
            <button onClick={logout}
              className="text-xs font-mono text-criterio-texto/40 hover:text-criterio-acento border border-criterio-gris3 px-3 py-1.5 rounded-lg hover:border-criterio-acento transition-colors">
              salir
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  )
}
