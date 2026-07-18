"use client"

import { useEffect, useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { getConfigRecordatorios } from '@/lib/actions'
import { ConfigRecordatoriosForm } from './config-recordatorios-form'

// Aparece UNA VEZ (al entrar) si la congregación tiene los recordatorios
// habilitados pero todavía no configuró los días de reunión. Si se cierra sin
// guardar, vuelve a aparecer la próxima vez hasta que se configure.
export function ConfigRecordatoriosGate() {
  const [open, setOpen] = useState(false)
  const [inicial, setInicial] = useState<{ diaEntreSemana: number | null; diaFinDeSemana: number | null; contacto: string } | null>(null)

  useEffect(() => {
    getConfigRecordatorios()
      .then(c => {
        if (c.habilitado && !c.configurado) {
          setInicial({ diaEntreSemana: c.diaEntreSemana, diaFinDeSemana: c.diaFinDeSemana, contacto: c.contacto })
          setOpen(true)
        }
      })
      .catch(() => {})
  }, [])

  if (!open || !inicial) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configurá los recordatorios por WhatsApp</DialogTitle>
          <DialogDescription>
            Decinos qué días se reúne tu congregación y a quién avisar. Con esto, los
            recordatorios muestran el día correcto y se envían el día anterior a cada reunión.
            Lo podés cambiar cuando quieras desde Configuración.
          </DialogDescription>
        </DialogHeader>
        <ConfigRecordatoriosForm
          diaEntreSemana={inicial.diaEntreSemana}
          diaFinDeSemana={inicial.diaFinDeSemana}
          contacto={inicial.contacto}
          onSaved={() => setOpen(false)}
          botonLabel="Guardar y empezar"
        />
      </DialogContent>
    </Dialog>
  )
}
