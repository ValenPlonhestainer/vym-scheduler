"use client"

import { useState, useEffect } from 'react'
import { Lock } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { getCongregacion } from '@/lib/actions'

export default function ConfiguracionPage() {
  const [congregacion, setCongregacion] = useState('')

  useEffect(() => {
    getCongregacion().then(setCongregacion)
  }, [])

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground mb-6">Configuración</h1>
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
    </div>
  )
}
