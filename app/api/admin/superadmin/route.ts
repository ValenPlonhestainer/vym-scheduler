import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServiceSupabase } from '@/lib/supabase'

function checkAdmin() {
  const adminAuth = cookies().get('admin_auth')?.value
  return adminAuth === process.env.ADMIN_SECRET
}

// GET — lista de cuentas admin globales (email + cuántas congregaciones tienen).
export async function GET() {
  if (!checkAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const sb = getServiceSupabase()
  const { data: admins, error } = await sb.from('app_admins').select('user_id, created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { count: totalCongs } = await sb
    .from('congregaciones')
    .select('id', { count: 'exact', head: true })

  const { data: usersData } = await sb.auth.admin.listUsers({ perPage: 1000 })
  const emailById = new Map((usersData?.users ?? []).map(u => [u.id, u.email ?? '']))

  const cuentas = await Promise.all((admins ?? []).map(async a => {
    const { count } = await sb
      .from('congregacion_miembros')
      .select('congregacion_id', { count: 'exact', head: true })
      .eq('user_id', a.user_id)
    return {
      user_id: a.user_id,
      email: emailById.get(a.user_id) ?? '(cuenta eliminada)',
      congregaciones: count ?? 0,
      created_at: a.created_at,
    }
  }))

  return NextResponse.json({ cuentas, totalCongregaciones: totalCongs ?? 0 })
}

// POST — crea (o reusa) la cuenta admin y la vincula a TODAS las congregaciones.
export async function POST(request: NextRequest) {
  if (!checkAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const email = ((body.email as string) ?? '').trim().toLowerCase()
  const password = (body.password as string) ?? ''
  const nombre = ((body.nombre as string) ?? 'Administrador').trim() || 'Administrador'

  if (!email || password.length < 6) {
    return NextResponse.json({ error: 'Correo y contraseña (mín. 6 caracteres) requeridos' }, { status: 400 })
  }

  const sb = getServiceSupabase()

  // Crear el usuario de auth (confirmado). Si ya existe, lo reusamos.
  let userId: string | null = null
  const { data: created, error: createErr } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre },
  })

  if (created?.user) {
    userId = created.user.id
  } else if (createErr) {
    // Probablemente ya existe: lo buscamos por email.
    const { data: usersData } = await sb.auth.admin.listUsers({ perPage: 1000 })
    const existing = (usersData?.users ?? []).find(u => (u.email ?? '').toLowerCase() === email)
    if (!existing) {
      return NextResponse.json({ error: `No se pudo crear la cuenta: ${createErr.message}` }, { status: 400 })
    }
    userId = existing.id
    // Actualizar la contraseña a la indicada (así siempre sabés la clave).
    await sb.auth.admin.updateUserById(userId, { password })
  }

  if (!userId) return NextResponse.json({ error: 'No se pudo determinar el usuario' }, { status: 500 })

  // Marcar como admin global.
  const { error: insErr } = await sb
    .from('app_admins')
    .upsert({ user_id: userId }, { onConflict: 'user_id' })
  if (insErr) return NextResponse.json({ error: `No se pudo marcar como admin: ${insErr.message}` }, { status: 500 })

  // Vincular a todas las congregaciones existentes.
  const { data: vinculadas, error: rpcErr } = await sb.rpc('vincular_admin_a_todas', {
    p_user_id: userId,
    p_nombre: nombre,
  })
  if (rpcErr) return NextResponse.json({ error: `No se pudo vincular: ${rpcErr.message}` }, { status: 500 })

  return NextResponse.json({ ok: true, vinculadasAhora: vinculadas ?? 0 })
}

// DELETE — quita privilegios admin (?userId=...): borra de app_admins y sus
// membresías rol='admin'. NO borra la cuenta de auth ni datos de congregaciones.
export async function DELETE(request: NextRequest) {
  if (!checkAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const userId = request.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'Falta userId' }, { status: 400 })

  const sb = getServiceSupabase()
  await sb.from('congregacion_miembros').delete().eq('user_id', userId).eq('rol', 'admin')
  await sb.from('app_admins').delete().eq('user_id', userId)
  return NextResponse.json({ ok: true })
}
