import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServiceSupabase } from '@/lib/supabase'

function checkAdmin() {
  const adminAuth = cookies().get('admin_auth')?.value
  return adminAuth === process.env.ADMIN_SECRET
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!checkAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = getServiceSupabase()

  const body = await request.json().catch(() => ({}))
  const { active, congregation_name } = body

  if (typeof active === 'boolean') {
    const { error } = await supabase.from('tokens').update({ active }).eq('id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (typeof congregation_name === 'string' && congregation_name.trim()) {
    const name = congregation_name.trim()
    const { error: te } = await supabase.from('tokens').update({ congregation_name: name }).eq('id', params.id)
    if (te) return NextResponse.json({ error: te.message }, { status: 500 })
    const { error: ce } = await supabase.from('congregations').update({ name }).eq('token_id', params.id)
    if (ce) return NextResponse.json({ error: ce.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Parámetro inválido' }, { status: 400 })
}

// Borra la congregación COMPLETA: el token, la congregación y todos sus datos
// (hermanos, semanas, asignaciones, invitaciones, sugerencias) y las cuentas de
// login de organizador/colaboradores. NO borra la cuenta admin (solo le quita el
// vínculo a esta congregación, que de todos modos deja de existir).
export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  if (!checkAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = getServiceSupabase()

  // ¿Qué congregación cuelga de este token? (puede no haber, si nadie se registró)
  const { data: tok } = await supabase
    .from('tokens')
    .select('congregacion_id')
    .eq('id', params.id)
    .maybeSingle()
  const congId = (tok?.congregacion_id as string | null) ?? null

  if (congId) {
    // Miembros de la congregación. Las cuentas admin (app_admins) NO se borran.
    const { data: miembros } = await supabase
      .from('congregacion_miembros')
      .select('user_id')
      .eq('congregacion_id', congId)
    const { data: adminsData } = await supabase.from('app_admins').select('user_id')
    const adminIds = new Set((adminsData ?? []).map(a => a.user_id as string))
    const cuentasABorrar = (miembros ?? [])
      .map(m => m.user_id as string)
      .filter(uid => !adminIds.has(uid))

    // Datos de la congregación (hijos antes que padres por las FKs).
    await supabase.from('asignaciones_fds').delete().eq('congregation_id', congId)
    await supabase.from('asignaciones').delete().eq('congregation_id', congId)
    await supabase.from('semanas_fds').delete().eq('congregation_id', congId)
    await supabase.from('semanas').delete().eq('congregation_id', congId)
    await supabase.from('hermanos').delete().eq('congregation_id', congId)
    await supabase.from('sugerencias').delete().eq('congregation_id', congId)
    await supabase.from('invitaciones').delete().eq('congregacion_id', congId)
    await supabase.from('congregacion_miembros').delete().eq('congregacion_id', congId)

    // El token referencia a la congregación: hay que borrarlo antes que ella.
    await supabase.from('congregations').delete().eq('token_id', params.id)
    const { error: delTok } = await supabase.from('tokens').delete().eq('id', params.id)
    if (delTok) return NextResponse.json({ error: delTok.message }, { status: 500 })

    const { error: delCong } = await supabase.from('congregaciones').delete().eq('id', congId)
    if (delCong) return NextResponse.json({ error: delCong.message }, { status: 500 })

    // Borrar las cuentas de login de organizador/colaboradores (no admin).
    for (const uid of cuentasABorrar) {
      await supabase.auth.admin.deleteUser(uid).catch(() => {})
    }

    return NextResponse.json({ ok: true })
  }

  // Token sin congregación: solo se borra el token (y su fila legacy si hubiera).
  await supabase.from('congregations').delete().eq('token_id', params.id)
  const { error } = await supabase.from('tokens').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
