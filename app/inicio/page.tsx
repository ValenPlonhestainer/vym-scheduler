"use client"

import Link from 'next/link'
import { Users, Calendar, History, FileDown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { OnboardingGate } from '@/components/onboarding/onboarding-dialog'

const modulos = [
  {
    href: '/hermanos',
    label: 'Hermanos',
    icon: Users,
    description: 'Gestioná la lista de hermanos, sus roles y disponibilidad.',
    color: 'text-sky-400',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/30',
  },
  {
    href: '/programar',
    label: 'Programar',
    icon: Calendar,
    description: 'Creá y editá las asignaciones para reuniones de entre semana y fin de semana.',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
  },
  {
    href: '/historial',
    label: 'Historial',
    icon: History,
    description: 'Consultá todas las reuniones pasadas y sus asignaciones.',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
  },
  {
    href: '/exportar',
    label: 'Exportar a PDF',
    icon: FileDown,
    description: 'Generá e imprimí el programa semanal en formato PDF.',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/30',
  },
]

export default function InicioPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <OnboardingGate />
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Inicio</h1>
        <p className="text-sm text-muted-foreground mt-1">Seleccioná un módulo para comenzar.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {modulos.map(({ href, label, icon: Icon, description, color, bg, border }) => (
          <Link key={href} href={href}>
            <Card className={`h-full cursor-pointer hover:shadow-md transition-shadow border ${border}`}>
              <CardContent className="p-5 flex flex-col gap-3">
                <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{label}</p>
                  <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
