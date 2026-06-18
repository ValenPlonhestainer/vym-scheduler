"use client"

import { Hermano, ParteTipoFDS, AsignacionFDS } from '@/lib/types'
import { ROL_LABELS, formatFechaCorta, hermanosElegiblesParaParteFDS } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertCircle } from 'lucide-react'

interface Props {
  parte: ParteTipoFDS
  hermanos: Hermano[]
  value: string
  onChange: (hermanoId: string) => void
  semanaFDSId: string
  disabled?: boolean
  todasAsignaciones?: Array<AsignacionFDS & { fecha: string }>
  asigsSemana?: Partial<Record<ParteTipoFDS, string>>
}

export function SelectorFDS({
  parte, hermanos, value, onChange, semanaFDSId,
  disabled, todasAsignaciones = [], asigsSemana = {},
}: Props) {
  const elegibles = hermanosElegiblesParaParteFDS(hermanos, parte)

  function getUltima(hermanoId: string): string | null {
    const fechas = todasAsignaciones
      .filter(a => a.hermanoId === hermanoId && a.parte === parte && a.semanaFDSId !== semanaFDSId)
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
        <span title="Este hermano ya tiene otra asignación en esta reunión">
          <AlertCircle className="h-4 w-4 text-orange-500 shrink-0" />
        </span>
      )}
    </div>
  )
}
