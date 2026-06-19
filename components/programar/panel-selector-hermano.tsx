"use client"

import { useEffect, useRef, useState } from 'react'
import { X, Search, AlertCircle, UserX } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Hermano, Rol } from '@/lib/types'
import { ROL_LABELS, ROL_COLORS, formatFechaCorta, cn } from '@/lib/utils'

const ROL_ORDER: Rol[] = ['anciano', 'siervo', 'publicador', 'hermana']

interface HermanoItem {
  hermano: Hermano
  ultima: string | null
  yaAsignado: boolean
}

interface Props {
  open: boolean
  onClose: () => void
  titulo: string
  items: HermanoItem[]
  selectedId: string
  onSelect: (id: string) => void
}

export function PanelSelectorHermano({ open, onClose, titulo, items, selectedId, onSelect }: Props) {
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
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const norm = busqueda.trim().toLowerCase()
  const filtrados = norm
    ? items.filter(i => i.hermano.nombre.toLowerCase().includes(norm))
    : items

  const porRol: Record<Rol, HermanoItem[]> = { anciano: [], siervo: [], publicador: [], hermana: [] }
  for (const item of filtrados) porRol[item.hermano.rol].push(item)

  function handleSelect(id: string) {
    onSelect(id)
    onClose()
  }

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          'fixed inset-0 bg-black/50 z-40 transition-opacity duration-200',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          'fixed top-0 right-0 h-full w-full sm:w-96 bg-background border-l border-border z-50 flex flex-col transition-transform duration-300',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div>
            <p className="text-xs text-muted-foreground">Asignar hermano</p>
            <h2 className="font-semibold text-foreground text-sm leading-tight">{titulo}</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Buscador */}
        <div className="px-4 py-3 border-b border-border shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              ref={inputRef}
              placeholder="Buscar hermano..."
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

        {/* Lista */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {/* Sin asignar */}
          <button
            onClick={() => handleSelect('')}
            className={cn(
              'w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-colors',
              !selectedId
                ? 'border-primary bg-primary/10 text-primary font-medium'
                : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
            )}
          >
            — Sin asignar —
          </button>

          {filtrados.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <UserX className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Sin resultados para "{busqueda}"</p>
            </div>
          )}

          {ROL_ORDER.map(rol => {
            const lista = porRol[rol]
            if (lista.length === 0) return null
            return (
              <div key={rol}>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  {ROL_LABELS[rol]}
                </p>
                <div className="space-y-1.5">
                  {lista.map(({ hermano, ultima, yaAsignado }) => {
                    const selected = hermano.id === selectedId
                    return (
                      <button
                        key={hermano.id}
                        onClick={() => handleSelect(hermano.id)}
                        className={cn(
                          'w-full text-left px-3 py-2.5 rounded-lg border transition-colors',
                          selected
                            ? 'border-primary bg-primary/10'
                            : yaAsignado
                            ? 'border-orange-400/50 bg-orange-50 dark:bg-orange-950/20 hover:bg-orange-100/50 dark:hover:bg-orange-900/30'
                            : 'border-border bg-card hover:bg-muted/50'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {yaAsignado && !selected && (
                            <AlertCircle className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                          )}
                          <span className={cn(
                            'font-medium text-sm flex-1 min-w-0 truncate',
                            selected ? 'text-primary' : 'text-foreground'
                          )}>
                            {hermano.nombre}
                          </span>
                          <Badge
                            className={cn('text-xs shrink-0', ROL_COLORS[hermano.rol])}
                            variant="outline"
                          >
                            {ROL_LABELS[hermano.rol].split(' ')[0]}
                          </Badge>
                        </div>
                        {ultima && (
                          <p className="text-xs text-muted-foreground mt-0.5 pl-0.5">
                            Última: {formatFechaCorta(ultima)}
                          </p>
                        )}
                        {yaAsignado && !selected && (
                          <p className="text-xs text-orange-500 mt-0.5 pl-0.5">
                            Ya asignado esta semana
                          </p>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
