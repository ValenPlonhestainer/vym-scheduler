"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token.trim()) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Error al iniciar sesión')
        setLoading(false)
        return
      }
      window.location.href = '/inicio'
    } catch {
      setError('Error de conexión. Intente nuevamente.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-full bg-primary/10 p-4">
            <BookOpen className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">VyM Scheduler</h1>
        </div>

        <p className="text-sm text-muted-foreground text-center leading-relaxed">
          Para acceder a los datos de su congregación, ingrese la clave token que le fue asignada.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="token">Clave token</Label>
            <Input
              id="token"
              type="text"
              placeholder="cong_xxx_xxxxx"
              value={token}
              onChange={e => { setToken(e.target.value); setError('') }}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-950/30 border border-red-800/40 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={loading || !token.trim()}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Ingresar
          </Button>
        </form>
      </div>
    </div>
  )
}
