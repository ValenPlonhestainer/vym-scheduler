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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Historial — {hermano.nombre}</DialogTitle>
        </DialogHeader>
        {historial.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <CalendarDays className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Sin asignaciones registradas</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {historial.map(({ semana, parte }, i) => (
              <div key={i} className="flex items-start gap-3 py-2 border-b last:border-0">
                <div className="text-xs text-gray-400 whitespace-nowrap pt-0.5 min-w-[80px]">
                  {formatFechaCorta(semana.fecha)}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{PARTES_INFO[parte].label}</p>
                  {semana.tema && <p className="text-xs text-gray-400 truncate">{semana.tema}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
