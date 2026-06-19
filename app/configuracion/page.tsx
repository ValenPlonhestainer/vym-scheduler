"use client"

import { useState, useEffect } from 'react'
import { Lock, Sun, Moon } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { getCongregacion } from '@/lib/actions'
import { useTheme } from '@/components/theme-provider'

export default function ConfiguracionPage() {
  const [congregacion, setCongregacion] = useState('')
  const { theme, toggle } = useTheme()

  useEffect(() => {
    getCongregacion().then(setCongregacion)
  }, [])

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
              {/* Toggle pill */}
              <div className={`relative w-10 h-5 rounded-full transition-colors ${theme === 'dark' ? 'bg-blue-600' : 'bg-muted-foreground/30'}`}>
                <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${theme === 'dark' ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
