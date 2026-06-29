import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServiceSupabase } from '@/lib/supabase'

function checkAdmin() {
  return cookies().get('admin_auth')?.value === process.env.ADMIN_SECRET
}

// POST — re-vincula una cuenta admin existente a TODAS las congregaciones.
// Útil como botón de seguridad; las congregaciones nuevas ya se enganchan solas
// por trigger, pero esto reconcilia cualquier hueco.
export async function POST(request: NextRequest) {
  if (!checkAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const userId = (body.user_id as string) ?? ''
  if (!userId) return NextResponse.json({ error: 'Falta user_id' }, { status: 400 })

  const sb = getServiceSupabase()
  const { data, error } = await sb.rpc('vincular_admin_a_todas', {
    p_user_id: userId,
    p_nombre: 'Administrador',
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, vinculadasAhora: data ?? 0 })
}
