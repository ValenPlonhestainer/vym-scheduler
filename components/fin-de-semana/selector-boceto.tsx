"use client"

import { useState } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { PanelSelectorBoceto } from './panel-selector-boceto'
import { bocetoPDFLabel } from '@/data/bocetos'
import { cn } from '@/lib/utils'

interface Props {
  value?: number
  onChange: (numero: number | undefined) => void
}

export function SelectorBoceto({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)

  const label = value ? bocetoPDFLabel(value) : null

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
        <span className={cn('truncate', label ? 'text-foreground' : 'text-muted-foreground')}>
          {label ?? '— Sin bosquejo —'}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {value && (
            <span
              role="button"
              onClick={e => { e.stopPropagation(); onChange(undefined) }}
              className="text-muted-foreground hover:text-foreground p-0.5 rounded"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </button>

      <PanelSelectorBoceto
        open={open}
        onClose={() => setOpen(false)}
        selectedNumero={value}
        onSelect={onChange}
      />
    </>
  )
}
