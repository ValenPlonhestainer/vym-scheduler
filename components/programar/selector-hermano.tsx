"use client"

import { useState } from 'react'
import { ChevronDown, AlertCircle, X } from 'lucide-react'
import { Hermano, ParteTipo, Asignacion } from '@/lib/types'
import { hermaosElegiblesParaParte, formatFechaCorta } from '@/lib/utils'
import { PARTES_INFO } from '@/lib/types'
import { PanelSelectorHermano } from './panel-selector-hermano'
import { cn } from '@/lib/utils'

interface Props {
  parte: ParteTipo
  hermanos: Hermano[]
  value: string
  onChange: (hermanoId: string) => void
  semanaId: string
  disabled?: boolean
  soloHombres?: boolean
  todasAsignaciones?: Array<Asignacion & { fecha: string }>
  // IDs de todos los hermanos ya asignados en ESTA reunión (partes + micrófonos +
  // acomodadores), como multiset: un mismo id puede aparecer varias veces.
  idsEstaReunion?: string[]
  // IDs asignados en la OTRA reunión de la misma semana (para avisar, sin bloquear).
  idsOtraReunion?: string[]
  etiquetaOtraReunion?: string
}

export function SelectorHermano({
  parte, hermanos, value, onChange, semanaId,
  disabled, soloHombres, todasAsignaciones = [],
  idsEstaReunion = [], idsOtraReunion = [], etiquetaOtraReunion,
}: Props) {
  const [open, setOpen] = useState(false)

  const elegibles = hermaosElegiblesParaParte(hermanos, parte)
    .filter(h => soloHombres ? h.genero === 'masculino' : true)

  function getUltima(hermanoId: string): string | null {
    const fechas = todasAsignaciones
      .filter(a => a.hermanoId === hermanoId && a.parte === parte && a.semanaId !== semanaId)
      .map(a => a.fecha)
      .filter(Boolean)
    return fechas.sort().reverse()[0] ?? null
  }

  // Ya asignado en OTRO lugar de esta reunión (otra parte, micrófono o acomodador).
  function isYaAsignado(hermanoId: string): boolean {
    if (hermanoId === value) return false
    return idsEstaReunion.includes(hermanoId)
  }

  function otraReunion(hermanoId: string): string | null {
    if (hermanoId === value || isYaAsignado(hermanoId)) return null
    return idsOtraReunion.includes(hermanoId) ? (etiquetaOtraReunion ?? null) : null
  }

  // El seleccionado está repetido si aparece 2+ veces (este lugar + otro).
  const selectedYaAsignado =
    !!value && idsEstaReunion.filter(id => id === value).length >= 2

  const selectedHermano = hermanos.find(h => h.id === value)

  const items = elegibles.map(hermano => ({
    hermano,
    ultima: getUltima(hermano.id),
    yaAsignado: isYaAsignado(hermano.id),
    yaAsignadoOtra: otraReunion(hermano.id),
  }))

  return (
    <>
      <div className="flex items-center gap-2 w-full">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className={cn(
            'flex-1 flex items-center justify-between gap-2 px-3 py-1.5 h-9 rounded-md border text-sm transition-colors text-left',
            disabled
              ? 'opacity-50 cursor-not-allowed bg-muted border-border'
              : 'bg-background border-input hover:bg-muted/50 cursor-pointer',
            selectedYaAsignado && 'border-orange-400'
          )}
        >
          <span className={cn(
            'truncate',
            selectedHermano ? 'text-foreground' : 'text-muted-foreground'
          )}>
            {selectedHermano ? selectedHermano.nombre : '— Sin asignar —'}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {value && !disabled && (
              <span
                role="button"
                onClick={e => { e.stopPropagation(); onChange('') }}
                className="text-muted-foreground hover:text-foreground p-0.5 rounded"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </button>
        {selectedYaAsignado && (
          <span title="Este hermano ya tiene otra asignación en esta semana">
            <AlertCircle className="h-4 w-4 text-orange-500 shrink-0" />
          </span>
        )}
      </div>

      <PanelSelectorHermano
        open={open}
        onClose={() => setOpen(false)}
        titulo={PARTES_INFO[parte]?.label ?? parte}
        items={items}
        selectedId={value}
        onSelect={onChange}
      />
    </>
  )
}
