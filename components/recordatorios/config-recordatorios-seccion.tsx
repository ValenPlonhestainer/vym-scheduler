"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { getConfigRecordatorios } from '@/lib/actions'
import { ConfigRecordatoriosForm } from './config-recordatorios-form'

type Config = Awaited<ReturnType<typeof getConfigRecordatorios>>

// Sección de Configuración (solo en la congregación habilitada) para editar los
// días de reunión y el contacto de los recordatorios por WhatsApp.
export function ConfigRecordatoriosSeccion() {
  const [data, setData] = useState<Config | null>(null)

  const cargar = () => getConfigRecordatorios().then(setData).catch(() => {})
  useEffect(() => { cargar() }, [])

  if (!data || !data.habilitado) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recordatorios por WhatsApp</CardTitle>
        <CardDescription>
          Días en que se reúne tu congregación y el contacto que aparece al pie de cada aviso.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ConfigRecordatoriosForm
          diaEntreSemana={data.diaEntreSemana}
          diaFinDeSemana={data.diaFinDeSemana}
          contacto={data.contacto}
          onSaved={cargar}
        />
      </CardContent>
    </Card>
  )
}
