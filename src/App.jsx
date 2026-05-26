import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import EncargadaDashboard from './pages/encargada/Dashboard'
import GerenciaDashboard from './pages/gerencia/Dashboard'

function AppRoutes() {
  const { user, perfil, loading } = useAuth()

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-criterio-negro">
      <div className="text-center">
        <p className="font-display text-3xl text-criterio-acento mb-2">Criterio</p>
        <p className="text-criterio-texto/40 font-mono text-sm animate-pulse">cargando...</p>
      </div>
    </div>
  )

  if (!user) return <Login />

  if (!perfil) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-criterio-texto/40">Sin perfil asignado. Contactá a gerencia.</p>
    </div>
  )

  return (
    <Routes>
      {perfil.rol === 'gerencia' ? (
        <>
          <Route path="/" element={<GerenciaDashboard />} />
          <Route path="*" element={<Navigate to="/" />} />
        </>
      ) : (
        <>
          <Route path="/" element={<EncargadaDashboard />} />
          <Route path="*" element={<Navigate to="/" />} />
        </>
      )}
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
