"use client"

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Save, Loader2, Music, User, BookOpen } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SelectorFDS } from '@/components/fin-de-semana/selector-fds'
import { SelectorBoceto } from '@/components/fin-de-semana/selector-boceto'
import {
  getHermanos, getSemanaFDS, saveSemanaFDS, getAsignacionesFDS, saveAllAsignacionesFDS,
  getAllAsignacionesFDSConFecha,
} from '@/lib/actions'
import { Hermano, SemanaFDS, ParteTipoFDS, PARTES_INFO_FDS, AsignacionFDS } from '@/lib/types'
import { formatFecha } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { bocetoPDFLabel } from '@/data/bocetos'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Asigs = Partial<Record<ParteTipoFDS, string>>

export default function DetalleFDSPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { toast } = useToast()

  const [hermanos, setHermanos] = useState<Hermano[]>([])
  const [semana, setSemana] = useState<SemanaFDS | null>(null)
  const [asigs, setAsigs] = useState<Asigs>({})
  const [saving, setSaving] = useState(false)
  const [todasAsigsFDS, setTodasAsigsFDS] = useState<Array<AsignacionFDS & { fecha: string }>>([])


  useEffect(() => {
    Promise.all([getSemanaFDS(id), getAsignacionesFDS(id), getHermanos(), getAllAsignacionesFDSConFecha()])
      .then(([s, asigsSemana, herm, todas]) => {
        if (!s) { router.push('/fin-de-semana'); return }
        const map: Asigs = {}
        for (const a of asigsSemana) map[a.parte] = a.hermanoId
        // Migración suave: semanas viejas guardaban la oración de cierre como
        // asignación (hermano_id). Si no hay texto libre, lo precargamos con
        // el nombre de ese hermano.
        if (!s.oracionCierreTexto && map['fds_oracion_cierre']) {
          const h = herm.find(x => x.id === map['fds_oracion_cierre'])
          if (h) s = { ...s, oracionCierreTexto: h.nombre }
        }
        setSemana(s)
        setAsigs(map)
        setHermanos(herm)
        setTodasAsigsFDS(todas)
      })
  }, [id])

  if (!semana) return null

  function update<K extends keyof SemanaFDS>(key: K, value: SemanaFDS[K]) {
    setSemana(prev => prev ? { ...prev, [key]: value } : prev)
  }

  function setAsig(parte: ParteTipoFDS, hermanoId: string) {
    setAsigs(prev => ({ ...prev, [parte]: hermanoId || undefined }))
  }

  async function handleGuardar() {
    if (!semana) return
    setSaving(true)
    await saveSemanaFDS(semana)
    const asignArray = Object.entries(asigs)
      .filter(([parte, v]) => !!v && parte !== 'fds_oracion_cierre') // la oración de cierre ahora es texto libre
      .map(([parte, hermanoId]) => ({ parte: parte as ParteTipoFDS, hermanoId: hermanoId! }))
    await saveAllAsignacionesFDS(semana.id, asignArray)
    setSaving(false)
    toast({ title: 'Reunión guardada' })
  }

  const nombre = (id?: string) => id ? (hermanos.find(h => h.id === id)?.nombre ?? '—') : '—'

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/fin-de-semana"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-foreground truncate">Fin de semana</h1>
          <p className="text-sm text-muted-foreground capitalize">{formatFecha(semana.fecha)}</p>
        </div>
        <Button onClick={handleGuardar} disabled={saving} size="sm">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span className="hidden sm:inline">Guardar cambios</span>
          <span className="sm:hidden">Guardar</span>
        </Button>
      </div>

      {/* Resumen visual */}
      <Card className="mb-6 border bg-purple-50 border-purple-200 dark:bg-purple-950/20 dark:border-purple-800/40">
        <CardContent className="py-4 px-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {semana.fechaLocale && (
            <div className="col-span-2 text-purple-300 italic text-xs mb-1">{semana.fechaLocale}</div>
          )}
          {(
            [
              ['fds_presidente', 'Presidente'],
              ['fds_oracion_apertura', 'Oración apertura'],
              ['fds_lector', 'Lector'],
            ] as [ParteTipoFDS, string][]
          ).map(([parte, label]) => (
            <div key={parte} className="flex items-center gap-2">
              <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">{label}:</span>
              <span className="text-foreground font-medium">{nombre(asigs[parte])}</span>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">Oración cierre:</span>
            <span className="text-foreground font-medium">{semana.oracionCierreTexto || '—'}</span>
          </div>
          {semana.boceto && (
            <div className="col-span-2 flex items-center gap-2">
              <BookOpen className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <span className="text-amber-300 text-xs font-medium">{bocetoPDFLabel(semana.boceto)}</span>
            </div>
          )}
          {semana.oradorNombre && (
            <div className="col-span-2 flex items-center gap-2">
              <BookOpen className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <span className="text-muted-foreground">Orador:</span>
              <span className="text-foreground font-medium">{semana.oradorNombre}</span>
              {semana.oradorCongregacion && (
                <span className="text-muted-foreground text-xs">({semana.oradorCongregacion})</span>
              )}
            </div>
          )}
          {[semana.cancionApertura, semana.cancionIntermedia, semana.cancionCierre].some(Boolean) && (
            <div className="col-span-2 flex items-center gap-4 mt-1">
              <Music className="h-3.5 w-3.5 text-purple-400 shrink-0" />
              {semana.cancionApertura && <span className="text-purple-300 text-xs">Apertura: {semana.cancionApertura}</span>}
              {semana.cancionIntermedia && <span className="text-purple-300 text-xs">Intermedia: {semana.cancionIntermedia}</span>}
              {semana.cancionCierre && <span className="text-purple-300 text-xs">Cierre: {semana.cancionCierre}</span>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edición — Datos generales */}
      <Card className="mb-4">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Datos generales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="space-y-1.5">
              <div className="flex items-baseline gap-2">
                <Label>Canción apertura</Label>
                <span className="text-xs text-muted-foreground italic">opcional</span>
              </div>
              <Input
                type="number"
                placeholder="Nº"
                value={semana.cancionApertura ?? ''}
                onChange={e => update('cancionApertura', e.target.value ? +e.target.value : undefined)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Canción intermedia</Label>
              <Input
                type="number"
                placeholder="Nº"
                value={semana.cancionIntermedia ?? ''}
                onChange={e => update('cancionIntermedia', e.target.value ? +e.target.value : undefined)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Canción cierre</Label>
              <Input
                type="number"
                placeholder="Nº"
                value={semana.cancionCierre ?? ''}
                onChange={e => update('cancionCierre', e.target.value ? +e.target.value : undefined)}
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
                value={asigs[parte] ?? ''}
                onChange={v => setAsig(parte, v)}
                semanaFDSId={semana.id}
                todasAsignaciones={todasAsigsFDS}
                asigsSemana={asigs}
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
              value={semana.boceto}
              onChange={v => update('boceto', v)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Título libre (opcional)</Label>
            <Input
              placeholder="Título personalizado…"
              value={semana.disertacionTitulo ?? ''}
              onChange={e => update('disertacionTitulo', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nombre del orador</Label>
              <Input
                placeholder="Nombre completo…"
                value={semana.oradorNombre ?? ''}
                onChange={e => setSemana(prev => {
                  if (!prev) return prev
                  const nuevo = e.target.value
                  // Espejar el orador en la oración de cierre mientras no se haya
                  // editado a mano (sigue vacía o igual al orador anterior).
                  const sync = !prev.oracionCierreTexto || prev.oracionCierreTexto === (prev.oradorNombre ?? '')
                  return { ...prev, oradorNombre: nuevo, ...(sync ? { oracionCierreTexto: nuevo } : {}) }
                })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Congregación de origen</Label>
              <Input
                placeholder="Nombre de la congregación…"
                value={semana.oradorCongregacion ?? ''}
                onChange={e => update('oradorCongregacion', e.target.value)}
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
              value={semana.tituloArticulo ?? ''}
              onChange={e => update('tituloArticulo', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{PARTES_INFO_FDS['fds_lector'].label}</Label>
            <SelectorFDS
              parte="fds_lector"
              hermanos={hermanos}
              value={asigs['fds_lector'] ?? ''}
              onChange={v => setAsig('fds_lector', v)}
              semanaFDSId={semana.id}
              todasAsignaciones={todasAsigsFDS}
              asigsSemana={asigs}
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
          <div className="space-y-1.5">
            <Label>{PARTES_INFO_FDS['fds_oracion_cierre'].label}</Label>
            <Input
              placeholder="Nombre de quien hace la oración…"
              value={semana.oracionCierreTexto ?? ''}
              onChange={e => update('oracionCierreTexto', e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Se completa solo con el orador. Podés borrarlo y poner otro.</p>
          </div>
        </CardContent>
      </Card>

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
                <Select
                  value={semana[field] ?? ''}
                  onValueChange={v => update(field, v || undefined)}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="— Sin asignar —" />
                  </SelectTrigger>
                  <SelectContent>
                    {hermanos.filter(h => h.activo).map(h => (
                      <SelectItem key={h.id} value={h.id}>{h.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end mt-6">
        <Button onClick={handleGuardar} disabled={saving} size="lg">
          Guardar cambios
        </Button>
      </div>
    </div>
  )
}
