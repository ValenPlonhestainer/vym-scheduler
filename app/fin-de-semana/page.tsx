"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Calendar, Plus, Trash2, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getSemanasFDS, deleteSemanaFDS, getAllAsignacionesFDS } from '@/lib/actions'
import { SemanaFDS, AsignacionFDS } from '@/lib/types'
import { formatFechaCorta, agruparSemanasPorMes } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

export default function FinDeSemanaPage() {
  const [semanas, setSemanas] = useState<SemanaFDS[]>([])
  const [asignaciones, setAsignaciones] = useState<AsignacionFDS[]>([])
  const { toast } = useToast()

  function load() {
    Promise.all([getSemanasFDS(), getAllAsignacionesFDS()]).then(([s, a]) => {
      setSemanas(s)
      setAsignaciones(a)
    })
  }
  useEffect(() => { load() }, [])

  async function handleDelete(s: SemanaFDS) {
    if (!confirm(`¿Eliminar la reunión del ${formatFechaCorta(s.fecha)}?`)) return
    await deleteSemanaFDS(s.id)
    load()
    toast({ title: 'Reunión eliminada' })
  }

  const grupos = agruparSemanasPorMes(semanas)
  const meses = Object.keys(grupos).sort().reverse()

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Fin de semana</h1>
        <Button asChild>
          <Link href="/fin-de-semana/nuevo">
            <Plus className="h-4 w-4" />
            Nueva reunión
          </Link>
        </Button>
      </div>

      {semanas.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No hay reuniones de fin de semana</p>
            <p className="text-sm">Creá la primera con el botón de arriba</p>
          </CardContent>
        </Card>
      )}

      {meses.map(mes => {
        const semanasDelMes = grupos[mes]
        const [year, month] = mes.split('-')
        const fecha = new Date(+year, +month - 1, 1)
        const mesLabel = fecha.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })

        return (
          <div key={mes} className="mb-6">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 capitalize">
              {mesLabel}
            </h2>
            <div className="space-y-2">
              {semanasDelMes.map(s => {
                const asigs = asignaciones.filter(a => a.semanaFDSId === s.id)
                const completitud = Math.round((asigs.filter(a => a.hermanoId).length / 4) * 100)
                return (
                  <Link key={s.id} href={`/fin-de-semana/${s.id}`}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="py-3 px-4 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="font-medium text-foreground">{formatFechaCorta(s.fecha)}</span>
                            {s.oradorNombre && (
                              <span className="text-sm text-muted-foreground truncate">
                                Orador: {s.oradorNombre}
                              </span>
                            )}
                          </div>
                          {s.tituloArticulo && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{s.tituloArticulo}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <div className="h-1.5 w-24 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-500 rounded-full"
                                style={{ width: `${Math.min(completitud, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">{asigs.length}/4 asignaciones</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-400"
                            onClick={e => { e.preventDefault(); handleDelete(s) }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
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
    </div>
  )
}
