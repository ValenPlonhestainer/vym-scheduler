"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function AdminLoginPage() {
  const router = useRouter()
  const [secret, setSecret] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Clave incorrecta')
        setLoading(false)
        return
      }
      window.location.href = '/admin'
    } catch {
      setError('Error de conexión')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-full bg-amber-500/10 p-4">
            <Shield className="h-8 w-8 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Panel de administración</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="secret">Clave maestra</Label>
            <Input
              id="secret"
              type="password"
              value={secret}
              onChange={e => { setSecret(e.target.value); setError('') }}
              autoFocus
            />
          </div>
          {error && (
            <p className="text-sm text-red-400 bg-red-950/30 border border-red-800/40 rounded-md px-3 py-2">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={loading || !secret}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Ingresar
          </Button>
        </form>
      </div>
    </div>
  )
}
