import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

const COOKIE_OPTS = {
  httpOnly: true,
  secure: false,
  sameSite: 'strict' as const,
  maxAge: 60 * 60 * 24 * 365 * 10,
  path: '/',
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = ((body.email as string) ?? '').trim().toLowerCase()
    const password = (body.password as string) ?? ''

    if (!email || !password) {
      return NextResponse.json({ error: 'Correo y contraseña requeridos' }, { status: 400 })
    }

    const sb = getSupabase()
    const { data: authData, error: authError } = await sb.auth.signInWithPassword({ email, password })

    if (authError || !authData.user) {
      return NextResponse.json({ error: 'Correo o contraseña incorrectos' }, { status: 401 })
    }

    const userId = authData.user.id

    const { data: miembro } = await sb
      .from('congregacion_miembros')
      .select('congregacion_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (!miembro) {
      return NextResponse.json({ error: 'Esta cuenta no está asociada a ninguna congregación' }, { status: 403 })
    }

    const congregacionId = miembro.congregacion_id as string

    // Verificar que el token de licencia de esta congregación siga activo
    const { data: tokenRow } = await sb
      .from('tokens')
      .select('active')
      .eq('congregacion_id', congregacionId)
      .maybeSingle()

    if (tokenRow && !tokenRow.active) {
      return NextResponse.json({ error: 'El acceso a esta congregación fue suspendido. Contactá al administrador.' }, { status: 403 })
    }

    const response = NextResponse.json({ ok: true })
    response.cookies.set('user_id', userId, COOKIE_OPTS)
    response.cookies.set('congregation_id', congregacionId, COOKIE_OPTS)
    return response
  } catch (err) {
    return NextResponse.json({ error: `Error interno: ${String(err)}` }, { status: 500 })
  }
}
