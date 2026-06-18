import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabase } from '@/lib/supabase'

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 60 * 60 * 24 * 365 * 10,
  path: '/',
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const token = (body.token ?? '').trim()

  if (!token) {
    return NextResponse.json({ error: 'Token requerido' }, { status: 400 })
  }

  const { data: tokenData, error } = await supabase
    .from('tokens')
    .select('id, active')
    .eq('token', token)
    .maybeSingle()

  if (error || !tokenData || !tokenData.active) {
    return NextResponse.json(
      { error: 'Token inválido o inactivo. Verifique la clave e intente nuevamente.' },
      { status: 401 }
    )
  }

  const { data: congData } = await supabase
    .from('congregations')
    .select('id')
    .eq('token_id', tokenData.id)
    .maybeSingle()

  if (!congData) {
    return NextResponse.json(
      { error: 'Configuración de congregación no encontrada.' },
      { status: 500 }
    )
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set('congregation_token', token, COOKIE_OPTS)
  response.cookies.set('congregation_id', congData.id, COOKIE_OPTS)
  return response
}
