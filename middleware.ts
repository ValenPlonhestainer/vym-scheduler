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
    if (process.env.SITE_MODE === 'admin') {
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

  // Verifica cookies de sesión
  const congId = request.cookies.get('congregation_id')?.value
  const token = request.cookies.get('congregation_token')?.value

  if (!congId || !token) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Valida el token contra Supabase (fetch directo, no Supabase JS client)
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)

    const res = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/tokens?token=eq.${encodeURIComponent(token)}&select=active`,
      {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        signal: controller.signal,
      }
    )
    clearTimeout(timeout)

    if (res.ok) {
      const data: { active: boolean }[] = await res.json()
      if (!data.length || !data[0].active) {
        const response = NextResponse.redirect(new URL('/', request.url))
        response.cookies.delete('congregation_token')
        response.cookies.delete('congregation_id')
        return response
      }
    }
  } catch {
    // Si falla el check (timeout, red), dejamos pasar — mejor no cortar sesiones válidas
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
