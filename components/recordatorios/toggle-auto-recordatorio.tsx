"use client"

import { useState, useEffect } from 'react'
import { Switch } from '@/components/ui/switch'
import { setRecordatorioAuto, recordatoriosHabilitados } from '@/lib/actions'
import { useToast } from '@/hooks/use-toast'

interface Props {
  id: string
  tipo: 'semana' | 'fds'
  inicial: boolean
}

// Toggle (en cada tarjeta del historial) para prender/apagar el recordatorio
// AUTOMÁTICO por WhatsApp de esa reunión. Solo aparece en la congregación
// habilitada. No afecta al botón manual, que envía igual.
export function ToggleAutoRecordatorio({ id, tipo, inicial }: Props) {
  const { toast } = useToast()
  const [habilitado, setHabilitado] = useState(false)
  const [valor, setValor] = useState(inicial)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    recordatoriosHabilitados().then(setHabilitado).catch(() => setHabilitado(false))
  }, [])

  if (!habilitado) return null

  async function cambiar(nuevo: boolean) {
    setValor(nuevo)
    setGuardando(true)
    try {
      const r = await setRecordatorioAuto(id, tipo, nuevo)
      if (r.error) {
        setValor(!nuevo)
        toast({ title: 'No se pudo guardar', description: r.error, variant: 'destructive' })
      }
    } catch (e) {
      setValor(!nuevo)
      toast({ title: 'No se pudo guardar', description: String(e), variant: 'destructive' })
    } finally {
      setGuardando(false)
    }
  }

  // El onClick del contenedor evita que se abra el detalle (la tarjeta es un enlace).
  return (
    <span
      className="flex items-center gap-1.5"
      onClick={e => { e.preventDefault(); e.stopPropagation() }}
      title={valor
        ? 'Recordatorio automático por WhatsApp ACTIVADO para esta reunión'
        : 'Recordatorio automático por WhatsApp DESACTIVADO para esta reunión'}
    >
      <span className="hidden sm:inline text-[10px] text-muted-foreground">Aviso auto</span>
      <Switch checked={valor} onCheckedChange={cambiar} disabled={guardando} />
    </span>
  )
}
