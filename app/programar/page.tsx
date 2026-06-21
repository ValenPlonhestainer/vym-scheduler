"use client"

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Loader2, CheckCircle2, AlertCircle, RefreshCw, Calendar, Sun, FileDown } from 'lucide-react'
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
} from '@/lib/actions'
import { Asignacion, AsignacionFDS } from '@/lib/types'
import {
  Hermano, Semana, ParteTipo, PARTES_ORDEN, PARTES_INFO, SECCION_LABELS,
  SemanaFDS, ParteTipoFDS, PARTES_INFO_FDS,
} from '@/lib/types'
import { generateId } from '@/lib/utils'
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

export default function ProgramarPage() {
  const router = useRouter()
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
  const [semanaSaved, setSemanaSaved] = useState(false)
  const [fdsSaved, setFdsSaved] = useState(false)
  const [incompletoOpen, setIncompletoOpen] = useState(false)
  const [incompletoMensaje, setIncompletoMensaje] = useState('')
  const [incompletoAccion, setIncompletoAccion] = useState<() => void>(() => {})
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

  const [semana, setSemana] = useState<Partial<Semana>>(() => {
    if (typeof window !== 'undefined') {
      try { const r = localStorage.getItem('vym_prog_semana'); if (r) return JSON.parse(r) } catch {}
    }
    return { id: generateId(), fecha: '', tema: '', lecturaBiblica: '', cancionApertura: undefined, cancionIntermedia: undefined, cancionCierre: undefined, titulos: {}, microfonista1: undefined, microfonista2: undefined, acomodador1: undefined, acomodador2: undefined }
  })
  const [asigs, setAsigs] = useState<Asigs>(() => {
    if (typeof window !== 'undefined') {
      try { const r = localStorage.getItem('vym_prog_asigs'); if (r) return JSON.parse(r) } catch {}
    }
    return {}
  })

  // ── Fin de semana ─────────────────────────────────────────────
  const [epubFDSStatus, setEpubFDSStatus] = useState<EpubStatus>('idle')
  const [epubFDSError, setEpubFDSError] = useState('')
  const abortFDSRef = useRef<AbortController | null>(null)

  const [semanaFDS, setSemanaFDS] = useState<Partial<SemanaFDS>>(() => {
    if (typeof window !== 'undefined') {
      try { const r = localStorage.getItem('vym_prog_fds'); if (r) return JSON.parse(r) } catch {}
    }
    return { id: generateId(), fecha: '', tituloArticulo: '', fechaLocale: '', cancionApertura: undefined, cancionIntermedia: undefined, cancionCierre: undefined, boceto: undefined, disertacionTitulo: '', oradorNombre: '', oradorCongregacion: '', microfonista1: undefined, microfonista2: undefined, acomodador1: undefined, acomodador2: undefined }
  })
  const [asigsFDS, setAsigsFDS] = useState<AsigsFDS>(() => {
    if (typeof window !== 'undefined') {
      try { const r = localStorage.getItem('vym_prog_asigsfds'); if (r) return JSON.parse(r) } catch {}
    }
    return {}
  })

  useEffect(() => {
    getHermanos().then(setHermanos)
    getAllAsignacionesConFecha().then(setTodasAsigs)
    getAllAsignacionesFDSConFecha().then(setTodasAsigsFDS)
    getSemanas().then(setTodasSemanas)
    getSemanasFDS().then(setTodasSemanasFDS)
  }, [])

  // Epub entre semana
  useEffect(() => {
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

  // Epub fin de semana
  useEffect(() => {
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

  useEffect(() => { try { localStorage.setItem('vym_prog_semana', JSON.stringify(semana)) } catch {} }, [semana])
  useEffect(() => { try { localStorage.setItem('vym_prog_asigs', JSON.stringify(asigs)) } catch {} }, [asigs])
  useEffect(() => { try { localStorage.setItem('vym_prog_fds', JSON.stringify(semanaFDS)) } catch {} }, [semanaFDS])
  useEffect(() => { try { localStorage.setItem('vym_prog_asigsfds', JSON.stringify(asigsFDS)) } catch {} }, [asigsFDS])
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
  function recargar() {
    const f = semana.fecha
    if (!f) return
    setSemana(p => ({ ...p, fecha: '' }))
    setTimeout(() => setSemana(p => ({ ...p, fecha: f })), 50)
  }

  const lsKeys = ['vym_prog_semana','vym_prog_asigs','vym_prog_fds','vym_prog_asigsfds','vym_prog_tipo','vym_prog_salaaux']

  async function handleGuardarSemana() {
    if (!semana.fecha) { toast({ title: 'La fecha es obligatoria', variant: 'destructive' }); return }
    const fechaNorm = semana.fecha.replace(/-/g, '/')
    const existente = todasSemanas.find(s => s.id !== semana.id && s.fecha.replace(/-/g, '/') === fechaNorm)
    if (existente) {
      setDuplicadoId(existente.id)
      setDuplicadoTipo('semana')
      setDuplicadoOpen(true)
      return
    }
    setSaving(true)
    const s: Semana = {
      id: semana.id!,
      fecha: semana.fecha!,
      tema: semana.tema ?? '',
      lecturaBiblica: semana.lecturaBiblica ?? '',
      cancionApertura: semana.cancionApertura,
      cancionIntermedia: semana.cancionIntermedia,
      cancionCierre: semana.cancionCierre,
      numEstudiantes: semana.numEstudiantes,
      titulos: semana.titulos ?? {},
      microfonista1: semana.microfonista1,
      microfonista2: semana.microfonista2,
      acomodador1: semana.acomodador1,
      acomodador2: semana.acomodador2,
    }
    try {
      const r1 = await saveSemana(s)
      if (r1.error) { toast({ title: 'Error al guardar', description: r1.error, variant: 'destructive' }); return }
      const asignArray = Object.entries(asigs)
        .filter(([, v]) => !!v)
        .map(([parte, hermanoId]) => ({ parte: parte as ParteTipo, hermanoId: hermanoId! }))
      const r2 = await saveAllAsignaciones(s.id, asignArray)
      if (r2.error) { toast({ title: 'Error al guardar', description: r2.error, variant: 'destructive' }); return }
      setSemanaSaved(true)
      toast({ title: 'Reunión guardada', description: 'La reunión entre semana fue guardada correctamente.' })
    } catch (err) {
      toast({ title: 'Error al guardar', description: String(err), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function handleGuardarFDS() {
    if (!semanaFDS.fecha) { toast({ title: 'La fecha es obligatoria', variant: 'destructive' }); return }
    const fechaNorm = semanaFDS.fecha.replace(/-/g, '/')
    const existente = todasSemanasFDS.find(s => s.id !== semanaFDS.id && s.fecha.replace(/-/g, '/') === fechaNorm)
    if (existente) {
      setDuplicadoId(existente.id)
      setDuplicadoTipo('fds')
      setDuplicadoOpen(true)
      return
    }
    setSaving(true)
    const s: SemanaFDS = {
      id: semanaFDS.id!,
      fecha: semanaFDS.fecha!,
      fechaLocale: semanaFDS.fechaLocale,
      tituloArticulo: semanaFDS.tituloArticulo,
      cancionApertura: semanaFDS.cancionApertura,
      cancionIntermedia: semanaFDS.cancionIntermedia,
      cancionCierre: semanaFDS.cancionCierre,
      boceto: semanaFDS.boceto,
      disertacionTitulo: semanaFDS.disertacionTitulo,
      oradorNombre: semanaFDS.oradorNombre,
      oradorCongregacion: semanaFDS.oradorCongregacion,
      microfonista1: semanaFDS.microfonista1,
      microfonista2: semanaFDS.microfonista2,
      acomodador1: semanaFDS.acomodador1,
      acomodador2: semanaFDS.acomodador2,
    }
    try {
      const r1 = await saveSemanaFDS(s)
      if (r1.error) { toast({ title: 'Error al guardar', description: r1.error, variant: 'destructive' }); return }
      const asignArray = Object.entries(asigsFDS)
        .filter(([, v]) => !!v)
        .map(([parte, hermanoId]) => ({ parte: parte as ParteTipoFDS, hermanoId: hermanoId! }))
      const r2 = await saveAllAsignacionesFDS(s.id, asignArray)
      if (r2.error) { toast({ title: 'Error al guardar', description: r2.error, variant: 'destructive' }); return }
      setFdsSaved(true)
      toast({ title: 'Reunión guardada', description: 'La reunión de fin de semana fue guardada correctamente.' })
    } catch (err) {
      toast({ title: 'Error al guardar', description: String(err), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  function handleExportar() {
    const otroTieneFecha = tipo === 'semana' ? !!semanaFDS.fecha : !!semana.fecha
    const otroGuardado = tipo === 'semana' ? fdsSaved : semanaSaved
    if (otroTieneFecha && !otroGuardado) {
      const reunionFaltante = tipo === 'semana' ? 'fin de semana' : 'entre semana'
      setIncompletoMensaje(`Hay datos en la reunión de ${reunionFaltante} que todavía no fueron guardados.`)
      setIncompletoAccion(() => () => { setIncompletoOpen(false); setTipo(tipo === 'semana' ? 'fds' : 'semana') })
      setIncompletoOpen(true)
      return
    }
    lsKeys.forEach(k => localStorage.removeItem(k))
    router.push('/exportar')
  }

  const secciones = agruparPorSeccion()
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
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Encabezado */}
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-foreground flex-1">Nueva reunión</h1>
        <div className="flex items-center gap-2">
          <Button
            onClick={tipo === 'semana' ? handleGuardarSemana : handleGuardarFDS}
            disabled={saving}
            size="sm"
            variant="outline"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Guardar
          </Button>
          <Button
            onClick={handleExportar}
            disabled={saving}
            size="sm"
          >
            <FileDown className="h-4 w-4" />
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* Selector de tipo */}
      <div className="flex gap-2 mb-6 p-1 rounded-lg bg-muted w-full sm:w-fit">
        <button
          onClick={() => setTipo('semana')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tipo === 'semana'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Calendar className="h-4 w-4" />
          Entre semana
        </button>
        <button
          onClick={() => setTipo('fds')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tipo === 'fds'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Sun className="h-4 w-4" />
          Fin de semana
        </button>
      </div>

      {/* ── FORMULARIO ENTRE SEMANA ── */}
      {tipo === 'semana' && (
        <>
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Datos de la semana</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="fecha">Fecha de la reunión *</Label>
                  <Input
                    id="fecha"
                    type="date"
                    value={semana.fecha ?? ''}
                    onChange={e => setSemana(p => ({ ...p, fecha: e.target.value }))}
                  />
                  {semana.fecha && (
                    <div className="flex items-center gap-1.5 text-xs">
                      {epubStatus === 'loading' && (
                        <><Loader2 className="h-3 w-3 animate-spin text-blue-500" /><span className="text-blue-500">Cargando datos de jw.org…</span></>
                      )}
                      {epubStatus === 'ok' && (
                        <><CheckCircle2 className="h-3 w-3 text-green-600" /><span className="text-green-600">Títulos cargados desde jw.org</span></>
                      )}
                      {epubStatus === 'error' && (
                        <><AlertCircle className="h-3 w-3 text-orange-500" /><span className="text-orange-500">{epubError}</span>
                          <button onClick={recargar} className="ml-1 underline text-orange-600 hover:text-orange-800">reintentar</button>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lectura">Lectura bíblica</Label>
                  <Input
                    id="lectura"
                    placeholder="Ej: Génesis 1-3"
                    value={semana.lecturaBiblica ?? ''}
                    onChange={e => setSemana(p => ({ ...p, lecturaBiblica: e.target.value }))}
                  />
                </div>
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
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-3">
                {(['cancionApertura', 'cancionIntermedia', 'cancionCierre'] as const).map(c => (
                  <div key={c} className="space-y-1.5">
                    <Label>{c === 'cancionApertura' ? 'Canción apertura' : c === 'cancionIntermedia' ? 'Canción intermedia' : 'Canción cierre'}</Label>
                    <Input
                      type="number"
                      placeholder="Nº"
                      value={semana[c] ?? ''}
                      onChange={e => setSemana(p => ({ ...p, [c]: e.target.value ? +e.target.value : undefined }))}
                    />
                  </div>
                ))}
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
                          {info.opcional && <span className="text-xs text-muted-foreground italic">opcional</span>}
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
                            asigsSemana={asigs}
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
                                asigsSemana={asigs}
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
                              asigsSemana={asigs}
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
                                  asigsSemana={asigs}
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
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

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

      {/* ── POPUP REUNIÓN INCOMPLETA ── */}
      <Dialog open={incompletoOpen} onOpenChange={setIncompletoOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reunión sin programar</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{incompletoMensaje}</p>
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { lsKeys.forEach(k => localStorage.removeItem(k)); router.push('/exportar') }}>
              Ir a exportar igual
            </Button>
            <Button onClick={incompletoAccion}>
              Completar ahora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── FORMULARIO FIN DE SEMANA ── */}
      {tipo === 'fds' && (
        <>
          {/* Datos generales */}
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Datos de la reunión</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Fecha de la reunión *</Label>
                  <Input
                    type="date"
                    value={semanaFDS.fecha ?? ''}
                    onChange={e => setSemanaFDS(p => ({ ...p, fecha: e.target.value }))}
                  />
                  {semanaFDS.fecha && (
                    <div className="flex items-center gap-1.5 text-xs">
                      {epubFDSStatus === 'loading' && (
                        <><Loader2 className="h-3 w-3 animate-spin text-blue-500" /><span className="text-blue-500">Cargando desde jw.org…</span></>
                      )}
                      {epubFDSStatus === 'ok' && (
                        <><CheckCircle2 className="h-3 w-3 text-green-600" /><span className="text-green-600">Datos cargados desde jw.org</span></>
                      )}
                      {epubFDSStatus === 'error' && (
                        <><AlertCircle className="h-3 w-3 text-orange-500" /><span className="text-orange-500">{epubFDSError}</span></>
                      )}
                    </div>
                  )}
                  {semanaFDS.fechaLocale && (
                    <p className="text-xs text-muted-foreground italic">{semanaFDS.fechaLocale}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-baseline gap-2">
                    <Label>Canción de apertura</Label>
                    <span className="text-xs text-muted-foreground italic">opcional</span>
                  </div>
                  <Input
                    type="number"
                    placeholder="Nº"
                    value={semanaFDS.cancionApertura ?? ''}
                    onChange={e => setSemanaFDS(p => ({ ...p, cancionApertura: e.target.value ? +e.target.value : undefined }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

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
                    asigsSemana={asigsFDS}
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
                    onChange={e => setSemanaFDS(p => ({ ...p, oradorNombre: e.target.value }))}
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
                  asigsSemana={asigsFDS}
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
                <SelectorFDS
                  parte="fds_oracion_cierre"
                  hermanos={hermanos}
                  value={asigsFDS['fds_oracion_cierre'] ?? ''}
                  onChange={v => setAsigFDS('fds_oracion_cierre', v)}
                  semanaFDSId={semanaFDS.id!}
                  todasAsignaciones={todasAsigsFDS}
                  asigsSemana={asigsFDS}
                />
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
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

    </div>
  )
}
