import { useState, useEffect, useCallback } from 'react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Layout, { TIPO_CONFIG } from '../../components/Layout'

const TIPOS_VENTA = ['venta_efectivo', 'venta_transferencia']
const TIPOS_GASTO = ['gasto_efectivo', 'gasto_transferencia']
const TIPOS_POSITIVOS = [...TIPOS_VENTA, 'mercaderia_recibida']

function formatPeso(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

export default function EncargadaDashboard() {
  const { perfil } = useAuth()
  const localId = perfil?.local_id
  const hoy = new Date()

  const [movimientos, setMovimientos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({ tipo: 'venta_efectivo', monto: '', descripcion: '' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [mesActual] = useState(hoy)

  const cargarMovimientos = useCallback(async () => {
    if (!localId) return
    setLoading(true)
    const desde = format(startOfMonth(mesActual), 'yyyy-MM-dd')
    const hasta = format(endOfMonth(mesActual), 'yyyy-MM-dd')

    const { data } = await supabase
      .from('movimientos')
      .select('*')
      .eq('local_id', localId)
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .order('created_at', { ascending: false })

    setMovimientos(data || [])
    setLoading(false)
  }, [localId, mesActual])

  useEffect(() => { cargarMovimientos() }, [cargarMovimientos])

  // Totales del mes
  const totales = movimientos.reduce((acc, m) => {
    if (!acc[m.tipo]) acc[m.tipo] = 0
    acc[m.tipo] += Number(m.monto)
    return acc
  }, {})

  const totalVentasEf    = totales.venta_efectivo || 0
  const totalVentasTrans = totales.venta_transferencia || 0
  const totalGastosEf    = totales.gasto_efectivo || 0
  const totalGastosTrans = totales.gasto_transferencia || 0
  const totalMercaderia  = totales.mercaderia_recibida || 0
  const totalEntregaEf   = totales.entrega_dueno_efectivo || 0
  const totalEntregaTrans= totales.entrega_dueno_transferencia || 0
  const totalVentas      = totalVentasEf + totalVentasTrans
  const saldoCaja        = totalVentasEf - totalGastosEf - totalEntregaEf

  // Movimientos de hoy para poder editar/eliminar
  const hoyStr = format(hoy, 'yyyy-MM-dd')
  const movHoy = movimientos.filter(m => m.fecha === hoyStr)

  async function handleGuardar(e) {
    e.preventDefault()
    setError('')
    if (!form.monto || isNaN(form.monto) || Number(form.monto) <= 0) {
      setError('Ingresá un monto válido')
      return
    }
    setGuardando(true)

    if (editando) {
      const { error } = await supabase
        .from('movimientos')
        .update({ tipo: form.tipo, monto: Number(form.monto), descripcion: form.descripcion })
        .eq('id', editando.id)
      if (error) setError('Error al guardar')
      else { setEditando(null); resetForm() }
    } else {
      const { error } = await supabase.from('movimientos').insert({
        local_id: localId,
        fecha: hoyStr,
        tipo: form.tipo,
        monto: Number(form.monto),
        descripcion: form.descripcion,
        creado_por: perfil.id,
      })
      if (error) setError('Error al guardar')
      else resetForm()
    }

    await cargarMovimientos()
    setGuardando(false)
  }

  async function handleEliminar(id) {
    if (!confirm('¿Eliminar este movimiento?')) return
    await supabase.from('movimientos').delete().eq('id', id)
    await cargarMovimientos()
  }

  function handleEditar(mov) {
    setEditando(mov)
    setForm({ tipo: mov.tipo, monto: String(mov.monto), descripcion: mov.descripcion || '' })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function resetForm() {
    setForm({ tipo: 'venta_efectivo', monto: '', descripcion: '' })
    setShowForm(false)
    setEditando(null)
  }

  const mesLabel = format(mesActual, 'MMMM yyyy', { locale: es })

  return (
    <Layout>
      <div className="flex flex-col gap-6 animate-fade-in">

        {/* Header mes */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl font-semibold text-criterio-blanco capitalize">
              {mesLabel}
            </h2>
            <p className="text-criterio-texto/40 font-mono text-xs mt-1">
              {format(hoy, "EEEE d 'de' MMMM", { locale: es })}
            </p>
          </div>
          <button
            onClick={() => { resetForm(); setShowForm(true) }}
            className="btn-primary w-auto px-5 py-2.5 text-sm"
          >
            + Nuevo
          </button>
        </div>

        {/* Formulario */}
        {showForm && (
          <div className="card border-criterio-acento/30 animate-fade-in">
            <h3 className="section-title mb-4">
              {editando ? 'Editar movimiento' : 'Nuevo movimiento'}
            </h3>
            <form onSubmit={handleGuardar} className="flex flex-col gap-4">
              <div>
                <label className="stat-label block mb-2">Tipo</label>
                <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                  <optgroup label="Ventas">
                    <option value="venta_efectivo">Venta Efectivo</option>
                    <option value="venta_transferencia">Venta Transferencia</option>
                  </optgroup>
                  <optgroup label="Gastos">
                    <option value="gasto_efectivo">Gasto Efectivo</option>
                    <option value="gasto_transferencia">Gasto Transferencia</option>
                  </optgroup>
                  <optgroup label="Otros">
                    <option value="mercaderia_recibida">Mercadería Recibida</option>
                    <option value="entrega_dueno_efectivo">Entrega a Dueño (Efectivo)</option>
                    <option value="entrega_dueno_transferencia">Entrega a Dueño (Transf.)</option>
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="stat-label block mb-2">Monto ($)</label>
                <input
                  type="number"
                  value={form.monto}
                  onChange={e => setForm(f => ({ ...f, monto: e.target.value }))}
                  placeholder="0"
                  min="1"
                  step="1"
                />
              </div>

              <div>
                <label className="stat-label block mb-2">Descripción (opcional)</label>
                <input
                  type="text"
                  value={form.descripcion}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Ej: 3 packs remeras"
                />
              </div>

              {error && <p className="text-red-400 font-mono text-sm">{error}</p>}

              <div className="flex gap-3">
                <button type="submit" className="btn-primary" disabled={guardando}>
                  {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Registrar'}
                </button>
                <button type="button" onClick={resetForm} className="btn-secondary">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Stats del mes */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="stat-card">
            <span className="stat-label">Ventas efectivo</span>
            <span className="stat-value-accent">{formatPeso(totalVentasEf)}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Ventas transf.</span>
            <span className="stat-value-accent">{formatPeso(totalVentasTrans)}</span>
          </div>
          <div className="stat-card col-span-2 sm:col-span-1">
            <span className="stat-label">Total ventas</span>
            <span className="stat-value text-criterio-acento2">{formatPeso(totalVentas)}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Gastos efectivo</span>
            <span className="text-xl font-display text-red-400">{formatPeso(totalGastosEf)}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Gastos transf.</span>
            <span className="text-xl font-display text-red-400">{formatPeso(totalGastosTrans)}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Saldo en caja</span>
            <span className={`text-xl font-display font-semibold ${saldoCaja >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatPeso(saldoCaja)}
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Mercadería recibida</span>
            <span className="text-xl font-display text-blue-400">{formatPeso(totalMercaderia)}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Entregado a dueño</span>
            <span className="text-xl font-display text-yellow-400">
              {formatPeso(totalEntregaEf + totalEntregaTrans)}
            </span>
          </div>
        </div>

        {/* Movimientos de hoy */}
        <div>
          <h3 className="section-title">Movimientos de hoy</h3>
          {movHoy.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-criterio-texto/30 font-mono text-sm">Sin movimientos hoy</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {movHoy.map(mov => {
                const cfg = TIPO_CONFIG[mov.tipo]
                return (
                  <div key={mov.id} className="card flex items-center justify-between gap-4 py-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className={`badge-tipo ${cfg.color} shrink-0`}>{cfg.label}</span>
                      {mov.descripcion && (
                        <span className="text-criterio-texto/50 text-sm truncate">{mov.descripcion}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono font-semibold text-criterio-blanco">
                        {formatPeso(mov.monto)}
                      </span>
                      <button onClick={() => handleEditar(mov)} className="text-criterio-texto/40 hover:text-criterio-acento text-xs font-mono">
                        editar
                      </button>
                      <button onClick={() => handleEliminar(mov.id)} className="text-criterio-texto/40 hover:text-red-400 text-xs font-mono">
                        ✕
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Historial del mes */}
        <div>
          <h3 className="section-title">Historial del mes</h3>
          {loading ? (
            <div className="card text-center py-8">
              <p className="text-criterio-texto/30 font-mono text-sm animate-pulse">Cargando...</p>
            </div>
          ) : movimientos.filter(m => m.fecha !== hoyStr).length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-criterio-texto/30 font-mono text-sm">Sin movimientos anteriores</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {movimientos
                .filter(m => m.fecha !== hoyStr)
                .map(mov => {
                  const cfg = TIPO_CONFIG[mov.tipo]
                  return (
                    <div key={mov.id} className="card flex items-center justify-between gap-4 py-3 opacity-80">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="text-criterio-texto/30 font-mono text-xs shrink-0">
                          {format(new Date(mov.fecha + 'T12:00:00'), 'd MMM', { locale: es })}
                        </span>
                        <span className={`badge-tipo ${cfg.color} shrink-0`}>{cfg.label}</span>
                        {mov.descripcion && (
                          <span className="text-criterio-texto/40 text-sm truncate">{mov.descripcion}</span>
                        )}
                      </div>
                      <span className="font-mono text-sm text-criterio-texto/70 shrink-0">
                        {formatPeso(mov.monto)}
                      </span>
                    </div>
                  )
                })}
            </div>
          )}
        </div>

      </div>
    </Layout>
  )
}
