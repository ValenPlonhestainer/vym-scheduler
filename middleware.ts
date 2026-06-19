import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/api/auth')) {
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
    const congId = request.cookies.get('congregation_id')?.value
    const token = request.cookies.get('congregation_token')?.value
    if (congId && token) {
      return NextResponse.redirect(new URL('/inicio', request.url))
    }
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

  // En modo desktop la validación de licencia ocurre al arrancar Electron
  // y en /api/auth al hacer login. El middleware solo verifica que existan
  // las cookies de sesión (Edge Runtime no puede acceder a fs/crypto).
  const congId = request.cookies.get('congregation_id')?.value
  const token = request.cookies.get('congregation_token')?.value

  if (!congId || !token) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
