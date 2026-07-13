"use client"

import { useState } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { Hermano } from '@/lib/types'
import { PanelSelectorHermano } from './panel-selector-hermano'
import { cn, getPrivilegiosDefecto } from '@/lib/utils'

interface Props {
  label: string
  hermanos: Hermano[]
  value: string
  onChange: (hermanoId: string) => void
}

export function SelectorMicrofono({ label, hermanos, value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const selectedHermano = hermanos.find(h => h.id === value)

  const items = hermanos
    // Ancianos y siervos (masculinos): siempre elegibles.
    // Publicadores y hermanas: solo con el privilegio "Microfonista" activo.
    .filter(h => {
      if (!h.activo) return false
      if (h.genero === 'masculino' && (h.rol === 'anciano' || h.rol === 'siervo')) return true
      const privs = h.privilegios ?? getPrivilegiosDefecto(h.rol)
      return privs.microfonos === true
    })
    .map(h => ({ hermano: h, ultima: null, yaAsignado: false }))

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'w-full flex items-center justify-between gap-2 px-3 py-1.5 h-9 rounded-md border text-sm transition-colors text-left',
          'bg-background border-input hover:bg-muted/50 cursor-pointer'
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
