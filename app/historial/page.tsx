"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Calendar, Plus, Trash2, ChevronRight, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { getSemanas, deleteSemana, getAllAsignaciones, getSemanasFDS, deleteSemanaFDS } from '@/lib/actions'
import { Semana, SemanaFDS, Asignacion } from '@/lib/types'
import { formatFechaCorta } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { ToggleAutoRecordatorioSemana } from '@/components/recordatorios/toggle-auto-recordatorio-semana'
import { BotonRecordatorios } from '@/components/recordatorios/boton-recordatorios'

type EntradaSemana = {
  lunes: string
  semana?: Semana
  semanaFDS?: SemanaFDS
}

function getMondayOf(fecha: string): string {
  const d = new Date(fecha.replace(/\//g, '-') + 'T12:00:00')
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}

function getWeekRange(lunes: string): string {
  const d = new Date(lunes + 'T12:00:00')
  const domingo = new Date(d)
  domingo.setDate(d.getDate() + 6)
  const lunesDay = d.getDate()
  const domingoDay = domingo.getDate()
  const lunesMes = d.toLocaleDateString('es-AR', { month: 'long' })
  const domingoMes = domingo.toLocaleDateString('es-AR', { month: 'long' })
  const year = domingo.getFullYear()
  if (lunesMes === domingoMes) {
    return `${lunesDay} al ${domingoDay} de ${lunesMes} ${year}`
  }
  return `${lunesDay} de ${lunesMes} al ${domingoDay} de ${domingoMes} ${year}`
}

function agruparEntradas(semanas: Semana[], semanasFDS: SemanaFDS[]): Record<string, EntradaSemana[]> {
  const mapa: Record<string, EntradaSemana> = {}
  for (const s of semanas) {
    const lunes = getMondayOf(s.fecha)
    if (!mapa[lunes]) mapa[lunes] = { lunes }
    mapa[lunes].semana = s
  }
  for (const f of semanasFDS) {
    const lunes = getMondayOf(f.fecha)
    if (!mapa[lunes]) mapa[lunes] = { lunes }
    mapa[lunes].semanaFDS = f
  }
  const grupos: Record<string, EntradaSemana[]> = {}
  for (const entrada of Object.values(mapa)) {
    const [year, month] = entrada.lunes.split('-')
    const key = `${year}-${month}`
    if (!grupos[key]) grupos[key] = []
    grupos[key].push(entrada)
  }
  for (const key of Object.keys(grupos)) {
    grupos[key].sort((a, b) => b.lunes.localeCompare(a.lunes))
  }
  return grupos
}

type DeleteTarget = { tipo: 'semana'; item: Semana } | { tipo: 'fds'; item: SemanaFDS }

export default function HistorialPage() {
  const [semanas, setSemanas] = useState<Semana[]>([])
  const [semanasFDS, setSemanasFDS] = useState<SemanaFDS[]>([])
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([])
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const { toast } = useToast()

  function load() {
    Promise.all([getSemanas(), getSemanasFDS(), getAllAsignaciones()]).then(
      ([s, fds, asigs]) => {
        setSemanas(s)
        setSemanasFDS(fds)
        setAsignaciones(asigs)
      }
    )
  }
  useEffect(() => { load() }, [])

  function handleDeleteSemana(e: React.MouseEvent, s: Semana) {
    e.preventDefault()
    setDeleteTarget({ tipo: 'semana', item: s })
  }

  function handleDeleteFDS(e: React.MouseEvent, f: SemanaFDS) {
    e.preventDefault()
    setDeleteTarget({ tipo: 'fds', item: f })
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const fecha = formatFechaCorta(deleteTarget.item.fecha)
    setDeleteTarget(null)
    if (deleteTarget.tipo === 'semana') {
      await deleteSemana(deleteTarget.item.id)
      toast({ title: 'Semana eliminada', description: fecha })
    } else {
      await deleteSemanaFDS(deleteTarget.item.id)
      toast({ title: 'Reunión eliminada', description: fecha })
    }
    load()
  }

  const grupos = agruparEntradas(semanas, semanasFDS)
  const meses = Object.keys(grupos).sort().reverse()
  const totalEntradas = semanas.length + semanasFDS.length

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Historial</h1>
        <Button asChild>
          <Link href="/programar">
            <Plus className="h-4 w-4" />
            Nueva reunión
          </Link>
        </Button>
      </div>

      {totalEntradas === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No hay reuniones programadas</p>
            <p className="text-sm">Creá la primera desde Programar</p>
          </CardContent>
        </Card>
      )}

      {meses.map(mes => {
        const entradasDelMes = grupos[mes]
        const [year, month] = mes.split('-')
        const mesLabel = new Date(+year, +month - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })

        return (
          <div key={mes} className="mb-8">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 capitalize">
              {mesLabel}
            </h2>

            <div className="space-y-4">
              {entradasDelMes.map(entrada => {
                const s = entrada.semana
                const f = entrada.semanaFDS
                const asigsCount = s ? asignaciones.filter(a => a.semanaId === s.id).length : 0
                return (
                  <Link key={entrada.lunes} href={`/programar?editar=${entrada.lunes}`}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between gap-2 mb-2.5">
                          <div className="flex items-center gap-2 min-w-0">
                            {/* Envío MANUAL de recordatorios (además del automático). */}
                            <span onClick={e => { e.preventDefault(); e.stopPropagation() }}>
                              <BotonRecordatorios fechaReferencia={entrada.lunes} />
                            </span>
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide leading-none">Semana del</p>
                              <p className="text-sm font-medium text-foreground mt-0.5 truncate">{getWeekRange(entrada.lunes)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <ToggleAutoRecordatorioSemana
                              semanaId={s?.id}
                              fdsId={f?.id}
                              inicial={[s, f].some(m => !!m && (m.recordatorioAuto ?? true))}
                            />
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {/* Entre semana */}
                          <div className="rounded-md border-l-[3px] border-l-blue-500 bg-muted/30 px-3 py-2 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Calendar className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wide">Entre semana</span>
                              </div>
                              {s && (
                                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-red-500 hover:text-red-400" onClick={e => handleDeleteSemana(e, s)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                            {s ? (
                              <div className="mt-1">
                                <p className="text-sm text-foreground">{formatFechaCorta(s.fecha)}</p>
                                {s.tema && <p className="text-xs text-muted-foreground truncate">{s.tema}</p>}
                                <p className="text-[10px] text-muted-foreground mt-0.5">{asigsCount} asignaciones</p>
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground/50 italic mt-1">Sin reunión cargada</p>
                            )}
                          </div>
                          {/* Fin de semana */}
                          <div className="rounded-md border-l-[3px] border-l-purple-500 bg-muted/30 px-3 py-2 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Sun className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wide">Fin de semana</span>
                              </div>
                              {f && (
                                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-red-500 hover:text-red-400" onClick={e => handleDeleteFDS(e, f)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                            {f ? (
                              <div className="mt-1">
                                <p className="text-sm text-foreground">{formatFechaCorta(f.fecha)}</p>
                                {f.tituloArticulo && <p className="text-xs text-muted-foreground truncate">{f.tituloArticulo}</p>}
                                {f.oradorNombre && <p className="text-[10px] text-muted-foreground truncate">Orador: {f.oradorNombre}</p>}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground/50 italic mt-1">Sin reunión cargada</p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                )
              })}
            </div>
          </div>
        )
      })}

      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar reunión</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Eliminar la reunión del{' '}
            <span className="font-medium text-foreground">
              {deleteTarget ? formatFechaCorta(deleteTarget.item.fecha) : ''}
            </span>?
            {' '}Se borrarán todas sus asignaciones.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDelete}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
