"use client"

import { Hermano, ParteTipo, Asignacion } from '@/lib/types'
import { hermaosElegiblesParaParte, ROL_LABELS, formatFechaCorta } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertCircle } from 'lucide-react'

interface Props {
  parte: ParteTipo
  hermanos: Hermano[]
  value: string
  onChange: (hermanoId: string) => void
  semanaId: string
  disabled?: boolean
  soloHombres?: boolean
  todasAsignaciones?: Array<Asignacion & { fecha: string }>
  asigsSemana?: Partial<Record<ParteTipo, string>>
}

export function SelectorHermano({
  parte, hermanos, value, onChange, semanaId,
  disabled, soloHombres, todasAsignaciones = [], asigsSemana = {},
}: Props) {
  const elegibles = hermaosElegiblesParaParte(hermanos, parte)
    .filter(h => soloHombres ? h.genero === 'masculino' : true)

  function getUltima(hermanoId: string): string | null {
    const fechas = todasAsignaciones
      .filter(a => a.hermanoId === hermanoId && a.parte === parte && a.semanaId !== semanaId)
      .map(a => a.fecha)
      .filter(Boolean)
    return fechas.sort().reverse()[0] ?? null
  }

  function isYaAsignado(hermanoId: string): boolean {
    if (hermanoId === value) return false
    return Object.entries(asigsSemana).some(([p, hId]) => hId === hermanoId && p !== parte)
  }

  const selectedYaAsignado =
    !!value &&
    Object.entries(asigsSemana).some(([p, hId]) => hId === value && p !== parte)

  return (
    <div className="flex items-center gap-2 w-full">
      <Select value={value || ''} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="flex-1 text-sm">
          <SelectValue placeholder="— Sin asignar —" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">— Sin asignar —</SelectItem>
          {elegibles.map(hermano => {
            const ultima = getUltima(hermano.id)
            const yaAsignado = isYaAsignado(hermano.id)
            return (
              <SelectItem
                key={hermano.id}
                value={hermano.id}
                className={yaAsignado ? 'text-orange-600' : ''}
              >
                <span className="flex items-center gap-1.5">
                  {yaAsignado && <AlertCircle className="h-3 w-3 text-orange-500 inline shrink-0" />}
                  {hermano.nombre}
                  <span className="text-xs text-gray-400 ml-1">
                    ({ROL_LABELS[hermano.rol].split(' ')[0]})
                  </span>
                  {ultima && (
                    <span className="text-xs text-gray-400 ml-1">· última: {formatFechaCorta(ultima)}</span>
                  )}
                </span>
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
      {selectedYaAsignado && (
        <span title="Este hermano ya tiene otra asignación en esta semana">
          <AlertCircle className="h-4 w-4 text-orange-500 shrink-0" />
        </span>
      )}
    </div>
  )
}
