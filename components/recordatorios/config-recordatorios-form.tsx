"use client"

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { saveConfigRecordatorios } from '@/lib/actions'
import { useToast } from '@/hooks/use-toast'

// Días en formato ISO (1=lunes … 7=domingo).
const DIAS_ENTRE_SEMANA = [
  { v: '1', l: 'Lunes' }, { v: '2', l: 'Martes' }, { v: '3', l: 'Miércoles' },
  { v: '4', l: 'Jueves' }, { v: '5', l: 'Viernes' },
]
const DIAS_FIN_DE_SEMANA = [
  { v: '6', l: 'Sábado' }, { v: '7', l: 'Domingo' },
]

interface Props {
  diaEntreSemana: number | null
  diaFinDeSemana: number | null
  contacto: string
  onSaved: () => void
  botonLabel?: string
}

export function ConfigRecordatoriosForm({ diaEntreSemana, diaFinDeSemana, contacto, onSaved, botonLabel = 'Guardar' }: Props) {
  const { toast } = useToast()
  const [diaES, setDiaES] = useState(String(diaEntreSemana ?? 2)) // martes por defecto
  const [diaFDS, setDiaFDS] = useState(String(diaFinDeSemana ?? 6)) // sábado por defecto
  const [nombreContacto, setNombreContacto] = useState(contacto)
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    setGuardando(true)
    try {
      const r = await saveConfigRecordatorios(Number(diaES), Number(diaFDS), nombreContacto)
      if (r.error) {
        toast({ title: 'No se pudo guardar', description: r.error, variant: 'destructive' })
        return
      }
      toast({ title: 'Configuración guardada' })
      onSaved()
    } catch (e) {
      toast({ title: 'No se pudo guardar', description: String(e), variant: 'destructive' })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Día de la reunión de entre semana</Label>
          <Select value={diaES} onValueChange={setDiaES}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {DIAS_ENTRE_SEMANA.map(d => <SelectItem key={d.v} value={d.v}>{d.l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Día de la reunión de fin de semana</Label>
          <Select value={diaFDS} onValueChange={setDiaFDS}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {DIAS_FIN_DE_SEMANA.map(d => <SelectItem key={d.v} value={d.v}>{d.l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contacto">Contacto para los recordatorios</Label>
        <Input
          id="contacto"
          value={nombreContacto}
          onChange={e => setNombreContacto(e.target.value)}
          placeholder="Ej: Alvaro Ricci"
        />
        <p className="text-xs text-muted-foreground">
          Aparece al final del mensaje: “Por cualquier duda o inconveniente comunicate con …”.
        </p>
      </div>

      <div className="flex justify-end">
        <Button onClick={guardar} disabled={guardando}>
          {guardando && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
          {botonLabel}
        </Button>
      </div>
    </div>
  )
}
