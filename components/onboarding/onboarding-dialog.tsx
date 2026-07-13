"use client"

import { useEffect, useState } from 'react'
import {
  BookOpen, Users, Calendar, History, FileDown, Settings,
  ChevronLeft, ChevronRight, X, Plus, Search, Check, Download, Moon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/* ════════════════════════════════════════════════════════════════════════════
   Tutorial de bienvenida (primera vez).

   Se muestra una sola vez por usuario — el estado vive en Supabase
   (congregacion_miembros.onboarding_visto), leído/escrito vía /api/onboarding.

   Cada paso trae un "mockup" animado de la sección real, recreado con los
   mismos colores/íconos de la app (no son capturas, son recreaciones livianas).
   ════════════════════════════════════════════════════════════════════════════ */

// ── Lee una cookie no-httpOnly (user_role) desde el cliente ───────────────────
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const m = document.cookie.split(';').find(c => c.trim().startsWith(name + '='))
  return m ? m.trim().split('=')[1] : null
}

/* ─────────────────────────────  MOCKUPS  ───────────────────────────────────── */

function Stage({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative h-56 sm:h-64 w-full overflow-hidden rounded-xl border border-border bg-muted/30 p-4">
      {children}
    </div>
  )
}

function MockBienvenida() {
  const secciones = [
    { icon: Users, color: 'text-sky-400', bg: 'bg-sky-500/10' },
    { icon: Calendar, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { icon: History, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { icon: FileDown, color: 'text-violet-400', bg: 'bg-violet-500/10' },
    { icon: Settings, color: 'text-rose-400', bg: 'bg-rose-500/10' },
  ]
  return (
    <Stage>
      <div className="flex h-full flex-col items-center justify-center gap-5">
        <div className="animate-in zoom-in-50 fade-in duration-500 rounded-2xl bg-primary/10 p-5">
          <BookOpen className="h-10 w-10 text-primary" />
        </div>
        <div className="flex gap-2.5">
          {secciones.map(({ icon: Icon, color, bg }, i) => (
            <div
              key={i}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-xl',
                bg,
                'animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500',
              )}
              style={{ animationDelay: `${250 + i * 110}ms` }}
            >
              <Icon className={cn('h-5 w-5', color)} />
            </div>
          ))}
        </div>
      </div>
    </Stage>
  )
}

function MockHermanos() {
  const filas = [
    { nombre: 'Carlos Méndez', badge: 'anciano', label: 'Anciano' },
    { nombre: 'Julián Ferreyra', badge: 'siervo', label: 'S. Ministerial' },
    { nombre: 'Ana Ríos', badge: 'hermana', label: 'Hermana' },
    { nombre: 'Diego Sosa', badge: 'publicador', label: 'Publicador' },
  ]
  return (
    <Stage>
      <div className="flex items-center gap-2">
        <div className="flex h-8 flex-1 items-center gap-2 rounded-md border border-border bg-background px-2.5">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <div className="h-2 w-20 rounded-full bg-muted-foreground/25" />
        </div>
        <div className="flex h-8 items-center gap-1 rounded-md bg-primary px-2.5 text-primary-foreground animate-glow">
          <Plus className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">Agregar</span>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {filas.map((f, i) => (
          <div
            key={f.nombre}
            className="flex items-center gap-2.5 rounded-md border border-border bg-background px-3 py-2 animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500"
            style={{ animationDelay: `${150 + i * 130}ms` }}
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
              {f.nombre.split(' ').map(p => p[0]).join('')}
            </div>
            <span className="flex-1 truncate text-sm text-foreground">{f.nombre}</span>
            <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', `badge-${f.badge}`)}>
              {f.label}
            </span>
          </div>
        ))}
      </div>
    </Stage>
  )
}

