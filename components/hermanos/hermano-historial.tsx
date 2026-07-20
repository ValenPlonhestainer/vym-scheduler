"use client"

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Hermano, ParteTipo, Semana, PARTES_INFO } from '@/lib/types'
import { getAsignacionesHermano } from '@/lib/actions'
import { formatFechaCorta } from '@/lib/utils'
import { CalendarDays } from 'lucide-react'

interface Props {
  hermano: Hermano
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function HermanoHistorial({ hermano, open, onOpenChange }: Props) {
  const [historial, setHistorial] = useState<Array<{ semana: Semana; parte: ParteTipo }>>([])

  useEffect(() => {
    if (open) {
      getAsignacionesHermano(hermano.id).then(data =>
        setHistorial(data.sort((a, b) => b.semana.fecha.localeCompare(a.semana.fecha)))
      )
    }
  }, [open, hermano.id])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Historial — {hermano.nombre}</DialogTitle>
        </DialogHeader>
        {historial.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <CalendarDays className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Sin asignaciones registradas</p>
          </div>
        ) : (
          <div className="max-h-[65vh] overflow-y-auto pr-1">
            {historial.map(({ semana, parte }, i) => (
              <div key={i} className="flex items-start gap-4 py-3 border-b border-border last:border-0">
                <div className="text-sm text-muted-foreground whitespace-nowrap pt-0.5 min-w-[92px]">
                  {formatFechaCorta(semana.fecha)}
                </div>
                <div className="min-w-0">
                  <p className="text-base font-semibold text-foreground">{PARTES_INFO[parte].label}</p>
                  {semana.tema && <p className="text-sm text-muted-foreground truncate">{semana.tema}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
