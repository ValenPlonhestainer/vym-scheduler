"use client"

import { useState, useEffect } from 'react'
import { Switch } from '@/components/ui/switch'
import { setRecordatorioAuto, recordatoriosHabilitados } from '@/lib/actions'
import { useToast } from '@/hooks/use-toast'

interface Props {
  semanaId?: string // reunión de entre semana (si existe)
  fdsId?: string     // reunión de fin de semana (si existe)
  inicial: boolean   // estado combinado inicial (encendido si alguna está encendida)
}

// Toggle por SEMANA: prende/apaga el recordatorio automático de las DOS reuniones
// de esa semana a la vez. Solo aparece en la congregación habilitada.
export function ToggleAutoRecordatorioSemana({ semanaId, fdsId, inicial }: Props) {
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
      const results = await Promise.all([
        semanaId ? setRecordatorioAuto(semanaId, 'semana', nuevo) : Promise.resolve({} as { error?: string }),
        fdsId ? setRecordatorioAuto(fdsId, 'fds', nuevo) : Promise.resolve({} as { error?: string }),
      ])
      const err = results.find(r => r.error)?.error
      if (err) {
        setValor(!nuevo)
        toast({ title: 'No se pudo guardar', description: err, variant: 'destructive' })
      }
    } catch (e) {
      setValor(!nuevo)
      toast({ title: 'No se pudo guardar', description: String(e), variant: 'destructive' })
    } finally {
      setGuardando(false)
    }
  }

  // El onClick del contenedor evita que se abra la edición (la tarjeta es un enlace).
  return (
    <span
      className="flex items-center gap-1.5"
      onClick={e => { e.preventDefault(); e.stopPropagation() }}
      title={valor
        ? 'Recordatorio automático por WhatsApp ACTIVADO para esta semana'
        : 'Recordatorio automático por WhatsApp DESACTIVADO para esta semana'}
    >
      <span className="hidden sm:inline text-[10px] text-muted-foreground">Aviso auto</span>
      <Switch checked={valor} onCheckedChange={cambiar} disabled={guardando} />
    </span>
  )
}
