import { useState, useEffect, useCallback } from 'react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from 'recharts'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Layout, { TIPO_CONFIG } from '../../components/Layout'

function formatPeso(n) {
  if (!n) return '$0'
  if (Math.abs(n) >= 1_000_000) return `$${(n/1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${(n/1_000).toFixed(0)}K`
  return new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(n)
}
function formatPesoFull(n) {
  return new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(n||0)
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const AÑO = 2026
const TABS = ['resumen','movimientos','gastos','anual','comparar','proyeccion','config']
const TAB_LABELS = {resumen:'Resumen',movimientos:'Movimientos',gastos:'Gastos Fijos',anual:'Anual',comparar:'Comparar',proyeccion:'Proyección',config:'Config'}

export default function GerenciaDashboard() {
  const hoy = new Date()
  const [mesIdx, setMesIdx] = useState(hoy.getMonth())
  const [locales, setLocales] = useState([])
  const [localSel, setLocalSel] = useState(null)
  const [movimientos, setMovimientos] = useState([])
  const [gastosFijos, setGastosFijos] = useState(null)
  const [resumenAnual, setResumenAnual] = useState([])
  const [tab, setTab] = useState('resumen')
  const [guardandoGF, setGuardandoGF] = useState(false)
  const [editandoMov, setEditandoMov] = useState(null)
  const [formMov, setFormMov] = useState({ tipo:'venta_efectivo', monto:'', descripcion:'' })
  const [showFormMov, setShowFormMov] = useState(false)
  const [formGF, setFormGF] = useState({ alquiler:'', servicios:'', otros:'', sueldo_empleado_fabrica:'', sueldo_minimo_encargada:'1500000' })
  const [config, setConfig] = useState({ comision_pct: 3 })
  const [guardandoConfig, setGuardandoConfig] = useState(false)
  // Comparar
  const [cmpModo, setCmpModo] = useState('mes') // mes | anio | periodo
  const [cmpMes1, setCmpMes1] = useState(hoy.getMonth() > 0 ? hoy.getMonth()-1 : 0)
  const [cmpMes2, setCmpMes2] = useState(hoy.getMonth())
  const [cmpAnio1, setCmpAnio1] = useState(AÑO-1)
  const [cmpAnio2, setCmpAnio2] = useState(AÑO)
  const [cmpData1, setCmpData1] = useState([])
  const [cmpData2, setCmpData2] = useState([])
  const [cmpPer1Desde, setCmpPer1Desde] = useState(0)
  const [cmpPer1Hasta, setCmpPer1Hasta] = useState(2)
  const [cmpPer2Desde, setCmpPer2Desde] = useState(3)
  const [cmpPer2Hasta, setCmpPer2Hasta] = useState(5)

  useEffect(() => {
    supabase.from('locales').select('*').eq('activo',true).then(({data}) => {
      setLocales(data||[])
      if (data?.length>0) setLocalSel(data[0])
    })
  }, [])

  const cargarMovimientos = useCallback(async () => {
    if (!localSel) return
    const mesDate = new Date(AÑO, mesIdx, 1)
    const {data} = await supabase.from('movimientos').select('*')
      .eq('local_id', localSel.id)
      .gte('fecha', format(startOfMonth(mesDate),'yyyy-MM-dd'))
      .lte('fecha', format(endOfMonth(mesDate),'yyyy-MM-dd'))
      .order('created_at',{ascending:false})
    setMovimientos(data||[])
  }, [localSel, mesIdx])

  const cargarGastosFijos = useCallback(async () => {
    if (!localSel) return
    const {data} = await supabase.from('gastos_fijos').select('*')
      .eq('local_id', localSel.id).eq('mes', mesIdx+1).eq('anio', AÑO).single()
    if (data) {
      setGastosFijos(data)
      setFormGF({ alquiler: String(data.alquiler||''), servicios: String(data.servicios||''), otros: String(data.otros||''), sueldo_empleado_fabrica: String(data.sueldo_empleado_fabrica||''), sueldo_minimo_encargada: String(data.sueldo_minimo_encargada||'1500000') })
      if (data.comision_pct) setConfig({ comision_pct: data.comision_pct })
    } else {
      setGastosFijos(null)
      setFormGF({ alquiler:'', servicios:'', otros:'', sueldo_empleado_fabrica:'', sueldo_minimo_encargada:'1500000' })
    }
  }, [localSel, mesIdx])

  const cargarAnual = useCallback(async () => {
    if (!localSel) return
    const {data} = await supabase.from('movimientos').select('fecha,tipo,monto')
      .eq('local_id', localSel.id).gte('fecha',`${AÑO}-01-01`).lte('fecha',`${AÑO}-12-31`)
    const porMes = MESES.map((mes,i) => ({ mes, ventas:0, gastos:0, mercaderia:0, entregado:0, cantVentas:0 }))
    ;(data||[]).forEach(m => {
      const mi = new Date(m.fecha+'T12:00:00').getMonth()
      if (m.tipo.startsWith('venta')) { porMes[mi].ventas += Number(m.monto); porMes[mi].cantVentas++ }
      else if (m.tipo.startsWith('gasto')) porMes[mi].gastos += Number(m.monto)
      else if (m.tipo==='mercaderia_recibida') porMes[mi].mercaderia += Number(m.monto)
      else if (m.tipo.startsWith('entrega')) porMes[mi].entregado += Number(m.monto)
    })
    // Calcular crecimiento mes a mes
    porMes.forEach((m,i) => {
      if (i>0 && porMes[i-1].ventas>0) {
        m.crecimiento = ((m.ventas - porMes[i-1].ventas) / porMes[i-1].ventas * 100).toFixed(1)
      } else m.crecimiento = null
    })
    setResumenAnual(porMes)
  }, [localSel])

  useEffect(() => { cargarMovimientos(); cargarGastosFijos(); cargarAnual() }, [cargarMovimientos, cargarGastosFijos, cargarAnual])

  // Totales mes
  const totales = movimientos.reduce((acc,m) => { acc[m.tipo]=(acc[m.tipo]||0)+Number(m.monto); return acc }, {})
  const ventasEf=totales.venta_efectivo||0, ventasTrans=totales.venta_transferencia||0
  const gastosEf=totales.gasto_efectivo||0, gastosTrans=totales.gasto_transferencia||0
  const mercaderia=totales.mercaderia_recibida||0
  const entregaEf=totales.entrega_dueno_efectivo||0, entregaTrans=totales.entrega_dueno_transferencia||0
  const ingresoCaja=totales.ingreso_caja||0
  const cantVentas=movimientos.filter(m=>m.tipo.startsWith('venta')).length
  const totalVentas=ventasEf+ventasTrans, totalGastos=gastosEf+gastosTrans
  const alquiler=Number(formGF.alquiler||0), servicios=Number(formGF.servicios||0), otros=Number(formGF.otros||0)
  const sueldoEmp=Number(formGF.sueldo_empleado_fabrica||0), sueldoMin=Number(formGF.sueldo_minimo_encargada||1500000)
  const pct=config.comision_pct/100
  const comisionCalc=totalVentas*pct, sueldoEncargada=Math.max(sueldoMin,comisionCalc)
  const totalEgresos=totalGastos+alquiler+servicios+otros+sueldoEmp+sueldoEncargada
  const resultado=totalVentas-totalEgresos
  const saldoCaja=ventasEf-gastosEf-entregaEf-entregaTrans+ingresoCaja

  async function guardarGF(e) {
    e.preventDefault(); setGuardandoGF(true)
    const payload = { local_id:localSel.id, mes:mesIdx+1, anio:AÑO, alquiler:Number(formGF.alquiler)||0, servicios:Number(formGF.servicios)||0, otros:Number(formGF.otros)||0, sueldo_empleado_fabrica:Number(formGF.sueldo_empleado_fabrica)||0, sueldo_minimo_encargada:Number(formGF.sueldo_minimo_encargada)||1500000, updated_at:new Date().toISOString() }
    if (gastosFijos?.id) await supabase.from('gastos_fijos').update(payload).eq('id',gastosFijos.id)
    else await supabase.from('gastos_fijos').insert(payload)
    await cargarGastosFijos(); setGuardandoGF(false)
  }

  async function guardarConfig(e) {
    e.preventDefault(); setGuardandoConfig(true)
    // Store config in gastos_fijos as extra field or separate table
    // For now just save in state and gastos_fijos
    const payload = { local_id:localSel.id, mes:mesIdx+1, anio:AÑO, comision_pct:config.comision_pct, updated_at:new Date().toISOString() }
    if (gastosFijos?.id) await supabase.from('gastos_fijos').update({ comision_pct:config.comision_pct }).eq('id',gastosFijos.id)
    setGuardandoConfig(false)
    alert('Configuración guardada')
  }

  async function handleEliminarMov(id) {
    if (!confirm('¿Eliminar?')) return
    await supabase.from('movimientos').delete().eq('id',id)
    await cargarMovimientos()
  }

  async function handleGuardarMov(e) {
    e.preventDefault()
    if (!formMov.monto || Number(formMov.monto)<=0) return
    if (editandoMov) {
      await supabase.from('movimientos').update({ tipo:formMov.tipo, monto:Number(formMov.monto), descripcion:formMov.descripcion }).eq('id',editandoMov.id)
    }
    await cargarMovimientos()
    setShowFormMov(false); setEditandoMov(null)
    setFormMov({ tipo:'venta_efectivo', monto:'', descripcion:'' })
  }

  // Comparar — cargar datos de dos períodos
  async function cargarComparar() {
    if (!localSel) return
    const cargarPeriodo = async (desde, hasta) => {
      const {data} = await supabase.from('movimientos').select('fecha,tipo,monto')
        .eq('local_id',localSel.id).gte('fecha',desde).lte('fecha',hasta)
      const ventas=(data||[]).filter(m=>m.tipo.startsWith('venta')).reduce((s,m)=>s+Number(m.monto),0)
      const gastos=(data||[]).filter(m=>m.tipo.startsWith('gasto')).reduce((s,m)=>s+Number(m.monto),0)
      const cant=(data||[]).filter(m=>m.tipo.startsWith('venta')).length
      return { ventas, gastos, cant }
    }

    if (cmpModo==='mes') {
      const d1 = await cargarPeriodo(format(startOfMonth(new Date(AÑO,cmpMes1,1)),'yyyy-MM-dd'), format(endOfMonth(new Date(AÑO,cmpMes1,1)),'yyyy-MM-dd'))
      const d2 = await cargarPeriodo(format(startOfMonth(new Date(AÑO,cmpMes2,1)),'yyyy-MM-dd'), format(endOfMonth(new Date(AÑO,cmpMes2,1)),'yyyy-MM-dd'))
      setCmpData1([{ name:MESES[cmpMes1], ...d1 }]); setCmpData2([{ name:MESES[cmpMes2], ...d2 }])
    } else if (cmpModo==='periodo') {
      const cargarPeriodoRange = async (desdeIdx, hastaIdx) => {
        const desde = format(startOfMonth(new Date(AÑO,desdeIdx,1)),'yyyy-MM-dd')
        const hasta = format(endOfMonth(new Date(AÑO,hastaIdx,1)),'yyyy-MM-dd')
        const {data} = await supabase.from('movimientos').select('fecha,tipo,monto')
          .eq('local_id',localSel.id).gte('fecha',desde).lte('fecha',hasta)
        const ventas=(data||[]).filter(m=>m.tipo.startsWith('venta')).reduce((s,m)=>s+Number(m.monto),0)
        const gastos=(data||[]).filter(m=>m.tipo.startsWith('gasto')).reduce((s,m)=>s+Number(m.monto),0)
        const cant=(data||[]).filter(m=>m.tipo.startsWith('venta')).length
        return [{ ventas, gastos, cant }]
      }
      const [p1,p2] = await Promise.all([cargarPeriodoRange(cmpPer1Desde,cmpPer1Hasta), cargarPeriodoRange(cmpPer2Desde,cmpPer2Hasta)])
      setCmpData1(p1); setCmpData2(p2)
    } else if (cmpModo==='anio') {
      const cargarAnioData = async (anio) => {
        const {data} = await supabase.from('movimientos').select('fecha,tipo,monto')
          .eq('local_id',localSel.id).gte('fecha',`${anio}-01-01`).lte('fecha',`${anio}-12-31`)
        return MESES.map((mes,i) => {
          const movMes=(data||[]).filter(m=>new Date(m.fecha+'T12:00:00').getMonth()===i)
          return { mes:mes.slice(0,3), ventas:movMes.filter(m=>m.tipo.startsWith('venta')).reduce((s,m)=>s+Number(m.monto),0) }
        })
      }
      const [a1,a2] = await Promise.all([cargarAnioData(cmpAnio1), cargarAnioData(cmpAnio2)])
      setCmpData1(a1); setCmpData2(a2)
    }
  }

  const [proj, setProj] = useState({ clientes:4, ticket:160000, margen:43, costos:5500000 })
  const ventaProyectada=proj.clientes*proj.ticket*25
  const gananciaProyectada=ventaProyectada*(proj.margen/100)-proj.costos
  const equilibrio=proj.costos/(proj.margen/100)

  return (
    <Layout>
      <div className="flex flex-col gap-6 animate-fade-in">

        {/* Selector local + mes */}
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            {locales.map(l=>(
              <button key={l.id} onClick={()=>setLocalSel(l)}
                className={`px-4 py-2 rounded-xl font-mono text-sm transition-colors ${localSel?.id===l.id?'bg-criterio-acento text-criterio-negro':'bg-criterio-gris2 text-criterio-texto/60 hover:text-criterio-texto'}`}>
                {l.nombre}
              </button>
            ))}
          </div>
          <select value={mesIdx} onChange={e=>setMesIdx(Number(e.target.value))} className="w-auto">
            {MESES.map((m,i)=><option key={i} value={i}>{m} {AÑO}</option>)}
          </select>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-criterio-gris/50 p-1 rounded-xl overflow-x-auto">
          {TABS.map(t=>(
            <button key={t} onClick={()=>setTab(t)}
              className={`px-3 py-2 rounded-lg font-mono text-xs whitespace-nowrap transition-colors ${tab===t?'bg-criterio-acento text-criterio-negro font-semibold':'text-criterio-texto/50 hover:text-criterio-texto'}`}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {/* RESUMEN */}
        {tab==='resumen' && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                ['Ventas efectivo', ventasEf, 'text-criterio-acento'],
                ['Ventas transf.', ventasTrans, 'text-criterio-acento'],
                ['Cantidad ventas', cantVentas, 'text-criterio-blanco', true],
                ['Ingreso a caja', ingresoCaja, 'text-purple-400'],
              ].map(([l,v,c,isNum])=>(
                <div key={l} className="card flex flex-col gap-1">
                  <span className="text-xs font-mono text-criterio-texto/60 uppercase tracking-widest">{l}</span>
                  <span className={`text-xl font-display font-semibold ${c}`}>{isNum ? v : formatPesoFull(v)}</span>
                </div>
              ))}
            </div>

            <div className={`card border-2 ${resultado>=0?'border-green-700':'border-red-700'}`}>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="text-xs font-mono text-criterio-texto/60 uppercase tracking-widest">Resultado neto</p>
                  <p className={`text-4xl font-display font-bold mt-1 ${resultado>=0?'text-green-400':'text-red-400'}`}>{formatPesoFull(resultado)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-mono text-criterio-texto/60 uppercase tracking-widest">Total ingresos</p>
                  <p className="text-2xl font-display text-green-400 mt-1">{formatPesoFull(totalVentas)}</p>
                  <p className="text-xs font-mono text-criterio-texto/60 uppercase tracking-widest mt-2">Total egresos</p>
                  <p className="text-2xl font-display text-red-400 mt-1">{formatPesoFull(totalEgresos)}</p>
                </div>
              </div>
            </div>

            {/* Control caja */}
            <div className="card">
              <h3 className="font-display text-lg font-semibold text-criterio-blanco mb-4">Control de Caja</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[['Ventas ef.',ventasEf,'text-green-400'],['Gastos ef.',gastosEf,'text-red-400'],['Ingreso caja',ingresoCaja,'text-purple-400'],['Entregado dueño',entregaEf+entregaTrans,'text-yellow-400']].map(([l,v,c])=>(
                  <div key={l}><p className="text-xs font-mono text-criterio-texto/60">{l}</p><p className={`font-mono text-lg ${c}`}>{formatPesoFull(v)}</p></div>
                ))}
                <div className="col-span-2 sm:col-span-4 border-t border-criterio-gris3 pt-3">
                  <p className="text-xs font-mono text-criterio-texto/60 uppercase tracking-widest">Saldo en caja</p>
                  <p className={`font-mono text-2xl font-bold ${saldoCaja>=0?'text-green-400':'text-red-400'}`}>{formatPesoFull(saldoCaja)}</p>
                </div>
              </div>
            </div>

            {/* Sueldo */}
            <div className="card">
              <h3 className="font-display text-lg font-semibold text-criterio-blanco mb-4">Sueldo Encargada</h3>
              <div className="grid grid-cols-3 gap-3">
                <div><p className="text-xs font-mono text-criterio-texto/60">Mínimo garantizado</p><p className="font-mono text-criterio-texto">{formatPesoFull(sueldoMin)}</p></div>
                <div><p className="text-xs font-mono text-criterio-texto/60">{config.comision_pct}% sobre ventas</p><p className="font-mono text-criterio-texto">{formatPesoFull(comisionCalc)}</p></div>
                <div><p className="text-xs font-mono text-criterio-texto/60">A pagar</p><p className="font-mono text-xl font-bold text-criterio-acento">{formatPesoFull(sueldoEncargada)}</p></div>
              </div>
            </div>
          </div>
        )}

        {/* MOVIMIENTOS */}
        {tab==='movimientos' && (
          <div className="flex flex-col gap-3">
            {showFormMov && editandoMov && (
              <div className="card border-criterio-acento/30">
                <h3 className="font-display text-lg mb-4 text-criterio-blanco">Editar movimiento</h3>
                <form onSubmit={handleGuardarMov} className="flex flex-col gap-3">
                  <select value={formMov.tipo} onChange={e=>setFormMov(f=>({...f,tipo:e.target.value}))}>
                    {Object.entries(TIPO_CONFIG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <input type="number" value={formMov.monto} onChange={e=>setFormMov(f=>({...f,monto:e.target.value}))} placeholder="Monto" />
                  <input type="text" value={formMov.descripcion} onChange={e=>setFormMov(f=>({...f,descripcion:e.target.value}))} placeholder="Descripción" />
                  <div className="flex gap-3">
                    <button type="submit" className="btn-primary">Guardar</button>
                    <button type="button" onClick={()=>{setShowFormMov(false);setEditandoMov(null)}} className="btn-secondary">Cancelar</button>
                  </div>
                </form>
              </div>
            )}
            {movimientos.length===0 ? (
              <div className="card text-center py-8"><p className="text-criterio-texto/30 font-mono text-sm">Sin movimientos este mes</p></div>
            ) : movimientos.map(mov=>{
              const cfg=TIPO_CONFIG[mov.tipo]||{label:mov.tipo,color:'bg-gray-900/40 text-gray-400'}
              return (
                <div key={mov.id} className="card flex items-center justify-between gap-4 py-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-criterio-texto/30 font-mono text-xs shrink-0">{format(new Date(mov.fecha+'T12:00:00'),'d MMM',{locale:es})}</span>
                    <span className={`text-xs font-mono px-2 py-1 rounded-full shrink-0 ${cfg.color}`}>{cfg.label}</span>
                    {mov.descripcion&&<span className="text-criterio-texto/50 text-sm truncate">{mov.descripcion}</span>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono font-semibold text-criterio-blanco">{formatPesoFull(mov.monto)}</span>
                    <button onClick={()=>{setEditandoMov(mov);setFormMov({tipo:mov.tipo,monto:String(mov.monto),descripcion:mov.descripcion||''});setShowFormMov(true)}} className="text-criterio-texto/40 hover:text-criterio-acento text-xs font-mono">editar</button>
                    <button onClick={()=>handleEliminarMov(mov.id)} className="text-criterio-texto/40 hover:text-red-400 text-xs font-mono">✕</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* GASTOS FIJOS */}
        {tab==='gastos' && (
          <div className="card">
            <h3 className="font-display text-lg font-semibold text-criterio-blanco mb-4">Gastos fijos — {MESES[mesIdx]} {AÑO}</h3>
            <form onSubmit={guardarGF} className="flex flex-col gap-4">
              {[['alquiler','Alquiler ($)'],['servicios','Servicios / Expensas ($)'],['otros','Otros gastos fijos ($)'],['sueldo_empleado_fabrica','Sueldo Empleado Fábrica ($)'],['sueldo_minimo_encargada','Sueldo Mínimo Encargada ($)']].map(([k,l])=>(
                <div key={k}>
                  <label className="text-xs font-mono text-criterio-texto/50 uppercase tracking-widest block mb-2">{l}</label>
                  <input type="number" value={formGF[k]} onChange={e=>setFormGF(f=>({...f,[k]:e.target.value}))} placeholder="0" min="0" />
                </div>
              ))}
              <button type="submit" className="btn-primary" disabled={guardandoGF}>{guardandoGF?'Guardando...':'Guardar gastos fijos'}</button>
            </form>
            <div className="mt-6 pt-6 border-t border-criterio-gris3">
              <h4 className="text-xs font-mono text-criterio-texto/50 uppercase tracking-widest mb-3">Resumen egresos</h4>
              <div className="flex flex-col gap-2 font-mono text-sm">
                {[['Gastos locales',totalGastos],['Alquiler',alquiler],['Servicios',servicios],['Otros',otros],['Sueldo emp. fábrica',sueldoEmp],['Sueldo encargada',sueldoEncargada]].map(([l,v])=>(
                  <div key={l} className="flex justify-between"><span className="text-criterio-texto/60">{l}</span><span>{formatPesoFull(v)}</span></div>
                ))}
                <div className="flex justify-between border-t border-criterio-gris3 pt-2 font-bold text-red-400">
                  <span>TOTAL EGRESOS</span><span>{formatPesoFull(totalEgresos)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ANUAL */}
        {tab==='anual' && (
          <div className="flex flex-col gap-4">
            <div className="card">
              <h3 className="font-display text-lg font-semibold text-criterio-blanco mb-1">Ventas por mes — {AÑO}</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={resumenAnual}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                  <XAxis dataKey="mes" tick={{fill:'#888',fontSize:10}} tickFormatter={v=>v.slice(0,3)} />
                  <YAxis tick={{fill:'#888',fontSize:10}} tickFormatter={v=>formatPeso(v)} />
                  <Tooltip contentStyle={{background:'#1a1a1a',border:'1px solid #3a3a3a',borderRadius:8}} labelStyle={{color:'#c8a96e'}} formatter={v=>[formatPesoFull(v)]} />
                  <Bar dataKey="ventas" fill="#c8a96e" radius={[4,4,0,0]} name="Ventas" />
                  <Bar dataKey="gastos" fill="#c0392b" radius={[4,4,0,0]} name="Gastos" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Tabla con crecimiento */}
            <div className="card overflow-x-auto">
              <h3 className="font-display text-lg font-semibold text-criterio-blanco mb-4">Detalle mensual</h3>
              <table className="w-full font-mono text-sm">
                <thead>
                  <tr className="border-b border-criterio-gris3">
                    {['Mes','Ventas','Gastos','Cant.','Crecimiento'].map(h=>(
                      <th key={h} className="text-left py-2 px-3 text-xs text-criterio-texto/50 uppercase tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resumenAnual.map((row,i)=>(
                    <tr key={i} className={`border-b border-criterio-gris3/30 ${i===mesIdx?'bg-criterio-acento/5':''}`}>
                      <td className="py-2 px-3 text-criterio-texto/70">{row.mes.slice(0,3)}</td>
                      <td className="py-2 px-3 text-green-400">{formatPeso(row.ventas)}</td>
                      <td className="py-2 px-3 text-red-400">{formatPeso(row.gastos)}</td>
                      <td className="py-2 px-3 text-criterio-texto">{row.cantVentas}</td>
                      <td className="py-2 px-3">
                        {row.crecimiento===null ? <span className="text-criterio-texto/30">—</span> :
                          <span className={Number(row.crecimiento)>=0?'text-green-400':'text-red-400'}>
                            {Number(row.crecimiento)>=0?'▲':'▼'} {Math.abs(row.crecimiento)}%
                          </span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* COMPARAR */}
        {tab==='comparar' && (
          <div className="flex flex-col gap-4">
            <div className="card">
              <h3 className="font-display text-lg font-semibold text-criterio-blanco mb-4">Comparar períodos</h3>
              <div className="flex gap-2 mb-4 flex-wrap">
                {[['mes','Mes vs Mes'],['anio','Año vs Año'],['periodo','Período libre']].map(([k,l])=>(
                  <button key={k} onClick={()=>setCmpModo(k)}
                    className={`px-4 py-2 rounded-xl font-mono text-sm ${cmpModo===k?'bg-criterio-acento text-criterio-negro':'bg-criterio-gris2 text-criterio-texto/60'}`}>{l}</button>
                ))}
              </div>

              {cmpModo==='mes' && (
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-xs font-mono text-criterio-texto/50 uppercase tracking-widest block mb-2">Mes 1</label>
                    <select value={cmpMes1} onChange={e=>setCmpMes1(Number(e.target.value))}>
                      {MESES.map((m,i)=><option key={i} value={i}>{m} {AÑO}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-mono text-criterio-texto/50 uppercase tracking-widest block mb-2">Mes 2</label>
                    <select value={cmpMes2} onChange={e=>setCmpMes2(Number(e.target.value))}>
                      {MESES.map((m,i)=><option key={i} value={i}>{m} {AÑO}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {cmpModo==='anio' && (
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-xs font-mono text-criterio-texto/50 uppercase tracking-widest block mb-2">Año 1</label>
                    <select value={cmpAnio1} onChange={e=>setCmpAnio1(Number(e.target.value))}>
                      {[2024,2025,2026,2027].map(a=><option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-mono text-criterio-texto/50 uppercase tracking-widest block mb-2">Año 2</label>
                    <select value={cmpAnio2} onChange={e=>setCmpAnio2(Number(e.target.value))}>
                      {[2024,2025,2026,2027].map(a=><option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {cmpModo==='periodo' && (
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-xs font-mono text-criterio-texto/50 uppercase tracking-widest block mb-2">Período 1 — desde</label>
                    <select value={cmpPer1Desde} onChange={e=>setCmpPer1Desde(Number(e.target.value))}>
                      {MESES.map((m,i)=><option key={i} value={i}>{m}</option>)}
                    </select>
                    <label className="text-xs font-mono text-criterio-texto/50 uppercase tracking-widest block mb-2 mt-3">hasta</label>
                    <select value={cmpPer1Hasta} onChange={e=>setCmpPer1Hasta(Number(e.target.value))}>
                      {MESES.map((m,i)=><option key={i} value={i}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-mono text-criterio-texto/50 uppercase tracking-widest block mb-2">Período 2 — desde</label>
                    <select value={cmpPer2Desde} onChange={e=>setCmpPer2Desde(Number(e.target.value))}>
                      {MESES.map((m,i)=><option key={i} value={i}>{m}</option>)}
                    </select>
                    <label className="text-xs font-mono text-criterio-texto/50 uppercase tracking-widest block mb-2 mt-3">hasta</label>
                    <select value={cmpPer2Hasta} onChange={e=>setCmpPer2Hasta(Number(e.target.value))}>
                      {MESES.map((m,i)=><option key={i} value={i}>{m}</option>)}
                    </select>
                  </div>
                </div>
              )}

              <button onClick={cargarComparar} className="btn-primary">Comparar</button>
            </div>

            {/* Resultado Mes vs Mes */}
            {cmpData1.length>0 && cmpModo==='mes' && (
              <div className="card">
                <h3 className="font-display text-lg font-semibold text-criterio-blanco mb-4">{MESES[cmpMes1]} vs {MESES[cmpMes2]}</h3>
                <div className="grid grid-cols-3 gap-4 font-mono text-sm">
                  {[['Ventas','ventas','text-criterio-acento'],['Gastos','gastos','text-red-400'],['Cant. ventas','cant','text-criterio-texto']].map(([l,k,c])=>(
                    <div key={k} className="card">
                      <p className="text-criterio-texto/50 text-xs uppercase tracking-widest mb-3">{l}</p>
                      <div className="flex flex-col gap-2">
                        <div>
                          <p className="text-criterio-texto/40 text-xs">{MESES[cmpMes1]}</p>
                          <p className={`text-lg font-bold ${c}`}>{k==='cant'?cmpData1[0]?.[k]:formatPesoFull(cmpData1[0]?.[k]||0)}</p>
                        </div>
                        <div>
                          <p className="text-criterio-texto/40 text-xs">{MESES[cmpMes2]}</p>
                          <p className={`text-lg font-bold ${c}`}>{k==='cant'?cmpData2[0]?.[k]:formatPesoFull(cmpData2[0]?.[k]||0)}</p>
                        </div>
                        {(cmpData1[0]?.[k]||0)>0&&(
                          <p className={`text-xs font-bold pt-1 border-t border-criterio-gris3 ${(cmpData2[0]?.[k]||0)>=(cmpData1[0]?.[k]||0)?'text-green-400':'text-red-400'}`}>
                            {(cmpData2[0]?.[k]||0)>=(cmpData1[0]?.[k]||0)?'▲':'▼'} {Math.abs((((cmpData2[0]?.[k]||0)-(cmpData1[0]?.[k]||0))/(cmpData1[0]?.[k]||1))*100).toFixed(1)}%
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Resultado Año vs Año */}
            {cmpData1.length>0 && cmpModo==='anio' && (
              <div className="card">
                <h3 className="font-display text-lg font-semibold text-criterio-blanco mb-4">{cmpAnio1} vs {cmpAnio2}</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                    <XAxis dataKey="mes" allowDuplicatedCategory={false} tick={{fill:'#888',fontSize:10}} />
                    <YAxis tick={{fill:'#888',fontSize:10}} tickFormatter={v=>formatPeso(v)} />
                    <Tooltip contentStyle={{background:'#1a1a1a',border:'1px solid #3a3a3a',borderRadius:8}} formatter={v=>[formatPesoFull(v)]} />
                    <Legend />
                    <Line data={cmpData1} type="monotone" dataKey="ventas" stroke="#c8a96e" strokeWidth={2} dot={{r:3}} name={String(cmpAnio1)} />
                    <Line data={cmpData2} type="monotone" dataKey="ventas" stroke="#60a5fa" strokeWidth={2} dot={{r:3}} name={String(cmpAnio2)} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Resultado Período libre */}
            {cmpData1.length>0 && cmpModo==='periodo' && (
              <div className="card">
                <h3 className="font-display text-lg font-semibold text-criterio-blanco mb-4">
                  {MESES[cmpPer1Desde]}–{MESES[cmpPer1Hasta]} vs {MESES[cmpPer2Desde]}–{MESES[cmpPer2Hasta]}
                </h3>
                <div className="grid grid-cols-3 gap-4 font-mono text-sm">
                  {[['Ventas','ventas','text-criterio-acento'],['Gastos','gastos','text-red-400'],['Cant. ventas','cant','text-criterio-texto']].map(([l,k,c])=>(
                    <div key={k} className="card">
                      <p className="text-criterio-texto/50 text-xs uppercase tracking-widest mb-3">{l}</p>
                      <div className="flex flex-col gap-2">
                        <div>
                          <p className="text-criterio-texto/40 text-xs">Período 1</p>
                          <p className={`text-lg font-bold ${c}`}>{k==='cant'?cmpData1.reduce((s,m)=>s+(m[k]||0),0):formatPesoFull(cmpData1.reduce((s,m)=>s+(m[k]||0),0))}</p>
                        </div>
                        <div>
                          <p className="text-criterio-texto/40 text-xs">Período 2</p>
                          <p className={`text-lg font-bold ${c}`}>{k==='cant'?cmpData2.reduce((s,m)=>s+(m[k]||0),0):formatPesoFull(cmpData2.reduce((s,m)=>s+(m[k]||0),0))}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* PROYECCIÓN */}
        {tab==='proyeccion' && (
          <div className="flex flex-col gap-4">
            <div className="card">
              <h3 className="font-display text-lg font-semibold text-criterio-blanco mb-4">Calculadora de rentabilidad</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {[
                  {key:'clientes',label:'Clientes por día',min:1,max:20,step:1,suffix:''},
                  {key:'ticket',label:'Ticket promedio ($)',min:10000,max:1000000,step:10000,suffix:''},
                  {key:'margen',label:'Margen (%)',min:10,max:80,step:1,suffix:'%'},
                  {key:'costos',label:'Costos fijos ($)',min:1000000,max:20000000,step:100000,suffix:''},
                ].map(({key,label,min,max,step,suffix})=>(
                  <div key={key}>
                    <div className="flex justify-between mb-2">
                      <label className="text-xs font-mono text-criterio-texto/60 uppercase tracking-widest">{label}</label>
                      <span className="font-mono text-criterio-acento text-sm">{key==='ticket'||key==='costos'?formatPesoFull(proj[key]):`${proj[key]}${suffix}`}</span>
                    </div>
                    <input type="range" min={min} max={max} step={step} value={proj[key]} onChange={e=>setProj(p=>({...p,[key]:Number(e.target.value)}))} className="w-full accent-criterio-acento bg-transparent border-none p-0 cursor-pointer" />
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="card"><p className="text-xs font-mono text-criterio-texto/60 uppercase tracking-widest">Venta mensual proyectada</p><p className="text-xl font-display font-semibold text-criterio-acento mt-1">{formatPesoFull(ventaProyectada)}</p></div>
              <div className="card"><p className="text-xs font-mono text-criterio-texto/60 uppercase tracking-widest">Punto de equilibrio</p><p className="text-xl font-display text-criterio-texto mt-1">{formatPesoFull(equilibrio)}</p></div>
              <div className={`card col-span-2 sm:col-span-1 border ${gananciaProyectada>=0?'border-green-700':'border-red-700'}`}>
                <p className="text-xs font-mono text-criterio-texto/60 uppercase tracking-widest">Ganancia neta</p>
                <p className={`text-2xl font-display font-bold mt-1 ${gananciaProyectada>=0?'text-green-400':'text-red-400'}`}>{formatPesoFull(gananciaProyectada)}</p>
              </div>
            </div>
          </div>
        )}

        {/* CONFIG */}
        {tab==='config' && (
          <div className="card">
            <h3 className="font-display text-lg font-semibold text-criterio-blanco mb-4">Configuración del local</h3>
            <form onSubmit={guardarConfig} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-mono text-criterio-texto/50 uppercase tracking-widest block mb-2">
                  % Comisión encargada (actualmente {config.comision_pct}%)
                </label>
                <div className="flex items-center gap-4">
                  <input type="range" min={1} max={20} step={0.5} value={config.comision_pct}
                    onChange={e=>setConfig(c=>({...c,comision_pct:Number(e.target.value)}))}
                    className="flex-1 accent-criterio-acento bg-transparent border-none p-0 cursor-pointer" />
                  <span className="font-mono text-criterio-acento text-xl w-16 text-right">{config.comision_pct}%</span>
                </div>
                <p className="text-criterio-texto/40 font-mono text-xs mt-2">
                  Con ventas de {formatPesoFull(totalVentas)}, la comisión sería {formatPesoFull(totalVentas*(config.comision_pct/100))}
                </p>
              </div>
              <button type="submit" className="btn-primary" disabled={guardandoConfig}>
                {guardandoConfig?'Guardando...':'Guardar configuración'}
              </button>
            </form>
          </div>
        )}

      </div>
    </Layout>
  )
}
