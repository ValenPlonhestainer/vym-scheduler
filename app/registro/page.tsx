"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'

type Modo = 'owner' | 'colaborador'

export default function RegistroPage() {
  const router = useRouter()
  const [modo, setModo] = useState<Modo>('owner')
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [codigo, setCodigo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirmar) { setError('Las contraseñas no coinciden'); return }
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, email, password, modo, codigo }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Error al crear la cuenta')
        setLoading(false)
        return
      }
      window.location.href = '/inicio'
    } catch {
      setError('Error de conexión. Verificá tu acceso a internet.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-full bg-primary/10 p-4">
            <BookOpen className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Crear cuenta</h1>
        </div>

        {/* Selector de modo */}
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-border p-1">
          <button
            type="button"
            onClick={() => { setModo('owner'); setError('') }}
            className={`rounded-md py-1.5 text-sm font-medium transition-colors ${
              modo === 'owner'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Con token de licencia
          </button>
          <button
            type="button"
            onClick={() => { setModo('colaborador'); setError('') }}
            className={`rounded-md py-1.5 text-sm font-medium transition-colors ${
              modo === 'colaborador'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Con código de invitación
          </button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          {modo === 'owner'
            ? 'Usá el token de licencia que te fue asignado para crear la cuenta de tu congregación.'
            : 'Usá el código de invitación que te compartió el organizador de tu congregación para ayudar como colaborador.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre</Label>
            <Input
              id="nombre"
              type="text"
              placeholder="Tu nombre"
              value={nombre}
              onChange={e => { setNombre(e.target.value); setError('') }}
              autoFocus
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              placeholder="usuario@ejemplo.com"
              value={email}
              onChange={e => { setEmail(e.target.value); setError('') }}
              autoComplete="email"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              autoComplete="new-password"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmar">Confirmar contraseña</Label>
            <Input
              id="confirmar"
              type="password"
              placeholder="Repetí la contraseña"
              value={confirmar}
              onChange={e => { setConfirmar(e.target.value); setError('') }}
              autoComplete="new-password"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="codigo">
              {modo === 'owner' ? 'Token de licencia' : 'Código de invitación'}
            </Label>
            <Input
              id="codigo"
              type="text"
              placeholder={modo === 'owner' ? 'cong_xxx_xxxxx' : 'XXXXXXXX'}
              value={codigo}
              onChange={e => { setCodigo(e.target.value); setError('') }}
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
              required
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-950/30 border border-red-800/40 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={loading || !nombre.trim() || !email.trim() || !password || !confirmar || !codigo.trim()}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Crear cuenta
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          ¿Ya tenés cuenta?{' '}
          <Link href="/" className="text-primary underline underline-offset-4 hover:opacity-80">
            Ingresar
          </Link>
        </p>
      </div>
    </div>
  )
}
