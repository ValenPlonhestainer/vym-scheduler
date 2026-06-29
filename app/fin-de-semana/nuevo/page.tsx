"use client"

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SelectorFDS } from '@/components/fin-de-semana/selector-fds'
import { getHermanos, saveSemanaFDS, saveAllAsignacionesFDS, getAllAsignacionesFDSConFecha } from '@/lib/actions'
import { AsignacionFDS } from '@/lib/types'
import { Hermano, SemanaFDS, ParteTipoFDS } from '@/lib/types'
import { generateId } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { BOCETOS } from '@/data/bocetos'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Asigs = Partial<Record<ParteTipoFDS, string>>
type EpubStatus = 'idle' | 'loading' | 'ok' | 'error'

export default function NuevoFinDeSemanaPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [hermanos, setHermanos] = useState<Hermano[]>([])
  const [saving, setSaving] = useState(false)
  const [epubStatus, setEpubStatus] = useState<EpubStatus>('idle')
  const [epubError, setEpubError] = useState('')
  const [todasAsigsFDS, setTodasAsigsFDS] = useState<Array<AsignacionFDS & { fecha: string }>>([])
  const abortRef = useRef<AbortController | null>(null)

  const [semana, setSemana] = useState<Partial<SemanaFDS>>({
    id: generateId(),
    fecha: '',
    tituloArticulo: '',
    fechaLocale: '',
    cancionApertura: undefined,
    cancionIntermedia: undefined,
    cancionCierre: undefined,
    boceto: undefined,
    disertacionTitulo: '',
    oradorNombre: '',
    oradorCongregacion: '',
    oracionCierreTexto: '',
  })

  const [asigs, setAsigs] = useState<Asigs>({})

  useEffect(() => {
    getHermanos().then(setHermanos)
    getAllAsignacionesFDSConFecha().then(setTodasAsigsFDS)
  }, [])

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
        const res = await fetch(`/api/epub-fds?fecha=${fecha}`, { signal: ctrl.signal })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Error al cargar')

        if (!data.semana) throw new Error('No se encontró el artículo para esta fecha')

        const d = data.semana as Record<string, unknown>
        setSemana(prev => ({
          ...prev,
          fechaLocale: (d.fechaLocale as string) || prev.fechaLocale,
          tituloArticulo: (d.tituloArticulo as string) || prev.tituloArticulo,
          cancionIntermedia: (d.cancionIntermedia as number | undefined) ?? prev.cancionIntermedia,
          cancionCierre: (d.cancionCierre as number | undefined) ?? prev.cancionCierre,
        }))
        setEpubStatus('ok')
      } catch (e: unknown) {
        if ((e as { name?: string }).name === 'AbortError') return
        const msg = e instanceof Error ? e.message : 'Error desconocido'
        setEpubError(msg)
        setEpubStatus('error')
      }
    }

    cargar()
    return () => ctrl.abort()
  }, [semana.fecha])

  function setAsig(parte: ParteTipoFDS, hermanoId: string) {
    setAsigs(prev => ({ ...prev, [parte]: hermanoId || undefined }))
  }

  async function handleGuardar() {
    if (!semana.fecha) {
      toast({ title: 'La fecha es obligatoria', variant: 'destructive' })
      return
    }
    setSaving(true)
    const s: SemanaFDS = {
      id: semana.id!,
      fecha: semana.fecha!,
      fechaLocale: semana.fechaLocale,
      tituloArticulo: semana.tituloArticulo,
      cancionApertura: semana.cancionApertura,
      cancionIntermedia: semana.cancionIntermedia,
      cancionCierre: semana.cancionCierre,
      boceto: semana.boceto,
      disertacionTitulo: semana.disertacionTitulo,
      oradorNombre: semana.oradorNombre,
      oradorCongregacion: semana.oradorCongregacion,
      oracionCierreTexto: semana.oracionCierreTexto,
    }
    await saveSemanaFDS(s)
    const asignArray = Object.entries(asigs)
      .filter(([, v]) => !!v)
      .map(([parte, hermanoId]) => ({ parte: parte as ParteTipoFDS, hermanoId: hermanoId! }))
    await saveAllAsignacionesFDS(s.id, asignArray)
    toast({ title: 'Reunión guardada' })
    router.push(`/fin-de-semana/${s.id}`)
  }

  const semanaId = semana.id!

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Nueva reunión de fin de semana</h1>
        <Button onClick={handleGuardar} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Guardar
        </Button>
      </div>

      {/* Fecha */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Datos de la reunión</CardTitle>
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
                    <><Loader2 className="h-3 w-3 animate-spin text-blue-500" /><span className="text-blue-500">Cargando desde jw.org…</span></>
                  )}
                  {epubStatus === 'ok' && (
                    <><CheckCircle2 className="h-3 w-3 text-green-600" /><span className="text-green-600">Datos cargados desde jw.org</span></>
                  )}
                  {epubStatus === 'error' && (
                    <><AlertCircle className="h-3 w-3 text-orange-500" /><span className="text-orange-500">{epubError}</span></>
                  )}
                </div>
              )}
              {semana.fechaLocale && (
                <p className="text-xs text-muted-foreground italic">{semana.fechaLocale}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Apertura */}
      <Card className="mb-4 border bg-card border-border">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Apertura
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Presidente</Label>
            <SelectorFDS
              parte="fds_presidente"
              hermanos={hermanos}
              value={asigs['fds_presidente'] ?? ''}
              onChange={v => setAsig('fds_presidente', v)}
              semanaFDSId={semanaId}
              todasAsignaciones={todasAsigsFDS}
              asigsSemana={asigs}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Oración de apertura</Label>
            <SelectorFDS
              parte="fds_oracion_apertura"
              hermanos={hermanos}
              value={asigs['fds_oracion_apertura'] ?? ''}
              onChange={v => setAsig('fds_oracion_apertura', v)}
              semanaFDSId={semanaId}
              todasAsignaciones={todasAsigsFDS}
              asigsSemana={asigs}
            />
          </div>
        </CardContent>
      </Card>

      {/* Disertación pública */}
      <Card className="mb-4 border bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800/40">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
            Disertación pública
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Bosquejo (S-34)</Label>
            <Select
              value={semana.boceto?.toString() ?? ''}
              onValueChange={v => setSemana(p => ({ ...p, boceto: v ? +v : undefined }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="— Sin bosquejo —" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {BOCETOS.map(b => (
                  <SelectItem key={b.numero} value={b.numero.toString()}>
                    {b.numero}. {b.titulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Título libre (opcional)</Label>
            <Input
              placeholder="Título personalizado…"
              value={semana.disertacionTitulo ?? ''}
              onChange={e => setSemana(p => ({ ...p, disertacionTitulo: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nombre del orador</Label>
              <Input
                placeholder="Nombre completo…"
                value={semana.oradorNombre ?? ''}
                onChange={e => setSemana(p => {
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
                value={semana.oradorCongregacion ?? ''}
                onChange={e => setSemana(p => ({ ...p, oradorCongregacion: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estudio de La Atalaya */}
      <Card className="mb-4 border bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800/40">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">
            Estudio de La Atalaya
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {semana.cancionIntermedia && (
            <p className="text-xs text-blue-300 font-medium">
              Canción intermedia: {semana.cancionIntermedia}
            </p>
          )}
          <div className="space-y-1.5">
            <Label>Título del artículo</Label>
            <Input
              placeholder="Título del artículo de estudio…"
              value={semana.tituloArticulo ?? ''}
              onChange={e => setSemana(p => ({ ...p, tituloArticulo: e.target.value }))}
              className={semana.tituloArticulo && epubStatus === 'ok' ? 'bg-blue-900/30 border-blue-700/50' : ''}
            />
            {semana.tituloArticulo && epubStatus === 'ok' && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Auto-cargado desde jw.org
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Lector</Label>
            <SelectorFDS
              parte="fds_lector"
              hermanos={hermanos}
              value={asigs['fds_lector'] ?? ''}
              onChange={v => setAsig('fds_lector', v)}
              semanaFDSId={semanaId}
              todasAsignaciones={todasAsigsFDS}
              asigsSemana={asigs}
            />
          </div>
        </CardContent>
      </Card>

      {/* Cierre */}
      <Card className="mb-4 border bg-card border-border">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Cierre
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {semana.cancionCierre && (
            <p className="text-xs text-muted-foreground font-medium">
              Canción de cierre: {semana.cancionCierre}
            </p>
          )}
          <div className="space-y-1.5">
            <Label>Oración de cierre</Label>
            <Input
              placeholder="Nombre de quien hace la oración…"
              value={semana.oracionCierreTexto ?? ''}
              onChange={e => setSemana(p => ({ ...p, oracionCierreTexto: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">Se completa solo con el orador. Podés borrarlo y poner otro.</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end mt-6">
        <Button onClick={handleGuardar} disabled={saving} size="lg">
          Guardar reunión
        </Button>
      </div>
    </div>
  )
}
