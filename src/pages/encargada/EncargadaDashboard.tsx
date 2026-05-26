import { useState, useEffect, useCallback } from 'react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Layout, { TIPO_CONFIG } from '../../components/Layout'

function formatPeso(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0)
}

export default function EncargadaDashboard() {
  const { perfil } = useAuth()
  const localId = perfil?.local_id
  const hoy = new Date()
  const hoyStr = format(hoy, 'yyyy-MM-dd')

  const [movimientos, setMovimientos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({ tipo: 'venta_efectivo', monto: '', descripcion: '' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    if (!localId) return
    setLoading(true)
    const mesDate = new Date()
    const { data } = await supabase
      .from('movimientos').select('*')
      .eq('local_id', localId)
      .gte('fecha', format(startOfMonth(mesDate), 'yyyy-MM-dd'))
      .lte('fecha', format(endOfMonth(mesDate), 'yyyy-MM-dd'))
      .order('created_at', { ascending: false })
    setMovimientos(data || [])
    setLoading(false)
  }, [localId])

  useEffect(() => { cargar() }, [cargar])

  const totales = movimientos.reduce((acc, m) => {
    acc[m.tipo] = (acc[m.tipo] || 0) + Number(m.monto)
    return acc
  }, {})

  const ventasEf    = totales.venta_efectivo || 0
  const ventasTrans = totales.venta_transferencia || 0
  const gastosEf    = totales.gasto_efectivo || 0
  const gastosTrans = totales.gasto_transferencia || 0
  const mercaderia  = totales.mercaderia_recibida || 0
  const entregaEf   = totales.entrega_dueno_efectivo || 0
  const entregaTrans= totales.entrega_dueno_transferencia || 0
  const ingresoCaja = totales.ingreso_caja || 0
  const totalVentas = ventasEf + ventasTrans
  const cantVentas  = movimientos.filter(m => m.tipo.startsWith('venta')).length
  const saldoCaja   = ventasEf - gastosEf - entregaEf - entregaTrans + ingresoCaja

  async function handleGuardar(e) {
    e.preventDefault()
    setError('')
    if (!form.monto || Number(form.monto) <= 0) { setError('Ingresá un monto válido'); return }
    setGuardando(true)
    if (editando) {
      await supabase.from('movimientos').update({ tipo: form.tipo, monto: Number(form.monto), descripcion: form.descripcion }).eq('id', editando.id)
    } else {
      await supabase.from('movimientos').insert({ local_id: localId, fecha: hoyStr, tipo: form.tipo, monto: Number(form.monto), descripcion: form.descripcion, creado_por: perfil.id })
    }
    await cargar()
    resetForm()
    setGuardando(false)
  }

  async function handleEliminar(id) {
    if (!confirm('¿Eliminar?')) return
    await supabase.from('movimientos').delete().eq('id', id)
    await cargar()
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
    setError('')
  }

  const movHoy = movimientos.filter(m => m.fecha === hoyStr)
  const movAnt  = movimientos.filter(m => m.fecha !== hoyStr)
  const mesLabel = format(hoy, 'MMMM yyyy', { locale: es })

  return (
    <Layout>
      <div className="flex flex-col gap-6 animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl font-semibold text-criterio-blanco capitalize">{mesLabel}</h2>
            <p className="text-criterio-texto/40 font-mono text-xs mt-1">{format(hoy, "EEEE d 'de' MMMM", { locale: es })}</p>
          </div>
          <button onClick={() => { resetForm(); setShowForm(true) }} className="btn-primary w-auto px-5 py-2.5 text-sm">+ Nuevo</button>
        </div>

        {/* Formulario */}
        {showForm && (
          <div className="card border-criterio-acento/30 animate-fade-in">
            <h3 className="font-display text-lg font-semibold text-criterio-blanco mb-4">{editando ? 'Editar' : 'Nuevo movimiento'}</h3>
            <form onSubmit={handleGuardar} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-mono text-criterio-texto/50 uppercase tracking-widest block mb-2">Tipo</label>
                <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                  <optgroup label="Ventas">
                    <option value="venta_efectivo">Venta Efectivo</option>
                    <option value="venta_transferencia">Venta Transferencia</option>
                  </optgroup>
                  <optgroup label="Gastos">
                    <option value="gasto_efectivo">Gasto Efectivo</option>
                    <option value="gasto_transferencia">Gasto Transferencia</option>
                  </optgroup>
                  <optgroup label="Caja">
                    <option value="ingreso_caja">Ingreso a Caja (efectivo recibido)</option>
                    <option value="entrega_dueno_efectivo">Entrega a Dueño (Efectivo)</option>
                    <option value="entrega_dueno_transferencia">Entrega a Dueño (Transf.)</option>
                  </optgroup>
                  <optgroup label="Stock">
                    <option value="mercaderia_recibida">Mercadería Recibida</option>
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="text-xs font-mono text-criterio-texto/50 uppercase tracking-widest block mb-2">Monto ($)</label>
                <input type="number" value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} placeholder="0" min="1" step="1" />
              </div>
              <div>
                <label className="text-xs font-mono text-criterio-texto/50 uppercase tracking-widest block mb-2">Descripción (opcional)</label>
                <input type="text" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Ej: 3 packs remeras" />
              </div>
              {error && <p className="text-red-400 font-mono text-sm">{error}</p>}
              <div className="flex gap-3">
                <button type="submit" className="btn-primary" disabled={guardando}>{guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Registrar'}</button>
                <button type="button" onClick={resetForm} className="btn-secondary">Cancelar</button>
              </div>
            </form>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="card flex flex-col gap-1">
            <span className="text-xs font-mono text-criterio-texto/60 uppercase tracking-widest">Ventas efectivo</span>
            <span className="text-xl font-display font-semibold text-criterio-acento">{formatPeso(ventasEf)}</span>
          </div>
          <div className="card flex flex-col gap-1">
            <span className="text-xs font-mono text-criterio-texto/60 uppercase tracking-widest">Ventas transf.</span>
            <span className="text-xl font-display font-semibold text-criterio-acento">{formatPeso(ventasTrans)}</span>
          </div>
          <div className="card flex flex-col gap-1">
            <span className="text-xs font-mono text-criterio-texto/60 uppercase tracking-widest">Total ventas</span>
            <span className="text-xl font-display font-semibold text-criterio-acento2">{formatPeso(totalVentas)}</span>
          </div>
          <div className="card flex flex-col gap-1">
            <span className="text-xs font-mono text-criterio-texto/60 uppercase tracking-widest">Cantidad ventas</span>
            <span className="text-2xl font-display font-bold text-criterio-blanco">{cantVentas}</span>
          </div>
          <div className="card flex flex-col gap-1">
            <span className="text-xs font-mono text-criterio-texto/60 uppercase tracking-widest">Gastos efectivo</span>
            <span className="text-xl font-display text-red-400">{formatPeso(gastosEf)}</span>
          </div>
          <div className="card flex flex-col gap-1">
            <span className="text-xs font-mono text-criterio-texto/60 uppercase tracking-widest">Gastos transf.</span>
            <span className="text-xl font-display text-red-400">{formatPeso(gastosTrans)}</span>
          </div>
          <div className="card flex flex-col gap-1">
            <span className="text-xs font-mono text-criterio-texto/60 uppercase tracking-widest">Ingreso a caja</span>
            <span className="text-xl font-display text-purple-400">{formatPeso(ingresoCaja)}</span>
          </div>
          <div className="card flex flex-col gap-1">
            <span className="text-xs font-mono text-criterio-texto/60 uppercase tracking-widest">Entregado dueño</span>
            <span className="text-xl font-display text-yellow-400">{formatPeso(entregaEf + entregaTrans)}</span>
          </div>
          <div className={`card flex flex-col gap-1 border ${saldoCaja >= 0 ? 'border-green-700' : 'border-red-700'}`}>
            <span className="text-xs font-mono text-criterio-texto/60 uppercase tracking-widest">Saldo en caja</span>
            <span className={`text-xl font-display font-bold ${saldoCaja >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatPeso(saldoCaja)}</span>
          </div>
        </div>

        {/* Movimientos hoy */}
        <div>
          <h3 className="font-display text-xl font-semibold text-criterio-blanco mb-4">Movimientos de hoy</h3>
          {movHoy.length === 0 ? (
            <div className="card text-center py-8"><p className="text-criterio-texto/30 font-mono text-sm">Sin movimientos hoy</p></div>
          ) : (
            <div className="flex flex-col gap-2">
              {movHoy.map(mov => {
                const cfg = TIPO_CONFIG[mov.tipo] || { label: mov.tipo, color: 'bg-gray-900/40 text-gray-400' }
                return (
                  <div key={mov.id} className="card flex items-center justify-between gap-4 py-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className={`text-xs font-mono px-2 py-1 rounded-full shrink-0 ${cfg.color}`}>{cfg.label}</span>
                      {mov.descripcion && <span className="text-criterio-texto/50 text-sm truncate">{mov.descripcion}</span>}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono font-semibold text-criterio-blanco">{formatPeso(mov.monto)}</span>
                      <button onClick={() => handleEditar(mov)} className="text-criterio-texto/40 hover:text-criterio-acento text-xs font-mono">editar</button>
                      <button onClick={() => handleEliminar(mov.id)} className="text-criterio-texto/40 hover:text-red-400 text-xs font-mono">✕</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Historial */}
        {movAnt.length > 0 && (
          <div>
            <h3 className="font-display text-xl font-semibold text-criterio-blanco mb-4">Historial del mes</h3>
            <div className="flex flex-col gap-2">
              {movAnt.map(mov => {
                const cfg = TIPO_CONFIG[mov.tipo] || { label: mov.tipo, color: 'bg-gray-900/40 text-gray-400' }
                return (
                  <div key={mov.id} className="card flex items-center justify-between gap-4 py-3 opacity-75">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-criterio-texto/30 font-mono text-xs shrink-0">{format(new Date(mov.fecha + 'T12:00:00'), 'd MMM', { locale: es })}</span>
                      <span className={`text-xs font-mono px-2 py-1 rounded-full shrink-0 ${cfg.color}`}>{cfg.label}</span>
                      {mov.descripcion && <span className="text-criterio-texto/40 text-sm truncate">{mov.descripcion}</span>}
                    </div>
                    <span className="font-mono text-sm text-criterio-texto/70 shrink-0">{formatPeso(mov.monto)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </div>
    </Layout>
  )
}
