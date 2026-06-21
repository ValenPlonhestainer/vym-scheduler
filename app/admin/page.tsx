"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, Plus, Power, Copy, Check, Loader2, Pencil, Trash2, X, Sun, Moon, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { useTheme } from '@/components/theme-provider'

type TokenRow = {
  id: string
  token: string
  congregation_name: string
  active: boolean
  created_at: string
  congregacion_id: string | null
}

function generateToken(name: string): string {
  const slug = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 20)
  const rand = Math.random().toString(36).slice(2, 9)
  return `cong_${slug}_${rand}`
}

export default function AdminPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { theme, toggle } = useTheme()
  const [tokens, setTokens] = useState<TokenRow[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newToken, setNewToken] = useState('')
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<TokenRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function load() {
    const res = await fetch('/api/admin/tokens')
    if (res.status === 401) { router.push('/admin/login'); return }
    const data = await res.json()
    setTokens(data.tokens ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function handleNameChange(name: string) {
    setNewName(name)
    setNewToken(generateToken(name))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim() || !newToken.trim()) return
    setCreating(true)
    const res = await fetch('/api/admin/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ congregation_name: newName.trim(), token: newToken.trim() }),
    })
    if (res.ok) {
      setNewName('')
      setNewToken('')
      await load()
      toast({ title: 'Congregación creada' })
    } else {
      const d = await res.json()
      toast({ title: 'Error', description: d.error, variant: 'destructive' })
    }
    setCreating(false)
  }

  async function handleToggle(id: string, active: boolean) {
    await fetch(`/api/admin/tokens/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !active }),
    })
    await load()
    toast({ title: active ? 'Token desactivado' : 'Token activado' })
  }

  async function handleCopy(token: string) {
    await navigator.clipboard.writeText(token)
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  function startEdit(t: TokenRow) {
    setEditingId(t.id)
    setEditingName(t.congregation_name)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditingName('')
  }

  async function handleSaveEdit(id: string) {
    if (!editingName.trim()) return
    setSavingEdit(true)
    const res = await fetch(`/api/admin/tokens/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ congregation_name: editingName.trim() }),
    })
    if (res.ok) {
      await load()
      setEditingId(null)
      toast({ title: 'Nombre actualizado' })
    } else {
      const d = await res.json()
      toast({ title: 'Error', description: d.error, variant: 'destructive' })
    }
    setSavingEdit(false)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const res = await fetch(`/api/admin/tokens/${deleteTarget.id}`, { method: 'DELETE' })
    if (res.ok) {
      setDeleteTarget(null)
      await load()
      toast({ title: 'Congregación eliminada' })
    } else {
      const d = await res.json()
      toast({ title: 'Error', description: d.error, variant: 'destructive' })
    }
    setDeleting(false)
  }

  async function handleLogout() {
    window.location.href = '/api/auth/logout'
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Shield className="h-6 w-6 text-amber-500 shrink-0" />
        <h1 className="text-xl font-bold flex-1 min-w-0">Panel de administración</h1>
        <Button variant="outline" size="icon" onClick={toggle} title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}>
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button variant="outline" size="sm" onClick={handleLogout}>Salir</Button>
      </div>

      {/* Crear nueva congregación */}
      <Card className="mb-8 border-amber-800/40 bg-amber-950/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-amber-400">Nueva congregación</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nombre de la congregación</Label>
                <Input
                  placeholder="Ej: Congregación Norte"
                  value={newName}
                  onChange={e => handleNameChange(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Token generado</Label>
                <Input
                  placeholder="cong_xxx_xxxxx"
                  value={newToken}
                  onChange={e => setNewToken(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
            </div>
            <Button type="submit" disabled={creating || !newName.trim() || !newToken.trim()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Crear congregación
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Lista de congregaciones */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Congregaciones ({tokens.length})
        </h2>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : tokens.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">No hay congregaciones registradas</p>
        ) : (
          tokens.map(t => (
            <Card key={t.id}>
              <CardContent className="py-3 px-4">
                {editingId === t.id ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(t.id); if (e.key === 'Escape') cancelEdit() }}
                      className="flex-1 h-8 text-sm"
                      autoFocus
                    />
                    <Button size="sm" onClick={() => handleSaveEdit(t.id)} disabled={savingEdit || !editingName.trim()}>
                      {savingEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Guardar'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelEdit}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{t.congregation_name}</span>
                        <Badge variant="outline" className={t.active ? 'text-green-400 border-green-700' : 'text-muted-foreground'}>
                          {t.active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <code className="text-xs text-muted-foreground font-mono">{t.token}</code>
                        <button onClick={() => handleCopy(t.token)} className="text-muted-foreground hover:text-foreground transition-colors">
                          {copied === t.token
                            ? <Check className="h-3 w-3 text-green-500" />
                            : <Copy className="h-3 w-3" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {t.congregacion_id && (
                        <Button variant="ghost" size="sm" onClick={() => router.push(`/admin/congregacion/${t.congregacion_id}`)} className="text-sky-500 hover:text-sky-400 px-2" title="Ver datos">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => startEdit(t)} className="text-muted-foreground hover:text-foreground px-2">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggle(t.id, t.active)}
                        className={t.active ? 'text-red-500 hover:text-red-400 px-2' : 'text-green-500 hover:text-green-400 px-2'}
                      >
                        <Power className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline ml-1">{t.active ? 'Desactivar' : 'Activar'}</span>
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(t)} className="text-red-600 hover:text-red-500 px-2">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Confirmar borrado */}
      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Eliminar congregación?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Se eliminará permanentemente <span className="font-semibold text-foreground">{deleteTarget?.congregation_name}</span> junto con todos sus hermanos, semanas y asignaciones. Esta acción no se puede deshacer.
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
