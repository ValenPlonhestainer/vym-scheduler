"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, Calendar, History, FileDown, Settings, LogOut, BookOpen, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'

const navItems = [
  { href: '/hermanos',      label: 'Hermanos',    icon: Users },
  { href: '/programar',     label: 'Programar',   icon: Calendar },
  { href: '/historial',     label: 'Historial',   icon: History },
  { href: '/exportar',      label: 'Exportar PDF', icon: FileDown },
  { href: '/configuracion', label: 'Configuración', icon: Settings },
]

function getRolFromCookie(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.split(';').find(c => c.trim().startsWith('user_role='))
  return match ? match.trim().split('=')[1] : null
}

function RolBadge({ rol }: { rol: string | null }) {
  if (!rol) return null
  const isOwner = rol === 'owner'
  return (
    <Badge variant="outline" className={cn(
      'text-xs px-1.5 py-0 h-5 shrink-0',
      isOwner ? 'text-amber-400 border-amber-700' : 'text-sky-400 border-sky-700'
    )}>
      {isOwner ? 'Organizador' : 'Colaborador'}
    </Badge>
  )
}

function NavContent({ pathname, rol, onNavigate, onLogoutClick }: {
  pathname: string
  rol: string | null
  onNavigate?: () => void
  onLogoutClick: () => void
}) {
  return (
    <>
      <Link
        href="/inicio"
        onClick={onNavigate}
        className="flex items-center gap-2 px-5 py-4 border-b border-border"
      >
        <BookOpen className="h-5 w-5 shrink-0 text-primary" />
        <div className="flex-1">
          <p className="font-bold text-primary leading-tight">VyM Scheduler</p>
          {rol && <RolBadge rol={rol} />}
        </div>
      </Link>

      <nav className="flex flex-col gap-1 p-3 flex-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium transition-colors',
                active
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t border-border">
        <button
          onClick={onLogoutClick}
          className="flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground w-full transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Cerrar sesión
        </button>
      </div>
    </>
  )
}

export function Navigation() {
  const pathname = usePathname()
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [rol, setRol] = useState<string | null>(null)

  useEffect(() => {
    setRol(getRolFromCookie())
  }, [])

  if (pathname === '/' || pathname.startsWith('/admin') || pathname.startsWith('/registro')) return null

  function handleLogout() {
    ;['vym_prog_semana','vym_prog_asigs','vym_prog_fds','vym_prog_asigsfds','vym_prog_tipo','vym_prog_salaaux'].forEach(k => localStorage.removeItem(k))
    window.location.href = '/api/auth/logout'
  }

  return (
    <>
      {/* Sidebar desktop */}
      <aside className="fixed top-0 left-0 h-full w-52 bg-card border-r border-border flex-col z-40 no-print hidden md:flex">
        <NavContent
          pathname={pathname}
          rol={rol}
          onLogoutClick={() => setLogoutOpen(true)}
        />
      </aside>

      {/* Top bar mobile */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-card border-b border-border flex items-center px-4 gap-3 z-40 md:hidden no-print">
        <button
          onClick={() => setMobileOpen(true)}
          className="text-muted-foreground hover:text-foreground"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/inicio" className="flex items-center gap-2 font-bold text-primary flex-1">
          <BookOpen className="h-5 w-5 shrink-0" />
          <span>VyM Scheduler</span>
        </Link>
        <RolBadge rol={rol} />
      </header>

      {/* Drawer mobile */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <NavContent
          pathname={pathname}
          rol={rol}
          onNavigate={() => setMobileOpen(false)}
          onLogoutClick={() => { setMobileOpen(false); setLogoutOpen(true) }}
        />
      </Sheet>

      {/* Dialog confirmar logout */}
      <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Cerrar sesión?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Está seguro que desea cerrar sesión? Deberá ingresar su clave token manualmente para volver a acceder.
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setLogoutOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleLogout}>
              Cerrar sesión
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
