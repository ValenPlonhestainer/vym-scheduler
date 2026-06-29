import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getAuthedSupabase, SESSION_COOKIE_OPTS } from '@/lib/supabase'

// GET — congregaciones a las que pertenece el usuario logueado (para el selector).
export async function GET() {
  try {
    const userId = cookies().get('user_id')?.value
    if (!userId) return NextResponse.json({ error: 'No hay sesión activa' }, { status: 401 })

    const sb = await getAuthedSupabase()
    const { data: miembros, error } = await sb
      .from('congregacion_miembros')
      .select('congregacion_id, rol')
      .eq('user_id', userId)
    if (error) throw new Error(error.message)

    const ids = (miembros ?? []).map(m => m.congregacion_id)
    if (ids.length === 0) return NextResponse.json({ congregaciones: [] })

    const { data: congs } = await sb
      .from('congregaciones')
      .select('id, nombre')
      .in('id', ids)
      .order('nombre')

    return NextResponse.json({ congregaciones: congs ?? [] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// POST — fija la congregación activa en las cookies, validando que el usuario sea
// miembro (la RLS solo deja leer su propia membresía).
export async function POST(request: NextRequest) {
  try {
    const userId = cookies().get('user_id')?.value
    if (!userId) return NextResponse.json({ error: 'No hay sesión activa' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const congId = (body.congregacion_id as string) ?? ''
    if (!congId) return NextResponse.json({ error: 'Falta congregacion_id' }, { status: 400 })

    const sb = await getAuthedSupabase()
    const { data: miembro, error } = await sb
      .from('congregacion_miembros')
      .select('rol')
      .eq('user_id', userId)
      .eq('congregacion_id', congId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!miembro) {
      return NextResponse.json({ error: 'No pertenecés a esa congregación' }, { status: 403 })
    }

    const response = NextResponse.json({ ok: true })
    response.cookies.set('congregation_id', congId, SESSION_COOKIE_OPTS)
    response.cookies.set('user_role', (miembro.rol as string) ?? 'colaborador', { ...SESSION_COOKIE_OPTS, httpOnly: false })
    return response
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
