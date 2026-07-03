"use client"

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Users, Calendar, Loader2, ChevronDown, ChevronUp, Trash2, KeyRound, Plus, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'

const ROL_LABELS: Record<string, string> = {
  anciano: 'Anciano',
  siervo: 'Siervo ministerial',
  publicador: 'Publicador',
  hermana: 'Hermana',
}

const ROL_COLORS: Record<string, string> = {
  anciano: 'border-blue-700 text-blue-400',
  siervo: 'border-emerald-700 text-emerald-400',
  publicador: 'border-violet-700 text-violet-400',
  hermana: 'border-pink-700 text-pink-400',
}

interface DatosCong {
  congregacion: { id: string; nombre: string }
  hermanos: Array<{ id: string; nombre: string; rol: string; genero: string; activo: boolean }>
  semanas: Array<{ id: string; fecha: string; tema: string }>
  semanasFDS: Array<{ id: string; fecha: string; titulo_articulo: string }>
  miembros: Array<{ user_id: string; nombre: string; rol: string; created_at: string }>
}

type Miembro = DatosCong['miembros'][number]

function formatFecha(fecha: string) {
  if (!fecha) return ''
  const [y, m, d] = fecha.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function CongregacionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const id = params.id as string
  const [datos, setDatos] = useState<DatosCong | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [hermanosAbierto, setHermanosAbierto] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Miembro | null>(null)
  const [deleting, setDeleting] = useState(false)

  type CodigoRow = { id: string; codigo: string; usado: boolean; created_at: string }
  const [codigos, setCodigos] = useState<CodigoRow[]>([])
  const [loadingCodigos, setLoadingCodigos] = useState(true)
  const [generando, setGenerando] = useState(false)
  const [copiado, setCopiado] = useState<string | null>(null)

  async function cargarCodigos() {
    setLoadingCodigos(true)
    const res = await fetch(`/api/admin/congregacion/${id}/invitaciones`)
    const data = await res.json().catch(() => ({}))
    if (res.ok) setCodigos(data.invitaciones ?? [])
    setLoadingCodigos(false)
  }

  async function generarCodigo() {
    setGenerando(true)
    const res = await fetch(`/api/admin/congregacion/${id}/invitaciones`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data.invitacion) {
      setCodigos(c => [data.invitacion, ...c])
      toast({ title: 'Código generado', description: 'Compartilo con el colaborador para que se registre.' })
    } else {
      toast({ title: 'Error', description: data.error, variant: 'destructive' })
    }
    setGenerando(false)
  }

  async function eliminarCodigo(codigoId: string) {
    const res = await fetch(`/api/admin/congregacion/${id}/invitaciones?codigoId=${codigoId}`, { method: 'DELETE' })
    if (res.ok) {
      setCodigos(c => c.filter(x => x.id !== codigoId))
      toast({ title: 'Código eliminado' })
    } else {
      toast({ title: 'Error', variant: 'destructive' })
    }
  }

  async function copiarCodigo(codigo: string) {
    await navigator.clipboard.writeText(codigo)
    setCopiado(codigo)
    setTimeout(() => setCopiado(null), 2000)
  }

  async function handleDeleteMiembro() {
    if (!deleteTarget) return
    setDeleting(true)
    const res = await fetch(`/api/admin/congregacion/${id}?userId=${deleteTarget.user_id}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      setDatos(d => d ? { ...d, miembros: d.miembros.filter(m => m.user_id !== deleteTarget.user_id) } : d)
      setDeleteTarget(null)
      toast(data.warning
        ? { title: 'Eliminado con advertencia', description: data.warning }
        : { title: deleteTarget.rol === 'owner' ? 'Organizador eliminado' : 'Colaborador eliminado' })
    } else {
      toast({ title: 'Error', description: data.error, variant: 'destructive' })
    }
    setDeleting(false)
  }

  useEffect(() => {
    fetch(`/api/admin/congregacion/${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else setDatos(data)
        setLoading(false)
      })
      .catch(() => { setError('Error al cargar datos'); setLoading(false) })
    cargarCodigos()
  }, [id])

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )

  if (error || !datos) return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Button variant="ghost" size="sm" onClick={() => router.push('/admin')} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" /> Volver
      </Button>
      <p className="text-red-400">{error || 'No encontrado'}</p>
    </div>
  )

  const ROL_ORDER: Record<string, number> = { anciano: 0, siervo: 1, publicador: 2, hermana: 3 }
  const hermanosSorted = [...datos.hermanos].sort((a, b) => {
    const rolDiff = (ROL_ORDER[a.rol] ?? 9) - (ROL_ORDER[b.rol] ?? 9)
    if (rolDiff !== 0) return rolDiff
    return a.nombre.localeCompare(b.nombre)
  })
  const hermanoActivos = datos.hermanos.filter(h => h.activo)
  const hermanoInactivos = datos.hermanos.filter(h => !h.activo)

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/admin')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Volver
        </Button>
        <h1 className="text-xl font-bold flex-1">{datos.congregacion.nombre}</h1>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Hermanos activos', value: hermanoActivos.length },
          { label: 'Hermanos inactivos', value: hermanoInactivos.length },
          { label: 'Reuniones entre semana', value: datos.semanas.length + '+' },
          { label: 'Reuniones fin de semana', value: datos.semanasFDS.length + '+' },
        ].map(stat => (
          <Card key={stat.label}>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Usuarios de la app */}
      {datos.miembros.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4" /> Usuarios registrados ({datos.miembros.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {datos.miembros.map((m, i) => (
              <div key={i} className="flex items-center gap-2 text-sm py-1">
                <span className="flex-1">{m.nombre}</span>
                <Badge variant="outline" className={m.rol === 'owner' ? 'text-amber-400 border-amber-700' : 'text-muted-foreground'}>
                  {m.rol === 'owner' ? 'Organizador' : 'Colaborador'}
                </Badge>
                <span className="text-xs text-muted-foreground">{formatFecha(m.created_at.slice(0, 10))}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteTarget(m)}
                  className="text-red-600 hover:text-red-500 px-2 shrink-0"
                  title="Eliminar acceso"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Códigos de colaborador */}
      <Card className="border-amber-800/40 bg-amber-950/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-amber-400">
            <KeyRound className="h-4 w-4" /> Códigos de colaborador
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Generá un código y compartilo con la persona. Al registrarse en la app con este código,
            queda como colaborador de <span className="font-medium text-foreground">{datos.congregacion.nombre}</span>.
            Cada código sirve una sola vez.
          </p>

          {loadingCodigos ? (
            <div className="flex justify-center py-2">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : codigos.length > 0 && (
            <div className="space-y-1.5">
              {codigos.map(c => (
                <div key={c.id} className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
                  <code className="flex-1 font-mono text-sm tracking-widest text-foreground">{c.codigo}</code>
                  <button
                    onClick={() => copiarCodigo(c.codigo)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title="Copiar"
                  >
                    {copiado === c.codigo ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => eliminarCodigo(c.id)}
                    className="text-red-600 hover:text-red-500 transition-colors"
                    title="Eliminar código"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <Button size="sm" onClick={generarCodigo} disabled={generando}>
            {generando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Generar código
          </Button>
        </CardContent>
      </Card>

      {/* Hermanos */}
      <Card>
        <CardHeader
          className="pb-2 cursor-pointer select-none"
          onClick={() => setHermanosAbierto(v => !v)}
        >
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4" /> Hermanos ({datos.hermanos.length})
            <span className="ml-auto">
              {hermanosAbierto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </span>
          </CardTitle>
        </CardHeader>
        {hermanosAbierto && (
          <CardContent>
            {hermanosSorted.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin hermanos cargados.</p>
            ) : (
              <div className="space-y-1">
                {hermanosSorted.map(h => (
                  <div key={h.id} className={`flex items-center gap-2 text-sm py-1 ${!h.activo ? 'opacity-40' : ''}`}>
                    <span className="flex-1">{h.nombre}</span>
                    <Badge variant="outline" className={`text-xs ${ROL_COLORS[h.rol] ?? ''}`}>
                      {ROL_LABELS[h.rol] ?? h.rol}
                    </Badge>
                    {!h.activo && <span className="text-xs text-muted-foreground">(inactivo)</span>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Últimas reuniones entre semana */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Últimas reuniones entre semana
          </CardTitle>
        </CardHeader>
        <CardContent>
          {datos.semanas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin reuniones guardadas.</p>
          ) : (
            <div className="space-y-1">
              {datos.semanas.map(s => (
                <div key={s.id} className="flex items-center gap-2 text-sm py-1">
                  <span className="text-muted-foreground w-28 shrink-0">{formatFecha(s.fecha)}</span>
                  <span className="flex-1 truncate text-muted-foreground">{s.tema || '—'}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Últimas reuniones fin de semana */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Últimas reuniones de fin de semana
          </CardTitle>
        </CardHeader>
        <CardContent>
          {datos.semanasFDS.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin reuniones guardadas.</p>
          ) : (
            <div className="space-y-1">
              {datos.semanasFDS.map(s => (
                <div key={s.id} className="flex items-center gap-2 text-sm py-1">
                  <span className="text-muted-foreground w-28 shrink-0">{formatFecha(s.fecha)}</span>
                  <span className="flex-1 truncate text-muted-foreground">{s.titulo_articulo || '—'}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmar borrado de miembro */}
      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Eliminar acceso?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Se eliminará el acceso de <span className="font-semibold text-foreground">{deleteTarget?.nombre}</span>
            {' '}({deleteTarget?.rol === 'owner' ? 'Organizador' : 'Colaborador'}) y su cuenta. Los hermanos y reuniones de la congregación <span className="font-semibold text-foreground">no</span> se tocan.
            {deleteTarget?.rol === 'owner' && ' Al ser organizador, se liberará el token para registrar uno nuevo.'}
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteMiembro} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
