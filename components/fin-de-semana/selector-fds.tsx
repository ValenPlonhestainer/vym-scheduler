"use client"

import { useState } from 'react'
import { ChevronDown, AlertCircle, X } from 'lucide-react'
import { Hermano, ParteTipoFDS, AsignacionFDS } from '@/lib/types'
import { hermanosElegiblesParaParteFDS, formatFechaCorta, cn } from '@/lib/utils'
import { PanelSelectorHermano } from '@/components/programar/panel-selector-hermano'

const PARTE_LABELS: Record<ParteTipoFDS, string> = {
  fds_presidente:       'Presidente',
  fds_oracion_apertura: 'Oración de apertura',
  fds_oracion_cierre:   'Oración de cierre',
  fds_lector:           'Lector de La Atalaya',
}

interface Props {
  parte: ParteTipoFDS
  hermanos: Hermano[]
  value: string
  onChange: (hermanoId: string) => void
  semanaFDSId: string
  disabled?: boolean
  todasAsignaciones?: Array<AsignacionFDS & { fecha: string }>
  idsEstaReunion?: string[]
  idsOtraReunion?: string[]
  etiquetaOtraReunion?: string
}

export function SelectorFDS({
  parte, hermanos, value, onChange, semanaFDSId,
  disabled, todasAsignaciones = [],
  idsEstaReunion = [], idsOtraReunion = [], etiquetaOtraReunion,
}: Props) {
  const [open, setOpen] = useState(false)

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
    return idsEstaReunion.includes(hermanoId)
  }

  function otraReunion(hermanoId: string): string | null {
    if (hermanoId === value || isYaAsignado(hermanoId)) return null
    return idsOtraReunion.includes(hermanoId) ? (etiquetaOtraReunion ?? null) : null
  }

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
          <span title="Este hermano ya tiene otra asignación en esta reunión">
            <AlertCircle className="h-4 w-4 text-orange-500 shrink-0" />
          </span>
        )}
      </div>

      <PanelSelectorHermano
        open={open}
        onClose={() => setOpen(false)}
        titulo={PARTE_LABELS[parte] ?? parte}
        items={items}
        selectedId={value}
        onSelect={onChange}
      />
    </>
  )
}
