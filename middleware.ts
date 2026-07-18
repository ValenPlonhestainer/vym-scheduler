import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/api/auth') || pathname.startsWith('/api/check-sesion') || pathname.startsWith('/api/seleccionar-congregacion')) {
    return NextResponse.next()
  }

  // La ruta de recordatorios automáticos la llama el bot (server-to-server, sin
  // sesión); se autentica con su propia clave secreta, no con cookies.
  if (pathname.startsWith('/api/recordatorios-auto')) {
    return NextResponse.next()
  }

  // Selector de congregación: la cuenta admin ya está logueada (tiene user_id)
  // pero todavía no eligió congregación (no hay congregation_id).
  if (pathname === '/seleccionar') {
    const userId = request.cookies.get('user_id')?.value
    if (!userId) return NextResponse.redirect(new URL('/', request.url))
    return NextResponse.next()
  }

  // En el deployment de admin, la raíz va directo al panel admin
  if (pathname === '/') {
    const host = request.headers.get('host') ?? ''
    const isAdminSite = host.includes('admin') || process.env.SITE_MODE === 'admin'
    if (isAdminSite) {
      const adminAuth = request.cookies.get('admin_auth')?.value
      if (adminAuth && adminAuth === process.env.ADMIN_SECRET) {
        return NextResponse.redirect(new URL('/admin', request.url))
      }
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
    const userId = request.cookies.get('user_id')?.value
    const congId = request.cookies.get('congregation_id')?.value
    if (userId && congId) {
      return NextResponse.redirect(new URL('/inicio', request.url))
    }
    if (userId) {
      // Sesión iniciada pero sin congregación elegida (cuenta admin).
      return NextResponse.redirect(new URL('/seleccionar', request.url))
    }
    return NextResponse.next()
  }

  if (pathname === '/registro') {
    return NextResponse.next()
  }

  if (pathname === '/admin/login') {
    return NextResponse.next()
  }

  if (pathname.startsWith('/admin')) {
    const adminAuth = request.cookies.get('admin_auth')?.value
    if (!adminAuth || adminAuth !== process.env.ADMIN_SECRET) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
    return NextResponse.next()
  }

  if (pathname.startsWith('/api/admin')) {
    return NextResponse.next()
  }

  const userId = request.cookies.get('user_id')?.value
  const congId = request.cookies.get('congregation_id')?.value

  if (!userId || !congId) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
