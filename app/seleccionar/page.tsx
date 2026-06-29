"use client"

import { useState, useEffect } from 'react'
import { Building2, Loader2, LogOut, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Cong { id: string; nombre: string }

export default function SeleccionarCongregacionPage() {
  const [congs, setCongs] = useState<Cong[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filtro, setFiltro] = useState('')
  const [seleccionando, setSeleccionando] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/seleccionar-congregacion')
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else setCongs(data.congregaciones ?? [])
        setLoading(false)
      })
      .catch(() => { setError('Error al cargar las congregaciones'); setLoading(false) })
  }, [])

  async function elegir(id: string) {
    setSeleccionando(id)
    setError('')
    const res = await fetch('/api/seleccionar-congregacion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ congregacion_id: id }),
    })
    if (res.ok) {
      window.location.href = '/inicio'
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'No se pudo entrar a la congregación')
      setSeleccionando(null)
    }
  }

  const visibles = congs.filter(c => c.nombre.toLowerCase().includes(filtro.toLowerCase()))

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="rounded-full bg-primary/10 p-4">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Elegí una congregación</h1>
          <p className="text-sm text-muted-foreground">
            Tu cuenta tiene acceso a {congs.length} congregaci{congs.length === 1 ? 'ón' : 'ones'}.
          </p>
        </div>

        {congs.length > 8 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar congregación..."
              value={filtro}
              onChange={e => setFiltro(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>
        )}

        {error && (
          <p className="text-sm text-red-400 bg-red-950/30 border border-red-800/40 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : visibles.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-10">
            {congs.length === 0 ? 'No hay congregaciones disponibles.' : 'Sin resultados.'}
          </p>
        ) : (
          <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
            {visibles.map(c => (
              <button
                key={c.id}
                onClick={() => elegir(c.id)}
                disabled={!!seleccionando}
                className="w-full flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left text-sm font-medium hover:bg-accent hover:border-primary/40 transition-colors disabled:opacity-50"
              >
                <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">{c.nombre}</span>
                {seleccionando === c.id && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              </button>
            ))}
          </div>
        )}

        <div className="pt-2 text-center">
          <a
            href="/api/auth/logout"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </a>
        </div>
      </div>
    </div>
  )
}