function MockProgramar() {
  const partes = [
    { parte: 'Tesoros de la Biblia', hermano: 'Carlos Méndez' },
    { parte: 'Seamos mejores maestros', hermano: null },
  ]
  return (
    <Stage>
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/10">
          <Calendar className="h-4 w-4 text-emerald-400" />
        </div>
        <div>
          <p className="text-xs font-semibold text-foreground">Reunión — miércoles</p>
          <p className="text-[10px] text-muted-foreground">Vida y Ministerio</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {partes.map((p, i) => (
          <div key={p.parte} className="rounded-md border border-border bg-background px-3 py-2">
            <p className="text-[11px] text-muted-foreground">{p.parte}</p>
            {p.hermano ? (
              <div className="mt-1 flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-sm font-medium text-foreground">{p.hermano}</span>
              </div>
            ) : (
              <div className="mt-1">
                <span className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-primary/50 px-2 py-1 text-sm font-medium text-foreground animate-drop-in">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/15 text-[9px] font-semibold text-emerald-500">JF</span>
                  Julián Ferreyra
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* mini "popover" de selección que aparece */}
      <div
        className="absolute bottom-3 right-3 w-36 rounded-lg border border-border bg-popover p-1.5 shadow-lg animate-in fade-in slide-in-from-top-1 fill-mode-both duration-500"
        style={{ animationDelay: '650ms' }}
      >
        <div className="rounded-md bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">Julián Ferreyra</div>
        <div className="px-2 py-1 text-[11px] text-muted-foreground">Diego Sosa</div>
      </div>
    </Stage>
  )
}

function MockHistorial() {
  const semanas = [
    { fecha: '5 – 11 may', partes: '9 asignaciones' },
    { fecha: '28 abr – 4 may', partes: '8 asignaciones' },
    { fecha: '21 – 27 abr', partes: '9 asignaciones' },
  ]
  return (
    <Stage>
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-500/10">
          <History className="h-4 w-4 text-amber-400" />
        </div>
        <p className="text-xs font-semibold text-foreground">Reuniones pasadas</p>
      </div>
      <div className="flex flex-col gap-2">
        {semanas.map((s, i) => (
          <div
            key={s.fecha}
            className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2.5 animate-in fade-in slide-in-from-left-4 fill-mode-both duration-500"
            style={{ animationDelay: `${120 + i * 150}ms` }}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/10">
              <Check className="h-4 w-4 text-amber-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{s.fecha}</p>
              <p className="text-[10px] text-muted-foreground">{s.partes}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        ))}
      </div>
    </Stage>
  )
}

function MockExportar() {
  return (
    <Stage>
      <div className="flex h-full items-center justify-center">
        {/* hoja */}
        <div className="relative w-40 rounded-md border border-border bg-white p-3 shadow-md dark:bg-zinc-100 animate-in zoom-in-95 fade-in duration-500">
          <div className="mx-auto h-2 w-24 rounded-full bg-violet-400/70" />
          <div className="mt-3 space-y-1.5">
            {[16, 20, 14, 22, 18, 12].map((w, i) => (
              <div
                key={i}
                className="h-1.5 rounded-full bg-zinc-300 animate-in fade-in fill-mode-both duration-300"
                style={{ width: `${w * 4}px`, animationDelay: `${200 + i * 90}ms` }}
              />
            ))}
          </div>
          {/* botón de descarga flotante */}
          <div className="absolute -bottom-3 -right-3 flex h-10 w-10 items-center justify-center rounded-full bg-violet-500 text-white shadow-lg animate-float">
            <Download className="h-5 w-5" />
          </div>
        </div>
      </div>
    </Stage>
  )
}

function MockConfiguracion() {
  type Row = { label: string; on?: boolean; input?: boolean; icon?: typeof Moon }
  const rows: Row[] = [
    { label: 'Tema oscuro', on: true, icon: Moon },
    { label: 'Nombre de la congregación', input: true },
    { label: 'Canción de apertura', input: true },
  ]
  return (
    <Stage>
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-rose-500/10">
          <Settings className="h-4 w-4 text-rose-400" />
        </div>
        <p className="text-xs font-semibold text-foreground">Configuración</p>
      </div>
      <div className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <div
            key={r.label}
            className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2.5 animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500"
            style={{ animationDelay: `${140 + i * 140}ms` }}
          >
            {r.icon && <r.icon className="h-3.5 w-3.5 text-muted-foreground" />}
            <span className="flex-1 text-sm text-foreground">{r.label}</span>
            {r.on !== undefined ? (
              <span className={cn(
                'flex h-5 w-9 items-center rounded-full p-0.5 transition-colors',
                r.on ? 'justify-end bg-primary animate-glow' : 'justify-start bg-muted-foreground/30',
              )}>
                <span className="h-4 w-4 rounded-full bg-white shadow" />
              </span>
            ) : (
              <span className="h-5 w-24 rounded-md border border-border bg-muted/50" />
            )}
          </div>
        ))}
      </div>
    </Stage>
  )
}

/* ─────────────────────────────  PASOS  ─────────────────────────────────────── */

type Paso = {
  icon: typeof Users
  color: string
  bg: string
  titulo: string
  descripcion: string
  Mock: () => JSX.Element
}

const PASOS: Paso[] = [
  {
    icon: BookOpen, color: 'text-primary', bg: 'bg-primary/10',
    titulo: '¡Bienvenido a VyM Scheduler!',
    descripcion: 'Esta app te ayuda a preparar el programa semanal de Vida y Ministerio de tu congregación. Te mostramos en 30 segundos cómo funciona cada sección.',
    Mock: MockBienvenida,
  },
  {
    icon: Users, color: 'text-sky-400', bg: 'bg-sky-500/10',
    titulo: 'Hermanos',
    descripcion: 'Cargá la lista de hermanos con su rol (anciano, siervo, publicador o hermana). Desde acá gestionás quién puede recibir cada tipo de asignación.',
    Mock: MockHermanos,
  },
  {
    icon: Calendar, color: 'text-emerald-400', bg: 'bg-emerald-500/10',
    titulo: 'Programar',
    descripcion: 'Armá las reuniones de entre semana y de fin de semana. Al asignar una parte, la app te sugiere hermanos disponibles con un solo clic.',
    Mock: MockProgramar,
  },
  {
    icon: History, color: 'text-amber-400', bg: 'bg-amber-500/10',
    titulo: 'Historial',
    descripcion: 'Consultá todas las reuniones ya programadas. Ideal para ver quién participó y equilibrar las asignaciones entre los hermanos.',
    Mock: MockHistorial,
  },
  {
    icon: FileDown, color: 'text-violet-400', bg: 'bg-violet-500/10',
    titulo: 'Exportar a PDF',
    descripcion: 'Generá el programa semanal en PDF, listo para imprimir o compartir con la congregación con un formato prolijo.',
    Mock: MockExportar,
  },
  {
    icon: Settings, color: 'text-rose-400', bg: 'bg-rose-500/10',
    titulo: 'Configuración',
    descripcion: 'Ajustá los datos de tu congregación, el tema claro/oscuro y otras preferencias. ¡Listo, ya podés empezar a usar la app!',
    Mock: MockConfiguracion,
  },
]

/* ─────────────────────────────  DIÁLOGO  ───────────────────────────────────── */

function OnboardingDialog({ onFinish }: { onFinish: () => void }) {
  const [paso, setPaso] = useState(0)
  const total = PASOS.length
  const esUltimo = paso === total - 1
  const { icon: Icon, color, bg, titulo, descripcion, Mock } = PASOS[paso]

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onFinish()
      else if (e.key === 'ArrowRight' && !esUltimo) setPaso(p => p + 1)
      else if (e.key === 'ArrowLeft' && paso > 0) setPaso(p => p - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [paso, esUltimo, onFinish])

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl animate-in zoom-in-95 fade-in duration-300 sm:p-6">
        {/* Cerrar / omitir */}
        <button
          onClick={onFinish}
          aria-label="Omitir tutorial"
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Encabezado */}
        <div className="mb-4 flex items-center gap-3 pr-6">
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', bg)}>
            <Icon className={cn('h-5 w-5', color)} />
          </div>
          <h2 className="text-lg font-bold leading-tight text-foreground">{titulo}</h2>
        </div>

        {/* Mockup animado — key fuerza el re-montaje para reproducir la animación */}
        <div key={paso}>
          <Mock />
        </div>

        {/* Descripción */}
        <p className="mt-4 min-h-[3.5rem] text-sm leading-relaxed text-muted-foreground">
          {descripcion}
        </p>

        {/* Puntos de progreso */}
        <div className="mt-4 flex items-center justify-center gap-1.5">
          {PASOS.map((_, i) => (
            <button
              key={i}
              onClick={() => setPaso(i)}
              aria-label={`Ir al paso ${i + 1}`}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === paso ? 'w-5 bg-primary' : 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50',
              )}
            />
          ))}
        </div>

        {/* Controles */}
        <div className="mt-5 flex items-center justify-between gap-3">
          {paso > 0 ? (
            <button
              onClick={() => setPaso(p => p - 1)}
              className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
              Atrás
            </button>
          ) : (
            <button
              onClick={onFinish}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Omitir
            </button>
          )}

          {esUltimo ? (
            <button
              onClick={onFinish}
              className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Check className="h-4 w-4" />
              Empezar a usar la app
            </button>
          ) : (
            <button
              onClick={() => setPaso(p => p + 1)}
              className="flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────  GATE: decide si mostrar el tutorial  ────────────────────── */

export function OnboardingGate() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // Los admins entran por /seleccionar y no necesitan el tutorial.
    if (getCookie('user_role') === 'admin') return

    let cancelado = false
    fetch('/api/onboarding', { credentials: 'include', cache: 'no-store' })
      .then(r => (r.ok ? r.json() : { visto: true }))
      .then(d => { if (!cancelado && d && d.visto === false) setOpen(true) })
      .catch(() => { /* red: no mostrar */ })
    return () => { cancelado = true }
  }, [])

  function finish() {
    setOpen(false)
    fetch('/api/onboarding', { method: 'POST', credentials: 'include' }).catch(() => {})
  }

  if (!open) return null
  return <OnboardingDialog onFinish={finish} />
}
