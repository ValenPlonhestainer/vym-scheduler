"use client"

import { useState } from 'react'
import { ChevronDown, X, AlertCircle } from 'lucide-react'
import { Hermano } from '@/lib/types'
import { PanelSelectorHermano } from './panel-selector-hermano'
import { cn, getPrivilegiosDefecto } from '@/lib/utils'

interface Props {
  label: string
  hermanos: Hermano[]
  value: string
  onChange: (hermanoId: string) => void
  // IDs ya asignados en ESTA reunión (partes + micrófonos + acomodadores), multiset.
  idsEstaReunion?: string[]
  // IDs asignados en la OTRA reunión de la misma semana (aviso, sin bloquear).
  idsOtraReunion?: string[]
  etiquetaOtraReunion?: string
}

export function SelectorMicrofono({
  label, hermanos, value, onChange,
  idsEstaReunion = [], idsOtraReunion = [], etiquetaOtraReunion,
}: Props) {
  const [open, setOpen] = useState(false)
  const selectedHermano = hermanos.find(h => h.id === value)

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

  const items = hermanos
    // Ancianos y siervos (masculinos): siempre elegibles.
    // Publicadores y hermanas: solo con el privilegio "Microfonista" activo.
    .filter(h => {
      if (!h.activo) return false
      if (h.genero === 'masculino' && (h.rol === 'anciano' || h.rol === 'siervo')) return true
      const privs = h.privilegios ?? getPrivilegiosDefecto(h.rol)
      return privs.microfonos === true
    })
    .map(h => ({
      hermano: h,
      ultima: null,
      yaAsignado: isYaAsignado(h.id),
      yaAsignadoOtra: otraReunion(h.id),
    }))

  return (
    <>
      <div className="flex items-center gap-2 w-full">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            'flex-1 flex items-center justify-between gap-2 px-3 py-1.5 h-9 rounded-md border text-sm transition-colors text-left',
            'bg-background border-input hover:bg-muted/50 cursor-pointer',
            selectedYaAsignado && 'border-orange-400'
          )}
        >
          <span className={cn('truncate', selectedHermano ? 'text-foreground' : 'text-muted-foreground')}>
            {selectedHermano ? selectedHermano.nombre : '— Sin asignar —'}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {value && (
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
        titulo={label}
        items={items}
        selectedId={value}
        onSelect={onChange}
      />
    </>
  )
}
