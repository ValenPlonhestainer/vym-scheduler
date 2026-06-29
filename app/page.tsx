"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Correo o contraseña incorrectos')
        setLoading(false)
        return
      }
      window.location.href = data.seleccionar ? '/seleccionar' : '/inicio'
    } catch {
      setError('Error de conexión. Verificá tu acceso a internet.')
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
          <p className="text-sm text-muted-foreground text-center">
            Iniciá sesión para acceder al programa de tu congregación.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              placeholder="usuario@ejemplo.com"
              value={email}
              onChange={e => { setEmail(e.target.value); setError('') }}
              autoFocus
              autoComplete="email"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              placeholder="Tu contraseña"
              value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-950/30 border border-red-800/40 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={loading || !email.trim() || !password}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Ingresar
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          ¿Primera vez?{' '}
          <Link href="/registro" className="text-primary underline underline-offset-4 hover:opacity-80">
            Crear cuenta
          </Link>
        </p>
      </div>
    </div>
  )
}
