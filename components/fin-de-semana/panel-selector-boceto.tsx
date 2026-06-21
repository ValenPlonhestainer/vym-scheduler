"use client"

import { useEffect, useRef, useState } from 'react'
import { X, Search, BookOpen } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { BOCETOS } from '@/data/bocetos'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  selectedNumero?: number
  onSelect: (numero: number | undefined) => void
}

export function PanelSelectorBoceto({ open, onClose, selectedNumero, onSelect }: Props) {
  const [busqueda, setBusqueda] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setBusqueda('')
      setTimeout(() => inputRef.current?.focus(), 50)
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const norm = busqueda.trim().toLowerCase()
  const filtrados = norm
    ? BOCETOS.filter(b =>
        b.titulo.toLowerCase().includes(norm) ||
        b.numero.toString().includes(norm)
      )
    : BOCETOS

  function handleSelect(numero: number | undefined) {
    onSelect(numero)
    onClose()
  }

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 bg-black/50 z-40 transition-opacity duration-200',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      <div
        className={cn(
          'fixed top-0 right-0 h-full w-full sm:w-96 bg-background border-l border-border z-50 flex flex-col transition-transform duration-300',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div>
            <p className="text-xs text-muted-foreground">Seleccionar bosquejo (S-34)</p>
            <h2 className="font-semibold text-foreground text-sm leading-tight">Disertación pública</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-border shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              ref={inputRef}
              placeholder="Buscar por número o título..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="pl-9 pr-8 h-9"
            />
            {busqueda && (
              <button
                onClick={() => setBusqueda('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
          <button
            onClick={() => handleSelect(undefined)}
            className={cn(
              'w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-colors mb-3',
              !selectedNumero
                ? 'border-primary bg-primary/10 text-primary font-medium'
                : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
            )}
          >
            — Sin bosquejo —
          </button>

          {filtrados.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Sin resultados para &ldquo;{busqueda}&rdquo;</p>
            </div>
          )}

          {filtrados.map(b => {
            const selected = b.numero === selectedNumero
            return (
              <button
                key={b.numero}
                onClick={() => handleSelect(b.numero)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-lg border transition-colors',
                  selected
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-card hover:bg-muted/50'
                )}
              >
                <div className="flex items-start gap-2">
                  <span className={cn(
                    'text-xs font-bold shrink-0 mt-0.5 w-7 text-right',
                    selected ? 'text-primary' : 'text-muted-foreground'
                  )}>
                    {b.numero}.
                  </span>
                  <span className={cn(
                    'text-sm leading-snug',
                    selected ? 'text-primary font-medium' : 'text-foreground'
                  )}>
                    {b.titulo}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
