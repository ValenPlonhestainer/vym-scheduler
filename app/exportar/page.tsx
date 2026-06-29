"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FileDown, Printer, Eye, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  getSemanas, getHermanos, getAllAsignaciones, getCongregacion,
  getSemanasFDS, getAllAsignacionesFDS, deleteSemana, deleteSemanaFDS,
} from '@/lib/actions'
import {
  Semana, PARTES_ORDEN, PARTES_INFO, SECCION_LABELS, ParteTipo,
  Hermano, Asignacion, SemanaFDS, AsignacionFDS, ParteTipoFDS,
} from '@/lib/types'
import { formatFechaCorta, getMesAnio, agruparSemanasPorMes } from '@/lib/utils'
import { generarPDFMensual } from '@/lib/pdf'

const SECCIONES_ORDEN = ['apertura', 'tesoros', 'maestros', 'cristiana', 'cierre']

function semanaLunes(fecha: string): number {
  const d = new Date(fecha + 'T12:00:00Z')
  const dow = d.getUTCDay()
  const toMonday = dow === 0 ? 6 : dow - 1
  const monday = new Date(d.getTime() - toMonday * 86_400_000)
  monday.setUTCHours(0, 0, 0, 0)
  return monday.getTime()
}

function fdsDeSemana(semanaFecha: string, semanasFDS: SemanaFDS[]): SemanaFDS[] {
  const weekStart = semanaLunes(semanaFecha)
  const weekEnd = weekStart + 6 * 86_400_000 + 86_399_999
  return semanasFDS.filter(fds => {
    const t = new Date(fds.fecha + 'T12:00:00Z').getTime()
    return t >= weekStart && t <= weekEnd
  })
}

function encontrarFDSParaSemana(semanaFecha: string, semanasFDS: SemanaFDS[]): SemanaFDS | undefined {
  // Prefer the FDS with more data filled in
  return fdsDeSemana(semanaFecha, semanasFDS)
    .sort((a, b) => {
      const score = (f: SemanaFDS) =>
        [f.tituloArticulo, f.oradorNombre, f.disertacionTitulo, f.oradorCongregacion].filter(Boolean).length
      return score(b) - score(a)
    })[0]
}

function asignacionesFDSSemana(
  semanaFecha: string,
  semanasFDS: SemanaFDS[],
  todasAsigs: AsignacionFDS[]
): Record<string, string> {
  const ids = fdsDeSemana(semanaFecha, semanasFDS).map(f => f.id)
  const map: Record<string, string> = {}
  for (const a of todasAsigs) {
    if (ids.includes(a.semanaFDSId)) map[a.parte] = a.hermanoId
  }
  return map
}

