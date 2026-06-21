"use client"

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Users, Calendar, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

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
  miembros: Array<{ nombre: string; rol: string; created_at: string }>
}

function formatFecha(fecha: string) {
  if (!fecha) return ''
  const [y, m, d] = fecha.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function CongregacionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [datos, setDatos] = useState<DatosCong | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/admin/congregacion/${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else setDatos(data)
        setLoading(false)
      })
      .catch(() => { setError('Error al cargar datos'); setLoading(false) })
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
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Hermanos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4" /> Hermanos ({datos.hermanos.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {datos.hermanos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin hermanos cargados.</p>
          ) : (
            <div className="space-y-1">
              {datos.hermanos.map(h => (
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
    </div>
  )
}
