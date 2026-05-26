import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    // Agrega dominio automáticamente si solo escriben el nombre
    const emailFull = email.includes('@') ? email : `${email.toLowerCase()}@criterio.com`
    const { error } = await login(emailFull, password)
    if (error) setError('Usuario o contraseña incorrectos')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-criterio-negro flex items-center justify-center p-4">
      {/* Fondo decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px]
                        bg-criterio-acento/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px]
                        bg-criterio-acento/3 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="font-display text-5xl font-bold text-criterio-blanco tracking-tight">
            Criterio
          </h1>
          <p className="text-criterio-acento font-mono text-xs tracking-[0.3em] uppercase mt-2">
            Local Flores
          </p>
          <div className="w-12 h-px bg-criterio-acento mx-auto mt-4" />
        </div>

        {/* Form */}
        <div className="card">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-mono text-criterio-texto/50 uppercase tracking-widest block mb-2">
                Usuario
              </label>
              <input
                type="text"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="gerencia / encargada"
                required
                autoComplete="username"
              />
            </div>

            <div>
              <label className="text-xs font-mono text-criterio-texto/50 uppercase tracking-widest block mb-2">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm font-mono text-center">{error}</p>
            )}

            <button type="submit" className="btn-primary mt-2" disabled={loading}>
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>
        </div>

        <p className="text-center text-criterio-texto/20 font-mono text-xs mt-8">
          Criterio Indumentaria © 2026
        </p>
      </div>
    </div>
  )
}