export default function ExportarPage() {
  const router = useRouter()
  const [semanas, setSemanas] = useState<Semana[]>([])
  const [hermanos, setHermanos] = useState<Hermano[]>([])
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([])
  const [semanasFDS, setSemanasFDS] = useState<SemanaFDS[]>([])
  const [asignacionesFDS, setAsignacionesFDS] = useState<AsignacionFDS[]>([])
  const [congregacion, setCongregacion] = useState('')
  const [mesSeleccionado, setMesSeleccionado] = useState('')
  const [confirmarOpen, setConfirmarOpen] = useState(false)
  const [eliminarId, setEliminarId] = useState('')
  const [eliminarTipo, setEliminarTipo] = useState<'semana' | 'fds'>('semana')

  function load() {
    Promise.all([getSemanas(), getHermanos(), getAllAsignaciones(), getSemanasFDS(), getAllAsignacionesFDS(), getCongregacion()])
      .then(([s, h, a, fds, afds, cong]) => {
        setSemanas(s); setHermanos(h); setAsignaciones(a)
        setSemanasFDS(fds); setAsignacionesFDS(afds); setCongregacion(cong)
      })
  }

  useEffect(() => { load() }, [])

  const grupos = agruparSemanasPorMes(semanas)
  const gruposFDS = agruparSemanasPorMes(semanasFDS)
  // Un mes aparece si tiene reuniones entre semana, o una FDS realmente huérfana
  // (sin reunión entre semana en su misma semana ISO, en ningún mes). Así una semana
  // que cruza de mes no hace aparecer el mes siguiente vacío en el selector.
  const mesesConFDSHuerfana = new Set<string>()
  for (const fds of semanasFDS) {
    const key = semanaLunes(fds.fecha)
    const tieneContraparte = semanas.some(s => semanaLunes(s.fecha) === key)
    if (!tieneContraparte) {
      const [y, m] = fds.fecha.split('-')
      mesesConFDSHuerfana.add(`${y}-${m}`)
    }
  }
  const meses = [...new Set([...Object.keys(grupos), ...mesesConFDSHuerfana])].sort().reverse()

  useEffect(() => {
    if (meses.length > 0 && !mesSeleccionado) setMesSeleccionado(meses[0])
  }, [meses.join(',')])

  const semanasMes = mesSeleccionado ? (grupos[mesSeleccionado] ?? []) : []
  // One representative FDS per ISO week (for display), all assignments merged separately
  const fdsSemanasDelMes = mesSeleccionado ? (gruposFDS[mesSeleccionado] ?? []) : []
  const fdsHuerfanasPorSemana = (() => {
    const seen = new Map<number, SemanaFDS>()
    for (const fds of fdsSemanasDelMes) {
      const key = semanaLunes(fds.fecha)
      // Contraparte = reunión entre semana en la MISMA semana ISO, de cualquier mes.
      // Si la reunión entre semana cae en el mes anterior (semana que cruza de mes),
      // la FDS se muestra con ella en ese mes y NO como huérfana acá.
      const tieneContraparte = semanas.some(s => semanaLunes(s.fecha) === key)
      if (!tieneContraparte && !seen.has(key)) seen.set(key, fds)
    }
    return [...seen.values()]
  })()

  function getMesLabel(key: string): string {
    const [year, month] = key.split('-')
    const date = new Date(+year, +month - 1, 1)
    return date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  }

  function handlePDF() {
    const mesLabel = getMesLabel(mesSeleccionado)
    generarPDFMensual(semanasMes, hermanos, asignaciones, congregacion, mesLabel, semanasFDS, asignacionesFDS, semanas)
  }

  function handlePrint() {
    window.print()
  }

  async function handleEliminar() {
    if (eliminarTipo === 'semana') await deleteSemana(eliminarId)
    else await deleteSemanaFDS(eliminarId)
    setConfirmarOpen(false)
    load()
  }

  function pedirConfirmarEliminar(id: string, tipo: 'semana' | 'fds') {
    setEliminarId(id)
    setEliminarTipo(tipo)
    setConfirmarOpen(true)
  }

  const nombreHermano = (id: string) => hermanos.find(h => h.id === id)?.nombre ?? '—'

  // Secciones en gris (como las demás); solo un puntito del color que tenían.
  const secDotColors: Record<string, string> = {
    tesoros: 'bg-amber-500',
    maestros: 'bg-green-500',
    cristiana: 'bg-blue-500',
    apertura: '',
    cierre: '',
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-foreground">Exportar PDF</h1>
        <div className="flex gap-2 no-print">
          <Button variant="outline" onClick={handlePrint} size="sm">
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">Imprimir</span>
          </Button>
          <Button onClick={handlePDF} disabled={semanasMes.length === 0} size="sm">
            <FileDown className="h-4 w-4" />
            <span className="hidden sm:inline">Descargar</span> PDF
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6 no-print">
        <Label className="shrink-0">Mes a exportar:</Label>
        <Select value={mesSeleccionado} onValueChange={setMesSeleccionado}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Seleccioná un mes" />
          </SelectTrigger>
          <SelectContent>
            {meses.map(m => (
              <SelectItem key={m} value={m}>{getMesLabel(m)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {semanasMes.length === 0 && fdsHuerfanasPorSemana.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Eye className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p>No hay semanas en este mes</p>
          </CardContent>
        </Card>
      )}

      {/* Vista previa imprimible */}
      <div id="print-area" className="space-y-6">
        {(semanasMes.length > 0 || fdsHuerfanasPorSemana.length > 0) && (
          <div className="text-center mb-2 border-b border-border pb-4">
            <h2 className="text-xl font-bold text-foreground">{congregacion}</h2>
            <p className="text-muted-foreground">Programa Vida y Ministerio — {getMesLabel(mesSeleccionado)}</p>
          </div>
        )}

        {semanasMes.map(semana => {
          const asigsSemana = asignaciones.filter(a => a.semanaId === semana.id)
          const asigMap: Partial<Record<ParteTipo, string>> = {}
          for (const a of asigsSemana) asigMap[a.parte] = a.hermanoId

          const secciones: Record<string, ParteTipo[]> = {}
          for (const parte of PARTES_ORDEN) {
            const sec = PARTES_INFO[parte].seccion
            if (!secciones[sec]) secciones[sec] = []
            secciones[sec].push(parte)
          }

          const fds = encontrarFDSParaSemana(semana.fecha, semanasFDS)
          const asigsFDSMap = asignacionesFDSSemana(semana.fecha, semanasFDS, asignacionesFDS)

          return (
            <div key={semana.id}>
              <div className="no-print flex justify-end gap-1 mb-1">
                <Button size="sm" variant="ghost" className="h-8 px-2 text-muted-foreground hover:text-foreground" onClick={() => router.push(`/historial/${semana.id}`)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" className="h-8 px-2 text-muted-foreground hover:text-destructive" onClick={() => pedirConfirmarEliminar(semana.id, 'semana')}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            <Card className="overflow-hidden">
              {/* Encabezado semana */}
              <div className="bg-blue-700 text-white px-4 py-2.5 flex items-baseline justify-between">
                <h3 className="font-bold text-sm capitalize">{formatFechaCorta(semana.fecha)}</h3>
                {semana.lecturaBiblica && (
                  <span className="text-xs text-blue-200">{semana.lecturaBiblica}</span>
                )}
              </div>
              {semana.tema && (
                <div className="px-4 py-1.5 bg-blue-900/30 border-b border-blue-800/40 text-sm text-blue-300 italic">
                  {semana.tema}
                </div>
              )}

              {/* Label reunión entre semana */}
              <div className="px-4 py-1 bg-blue-900/30 border-b border-border">
                <p className="text-xs font-bold uppercase tracking-wider text-blue-400">Reunión entre semana</p>
              </div>

              <CardContent className="p-0">
                {SECCIONES_ORDEN.map(seccion => {
                  const partes = secciones[seccion] ?? []
                  return (
                    <div key={seccion}>
                      <div className="px-4 py-1 bg-card border-b border-border">
                        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                          {secDotColors[seccion] && (
                            <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${secDotColors[seccion]}`} />
                          )}
                          {SECCION_LABELS[seccion]}
                        </p>
                      </div>
                      {seccion === 'apertura' && semana.cancionApertura && (
                        <div className="flex justify-between px-4 py-1.5 border-b border-border text-sm">
                          <span className="text-muted-foreground">Canción de apertura</span>
                          <span className="font-medium text-foreground">#{semana.cancionApertura}</span>
                        </div>
                      )}
                      {seccion === 'cristiana' && semana.cancionIntermedia && (
                        <div className="flex justify-between px-4 py-1.5 border-b border-border text-sm">
                          <span className="text-muted-foreground">Canción intermedia</span>
                          <span className="font-medium text-foreground">#{semana.cancionIntermedia}</span>
                        </div>
                      )}
                      {partes.map(parte => {
                        if ((parte === 'estudiante_3' || parte === 'ayudante_3') &&
                          !asigMap['estudiante_3'] && !asigMap['ayudante_3']) return null
                        const info = PARTES_INFO[parte]
                        const hermanoNombre = asigMap[parte] ? nombreHermano(asigMap[parte]!) : ''
                        const titulo = (semana.titulos ?? {})[parte] ?? ''
                        const isAyudante = ['ayudante_1', 'ayudante_2', 'ayudante_3'].includes(parte)
                        return (
                          <div
                            key={parte}
                            className={`flex justify-between items-start px-4 py-1.5 border-b border-border last:border-0 text-sm ${isAyudante ? 'pl-8 bg-muted/30' : ''}`}
                          >
                            <div className="flex-1 min-w-0 pr-2">
                              <span className="text-muted-foreground text-xs">{info.label}</span>
                              {titulo && <span className="text-foreground ml-1 text-xs">— {titulo}</span>}
                            </div>
                            <span className={`font-semibold text-xs shrink-0 ${hermanoNombre ? 'text-foreground' : 'text-muted-foreground/40'}`}>
                              {hermanoNombre || '—'}
                            </span>
                          </div>
                        )
                      })}
                      {seccion === 'cierre' && semana.cancionCierre && (
                        <div className="flex justify-between px-4 py-1.5 text-sm">
                          <span className="text-muted-foreground">Canción de cierre</span>
                          <span className="font-medium text-foreground">#{semana.cancionCierre}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </CardContent>

              {/* Reunión de fin de semana */}
              {fds && (
                <>
                  <div className="px-4 py-1 bg-purple-900/30 border-t-2 border-purple-700/40 border-b border-border flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-purple-400">
                      Reunión de fin de semana · {formatFechaCorta(fds.fecha)}
                    </p>
                    <div className="no-print flex gap-0.5">
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-purple-400 hover:text-purple-200" onClick={() => router.push(`/fin-de-semana/${fds.id}`)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-purple-400 hover:text-destructive" onClick={() => pedirConfirmarEliminar(fds.id, 'fds')}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Apertura FDS */}
                  <div className="px-4 py-1 bg-card border-b border-border">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Apertura</p>
                  </div>
                  {fds.cancionApertura && (
                    <div className="flex justify-between px-4 py-1.5 border-b border-border text-sm">
                      <span className="text-muted-foreground">Canción de apertura</span>
                      <span className="font-medium text-foreground">#{fds.cancionApertura}</span>
                    </div>
                  )}
                  {(['fds_presidente', 'fds_oracion_apertura'] as const).map(parte => (
                    <div key={parte} className="flex justify-between px-4 py-1.5 border-b border-border text-sm">
                      <span className="text-muted-foreground text-xs">
                        {parte === 'fds_presidente' ? 'Presidente' : 'Oración de apertura'}
                      </span>
                      <span className={`font-semibold text-xs shrink-0 ${asigsFDSMap[parte] ? 'text-foreground' : 'text-muted-foreground/40'}`}>
                        {asigsFDSMap[parte] ? nombreHermano(asigsFDSMap[parte]) : '—'}
                      </span>
                    </div>
                  ))}

                  {/* Disertación pública */}
                  <div className="px-4 py-1 bg-card border-b border-border">
                    <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      <span className="inline-block h-2 w-2 rounded-full shrink-0 bg-amber-500" />
                      Disertación pública
                    </p>
                  </div>
                  {fds.disertacionTitulo && (
                    <div className="px-4 py-1.5 border-b border-border text-sm text-foreground italic">
                      {fds.disertacionTitulo}
                    </div>
                  )}
                  {(fds.oradorNombre || fds.oradorCongregacion) && (
                    <div className="flex justify-between px-4 py-1.5 border-b border-border text-sm">
                      <span className="text-muted-foreground text-xs">Orador</span>
                      <span className="font-semibold text-xs text-foreground">
                        {fds.oradorNombre}{fds.oradorCongregacion ? ` (${fds.oradorCongregacion})` : ''}
                      </span>
                    </div>
                  )}

                  {/* Estudio de La Atalaya */}
                  <div className="px-4 py-1 bg-card border-b border-border">
                    <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      <span className="inline-block h-2 w-2 rounded-full shrink-0 bg-blue-500" />
                      Estudio de La Atalaya
                    </p>
                  </div>
                  {fds.cancionIntermedia && (
                    <div className="flex justify-between px-4 py-1.5 border-b border-border text-sm">
                      <span className="text-muted-foreground">Canción intermedia</span>
                      <span className="font-medium text-foreground">#{fds.cancionIntermedia}</span>
                    </div>
                  )}
                  {fds.tituloArticulo && (
                    <div className="px-4 py-1.5 border-b border-border text-sm text-foreground italic">
                      {fds.tituloArticulo}
                    </div>
                  )}
                  <div className="flex justify-between px-4 py-1.5 border-b border-border text-sm">
                    <span className="text-muted-foreground text-xs">Lector</span>
                    <span className={`font-semibold text-xs shrink-0 ${asigsFDSMap['fds_lector'] ? 'text-foreground' : 'text-muted-foreground/40'}`}>
                      {asigsFDSMap['fds_lector'] ? nombreHermano(asigsFDSMap['fds_lector']) : '—'}
                    </span>
                  </div>

                  {/* Cierre FDS */}
                  <div className="flex justify-between px-4 py-1.5 border-b border-border text-sm">
                    <span className="text-muted-foreground text-xs">Oración de cierre</span>
                    <span className={`font-semibold text-xs shrink-0 ${fds.oracionCierreTexto ? 'text-foreground' : 'text-muted-foreground/40'}`}>
                      {fds.oracionCierreTexto || '—'}
                    </span>
                  </div>
                  {fds.cancionCierre && (
                    <div className="flex justify-between px-4 py-1.5 text-sm">
                      <span className="text-muted-foreground">Canción de cierre</span>
                      <span className="font-medium text-foreground">#{fds.cancionCierre}</span>
                    </div>
                  )}
                </>
              )}
            </Card>
            </div>
          )
        })}

        {/* FDS meetings without a matching weekday semana */}
        {fdsHuerfanasPorSemana.map(fds => {
          const asigsFDSMap = asignacionesFDSSemana(fds.fecha, semanasFDS, asignacionesFDS)
          return (
            <div key={fds.id}>
              <div className="no-print flex justify-end gap-1 mb-1">
                <Button size="sm" variant="ghost" className="h-8 px-2 text-muted-foreground hover:text-foreground" onClick={() => router.push(`/fin-de-semana/${fds.id}`)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" className="h-8 px-2 text-muted-foreground hover:text-destructive" onClick={() => pedirConfirmarEliminar(fds.id, 'fds')}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            <Card className="overflow-hidden">
              <div className="bg-purple-700 text-white px-4 py-2.5">
                <h3 className="font-bold text-sm">Reunión fin de semana · {formatFechaCorta(fds.fecha)}</h3>
              </div>
              <div className="px-4 py-1 bg-card border-b border-border">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Apertura</p>
              </div>
              {fds.cancionApertura && (
                <div className="flex justify-between px-4 py-1.5 border-b border-border text-sm">
                  <span className="text-muted-foreground">Canción de apertura</span>
                  <span className="font-medium text-foreground">#{fds.cancionApertura}</span>
                </div>
              )}
              {(['fds_presidente', 'fds_oracion_apertura'] as const).map(parte => (
                <div key={parte} className="flex justify-between px-4 py-1.5 border-b border-border text-sm">
                  <span className="text-muted-foreground text-xs">{parte === 'fds_presidente' ? 'Presidente' : 'Oración de apertura'}</span>
                  <span className={`font-semibold text-xs shrink-0 ${asigsFDSMap[parte] ? 'text-foreground' : 'text-muted-foreground/40'}`}>
                    {asigsFDSMap[parte] ? nombreHermano(asigsFDSMap[parte]) : '—'}
                  </span>
                </div>
              ))}
              <div className="px-4 py-1 bg-card border-b border-border">
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  <span className="inline-block h-2 w-2 rounded-full shrink-0 bg-amber-500" />
                  Disertación pública
                </p>
              </div>
              {fds.disertacionTitulo && (
                <div className="px-4 py-1.5 border-b border-border text-sm text-foreground italic">{fds.disertacionTitulo}</div>
              )}
              {(fds.oradorNombre || fds.oradorCongregacion) && (
                <div className="flex justify-between px-4 py-1.5 border-b border-border text-sm">
                  <span className="text-muted-foreground text-xs">Orador</span>
                  <span className="font-semibold text-xs text-foreground">
                    {fds.oradorNombre}{fds.oradorCongregacion ? ` (${fds.oradorCongregacion})` : ''}
                  </span>
                </div>
              )}
              <div className="px-4 py-1 bg-card border-b border-border">
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  <span className="inline-block h-2 w-2 rounded-full shrink-0 bg-blue-500" />
                  Estudio de La Atalaya
                </p>
              </div>
              {fds.cancionIntermedia && (
                <div className="flex justify-between px-4 py-1.5 border-b border-border text-sm">
                  <span className="text-muted-foreground">Canción intermedia</span>
                  <span className="font-medium text-foreground">#{fds.cancionIntermedia}</span>
                </div>
              )}
              {fds.tituloArticulo && (
                <div className="px-4 py-1.5 border-b border-border text-sm text-foreground italic">{fds.tituloArticulo}</div>
              )}
              <div className="flex justify-between px-4 py-1.5 border-b border-border text-sm">
                <span className="text-muted-foreground text-xs">Lector</span>
                <span className={`font-semibold text-xs shrink-0 ${asigsFDSMap['fds_lector'] ? 'text-foreground' : 'text-muted-foreground/40'}`}>
                  {asigsFDSMap['fds_lector'] ? nombreHermano(asigsFDSMap['fds_lector']) : '—'}
                </span>
              </div>
              <div className="flex justify-between px-4 py-1.5 border-b border-border text-sm">
                <span className="text-muted-foreground text-xs">Oración de cierre</span>
                <span className={`font-semibold text-xs shrink-0 ${fds.oracionCierreTexto ? 'text-foreground' : 'text-muted-foreground/40'}`}>
                  {fds.oracionCierreTexto || '—'}
                </span>
              </div>
              {fds.cancionCierre && (
                <div className="flex justify-between px-4 py-1.5 text-sm">
                  <span className="text-muted-foreground">Canción de cierre</span>
                  <span className="font-medium text-foreground">#{fds.cancionCierre}</span>
                </div>
              )}
            </Card>
            </div>
          )
        })}
      </div>

      {/* ── CONFIRMAR ELIMINAR ── */}
      <Dialog open={confirmarOpen} onOpenChange={setConfirmarOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Eliminar reunión?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta acción no se puede deshacer. Se eliminarán también todas las asignaciones de esa reunión.
          </p>
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmarOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleEliminar}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
