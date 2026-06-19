"use client"

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Save, Loader2, RefreshCw, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SelectorHermano } from '@/components/programar/selector-hermano'
import { getSemana, getAsignaciones, getHermanos, saveSemana, saveAllAsignaciones, getAllAsignacionesConFecha } from '@/lib/actions'
import {
  Semana, ParteTipo, PARTES_ORDEN, PARTES_INFO, SECCION_LABELS, Hermano, Asignacion,
} from '@/lib/types'
import { formatFecha } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

type Asigs = Partial<Record<ParteTipo, string>>

const SECCIONES_ORDEN = ['apertura', 'tesoros', 'maestros', 'cristiana', 'cierre']

function agruparPorSeccion() {
  const secciones: Record<string, ParteTipo[]> = {}
  for (const parte of PARTES_ORDEN) {
    const sec = PARTES_INFO[parte].seccion
    if (!secciones[sec]) secciones[sec] = []
    secciones[sec].push(parte)
  }
  return secciones
}

export default function SemanaDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { toast } = useToast()
  const [semana, setSemana] = useState<Semana | null>(null)
  const [hermanos, setHermanos] = useState<Hermano[]>([])
  const [asigs, setAsigs] = useState<Asigs>({})
  const [saving, setSaving] = useState(false)
  const [reloading, setReloading] = useState(false)
  const [usarSalaAux, setUsarSalaAux] = useState(false)
  const [todasAsigs, setTodasAsigs] = useState<Array<Asignacion & { fecha: string }>>([])

  useEffect(() => {
    Promise.all([getSemana(id), getAsignaciones(id), getHermanos(), getAllAsignacionesConFecha()])
      .then(([s, asigData, herm, todas]) => {
        if (!s) { router.push('/historial'); return }
        setSemana(s)
        setHermanos(herm)
        const map: Asigs = {}
        for (const a of asigData) map[a.parte] = a.hermanoId
        setAsigs(map)
        const tieneAux = asigData.some(a => a.parte.startsWith('aux_'))
        if (tieneAux) setUsarSalaAux(true)
        setTodasAsigs(todas)
      })
  }, [id, router])

  function setAsig(parte: ParteTipo, hermanoId: string) {
    setAsigs(prev => ({ ...prev, [parte]: hermanoId || undefined }))
  }

  function setTitulo(parte: ParteTipo, titulo: string) {
    setSemana(prev => prev ? { ...prev, titulos: { ...prev.titulos, [parte]: titulo } } : prev)
  }

  async function recargarTitulos() {
    if (!semana?.fecha) return
    setReloading(true)
    try {
      const [year, month] = semana.fecha.split('-')
      const res = await fetch(`/api/epub?year=${year}&month=${month}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al cargar')

      const fechaNorm = semana.fecha.replace(/-/g, '/')
      const semanas: Array<Record<string, unknown>> = data.semanas ?? []
      const found = semanas.find(s => s.fecha === fechaNorm)
        ?? semanas.reduce((best: Record<string, unknown>, s: Record<string, unknown>) => {
          const diff = Math.abs(new Date((s.fecha as string).replace(/\//g, '-')).getTime() - new Date(semana.fecha).getTime())
          const bestDiff = Math.abs(new Date((best.fecha as string).replace(/\//g, '-')).getTime() - new Date(semana.fecha).getTime())
          return diff < bestDiff ? s : best
        }, semanas[0])

      if (!found) throw new Error('No se encontró la semana')

      setSemana(prev => prev ? {
        ...prev,
        tema: (found.tema as string) || prev.tema,
        lecturaBiblica: (found.lecturaBiblica as string) || prev.lecturaBiblica,
        cancionApertura: (found.cancionApertura as number) ?? prev.cancionApertura,
        cancionIntermedia: (found.cancionIntermedia as number) ?? prev.cancionIntermedia,
        cancionCierre: (found.cancionCierre as number) ?? prev.cancionCierre,
        numEstudiantes: (found.numEstudiantes as number | undefined) ?? prev.numEstudiantes,
        titulos: { ...prev.titulos, ...(found.titulos as Record<string, string>) },
      } : prev)
      toast({ title: 'Títulos actualizados desde jw.org' })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error'
      toast({ title: 'No se pudo cargar jw.org', description: msg, variant: 'destructive' })
    } finally {
      setReloading(false)
    }
  }

  async function handleGuardar() {
    if (!semana) return
    setSaving(true)
    await saveSemana(semana)
    const asigArray = Object.entries(asigs)
      .filter(([, v]) => !!v)
      .map(([parte, hermanoId]) => ({ parte: parte as ParteTipo, hermanoId: hermanoId! }))
    await saveAllAsignaciones(semana.id, asigArray)
    toast({ title: 'Cambios guardados' })
    setSaving(false)
  }

  if (!semana) return <div className="p-8 text-center text-gray-400">Cargando...</div>

  const secciones = agruparPorSeccion()

  const numEstudiantes = semana.numEstudiantes
    ?? (semana.titulos?.estudiante_4 ? 4
      : semana.titulos?.estudiante_3 ? 3
      : 2)

  const colorMap: Record<string, string> = {
    apertura: 'bg-card border-border',
    tesoros: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800/40',
    maestros: 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800/40',
    cristiana: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800/40',
    cierre: 'bg-card border-border',
  }
  const titleColorMap: Record<string, string> = {
    apertura: 'text-muted-foreground',
    tesoros: 'text-amber-600 dark:text-amber-400',
    maestros: 'text-green-600 dark:text-green-400',
    cristiana: 'text-blue-600 dark:text-blue-400',
    cierre: 'text-muted-foreground',
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold text-foreground capitalize truncate">{formatFecha(semana.fecha)}</h1>
          {semana.tema && <p className="text-muted-foreground text-xs sm:text-sm truncate">{semana.tema}</p>}
        </div>
        <Button variant="outline" size="sm" onClick={recargarTitulos} disabled={reloading} title="Recargar títulos de cada parte desde jw.org">
          {reloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="hidden sm:inline">jw.org</span>
        </Button>
        <Button size="sm" onClick={handleGuardar} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar
        </Button>
      </div>

      {/* Datos */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Datos de la semana</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Fecha</Label>
              <Input
                type="date"
                value={semana.fecha}
                onChange={e => setSemana(p => p ? { ...p, fecha: e.target.value } : p)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Lectura bíblica</Label>
              <Input
                value={semana.lecturaBiblica}
                onChange={e => setSemana(p => p ? { ...p, lecturaBiblica: e.target.value } : p)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Tema de la semana</Label>
            <Input
              value={semana.tema}
              onChange={e => setSemana(p => p ? { ...p, tema: e.target.value } : p)}
            />
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-3">
            {(['cancionApertura', 'cancionIntermedia', 'cancionCierre'] as const).map(c => (
              <div key={c} className="space-y-1.5">
                <Label>{c === 'cancionApertura' ? 'Apert.' : c === 'cancionIntermedia' ? 'Interm.' : 'Cierre'}</Label>
                <Input
                  type="number"
                  placeholder="Nº"
                  value={semana[c] ?? ''}
                  onChange={e => setSemana(p => p ? { ...p, [c]: e.target.value ? +e.target.value : undefined } : p)}
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
                <CardTitle className={`text-sm font-bold uppercase tracking-wide ${titleColorMap[seccion]}`}>
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
                const needsTitulo = ['discurso_tesoros', 'perlas_escondidas', 'lectura_biblica', 'estudiante_1', 'estudiante_2', 'estudiante_3', 'estudiante_4', 'parte_local_1', 'parte_local_2'].includes(parte)

                if (isAyudante) return null

                const n = parte.replace('estudiante_', '')
                const ayuParte = `ayudante_${n}` as ParteTipo
                const auxEstParte = `aux_estudiante_${n}` as ParteTipo
                const auxAyuParte = `aux_ayudante_${n}` as ParteTipo
                const tituloEst = (semana.titulos ?? {})[parte] ?? ''
                const esDiscurso = tituloEst.trim().toLowerCase() === 'discurso'

                return (
                  <div key={parte} className="space-y-1.5">
                    <div className="flex items-baseline gap-2">
                      <Label className="text-sm font-medium text-foreground">{info.label}</Label>
                      {info.opcional && <span className="text-xs text-muted-foreground italic">opcional</span>}
                    </div>
                    {needsTitulo && !isAyudante && (
                      <Input
                        placeholder="Título de la parte..."
                        className={`text-sm h-8 ${seccion === 'maestros' ? 'text-green-700 bg-green-50 border-green-300 input-gray-placeholder dark:text-green-300 dark:bg-green-950/40 dark:border-green-700/50' : ''}`}
                        value={(semana.titulos ?? {})[parte] ?? ''}
                        onChange={e => setTitulo(parte, e.target.value)}
                      />
                    )}
                    {/* Sala principal */}
                    <div className="space-y-1.5">
                      {usarSalaAux && isEstudiante && (
                        <p className="text-xs text-muted-foreground font-medium">Sala principal</p>
                      )}
                      <SelectorHermano
                        parte={parte}
                        hermanos={hermanos}
                        value={asigs[parte] ?? ''}
                        onChange={v => setAsig(parte, v)}
                        semanaId={semana.id}
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
                            semanaId={semana.id}
                            todasAsignaciones={todasAsigs}
                            asigsSemana={asigs}
                          />
                        </div>
                      )}
                    </div>
                    {/* Sala auxiliar */}
                    {usarSalaAux && isEstudiante && (
                      <div className="pl-3 border-l-2 border-amber-300 ml-1 space-y-1.5">
                        <p className="text-xs text-amber-600 font-medium">Sala auxiliar</p>
                        <SelectorHermano
                          parte={auxEstParte}
                          hermanos={hermanos}
                          value={asigs[auxEstParte] ?? ''}
                          onChange={v => setAsig(auxEstParte, v)}
                          semanaId={semana.id}
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
                              semanaId={semana.id}
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

      <div className="flex justify-end mt-6">
        <Button onClick={handleGuardar} disabled={saving} size="lg">
          Guardar cambios
        </Button>
      </div>
    </div>
  )
}
