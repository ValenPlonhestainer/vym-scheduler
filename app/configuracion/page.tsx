"use client"

import { useState, useEffect } from 'react'
import { Lock, Sun, Moon, Plus, Trash2, Copy, Check, Loader2, LogOut } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { getCongregacion } from '@/lib/actions'
import { useTheme } from '@/components/theme-provider'
import { ConfigRecordatoriosSeccion } from '@/components/recordatorios/config-recordatorios-seccion'

interface Invitacion {
  id: string
  codigo: string
  usado: boolean
  created_at: string
}

function getRol(): string {
  if (typeof document === 'undefined') return 'colaborador'
  const match = document.cookie.split(';').find(c => c.trim().startsWith('user_role='))
  return match ? match.trim().split('=')[1] : 'colaborador'
}

export default function ConfiguracionPage() {
  const [congregacion, setCongregacion] = useState('')
  const { theme, toggle } = useTheme()
  const [rol, setRol] = useState<string>('colaborador')

  const [invitaciones, setInvitaciones] = useState<Invitacion[]>([])
  const [loadingInvitaciones, setLoadingInvitaciones] = useState(true)
  const [creandoInvitacion, setCreandoInvitacion] = useState(false)
  const [copiado, setCopiado] = useState<string | null>(null)

  useEffect(() => {
    getCongregacion().then(setCongregacion)
    setRol(getRol())
    cargarInvitaciones()
  }, [])

  async function cargarInvitaciones() {
    setLoadingInvitaciones(true)
    try {
      const res = await fetch('/api/invitaciones')
      const data = await res.json()
      setInvitaciones(data.invitaciones ?? [])
    } catch { /* ignorar */ }
    setLoadingInvitaciones(false)
  }

  async function crearInvitacion() {
    setCreandoInvitacion(true)
    try {
      const res = await fetch('/api/invitaciones', { method: 'POST' })
      if (res.ok) await cargarInvitaciones()
    } catch { /* ignorar */ }
    setCreandoInvitacion(false)
  }

  async function eliminarInvitacion(id: string) {
    try {
      await fetch('/api/invitaciones', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      await cargarInvitaciones()
    } catch { /* ignorar */ }
  }

  async function copiarCodigo(codigo: string) {
    try {
      await navigator.clipboard.writeText(codigo)
      setCopiado(codigo)
      setTimeout(() => setCopiado(null), 2000)
    } catch { /* ignorar */ }
  }

  async function cerrarSesion() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/'
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground mb-6">Configuración</h1>

      <div className="space-y-4">
        {/* Congregación */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Congregación</CardTitle>
            <CardDescription>El nombre aparece en el encabezado del PDF exportado.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              <Label>Nombre de la congregación</Label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-muted/50 text-muted-foreground text-sm">
                <span className="flex-1">{congregacion || '—'}</span>
                <Lock className="h-3.5 w-3.5 shrink-0 opacity-50" />
              </div>
              <p className="text-xs text-muted-foreground">Solo el administrador puede modificar este campo.</p>
            </div>
          </CardContent>
        </Card>

        {/* Recordatorios por WhatsApp — solo en la congregación habilitada */}
        <ConfigRecordatoriosSeccion />

        {/* Invitaciones — solo organizadores */}
        {rol === 'owner' && <Card>
          <CardHeader>
            <CardTitle className="text-base">Colaboradores</CardTitle>
            <CardDescription>
              Generá un código de invitación y compartilo con quien quieras que colabore en el programa.
              Cada código es de un solo uso.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingInvitaciones ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando...
              </div>
            ) : invitaciones.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay códigos de invitación activos.</p>
            ) : (
              <div className="space-y-2">
                {invitaciones.map(inv => (
                  <div key={inv.id} className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-muted/30">
                    <code className="flex-1 font-mono text-sm tracking-widest text-foreground">{inv.codigo}</code>
                    <button
                      onClick={() => copiarCodigo(inv.codigo)}
                      className="text-muted-foreground hover:text-foreground transition-colors p-1"
                      title="Copiar código"
                    >
                      {copiado === inv.codigo
                        ? <Check className="h-4 w-4 text-green-500" />
                        : <Copy className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => eliminarInvitacion(inv.id)}
                      className="text-muted-foreground hover:text-red-500 transition-colors p-1"
                      title="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={crearInvitacion}
              disabled={creandoInvitacion}
            >
              {creandoInvitacion
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Plus className="h-4 w-4" />}
              Generar código de invitación
            </Button>
          </CardContent>
        </Card>}

        {/* Apariencia */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Apariencia</CardTitle>
            <CardDescription>Elegí entre el modo claro y oscuro.</CardDescription>
          </CardHeader>
          <CardContent>
            <button
              onClick={toggle}
              className="flex items-center justify-between w-full px-3 py-2.5 rounded-md border border-border bg-muted/50 hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-2.5">
                {theme === 'dark'
                  ? <Moon className="h-4 w-4 text-blue-400" />
                  : <Sun className="h-4 w-4 text-amber-500" />}
                <span className="text-sm font-medium">
                  {theme === 'dark' ? 'Modo oscuro' : 'Modo claro'}
                </span>
              </div>
              <div className={`relative w-10 h-5 rounded-full transition-colors ${theme === 'dark' ? 'bg-blue-600' : 'bg-muted-foreground/30'}`}>
                <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${theme === 'dark' ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
            </button>
          </CardContent>
        </Card>

        {/* Cerrar sesión */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sesión</CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" onClick={cerrarSesion} className="text-red-500 border-red-500/30 hover:bg-red-950/20 hover:text-red-400">
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
