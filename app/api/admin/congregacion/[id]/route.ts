import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSupabase } from '@/lib/supabase'

function checkAdmin() {
  const adminAuth = cookies().get('admin_auth')?.value
  return adminAuth === process.env.ADMIN_SECRET
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  if (!checkAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const congId = params.id
  const sb = getSupabase()

  const [{ data: congregacion }, { data: hermanos }, { data: semanas }, { data: semanasFDS }, { data: miembros }] =
    await Promise.all([
      sb.from('congregaciones').select('id, nombre').eq('id', congId).maybeSingle(),
      sb.from('hermanos').select('id, nombre, rol, genero, activo').eq('congregacion_id', congId).order('nombre'),
      sb.from('semanas').select('id, fecha, tema').eq('congregacion_id', congId).order('fecha', { ascending: false }).limit(10),
      sb.from('semanas_fds').select('id, fecha, titulo_articulo').eq('congregacion_id', congId).order('fecha', { ascending: false }).limit(10),
      sb.from('congregacion_miembros').select('nombre, rol, created_at').eq('congregacion_id', congId).order('created_at'),
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
