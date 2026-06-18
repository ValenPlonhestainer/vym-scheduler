"use client"

import { useState, useEffect } from 'react'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { getCongregacion, saveCongregacion } from '@/lib/actions'
import { useToast } from '@/hooks/use-toast'

export default function ConfiguracionPage() {
  const [congregacion, setCongregacion] = useState('')
  const { toast } = useToast()

  useEffect(() => {
    getCongregacion().then(setCongregacion)
  }, [])

  async function handleSave() {
    await saveCongregacion(congregacion.trim())
    toast({ title: 'Configuración guardada' })
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground mb-6">Configuración</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Congregación</CardTitle>
          <CardDescription>El nombre aparecerá en el encabezado del PDF exportado.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cong">Nombre de la congregación</Label>
            <Input
              id="cong"
              value={congregacion}
              onChange={e => setCongregacion(e.target.value)}
              placeholder="Ej: Congregación Norte"
            />
          </div>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4" />
            Guardar
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
