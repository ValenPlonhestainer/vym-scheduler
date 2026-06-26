import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServiceSupabase } from '@/lib/supabase'

function checkAdmin() {
  const adminAuth = cookies().get('admin_auth')?.value
  return adminAuth === process.env.ADMIN_SECRET
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  if (!checkAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const congId = params.id
  const sb = getServiceSupabase()

  const [{ data: congregacion }, { data: hermanos }, { data: semanas }, { data: semanasFDS }, { data: miembros }] =
    await Promise.all([
      sb.from('congregaciones').select('id, nombre').eq('id', congId).maybeSingle(),
      sb.from('hermanos').select('id, nombre, rol, genero, activo').eq('congregation_id', congId).order('nombre'),
      sb.from('semanas').select('id, fecha, tema').eq('congregation_id', congId).order('fecha', { ascending: false }).limit(10),
      sb.from('semanas_fds').select('id, fecha, titulo_articulo').eq('congregation_id', congId).order('fecha', { ascending: false }).limit(10),
      sb.from('congregacion_miembros').select('user_id, nombre, rol, created_at').eq('congregacion_id', congId).order('created_at'),
    ])

  if (!congregacion) return NextResponse.json({ error: 'Congregación no encontrada' }, { status: 404 })

  return NextResponse.json({
    congregacion,
    hermanos: hermanos ?? [],
    semanas: semanas ?? [],
    semanasFDS: semanasFDS ?? [],
    miembros: miembros ?? [],
  })
}

// Borra un miembro (organizador o colaborador) de la congregación SIN borrar la
// congregación ni sus hermanos. Quita el vínculo en congregacion_miembros y la
// cuenta de auth de Supabase. El ?userId apunta al miembro a eliminar.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!checkAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const congId = params.id
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'Falta userId' }, { status: 400 })

  const sb = getServiceSupabase()

  const { error: delMiembroError } = await sb
    .from('congregacion_miembros')
    .delete()
    .eq('congregacion_id', congId)
    .eq('user_id', userId)

  if (delMiembroError) {
    return NextResponse.json({ error: `Error al quitar el vínculo: ${delMiembroError.message}` }, { status: 500 })
  }

  // Borrar la cuenta de auth (email/contraseña). Si falla, el vínculo ya se quitó
  // igual: la persona queda sin acceso, así que no revertimos.
  const { error: delUserError } = await sb.auth.admin.deleteUser(userId)
  if (delUserError) {
    return NextResponse.json({
      ok: true,
      warning: `Vínculo eliminado, pero no se pudo borrar la cuenta de auth: ${delUserError.message}`,
    })
  }

  return NextResponse.json({ ok: true })
}
