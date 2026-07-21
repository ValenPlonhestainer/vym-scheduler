"use client"

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Loader2, CheckCircle2, AlertCircle, Calendar, Sun, X, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SelectorHermano } from '@/components/programar/selector-hermano'
import { SelectorMicrofono } from '@/components/programar/selector-microfono'
import { SelectorFDS } from '@/components/fin-de-semana/selector-fds'
import {
  getHermanos, saveSemana, saveAllAsignaciones, saveSemanaFDS, saveAllAsignacionesFDS,
  getAllAsignacionesConFecha, getAllAsignacionesFDSConFecha, getSemanas, getSemanasFDS,
  getAsignaciones, getAsignacionesFDS,
} from '@/lib/actions'
import { Asignacion, AsignacionFDS } from '@/lib/types'
import {
  Hermano, Semana, ParteTipo, PARTES_ORDEN, PARTES_INFO, SECCION_LABELS,
  SemanaFDS, ParteTipoFDS, PARTES_INFO_FDS,
} from '@/lib/types'
import { generateId, idsAsignadosReunion, claveSemanaISO } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { bocetoPDFLabel } from '@/data/bocetos'
import { SelectorBoceto } from '@/components/fin-de-semana/selector-boceto'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

type Asigs = Partial<Record<ParteTipo, string>>
type AsigsFDS = Partial<Record<ParteTipoFDS, string>>
type EpubStatus = 'idle' | 'loading' | 'ok' | 'error'
type TipoReunion = 'semana' | 'fds'

function agruparPorSeccion() {
  const secciones: Record<string, ParteTipo[]> = {}
  for (const parte of PARTES_ORDEN) {
    const sec = PARTES_INFO[parte].seccion
    if (!secciones[sec]) secciones[sec] = []
    secciones[sec].push(parte)
  }
  return secciones
}

function encontrarSemana(semanas: Array<{ fecha: string }>, fechaInput: string) {
  const normalizada = fechaInput.replace(/-/g, '/')
  const exact = semanas.find(s => s.fecha === normalizada)
  if (exact) return exact
  const inputMs = new Date(fechaInput).getTime()
  let mejor = semanas[0]
  let menorDiff = Infinity
  for (const s of semanas) {
    const ms = new Date(s.fecha.replace(/\//g, '-')).getTime()
    const diff = Math.abs(inputMs - ms)
    if (diff < menorDiff) { menorDiff = diff; mejor = s }
  }
  return mejor
}

const SECCIONES_ORDEN = ['apertura', 'tesoros', 'maestros', 'cristiana', 'cierre']
const MESES_ABBR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

// Estado inicial vacío con un id NUEVO. Clave para no pisar la semana anterior:
// cada semana guardada debe tener su propio id (el save hace upsert por id).
function nuevaSemanaVacia(): Partial<Semana> {
  return { id: generateId(), fecha: '', tema: '', lecturaBiblica: '', cancionApertura: undefined, cancionIntermedia: undefined, cancionCierre: undefined, titulos: {}, microfonista1: undefined, microfonista2: undefined, acomodador1: undefined, acomodador2: undefined }
}
function nuevaFDSVacia(): Partial<SemanaFDS> {
  return { id: generateId(), fecha: '', tituloArticulo: '', fechaLocale: '', cancionApertura: undefined, cancionIntermedia: undefined, cancionCierre: undefined, boceto: undefined, disertacionTitulo: '', oradorNombre: '', oradorCongregacion: '', oracionCierreTexto: '', microfonista1: undefined, microfonista2: undefined, acomodador1: undefined, acomodador2: undefined }
}

// Etiqueta legible para una semana del epub (fecha en YYYY-MM-DD).
function labelSemanaEpub(fecha: string): string {
  const [y, m, d] = fecha.split('-').map(Number)
  if (!y || !m || !d) return fecha
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })
}

// Sábado (fin de semana) de la misma semana ISO que `fecha` (YYYY-MM-DD).
// El epub de fin de semana matchea por semana, así que con cualquier día del
// fin de semana de esa semana carga el artículo correcto de La Atalaya.
function sabadoDeSemana(fecha: string): string {
  const [y, m, d] = fecha.split('-').map(Number)
  if (!y || !m || !d) return fecha
  const dt = new Date(y, m - 1, d)
  const dow = dt.getDay() // 0=domingo … 6=sábado
  const toMonday = dow === 0 ? 6 : dow - 1
  const sat = new Date(dt)
  sat.setDate(dt.getDate() - toMonday + 5)
  return `${sat.getFullYear()}-${String(sat.getMonth() + 1).padStart(2, '0')}-${String(sat.getDate()).padStart(2, '0')}`
}

// Si la URL trae ?editar=YYYY-MM-DD (lunes de la semana), estamos EDITANDO una
// semana existente del historial (no creando una nueva). Devuelve esa fecha o null.
function getEditarParam(): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('editar')
}

