import { NextRequest, NextResponse } from 'next/server'
import { getAnonSupabase, supabaseWithToken, SESSION_COOKIE_OPTS } from '@/lib/supabase'

const COOKIE_OPTS = SESSION_COOKIE_OPTS

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = ((body.email as string) ?? '').trim().toLowerCase()
    const password = (body.password as string) ?? ''

    if (!email || !password) {
      return NextResponse.json({ error: 'Correo y contraseña requeridos' }, { status: 400 })
    }

    // Login con anon key: devuelve el JWT (access_token) del usuario.
    const sbAuth = getAnonSupabase()
    const { data: authData, error: authError } = await sbAuth.auth.signInWithPassword({ email, password })

    if (authError || !authData.user || !authData.session) {
      return NextResponse.json({ error: 'Correo o contraseña incorrectos' }, { status: 401 })
    }

    const userId = authData.user.id
    const accessToken = authData.session.access_token
    const refreshToken = authData.session.refresh_token

    // Cliente autenticado con el JWT recién obtenido (sujeto a RLS).
    const sb = supabaseWithToken(accessToken)

    const { data: miembros, error: miembroError } = await sb
      .from('congregacion_miembros')
      .select('congregacion_id, rol')
      .eq('user_id', userId)

    if (miembroError) {
      return NextResponse.json({ error: `Error al buscar congregación: ${miembroError.message}` }, { status: 500 })
    }

    if (!miembros || miembros.length === 0) {
      return NextResponse.json({ error: `Esta cuenta (${userId}) no está asociada a ninguna congregación` }, { status: 403 })
    }

    // Cuenta admin (vinculada a varias congregaciones): no fijamos congregación,
    // dejamos al usuario elegirla en /seleccionar. Los admins no dependen de la
    // licencia. Detectamos por rol='admin' en cualquiera de sus membresías.
    const esAdmin = miembros.some(m => m.rol === 'admin')

    if (esAdmin || miembros.length > 1) {
      const response = NextResponse.json({ ok: true, seleccionar: true })
      response.cookies.set('user_id', userId, COOKIE_OPTS)
      response.cookies.set('user_role', esAdmin ? 'admin' : 'colaborador', { ...COOKIE_OPTS, httpOnly: false })
      response.cookies.set('sb_access_token', accessToken, COOKIE_OPTS)
      response.cookies.set('sb_refresh_token', refreshToken, COOKIE_OPTS)
      // Limpiar cualquier congregación previa para forzar la selección.
      response.cookies.delete('congregation_id')
      return response
    }

    const miembro = miembros[0]
    const congregacionId = miembro.congregacion_id as string

    // Verificar que la licencia de esta congregación siga activa (RPC SECURITY DEFINER).
    const { data: activa } = await sb.rpc('licencia_activa')
    if (activa === false) {
      return NextResponse.json({ error: 'El acceso a esta congregación fue suspendido. Contactá al administrador.' }, { status: 403 })
    }

    const response = NextResponse.json({ ok: true })
    response.cookies.set('user_id', userId, COOKIE_OPTS)
    response.cookies.set('congregation_id', congregacionId, COOKIE_OPTS)
    response.cookies.set('user_role', (miembro.rol as string) ?? 'colaborador', { ...COOKIE_OPTS, httpOnly: false })
    response.cookies.set('sb_access_token', accessToken, COOKIE_OPTS)
    response.cookies.set('sb_refresh_token', refreshToken, COOKIE_OPTS)
    return response
  } catch (err) {
    return NextResponse.json({ error: `Error interno: ${String(err)}` }, { status: 500 })
  }
}
