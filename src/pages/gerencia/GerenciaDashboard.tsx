import { useState, useEffect, useCallback } from 'react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Layout, { TIPO_CONFIG } from '../../components/Layout'

function formatPeso(n) {
  if (Math.abs(n) >= 1_000_000) return `$${(n/1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${(n/1_000).toFixed(0)}K`
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}
function formatPesoFull(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const AÑO = 2026

export default function GerenciaDashboard() {
  const { perfil } = useAuth()
  const hoy = new Date()
  const [mesIdx, setMesIdx] = useState(hoy.getMonth())
  const [locales, setLocales] = useState([])
  const [localSeleccionado, setLocalSeleccionado] = useState(null)
  const [movimientos, setMovimientos] = useState([])
  const [gastosFijos, setGastosFijos] = useState(null)
  const [resumenAnual, setResumenAnual] = useState([])
  const [loadingMov, setLoadingMov] = useState(true)
  const [tab, setTab] = useState('resumen') // resumen | movimientos | gastos | proyeccion
  const [guardandoGF, setGuardandoGF] = useState(false)
  const [formGF, setFormGF] = useState({
    alquiler: '', servicios: '', otros: '',
    sueldo_empleado_fabrica: '', sueldo_minimo_encargada: '1500000'
  })

  // Cargar locales
  useEffect(() => {
    supabase.from('locales').select('*').eq('activo', true).then(({ data }) => {
      setLocales(data || [])
      if (data?.length > 0) setLocalSeleccionado(data[0])
    })
  }, [])

  const cargarMovimientos = useCallback(async () => {
    if (!localSeleccionado) return
    setLoadingMov(true)
    const mesDate = new Date(AÑO, mesIdx, 1)
    const desde = format(startOfMonth(mesDate), 'yyyy-MM-dd')
    const hasta = format(endOfMonth(mesDate), 'yyyy-MM-dd')

    const { data } = await supabase
      .from('movimientos')
      .select('*')
      .eq('local_id', localSeleccionado.id)
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .order('created_at', { ascending: false })

    setMovimientos(data || [])
    setLoadingMov(false)
  }, [localSeleccionado, mesIdx])

  const cargarGastosFijos = useCallback(async () => {
    if (!localSeleccionado) return
    const { data } = await supabase
      .from('gastos_fijos')
      .select('*')
      .eq('local_id', localSeleccionado.id)
      .eq('mes', mesIdx + 1)
      .eq('anio', AÑO)
      .single()

    if (data) {
      setGastosFijos(data)
      setFormGF({
        alquiler: String(data.alquiler || ''),
        servicios: String(data.servicios || ''),
        otros: String(data.otros || ''),
        sueldo_empleado_fabrica: String(data.sueldo_empleado_fabrica || ''),
        sueldo_minimo_encargada: String(data.sueldo_minimo_encargada || '1500000'),
      })
    } else {
      setGastosFijos(null)
      setFormGF({ alquiler: '', servicios: '', otros: '', sueldo_empleado_fabrica: '', sueldo_minimo_encargada: '1500000' })
    }
  }, [localSeleccionado, mesIdx])

  const cargarResumenAnual = useCallback(async () => {
    if (!localSeleccionado) return
    const desde = `${AÑO}-01-01`
    const hasta = `${AÑO}-12-31`

    const { data } = await supabase
      .from('movimientos')
      .select('fecha, tipo, monto')
      .eq('local_id', localSeleccionado.id)
      .gte('fecha', desde)
      .lte('fecha', hasta)

    // Agrupar por mes
    const porMes = Array.from({ length: 12 }, (_, i) => ({
      mes: MESES[i],
      ventas: 0, gastos: 0, mercaderia: 0, entregado: 0
    }))

    ;(data || []).forEach(m => {
      const mesI = new Date(m.fecha + 'T12:00:00').getMonth()
      if (m.tipo.startsWith('venta')) porMes[mesI].ventas += Number(m.monto)
      else if (m.tipo.startsWith('gasto')) porMes[mesI].gastos += Number(m.monto)
      else if (m.tipo === 'mercaderia_recibida') porMes[mesI].mercaderia += Number(m.monto)
      else if (m.tipo.startsWith('entrega')) porMes[mesI].entregado += Number(m.monto)
    })

    setResumenAnual(porMes)
  }, [localSeleccionado])

  useEffect(() => {
    cargarMovimientos()
    cargarGastosFijos()
    cargarResumenAnual()
  }, [cargarMovimientos, cargarGastosFijos, cargarResumenAnual])

  // Calcular totales del mes
  const totales = movimientos.reduce((acc, m) => {
    if (!acc[m.tipo]) acc[m.tipo] = 0
    acc[m.tipo] += Number(m.monto)
    return acc
  }, {})

  const ventasEf    = totales.venta_efectivo || 0
  const ventasTrans = totales.venta_transferencia || 0
  const gastosEf    = totales.gasto_efectivo || 0
  const gastosTrans = totales.gasto_transferencia || 0
  const mercaderia  = totales.mercaderia_recibida || 0
  const entregaEf   = totales.entrega_dueno_efectivo || 0
  const entregaTrans= totales.entrega_dueno_transferencia || 0
  const totalVentas = ventasEf + ventasTrans
  const totalGastos = gastosEf + gastosTrans

  // Gastos fijos
  const gf = gastosFijos
  const alquiler = Number(gf?.alquiler || 0)
  const servicios = Number(gf?.servicios || 0)
  const otros     = Number(gf?.otros || 0)
  const sueldoEmp = Number(gf?.sueldo_empleado_fabrica || 0)
  const sueldoMin = Number(gf?.sueldo_minimo_encargada || 1500000)
  const tresPorciento = totalVentas * 0.03
  const sueldoEncargada = Math.max(sueldoMin, tresPorciento)
  const totalGastosFijos = alquiler + servicios + otros + sueldoEmp + sueldoEncargada

  const totalEgresos = totalGastos + totalGastosFijos
  const totalIngresos = totalVentas
  const resultado = totalIngresos - totalEgresos

  // Stock acumulado (simplificado: mercadería - ventas del mes)
  const stockMes = mercaderia - totalVentas
  const saldoCaja = ventasEf - gastosEf - entregaEf - entregaTrans

  async function guardarGastosFijos(e) {
    e.preventDefault()
    setGuardandoGF(true)
    const payload = {
      local_id: localSeleccionado.id,
      mes: mesIdx + 1,
      anio: AÑO,
      alquiler: Number(formGF.alquiler) || 0,
      servicios: Number(formGF.servicios) || 0,
      otros: Number(formGF.otros) || 0,
      sueldo_empleado_fabrica: Number(formGF.sueldo_empleado_fabrica) || 0,
      sueldo_minimo_encargada: Number(formGF.sueldo_minimo_encargada) || 1500000,
      updated_at: new Date().toISOString(),
    }
    if (gastosFijos?.id) {
      await supabase.from('gastos_fijos').update(payload).eq('id', gastosFijos.id)
    } else {
      await supabase.from('gastos_fijos').insert(payload)
    }
    await cargarGastosFijos()
    setGuardandoGF(false)
  }

  // Proyección
  const [proj, setProj] = useState({ clientes: 4, ticket: 160000, margen: 43, costos: 5500000 })
  const ventaProyectada = proj.clientes * proj.ticket * 25
  const gananciaProyectada = ventaProyectada * (proj.margen / 100) - proj.costos
  const equilibrio = proj.costos / (proj.margen / 100)

  const TABS = [
    { id: 'resumen', label: 'Resumen' },
    { id: 'movimientos', label: 'Movimientos' },
    { id: 'gastos', label: 'Gastos Fijos' },
    { id: 'anual', label: 'Anual' },
    { id: 'proyeccion', label: 'Proyección' },
  ]

  return (
    <Layout>
      <div className="flex flex-col gap-6 animate-fade-in">

        {/* Selector local + mes */}
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            {locales.map(l => (
              <button
                key={l.id}
                onClick={() => setLocalSeleccionado(l)}
                className={`px-4 py-2 rounded-xl font-mono text-sm transition-colors ${
                  localSeleccionado?.id === l.id
                    ? 'bg-criterio-acento text-criterio-negro'
                    : 'bg-criterio-gris2 text-criterio-texto/60 hover:text-criterio-texto'
                }`}
              >
                {l.nombre}
              </button>
            ))}
          </div>
          <select
            value={mesIdx}
            onChange={e => setMesIdx(Number(e.target.value))}
            className="w-auto"
          >
            {MESES.map((m, i) => (
              <option key={i} value={i}>{m} {AÑO}</option>
            ))}
          </select>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-criterio-gris/50 p-1 rounded-xl overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-lg font-mono text-xs whitespace-nowrap transition-colors ${
                tab === t.id
                  ? 'bg-criterio-acento text-criterio-negro font-semibold'
                  : 'text-criterio-texto/50 hover:text-criterio-texto'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* TAB: RESUMEN */}
        {tab === 'resumen' && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="stat-card">
                <span className="stat-label">Ventas efectivo</span>
                <span className="stat-value-accent">{formatPesoFull(ventasEf)}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Ventas transf.</span>
                <span className="stat-value-accent">{formatPesoFull(ventasTrans)}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Total ingresos</span>
                <span className="stat-value text-green-400">{formatPesoFull(totalIngresos)}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Total egresos</span>
                <span className="stat-value text-red-400">{formatPesoFull(totalEgresos)}</span>
              </div>
            </div>

            {/* Balance */}
            <div className={`card border-2 ${resultado >= 0 ? 'border-green-700' : 'border-red-700'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="stat-label">Resultado neto del mes</p>
                  <p className={`text-4xl font-display font-bold mt-1 ${resultado >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatPesoFull(resultado)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="stat-label">Stock en local</p>
                  <p className="text-2xl font-display text-blue-400 mt-1">{formatPesoFull(stockMes)}</p>
                </div>
              </div>
            </div>

            {/* Control caja */}
            <div className="card">
              <h3 className="section-title">Control de Caja</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <p className="stat-label">Ventas efectivo</p>
                  <p className="font-mono text-lg text-criterio-blanco">{formatPesoFull(ventasEf)}</p>
                </div>
                <div>
                  <p className="stat-label">Gastos efectivo</p>
                  <p className="font-mono text-lg text-red-400">{formatPesoFull(gastosEf)}</p>
                </div>
                <div>
                  <p className="stat-label">Entregado a dueño</p>
                  <p className="font-mono text-lg text-yellow-400">{formatPesoFull(entregaEf + entregaTrans)}</p>
                </div>
                <div className="col-span-2 sm:col-span-3 border-t border-criterio-gris3 pt-3 mt-1">
                  <p className="stat-label">Saldo en caja (debería haber)</p>
                  <p className={`font-mono text-2xl font-bold ${saldoCaja >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatPesoFull(saldoCaja)}
                  </p>
                </div>
              </div>
            </div>

            {/* Sueldo encargada */}
            <div className="card">
              <h3 className="section-title">Sueldo Encargada</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="stat-label">Mínimo garantizado</p>
                  <p className="font-mono text-criterio-texto">{formatPesoFull(sueldoMin)}</p>
                </div>
                <div>
                  <p className="stat-label">3% sobre ventas</p>
                  <p className="font-mono text-criterio-texto">{formatPesoFull(tresPorciento)}</p>
                </div>
                <div>
                  <p className="stat-label">A pagar</p>
                  <p className="font-mono text-xl font-bold text-criterio-acento">{formatPesoFull(sueldoEncargada)}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: MOVIMIENTOS */}
        {tab === 'movimientos' && (
          <div>
            {loadingMov ? (
              <div className="card text-center py-8">
                <p className="text-criterio-texto/30 font-mono text-sm animate-pulse">Cargando...</p>
              </div>
            ) : movimientos.length === 0 ? (
              <div className="card text-center py-8">
                <p className="text-criterio-texto/30 font-mono text-sm">Sin movimientos este mes</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {movimientos.map(mov => {
                  const cfg = TIPO_CONFIG[mov.tipo]
                  return (
                    <div key={mov.id} className="card flex items-center justify-between gap-4 py-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="text-criterio-texto/30 font-mono text-xs shrink-0">
                          {format(new Date(mov.fecha + 'T12:00:00'), 'd MMM', { locale: es })}
                        </span>
                        <span className={`badge-tipo ${cfg.color} shrink-0`}>{cfg.label}</span>
                        {mov.descripcion && (
                          <span className="text-criterio-texto/50 text-sm truncate">{mov.descripcion}</span>
                        )}
                      </div>
                      <span className="font-mono font-semibold text-criterio-blanco shrink-0">
                        {formatPesoFull(mov.monto)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB: GASTOS FIJOS */}
        {tab === 'gastos' && (
          <div className="card">
            <h3 className="section-title">Gastos fijos — {MESES[mesIdx]} {AÑO}</h3>
            <form onSubmit={guardarGastosFijos} className="flex flex-col gap-4">
              {[
                ['alquiler', 'Alquiler ($)'],
                ['servicios', 'Servicios / Expensas ($)'],
                ['otros', 'Otros gastos fijos ($)'],
                ['sueldo_empleado_fabrica', 'Sueldo Empleado Fábrica ($)'],
                ['sueldo_minimo_encargada', 'Sueldo Mínimo Encargada ($)'],
              ].map(([key, label]) => (
                <div key={key}>
                  <label className="stat-label block mb-2">{label}</label>
                  <input
                    type="number"
                    value={formGF[key]}
                    onChange={e => setFormGF(f => ({ ...f, [key]: e.target.value }))}
                    placeholder="0"
                    min="0"
                  />
                </div>
              ))}
              <button type="submit" className="btn-primary" disabled={guardandoGF}>
                {guardandoGF ? 'Guardando...' : 'Guardar gastos fijos'}
              </button>
            </form>

            {gastosFijos && (
              <div className="mt-6 pt-6 border-t border-criterio-gris3">
                <h4 className="stat-label mb-3">Resumen egresos del mes</h4>
                <div className="flex flex-col gap-2 font-mono text-sm">
                  {[
                    ['Gastos locales (ef + trans)', totalGastos],
                    ['Alquiler', alquiler],
                    ['Servicios', servicios],
                    ['Otros', otros],
                    ['Sueldo empleado fábrica', sueldoEmp],
                    ['Sueldo encargada', sueldoEncargada],
                  ].map(([label, val]) => (
                    <div key={label} className="flex justify-between">
                      <span className="text-criterio-texto/60">{label}</span>
                      <span className="text-criterio-texto">{formatPesoFull(val)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-criterio-gris3 pt-2 font-bold">
                    <span className="text-red-400">TOTAL EGRESOS</span>
                    <span className="text-red-400">{formatPesoFull(totalEgresos)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: ANUAL */}
        {tab === 'anual' && (
          <div className="flex flex-col gap-4">
            <div className="card">
              <h3 className="section-title">Ventas por mes — {AÑO}</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={resumenAnual}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                  <XAxis dataKey="mes" tick={{ fill: '#888', fontSize: 10 }} tickFormatter={v => v.slice(0,3)} />
                  <YAxis tick={{ fill: '#888', fontSize: 10 }} tickFormatter={v => formatPeso(v)} />
                  <Tooltip
                    contentStyle={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: 8 }}
                    labelStyle={{ color: '#c8a96e' }}
                    formatter={v => [formatPesoFull(v)]}
                  />
                  <Bar dataKey="ventas" fill="#c8a96e" radius={[4,4,0,0]} name="Ventas" />
                  <Bar dataKey="gastos" fill="#c0392b" radius={[4,4,0,0]} name="Gastos" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full font-mono text-sm">
                <thead>
                  <tr className="border-b border-criterio-gris3">
                    {['Mes', 'Ventas', 'Gastos', 'Mercadería', 'Entregado'].map(h => (
                      <th key={h} className="text-left py-2 px-3 stat-label">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resumenAnual.map((row, i) => (
                    <tr key={i} className={`border-b border-criterio-gris3/30 ${i === mesIdx ? 'bg-criterio-acento/5' : ''}`}>
                      <td className="py-2 px-3 text-criterio-texto/70">{row.mes.slice(0,3)}</td>
                      <td className="py-2 px-3 text-green-400">{formatPeso(row.ventas)}</td>
                      <td className="py-2 px-3 text-red-400">{formatPeso(row.gastos)}</td>
                      <td className="py-2 px-3 text-blue-400">{formatPeso(row.mercaderia)}</td>
                      <td className="py-2 px-3 text-yellow-400">{formatPeso(row.entregado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: PROYECCIÓN */}
        {tab === 'proyeccion' && (
          <div className="flex flex-col gap-4">
            <div className="card">
              <h3 className="section-title">Calculadora de rentabilidad</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {[
                  { key: 'clientes', label: 'Clientes por día', min: 1, max: 20, step: 1, suffix: '' },
                  { key: 'ticket', label: 'Ticket promedio ($)', min: 10000, max: 1000000, step: 10000, suffix: '' },
                  { key: 'margen', label: 'Margen (%)', min: 10, max: 80, step: 1, suffix: '%' },
                  { key: 'costos', label: 'Costos fijos ($)', min: 1000000, max: 20000000, step: 100000, suffix: '' },
                ].map(({ key, label, min, max, step, suffix }) => (
                  <div key={key}>
                    <div className="flex justify-between mb-2">
                      <label className="stat-label">{label}</label>
                      <span className="font-mono text-criterio-acento text-sm">
                        {key === 'ticket' || key === 'costos'
                          ? formatPesoFull(proj[key])
                          : `${proj[key]}${suffix}`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={min} max={max} step={step}
                      value={proj[key]}
                      onChange={e => setProj(p => ({ ...p, [key]: Number(e.target.value) }))}
                      className="w-full accent-criterio-acento bg-transparent border-none p-0 cursor-pointer"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="stat-card">
                <span className="stat-label">Venta mensual proyectada</span>
                <span className="stat-value-accent">{formatPesoFull(ventaProyectada)}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Punto de equilibrio</span>
                <span className="stat-value text-criterio-texto">{formatPesoFull(equilibrio)}</span>
              </div>
              <div className={`stat-card col-span-2 sm:col-span-1 border ${gananciaProyectada >= 0 ? 'border-green-700' : 'border-red-700'}`}>
                <span className="stat-label">Ganancia neta</span>
                <span className={`text-2xl font-display font-bold ${gananciaProyectada >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatPesoFull(gananciaProyectada)}
                </span>
              </div>
            </div>

            {/* Curva de 12 meses */}
            <div className="card">
              <h3 className="section-title">Proyección 12 meses (crecimiento gradual)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={MESES.map((m, i) => {
                  const clientesMes = proj.clientes + (i * 0.2)
                  const ventaMes = clientesMes * proj.ticket * 25
                  const gananciaMes = ventaMes * (proj.margen / 100) - proj.costos
                  return { mes: m.slice(0,3), ganancia: Math.round(gananciaMes) }
                })}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                  <XAxis dataKey="mes" tick={{ fill: '#888', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#888', fontSize: 10 }} tickFormatter={v => formatPeso(v)} />
                  <Tooltip
                    contentStyle={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: 8 }}
                    formatter={v => [formatPesoFull(v), 'Ganancia']}
                  />
                  <Line
                    type="monotone" dataKey="ganancia"
                    stroke="#c8a96e" strokeWidth={2} dot={{ fill: '#c8a96e', r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

      </div>
    </Layout>
  )
}
