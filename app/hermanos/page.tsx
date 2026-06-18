"use client"

import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, User, ChevronDown, ChevronUp, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { HermanoDialog } from '@/components/hermanos/hermano-dialog'
import { HermanoHistorial } from '@/components/hermanos/hermano-historial'
import { getHermanos, deleteHermano } from '@/lib/actions'
import { Hermano, Rol } from '@/lib/types'
import { ROL_LABELS, ROL_COLORS, cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

const ROL_ORDER: Rol[] = ['anciano', 'siervo', 'publicador', 'hermana']

export default function HermanosPage() {
  const [hermanos, setHermanos] = useState<Hermano[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingHermano, setEditingHermano] = useState<Hermano | null>(null)
  const [historialHermano, setHistorialHermano] = useState<Hermano | null>(null)
  const [mostrarInactivos, setMostrarInactivos] = useState(false)
  const { toast } = useToast()

  function load() {
    getHermanos().then(setHermanos)
  }

  useEffect(() => {
    load()
  }, [])

  function handleEdit(h: Hermano) {
    setEditingHermano(h)
    setDialogOpen(true)
  }

  function handleNew() {
    setEditingHermano(null)
    setDialogOpen(true)
  }

  async function handleDelete(h: Hermano) {
    if (!confirm(`¿Eliminar a ${h.nombre}? Se borrarán todas sus asignaciones.`)) return
    await deleteHermano(h.id)
    load()
    toast({ title: 'Hermano eliminado', description: h.nombre })
  }

  function handleSaved() {
    load()
    setDialogOpen(false)
  }

  const activos = hermanos.filter(h => h.activo)
  const inactivos = hermanos.filter(h => !h.activo)

  function groupByRol(list: Hermano[]): Record<Rol, Hermano[]> {
    const g: Record<Rol, Hermano[]> = { anciano: [], siervo: [], publicador: [], hermana: [] }
    for (const h of list) g[h.rol].push(h)
    return g
  }

  const activosByRol = groupByRol(activos)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Hermanos</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{activos.length} activos · {inactivos.length} inactivos</p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="h-4 w-4" />
          Agregar
        </Button>
      </div>

      {hermanos.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <User className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No hay hermanos cargados</p>
            <p className="text-sm">Agregá el primero con el botón de arriba</p>
          </CardContent>
        </Card>
      )}

      {ROL_ORDER.map(rol => {
        const lista = activosByRol[rol]
        if (lista.length === 0) return null
        return (
          <div key={rol} className="mb-6">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">{ROL_LABELS[rol]}</h2>
            <div className="space-y-2">
              {lista.map(h => (
                <HermanoRow
                  key={h.id}
                  hermano={h}
                  onEdit={() => handleEdit(h)}
                  onDelete={() => handleDelete(h)}
                  onHistorial={() => setHistorialHermano(h)}
                />
              ))}
            </div>
          </div>
        )
      })}

      {inactivos.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setMostrarInactivos(v => !v)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            {mostrarInactivos ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {inactivos.length} hermanos inactivos
          </button>
          {mostrarInactivos && (
            <div className="space-y-2 opacity-60">
              {inactivos.map(h => (
                <HermanoRow
                  key={h.id}
                  hermano={h}
                  onEdit={() => handleEdit(h)}
                  onDelete={() => handleDelete(h)}
                  onHistorial={() => setHistorialHermano(h)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <HermanoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        hermano={editingHermano}
        onSaved={handleSaved}
      />

      {historialHermano && (
        <HermanoHistorial
          hermano={historialHermano}
          open={!!historialHermano}
          onOpenChange={open => !open && setHistorialHermano(null)}
        />
      )}
    </div>
  )
}

function HermanoRow({
  hermano,
  onEdit,
  onDelete,
  onHistorial,
}: {
  hermano: Hermano
  onEdit: () => void
  onDelete: () => void
  onHistorial: () => void
}) {
  return (
    <Card>
      <CardContent className="py-3 px-4 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-foreground">{hermano.nombre}</span>
            <Badge className={cn('text-xs', ROL_COLORS[hermano.rol])} variant="outline">
              {ROL_LABELS[hermano.rol]}
            </Badge>
            {!hermano.activo && (
              <Badge variant="outline" className="text-xs text-muted-foreground">Inactivo</Badge>
            )}
          </div>
          {hermano.notas && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{hermano.notas}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="sm" onClick={onHistorial} className="text-muted-foreground text-xs h-8 px-2 hidden sm:flex">
            Historial
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 sm:hidden text-muted-foreground" onClick={onHistorial} title="Historial">
            <History className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-400" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