export default function ProgramarPage() {
  const router = useRouter()
  const [modoEdicion, setModoEdicion] = useState(false)
  const { toast } = useToast()
  const [hermanos, setHermanos] = useState<Hermano[]>([])
  const [saving, setSaving] = useState(false)
  const [tipo, setTipo] = useState<TipoReunion>(() =>
    typeof window !== 'undefined' ? ((localStorage.getItem('vym_prog_tipo') as TipoReunion) ?? 'semana') : 'semana'
  )
  const [todasAsigs, setTodasAsigs] = useState<Array<Asignacion & { fecha: string }>>([])
  const [todasAsigsFDS, setTodasAsigsFDS] = useState<Array<AsignacionFDS & { fecha: string }>>([])
  const [todasSemanas, setTodasSemanas] = useState<Semana[]>([])
  const [todasSemanasFDS, setTodasSemanasFDS] = useState<SemanaFDS[]>([])
  const [duplicadoOpen, setDuplicadoOpen] = useState(false)
  const [duplicadoId, setDuplicadoId] = useState('')
  const [duplicadoTipo, setDuplicadoTipo] = useState<'semana' | 'fds'>('semana')


  // ── Entre semana ──────────────────────────────────────────────
  const [epubStatus, setEpubStatus] = useState<EpubStatus>('idle')
  const [epubError, setEpubError] = useState('')
  const [usarSalaAux, setUsarSalaAux] = useState(() =>
    typeof window !== 'undefined' && localStorage.getItem('vym_prog_salaaux') === 'true'
  )
  const abortRef = useRef<AbortController | null>(null)

  // Lista de semanas disponibles en la guía (epub) para elegir sin tipear la fecha.
  const [mesEpub, setMesEpub] = useState<string>(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [semanasEpub, setSemanasEpub] = useState<Array<{ fecha: string; tema: string }>>([])
  const [epubListStatus, setEpubListStatus] = useState<EpubStatus>('idle')
  const [epubListError, setEpubListError] = useState('')
  const [panelOpen, setPanelOpen] = useState(false)

  const [semana, setSemana] = useState<Partial<Semana>>(() => {
    if (typeof window !== 'undefined' && !getEditarParam()) {
      try { const r = localStorage.getItem('vym_prog_semana'); if (r) return JSON.parse(r) } catch {}
    }
    return nuevaSemanaVacia()
  })
  const [asigs, setAsigs] = useState<Asigs>(() => {
    if (typeof window !== 'undefined' && !getEditarParam()) {
      try { const r = localStorage.getItem('vym_prog_asigs'); if (r) return JSON.parse(r) } catch {}
    }
    return {}
  })

  // ── Fin de semana ─────────────────────────────────────────────
  const [epubFDSStatus, setEpubFDSStatus] = useState<EpubStatus>('idle')
  const [epubFDSError, setEpubFDSError] = useState('')
  const abortFDSRef = useRef<AbortController | null>(null)

  const [semanaFDS, setSemanaFDS] = useState<Partial<SemanaFDS>>(() => {
    if (typeof window !== 'undefined' && !getEditarParam()) {
      try { const r = localStorage.getItem('vym_prog_fds'); if (r) return JSON.parse(r) } catch {}
    }
    return nuevaFDSVacia()
  })
  const [asigsFDS, setAsigsFDS] = useState<AsigsFDS>(() => {
    if (typeof window !== 'undefined' && !getEditarParam()) {
      try { const r = localStorage.getItem('vym_prog_asigsfds'); if (r) return JSON.parse(r) } catch {}
    }
    return {}
  })

  function recargarListas() {
    getAllAsignacionesConFecha().then(setTodasAsigs)
    getAllAsignacionesFDSConFecha().then(setTodasAsigsFDS)
    getSemanas().then(setTodasSemanas)
    getSemanasFDS().then(setTodasSemanasFDS)
  }

  useEffect(() => {
    getHermanos().then(setHermanos)
    recargarListas()
  }, [])

  // Modo EDICIÓN: si viene ?editar=<lunes>, cargamos esa semana (entre semana +
  // fin de semana) desde la base, para editarla como en Programar.
  useEffect(() => {
    const editar = getEditarParam()
    if (!editar) return
    setModoEdicion(true)
    ;(async () => {
      const [sems, fdss] = await Promise.all([getSemanas(), getSemanasFDS()])
      const sem = sems.find(s => claveSemanaISO(s.fecha) === editar)
      if (sem) {
        setSemana(sem)
        const a = await getAsignaciones(sem.id)
        const map: Asigs = {}
        for (const x of a) map[x.parte] = x.hermanoId
        setAsigs(map)
        if (a.some(x => x.parte.startsWith('aux_'))) setUsarSalaAux(true)
      }
      const fds = fdss.find(f => claveSemanaISO(f.fecha) === editar)
      if (fds) {
        const af = await getAsignacionesFDS(fds.id)
        const mapF: AsigsFDS = {}
        for (const x of af) mapF[x.parte] = x.hermanoId
        setSemanaFDS(fds)
        setAsigsFDS(mapF)
      }
    })()
  }, [])

  // Epub entre semana
  useEffect(() => {
    if (getEditarParam()) return // en edición no recargamos jw.org (no pisar lo guardado)
    const fecha = semana.fecha
    if (!fecha || fecha.length < 10) return
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    async function cargar() {
      setEpubStatus('loading')
      setEpubError('')
      try {
        const [year, month] = fecha!.split('-')
        const res = await fetch(`/api/epub?year=${year}&month=${month}`, { signal: ctrl.signal })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Error al cargar')
        const semanaData = encontrarSemana(data.semanas, fecha!)
        if (!semanaData) throw new Error('No se encontró la semana en la guía')
        const d = semanaData as Record<string, unknown>
        setSemana(prev => ({
          ...prev,
          tema: (d.tema as string) || prev.tema,
          lecturaBiblica: (d.lecturaBiblica as string) || prev.lecturaBiblica,
          cancionApertura: (d.cancionApertura as number | undefined) ?? prev.cancionApertura,
          cancionIntermedia: (d.cancionIntermedia as number | undefined) ?? prev.cancionIntermedia,
          cancionCierre: (d.cancionCierre as number | undefined) ?? prev.cancionCierre,
          numEstudiantes: (d.numEstudiantes as number | undefined) ?? prev.numEstudiantes,
          titulos: { ...prev.titulos, ...(d.titulos as Record<string, string>) },
        }))
        setEpubStatus('ok')
      } catch (e: unknown) {
        if ((e as { name?: string }).name === 'AbortError') return
        setEpubError(e instanceof Error ? e.message : 'Error desconocido')
        setEpubStatus('error')
      }
    }
    cargar()
    return () => ctrl.abort()
  }, [semana.fecha])

  // Lista de semanas del bimestre para el selector (epub entre semana)
  useEffect(() => {
    if (!mesEpub || mesEpub.length < 7) return
    const [year, month] = mesEpub.split('-')
    const ctrl = new AbortController()
    setEpubListStatus('loading')
    fetch(`/api/epub?year=${year}&month=${month}`, { signal: ctrl.signal })
      .then(r => r.json())
      .then((data) => {
        if (!Array.isArray(data?.semanas)) {
          setSemanasEpub([])
          setEpubListError(data?.error || 'No se pudo cargar la guía de ese mes.')
          setEpubListStatus('error')
          return
        }
        // La API trae todo el bimestre; mostramos solo las semanas del mes elegido.
        const lista = (data.semanas as Array<{ fecha: unknown; tema: unknown }>)
          .map(s => ({ fecha: String(s.fecha ?? '').replace(/\//g, '-'), tema: String(s.tema ?? '') }))
          .filter(s => s.fecha.length === 10 && s.fecha.slice(0, 7) === mesEpub)
          .sort((a, b) => a.fecha.localeCompare(b.fecha))
        setSemanasEpub(lista)
        if (lista.length) { setEpubListError(''); setEpubListStatus('ok') }
        else { setEpubListError('jw.org todavía no publicó la guía de ese bimestre.'); setEpubListStatus('error') }
      })
      .catch((e) => {
        if ((e as { name?: string }).name === 'AbortError') return
        setSemanasEpub([])
        setEpubListError('Sin conexión o error al cargar la guía.')
        setEpubListStatus('error')
      })
    return () => ctrl.abort()
  }, [mesEpub])

  // Epub fin de semana
  useEffect(() => {
    if (getEditarParam()) return // en edición no recargamos jw.org
    const fecha = semanaFDS.fecha
    if (!fecha || fecha.length < 10) return
    abortFDSRef.current?.abort()
    const ctrl = new AbortController()
    abortFDSRef.current = ctrl
    async function cargar() {
      setEpubFDSStatus('loading')
      setEpubFDSError('')
      try {
        const res = await fetch(`/api/epub-fds?fecha=${fecha}`, { signal: ctrl.signal })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Error al cargar')
        if (!data.semana) throw new Error('No se encontró el artículo para esta fecha')
        const d = data.semana as Record<string, unknown>
        setSemanaFDS(prev => ({
          ...prev,
          fechaLocale: (d.fechaLocale as string) || prev.fechaLocale,
          tituloArticulo: (d.tituloArticulo as string) || prev.tituloArticulo,
          cancionIntermedia: (d.cancionIntermedia as number | undefined) ?? prev.cancionIntermedia,
          cancionCierre: (d.cancionCierre as number | undefined) ?? prev.cancionCierre,
        }))
        setEpubFDSStatus('ok')
      } catch (e: unknown) {
        if ((e as { name?: string }).name === 'AbortError') return
        setEpubFDSError(e instanceof Error ? e.message : 'Error desconocido')
        setEpubFDSStatus('error')
      }
    }
    cargar()
    return () => ctrl.abort()
  }, [semanaFDS.fecha])

  // En modo edición NO tocamos el borrador de "nueva reunión" del localStorage.
  useEffect(() => { if (getEditarParam()) return; try { localStorage.setItem('vym_prog_semana', JSON.stringify(semana)) } catch {} }, [semana])
  useEffect(() => { if (getEditarParam()) return; try { localStorage.setItem('vym_prog_asigs', JSON.stringify(asigs)) } catch {} }, [asigs])
  useEffect(() => { if (getEditarParam()) return; try { localStorage.setItem('vym_prog_fds', JSON.stringify(semanaFDS)) } catch {} }, [semanaFDS])
  useEffect(() => { if (getEditarParam()) return; try { localStorage.setItem('vym_prog_asigsfds', JSON.stringify(asigsFDS)) } catch {} }, [asigsFDS])
  useEffect(() => { try { localStorage.setItem('vym_prog_tipo', tipo) } catch {} }, [tipo])
  useEffect(() => { try { localStorage.setItem('vym_prog_salaaux', String(usarSalaAux)) } catch {} }, [usarSalaAux])

  function setAsig(parte: ParteTipo, hermanoId: string) {
    setAsigs(prev => ({ ...prev, [parte]: hermanoId || undefined }))
  }
  function setAsigFDS(parte: ParteTipoFDS, hermanoId: string) {
    setAsigsFDS(prev => ({ ...prev, [parte]: hermanoId || undefined }))
  }
  function setTitulo(parte: ParteTipo, titulo: string) {
    setSemana(prev => ({ ...prev, titulos: { ...prev.titulos, [parte]: titulo } }))
  }
  // Elegir una semana de la guía: carga AMBAS reuniones (entre semana + fin de
  // semana). Los useEffect del epub disparan al cambiar cada fecha.
  function elegirSemanaGuia(fechaSemana: string) {
    setSemana(p => ({ ...p, fecha: fechaSemana }))
    setSemanaFDS(p => ({ ...p, fecha: sabadoDeSemana(fechaSemana) }))
    setPanelOpen(false)
    toast({ title: 'Semana cargada', description: 'Se cargaron la reunión entre semana y la de fin de semana.' })
  }

// Guarda las DOS reuniones de la semana (entre semana + fin de semana) con un
// solo botón. Guarda cada una que tenga fecha; si alguna ya existe, avisa.
  async function handleGuardarTodo() {
    const haySemana = !!semana.fecha
    const hayFDS = !!semanaFDS.fecha
    if (!haySemana && !hayFDS) {
      toast({ title: 'Elegí una semana primero', variant: 'destructive' })
      return
    }
    // Duplicados: si ya hay una reunión guardada para esa fecha, avisamos y paramos.
    if (haySemana) {
      const fechaNorm = semana.fecha!.replace(/-/g, '/')
      const existente = todasSemanas.find(s => s.id !== semana.id && s.fecha.replace(/-/g, '/') === fechaNorm)
      if (existente) { setDuplicadoId(existente.id); setDuplicadoTipo('semana'); setDuplicadoOpen(true); return }
    }
    if (hayFDS) {
      const fechaNormF = semanaFDS.fecha!.replace(/-/g, '/')
      const existenteF = todasSemanasFDS.find(s => s.id !== semanaFDS.id && s.fecha.replace(/-/g, '/') === fechaNormF)
      if (existenteF) { setDuplicadoId(existenteF.id); setDuplicadoTipo('fds'); setDuplicadoOpen(true); return }
    }
    setSaving(true)
    try {
      if (haySemana) {
        const s: Semana = {
          id: semana.id!, fecha: semana.fecha!, tema: semana.tema ?? '', lecturaBiblica: semana.lecturaBiblica ?? '',
          cancionApertura: semana.cancionApertura, cancionIntermedia: semana.cancionIntermedia, cancionCierre: semana.cancionCierre,
          numEstudiantes: semana.numEstudiantes, titulos: semana.titulos ?? {},
          microfonista1: semana.microfonista1, microfonista2: semana.microfonista2, acomodador1: semana.acomodador1, acomodador2: semana.acomodador2,
        }
        const r1 = await saveSemana(s)
        if (r1.error) { toast({ title: 'Error al guardar (entre semana)', description: r1.error, variant: 'destructive' }); setSaving(false); return }
        const asignArray = Object.entries(asigs).filter(([, v]) => !!v).map(([parte, hermanoId]) => ({ parte: parte as ParteTipo, hermanoId: hermanoId! }))
        const r2 = await saveAllAsignaciones(s.id, asignArray)
        if (r2.error) { toast({ title: 'Error al guardar (entre semana)', description: r2.error, variant: 'destructive' }); setSaving(false); return }
      }
      if (hayFDS) {
        const sf: SemanaFDS = {
          id: semanaFDS.id!, fecha: semanaFDS.fecha!, fechaLocale: semanaFDS.fechaLocale, tituloArticulo: semanaFDS.tituloArticulo,
          cancionApertura: semanaFDS.cancionApertura, cancionIntermedia: semanaFDS.cancionIntermedia, cancionCierre: semanaFDS.cancionCierre,
          boceto: semanaFDS.boceto, disertacionTitulo: semanaFDS.disertacionTitulo, oradorNombre: semanaFDS.oradorNombre,
          oradorCongregacion: semanaFDS.oradorCongregacion, oracionCierreTexto: semanaFDS.oracionCierreTexto,
          microfonista1: semanaFDS.microfonista1, microfonista2: semanaFDS.microfonista2, acomodador1: semanaFDS.acomodador1, acomodador2: semanaFDS.acomodador2,
        }
        const rf1 = await saveSemanaFDS(sf)
        if (rf1.error) { toast({ title: 'Error al guardar (fin de semana)', description: rf1.error, variant: 'destructive' }); setSaving(false); return }
        const asignArrayF = Object.entries(asigsFDS).filter(([parte, v]) => !!v && parte !== 'fds_oracion_cierre').map(([parte, hermanoId]) => ({ parte: parte as ParteTipoFDS, hermanoId: hermanoId! }))
        const rf2 = await saveAllAsignacionesFDS(sf.id, asignArrayF)
        if (rf2.error) { toast({ title: 'Error al guardar (fin de semana)', description: rf2.error, variant: 'destructive' }); setSaving(false); return }
      }
      toast({ title: 'Semana guardada', description: 'Se guardaron las reuniones de la semana.' })
      if (getEditarParam()) {
        // Editando desde el historial: volvemos al historial.
        router.push('/historial')
        return
      }
      setSemana(nuevaSemanaVacia()); setAsigs({})
      setSemanaFDS(nuevaFDSVacia()); setAsigsFDS({})
      setEpubStatus('idle'); setEpubError(''); setEpubFDSStatus('idle'); setEpubFDSError('')
      recargarListas()
    } catch (err) {
      toast({ title: 'Error al guardar', description: String(err), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

const secciones = agruparPorSeccion()

  // Duplicados: IDs asignados en cada reunión (partes + micrófonos + acomodadores).
  const idsReunionSemana = idsAsignadosReunion(asigs, [semana.microfonista1, semana.microfonista2, semana.acomodador1, semana.acomodador2])
  const idsReunionFDS = idsAsignadosReunion(asigsFDS, [semanaFDS.microfonista1, semanaFDS.microfonista2, semanaFDS.acomodador1, semanaFDS.acomodador2])
  // Aviso cruzado solo si ambas reuniones son de la misma semana.
  const mismaSemanaProg = !!semana.fecha && !!semanaFDS.fecha && claveSemanaISO(semana.fecha) === claveSemanaISO(semanaFDS.fecha)
  const idsOtraParaSemana = mismaSemanaProg ? idsReunionFDS : []
  const idsOtraParaFDS = mismaSemanaProg ? idsReunionSemana : []

  // Semana cargada (se usa para el rótulo del botón y el estado). semana.fecha es
  // la fecha de la semana de la guía (entre semana); se prioriza esa.
  const semanaCargada = semana.fecha || semanaFDS.fecha || ''
  const numEstudiantes = semana.numEstudiantes
    ?? ((semana.titulos as Record<string, string>)?.estudiante_4 ? 4
      : (semana.titulos as Record<string, string>)?.estudiante_3 ? 3
      : 2)

  const seccionIconos: Partial<Record<string, JSX.Element>> = {
    tesoros: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden="true">
        <path d="M4 8h12M4 8 7 2h6l3 6M4 8l6 10 6-10M7 2l3 6 3-6" />
      </svg>
    ),
    maestros: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden="true">
        <path d="M10 18v-7" />
        <path d="M10 15c-1-3.5-4-4.5-6.5-4 0.5 3 2.5 5 6.5 4z" />
        <path d="M10 12c1-3 4-4 6.5-3-0.5 3-2.5 4.5-6.5 3z" />
      </svg>
    ),
    cristiana: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden="true">
        <path d="M3 12c0-3 2-5 5-5s5 2 5 5-2 4-5 4-5-1-5-4z" />
        <circle cx="14.5" cy="10.5" r="2.5" />
        <path d="M5 16v2.5M8 16v2.5M10 16v2.5M13 15.5v2.5" />
      </svg>
    ),
  }

  const colorMap: Record<string, string> = {
    apertura: 'bg-card border-border',
    tesoros: 'bg-[#3c7f8b]/35 border-[#3c7f8b]/60 dark:bg-[#3c7f8b]/15 dark:border-[#3c7f8b]/30',
    maestros: 'bg-[#d68f00]/35 border-[#d68f00]/60 dark:bg-[#d68f00]/15 dark:border-[#d68f00]/30',
    cristiana: 'bg-[#bf2f13]/35 border-[#bf2f13]/60 dark:bg-[#bf2f13]/15 dark:border-[#bf2f13]/30',
    cierre: 'bg-card border-border',
  }
  const titleColorMap: Record<string, string> = {
    apertura: 'text-muted-foreground',
    tesoros: 'text-[#3c7f8b] dark:text-[#6abac8]',
    maestros: 'text-[#d68f00] dark:text-[#f0b030]',
    cristiana: 'text-[#bf2f13] dark:text-[#e05c3a]',
    cierre: 'text-muted-foreground',
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Encabezado */}
      <div className="flex items-center gap-3 mb-6">
        {modoEdicion && (
          <Button variant="ghost" size="icon" onClick={() => router.push('/historial')} title="Volver al historial">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <h1 className="text-2xl font-bold text-foreground flex-1">{modoEdicion ? 'Editar semana' : 'Nueva reunión'}</h1>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleGuardarTodo}
            disabled={saving}
            size="sm"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {modoEdicion ? 'Guardar cambios' : 'Guardar la semana'}
          </Button>
        </div>
      </div>

      {/* Modo edición: la semana está fija (no se elige de la guía). */}
      {modoEdicion ? (
        <div className="mb-6">
          <span className="inline-flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            {semanaCargada ? <span className="capitalize">Semana del {labelSemanaEpub(semanaCargada)}</span> : 'Semana'}
          </span>
        </div>
      ) : (
      /* Botón único: abre el panel de la guía (elige mes + semana, carga ambas reuniones) */
      <div className="mb-6 space-y-1">
        <Button variant="outline" className="w-full sm:w-auto" onClick={() => setPanelOpen(true)}>
          <Calendar className="h-4 w-4" />
          {semanaCargada ? <span className="capitalize">Semana del {labelSemanaEpub(semanaCargada)}</span> : 'Elegir semana de la guía'}
        </Button>
        {semanaCargada && (
          <p className="text-xs flex items-center gap-1.5">
            {(epubStatus === 'loading' || epubFDSStatus === 'loading') ? (
              <><Loader2 className="h-3 w-3 animate-spin text-blue-500" /><span className="text-blue-500">Cargando datos de jw.org…</span></>
            ) : (epubStatus === 'error' || epubFDSStatus === 'error') ? (
              <><AlertCircle className="h-3 w-3 text-orange-500" /><span className="text-orange-500">{epubError || epubFDSError || 'No se pudieron cargar todos los datos de jw.org'}</span></>
            ) : (
              <><CheckCircle2 className="h-3 w-3 text-green-600" /><span className="text-muted-foreground">Datos cargados desde jw.org</span></>
            )}
          </p>
        )}
      </div>
      )}

      {/* Panel lateral derecho */}
      {panelOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setPanelOpen(false)} />
          <div className="absolute top-0 right-0 h-full w-full max-w-sm bg-card border-l border-border shadow-xl flex flex-col animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Elegir semana de la guía</h2>
              <button onClick={() => setPanelOpen(false)} className="text-muted-foreground hover:text-foreground" aria-label="Cerrar">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto">
              <div className="space-y-1.5">
                <Label>Mes</Label>
                {(() => {
                  const [epY, epM] = mesEpub.split('-').map(Number)
                  return (
                    <div className="rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between mb-2.5">
                        <button type="button" onClick={() => setMesEpub(`${epY - 1}-${String(epM).padStart(2, '0')}`)}
                          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted" aria-label="Año anterior">
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <span className="text-sm font-semibold text-foreground">{epY}</span>
                        <button type="button" onClick={() => setMesEpub(`${epY + 1}-${String(epM).padStart(2, '0')}`)}
                          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted" aria-label="Año siguiente">
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {MESES_ABBR.map((mes, i) => {
                          const mm = i + 1
                          const activo = mm === epM
                          return (
                            <button key={mes} type="button"
                              onClick={() => setMesEpub(`${epY}-${String(mm).padStart(2, '0')}`)}
                              className={`py-1.5 rounded-md text-sm capitalize transition-colors ${activo ? 'bg-blue-600 text-white font-medium' : 'text-foreground hover:bg-muted'}`}>
                              {mes}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}
              </div>
              <div className="space-y-2">
                <Label>Semana</Label>
                {epubListStatus === 'loading' && (
                  <p className="text-xs text-blue-500 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Cargando semanas…</p>
                )}
                {epubListStatus === 'error' && (
                  <p className="text-xs text-orange-500">{epubListError}</p>
                )}
                <div className="space-y-1.5">
                  {semanasEpub.map(w => (
                    <button
                      key={w.fecha}
                      onClick={() => elegirSemanaGuia(w.fecha)}
                      className="w-full text-left rounded-lg border border-border px-3 py-2 hover:bg-muted/60 hover:border-blue-500/40 transition-colors"
                    >
                      <div className="text-sm font-medium text-foreground capitalize">Semana del {labelSemanaEpub(w.fecha)}</div>
                      {w.tema && <div className="text-xs text-muted-foreground line-clamp-2">{w.tema}</div>}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Al elegir una semana se cargan las dos reuniones: entre semana y fin de semana.</p>
            </div>
          </div>
        </div>
      )}

      {/* ── LAS DOS REUNIONES, UNA AL LADO DE LA OTRA ── */}
      <div className="grid grid-cols-2 gap-6 items-start">
        {/* Columna izquierda: reunión de entre semana */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-5 w-5 text-blue-500" />
            <h2 className="text-lg font-bold text-foreground">Entre semana</h2>
          </div>
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Datos de la semana</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="lectura">Lectura bíblica</Label>
                <Input
                  id="lectura"
                  placeholder="Ej: Génesis 1-3"
                  value={semana.lecturaBiblica ?? ''}
                  onChange={e => setSemana(p => ({ ...p, lecturaBiblica: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tema">Tema de la semana</Label>
                <Input
                  id="tema"
                  placeholder="Ej: Recuerda su pacto para siempre"
                  value={semana.tema ?? ''}
                  onChange={e => setSemana(p => ({ ...p, tema: e.target.value }))}
                />
              </div>
            </CardContent>
          </Card>

          {SECCIONES_ORDEN.map(seccion => {
            const partes = secciones[seccion] ?? []
            const partesVisible = partes.filter(p => {
              if (p === 'estudiante_3' || p === 'ayudante_3') return numEstudiantes >= 3
              if (p === 'estudiante_4' || p === 'ayudante_4') return numEstudiantes >= 4
              return true
            })
            if (partesVisible.length === 0) return null
            return (
              <Card key={seccion} className={`mb-4 border ${colorMap[seccion]}`}>
                <CardHeader className="pb-2 pt-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className={`text-sm font-bold uppercase tracking-wide flex items-center gap-1.5 ${titleColorMap[seccion]}`}>
                      {seccionIconos[seccion]}
                      {SECCION_LABELS[seccion]}
                    </CardTitle>
                    {seccion === 'maestros' && (
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer font-normal">
                        <input
                          type="checkbox"
                          checked={usarSalaAux}
                          onChange={e => setUsarSalaAux(e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-gray-300"
                        />
                        Sala auxiliar
                      </label>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {partesVisible.map(parte => {
                    const info = PARTES_INFO[parte]
                    const isAyudante = ['ayudante_1', 'ayudante_2', 'ayudante_3', 'ayudante_4'].includes(parte)
                    const isEstudiante = ['estudiante_1', 'estudiante_2', 'estudiante_3', 'estudiante_4'].includes(parte)
                    const hasTitulo = ['discurso_tesoros', 'perlas_escondidas', 'lectura_biblica', 'estudiante_1', 'estudiante_2', 'estudiante_3', 'estudiante_4', 'parte_local_1', 'parte_local_2'].includes(parte)
                    const titulo = (semana.titulos ?? {})[parte] ?? ''
                    if (isAyudante) return null
                    const n = parte.replace('estudiante_', '')
                    const ayuParte = `ayudante_${n}` as ParteTipo
                    const auxEstParte = `aux_estudiante_${n}` as ParteTipo
                    const auxAyuParte = `aux_ayudante_${n}` as ParteTipo
                    const esDiscurso = titulo.trim().toLowerCase() === 'discurso'
                    return (
                      <div key={parte} className="space-y-1.5">
                        <div className="flex items-baseline gap-2">
                          <Label className="text-sm font-medium text-foreground">{info.label}</Label>
                          {info.opcional && info.seccion !== 'maestros' && <span className="text-xs text-muted-foreground italic">opcional</span>}
                        </div>
                        {hasTitulo && !isAyudante && (
                          <div className="relative">
                            <Input
                              placeholder="Título de la parte…"
                              className={`text-sm h-8 ${titulo ? 'bg-blue-50 border-blue-300 dark:bg-blue-900/30 dark:border-blue-700/50' : ''}`}
                              value={titulo}
                              onChange={e => setTitulo(parte, e.target.value)}
                            />
                            {titulo && epubStatus === 'ok' && (
                              <CheckCircle2 className="absolute right-2 top-2 h-3.5 w-3.5 text-green-500 pointer-events-none" />
                            )}
                            {epubStatus === 'loading' && (
                              <Loader2 className="absolute right-2 top-2 h-3.5 w-3.5 text-blue-400 animate-spin pointer-events-none" />
                            )}
                          </div>
                        )}
                        <div className="space-y-1.5">
                          {usarSalaAux && isEstudiante && (
                            <p className="text-xs text-muted-foreground font-medium">Sala principal</p>
                          )}
                          <SelectorHermano
                            parte={parte}
                            hermanos={hermanos}
                            value={asigs[parte] ?? ''}
                            onChange={v => setAsig(parte, v)}
                            semanaId={semana.id!}
                            soloHombres={esDiscurso}
                            todasAsignaciones={todasAsigs}
                            idsEstaReunion={idsReunionSemana} idsOtraReunion={idsOtraParaSemana} etiquetaOtraReunion="la reunión de fin de semana"
                          />
                          {isEstudiante && !esDiscurso && (
                            <div className="pl-4 border-l-2 border-gray-200 ml-4">
                              <SelectorHermano
                                parte={ayuParte}
                                hermanos={hermanos}
                                value={asigs[ayuParte] ?? ''}
                                onChange={v => setAsig(ayuParte, v)}
                                semanaId={semana.id!}
                                todasAsignaciones={todasAsigs}
                                idsEstaReunion={idsReunionSemana} idsOtraReunion={idsOtraParaSemana} etiquetaOtraReunion="la reunión de fin de semana"
                              />
                            </div>
                          )}
                        </div>
                        {usarSalaAux && isEstudiante && (
                          <div className="pl-3 border-l-2 border-amber-300 ml-1 space-y-1.5">
                            <p className="text-xs text-amber-600 font-medium">Sala auxiliar</p>
                            <SelectorHermano
                              parte={auxEstParte}
                              hermanos={hermanos}
                              value={asigs[auxEstParte] ?? ''}
                              onChange={v => setAsig(auxEstParte, v)}
                              semanaId={semana.id!}
                              soloHombres={esDiscurso}
                              todasAsignaciones={todasAsigs}
                              idsEstaReunion={idsReunionSemana} idsOtraReunion={idsOtraParaSemana} etiquetaOtraReunion="la reunión de fin de semana"
                            />
                            {!esDiscurso && (
                              <div className="pl-4 border-l-2 border-amber-100 ml-4">
                                <SelectorHermano
                                  parte={auxAyuParte}
                                  hermanos={hermanos}
                                  value={asigs[auxAyuParte] ?? ''}
                                  onChange={v => setAsig(auxAyuParte, v)}
                                  semanaId={semana.id!}
                                  todasAsignaciones={todasAsigs}
                                  idsEstaReunion={idsReunionSemana} idsOtraReunion={idsOtraParaSemana} etiquetaOtraReunion="la reunión de fin de semana"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            )
          })}
          {/* Microfonistas y Acomodadores */}
          <Card className="mb-4 border bg-card border-border">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Microfonistas y Acomodadores</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {([
                  ['microfonista1', 'Micrófono 1'] as const,
                  ['microfonista2', 'Micrófono 2'] as const,
                  ['acomodador1',   'Acomodador 1'] as const,
                  ['acomodador2',   'Acomodador 2'] as const,
                ]).map(([field, label]) => (
                  <div key={field} className="space-y-1.5">
                    <Label className="text-sm">{label}</Label>
                    <SelectorMicrofono
                      label={label}
                      hermanos={hermanos}
                      value={semana[field] ?? ''}
                      onChange={v => setSemana(p => ({ ...p, [field]: v || undefined }))}
                      idsEstaReunion={idsReunionSemana}
                      idsOtraReunion={idsOtraParaSemana}
                      etiquetaOtraReunion="la reunión de fin de semana"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

        </div>{/* fin columna entre semana */}

        {/* Columna derecha: reunión de fin de semana */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Sun className="h-5 w-5 text-purple-500" />
            <h2 className="text-lg font-bold text-foreground">Fin de semana</h2>
          </div>
          {/* Datos generales */}
          {semanaFDS.fechaLocale && (
            <Card className="mb-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Datos de la reunión</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground italic">{semanaFDS.fechaLocale}</p>
              </CardContent>
            </Card>
          )}

          {/* Apertura */}
          <Card className="mb-4 border bg-card border-border">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Apertura</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(['fds_presidente', 'fds_oracion_apertura'] as ParteTipoFDS[]).map(parte => (
                <div key={parte} className="space-y-1.5">
                  <Label>{PARTES_INFO_FDS[parte].label}</Label>
                  <SelectorFDS
                    parte={parte}
                    hermanos={hermanos}
                    value={asigsFDS[parte] ?? ''}
                    onChange={v => setAsigFDS(parte, v)}
                    semanaFDSId={semanaFDS.id!}
                    todasAsignaciones={todasAsigsFDS}
                    idsEstaReunion={idsReunionFDS} idsOtraReunion={idsOtraParaFDS} etiquetaOtraReunion="la reunión de entre semana"
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Disertación pública */}
          <Card className="mb-4 border bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800/40">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">Disertación pública</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>Bosquejo (S-34)</Label>
                <SelectorBoceto
                  value={semanaFDS.boceto}
                  onChange={v => setSemanaFDS(p => ({ ...p, boceto: v }))}
                />
                {semanaFDS.boceto && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">{bocetoPDFLabel(semanaFDS.boceto)}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Título libre (opcional)</Label>
                <Input
                  placeholder="Título personalizado…"
                  value={semanaFDS.disertacionTitulo ?? ''}
                  onChange={e => setSemanaFDS(p => ({ ...p, disertacionTitulo: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Nombre del orador</Label>
                  <Input
                    placeholder="Nombre completo…"
                    value={semanaFDS.oradorNombre ?? ''}
                    onChange={e => setSemanaFDS(p => {
                      const nuevo = e.target.value
                      // Espejar el orador en la oración de cierre mientras no se haya
                      // editado a mano (sigue vacía o igual al orador anterior).
                      const sync = !p.oracionCierreTexto || p.oracionCierreTexto === (p.oradorNombre ?? '')
                      return { ...p, oradorNombre: nuevo, ...(sync ? { oracionCierreTexto: nuevo } : {}) }
                    })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Congregación de origen</Label>
                  <Input
                    placeholder="Nombre de la congregación…"
                    value={semanaFDS.oradorCongregacion ?? ''}
                    onChange={e => setSemanaFDS(p => ({ ...p, oradorCongregacion: e.target.value }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Estudio de La Atalaya */}
          <Card className="mb-4 border bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800/40">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">Estudio de La Atalaya</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>Título del artículo</Label>
                <Input
                  placeholder="Título del artículo de estudio…"
                  value={semanaFDS.tituloArticulo ?? ''}
                  onChange={e => setSemanaFDS(p => ({ ...p, tituloArticulo: e.target.value }))}
                  className={semanaFDS.tituloArticulo && epubFDSStatus === 'ok' ? 'bg-blue-900/30 border-blue-700/50' : ''}
                />
              </div>
              {semanaFDS.cancionIntermedia && (
                <p className="text-xs text-blue-300 font-medium">Canción intermedia: {semanaFDS.cancionIntermedia}</p>
              )}
              <div className="space-y-1.5">
                <Label>{PARTES_INFO_FDS['fds_lector'].label}</Label>
                <SelectorFDS
                  parte="fds_lector"
                  hermanos={hermanos}
                  value={asigsFDS['fds_lector'] ?? ''}
                  onChange={v => setAsigFDS('fds_lector', v)}
                  semanaFDSId={semanaFDS.id!}
                  todasAsignaciones={todasAsigsFDS}
                  idsEstaReunion={idsReunionFDS} idsOtraReunion={idsOtraParaFDS} etiquetaOtraReunion="la reunión de entre semana"
                />
              </div>
            </CardContent>
          </Card>

          {/* Cierre */}
          <Card className="mb-4 border bg-card border-border">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Cierre</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {semanaFDS.cancionCierre && (
                <p className="text-xs text-muted-foreground font-medium">Canción de cierre: {semanaFDS.cancionCierre}</p>
              )}
              <div className="space-y-1.5">
                <Label>{PARTES_INFO_FDS['fds_oracion_cierre'].label}</Label>
                <Input
                  placeholder="Nombre de quien hace la oración…"
                  value={semanaFDS.oracionCierreTexto ?? ''}
                  onChange={e => setSemanaFDS(p => ({ ...p, oracionCierreTexto: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">Se completa solo con el orador. Podés borrarlo y poner otro.</p>
              </div>
            </CardContent>
          </Card>

          {/* Microfonistas y Acomodadores FDS */}
          <Card className="mb-4 border bg-card border-border">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Microfonistas y Acomodadores</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {([
                  ['microfonista1', 'Micrófono 1'] as const,
                  ['microfonista2', 'Micrófono 2'] as const,
                  ['acomodador1',   'Acomodador 1'] as const,
                  ['acomodador2',   'Acomodador 2'] as const,
                ]).map(([field, label]) => (
                  <div key={field} className="space-y-1.5">
                    <Label className="text-sm">{label}</Label>
                    <SelectorMicrofono
                      label={label}
                      hermanos={hermanos}
                      value={semanaFDS[field] ?? ''}
                      onChange={v => setSemanaFDS(p => ({ ...p, [field]: v || undefined }))}
                      idsEstaReunion={idsReunionFDS}
                      idsOtraReunion={idsOtraParaFDS}
                      etiquetaOtraReunion="la reunión de entre semana"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

        </div>{/* fin columna fin de semana */}
      </div>{/* fin grid de las dos reuniones */}

      {/* ── POPUP REUNIÓN DUPLICADA ── */}
      <Dialog open={duplicadoOpen} onOpenChange={setDuplicadoOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reunión ya existente</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Ya existe una reunión programada para esa fecha. Podés editarla en el historial.
          </p>
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDuplicadoOpen(false)}>
              Cerrar
            </Button>
            <Button onClick={() => {
              setDuplicadoOpen(false)
              router.push(duplicadoTipo === 'semana' ? `/historial/${duplicadoId}` : `/fin-de-semana/${duplicadoId}`)
            }}>
              Ir al historial
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
