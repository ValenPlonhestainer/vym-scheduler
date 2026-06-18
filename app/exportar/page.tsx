"use client"

import { useState, useEffect } from 'react'
import { FileDown, Printer, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  getSemanas, getHermanos, getAllAsignaciones, getCongregacion,
  getSemanasFDS, getAllAsignacionesFDS,
} from '@/lib/actions'
import {
  Semana, PARTES_ORDEN, PARTES_INFO, SECCION_LABELS, ParteTipo,
  Hermano, Asignacion, SemanaFDS, AsignacionFDS, ParteTipoFDS,
} from '@/lib/types'
import { formatFechaCorta, getMesAnio, agruparSemanasPorMes } from '@/lib/utils'
import { generarPDFMensual } from '@/lib/pdf'

const SECCIONES_ORDEN = ['apertura', 'tesoros', 'maestros', 'cristiana', 'cierre']

function encontrarFDSParaSemana(semanaFecha: string, semanasFDS: SemanaFDS[]): SemanaFDS | undefined {
  const inicio = new Date(semanaFecha).getTime()
  const fin = inicio + 6 * 86_400_000
  return semanasFDS.find(fds => {
    const t = new Date(fds.fecha).getTime()
    return t >= inicio && t <= fin
  })
}

export default function ExportarPage() {
  const [semanas, setSemanas] = useState<Semana[]>([])
  const [hermanos, setHermanos] = useState<Hermano[]>([])
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([])
  const [semanasFDS, setSemanasFDS] = useState<SemanaFDS[]>([])
  const [asignacionesFDS, setAsignacionesFDS] = useState<AsignacionFDS[]>([])
  const [congregacion, setCongregacion] = useState('')
  const [mesSeleccionado, setMesSeleccionado] = useState('')

  function load() {
    Promise.all([getSemanas(), getHermanos(), getAllAsignaciones(), getSemanasFDS(), getAllAsignacionesFDS(), getCongregacion()])
      .then(([s, h, a, fds, afds, cong]) => {
        setSemanas(s); setHermanos(h); setAsignaciones(a)
        setSemanasFDS(fds); setAsignacionesFDS(afds); setCongregacion(cong)
      })
  }

  useEffect(() => { load() }, [])

  const grupos = agruparSemanasPorMes(semanas)
  const meses = Object.keys(grupos).sort().reverse()

  useEffect(() => {
    if (meses.length > 0 && !mesSeleccionado) setMesSeleccionado(meses[0])
  }, [meses.join(',')])

  const semanasMes = mesSeleccionado ? (grupos[mesSeleccionado] ?? []) : []

  function getMesLabel(key: string): string {
    const [year, month] = key.split('-')
    const date = new Date(+year, +month - 1, 1)
    return date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  }

  function handlePDF() {
    const mesLabel = getMesLabel(mesSeleccionado)
    generarPDFMensual(semanasMes, hermanos, asignaciones, congregacion, mesLabel, semanasFDS, asignacionesFDS)
  }

  function handlePrint() {
    window.print()
  }

  const nombreHermano = (id: string) => hermanos.find(h => h.id === id)?.nombre ?? '—'

  const secColors: Record<string, string> = {
    tesoros: 'bg-amber-950/30 border-amber-800/40',
    maestros: 'bg-green-950/30 border-green-800/40',
    cristiana: 'bg-blue-950/30 border-blue-800/40',
    apertura: 'bg-card',
    cierre: 'bg-card',
  }
  const secTitleColors: Record<string, string> = {
    tesoros: 'text-amber-400',
    maestros: 'text-green-400',
    cristiana: 'text-blue-400',
    apertura: 'text-muted-foreground',
    cierre: 'text-muted-foreground',
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

      {semanasMes.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Eye className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p>No hay semanas en este mes</p>
          </CardContent>
        </Card>
      )}

      {/* Vista previa imprimible */}
      <div id="print-area" className="space-y-6">
        {semanasMes.length > 0 && (
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
          const asigsFDS = fds ? asignacionesFDS.filter(a => a.semanaFDSId === fds.id) : []
          const asigsFDSMap: Record<string, string> = {}
          for (const a of asigsFDS) asigsFDSMap[a.parte] = a.hermanoId

          return (
            <Card key={semana.id} className="overflow-hidden">
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
              <div className="px-4 py-1 bg-muted/20 border-b border-border">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60">Reunión entre semana</p>
              </div>

              <CardContent className="p-0">
                {SECCIONES_ORDEN.map(seccion => {
                  const partes = secciones[seccion] ?? []
                  return (
                    <div key={seccion}>
                      <div className={`px-4 py-1 ${secColors[seccion]} border-b border-border`}>
                        <p className={`text-xs font-bold uppercase tracking-wide ${secTitleColors[seccion]}`}>
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
                  <div className="px-4 py-1 bg-purple-900/30 border-t-2 border-purple-700/40 border-b border-border">
                    <p className="text-xs font-bold uppercase tracking-wider text-purple-400">
                      Reunión de fin de semana · {formatFechaCorta(fds.fecha)}
                    </p>
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
                  <div className="px-4 py-1 bg-amber-950/30 border-b border-amber-800/40">
                    <p className="text-xs font-bold uppercase tracking-wide text-amber-400">Disertación pública</p>
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
                  <div className="px-4 py-1 bg-blue-950/30 border-b border-blue-800/40">
                    <p className="text-xs font-bold uppercase tracking-wide text-blue-400">Estudio de La Atalaya</p>
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
                    <span className={`font-semibold text-xs shrink-0 ${asigsFDSMap['fds_oracion_cierre'] ? 'text-foreground' : 'text-muted-foreground/40'}`}>
                      {asigsFDSMap['fds_oracion_cierre'] ? nombreHermano(asigsFDSMap['fds_oracion_cierre']) : '—'}
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
          )
        })}
      </div>
    </div>
  )
}
