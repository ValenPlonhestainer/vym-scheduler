import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServiceSupabase } from '@/lib/supabase'

function checkAdmin() {
  const adminAuth = cookies().get('admin_auth')?.value
  return adminAuth === process.env.ADMIN_SECRET
}

export async function GET() {
  if (!checkAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = getServiceSupabase()
  const { data, error } = await supabase
    .from('sugerencias')
    .select('id, texto, created_at, congregaciones(nombre)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const sugerencias = (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    texto: r.texto as string,
    created_at: r.created_at as string,
    congregacion: ((r.congregaciones as { nombre?: string } | null)?.nombre) ?? '—',
  }))
  return NextResponse.json({ sugerencias })
}

// Descartar (eliminar) una sugerencia ya atendida.
export async function DELETE(request: NextRequest) {
  if (!checkAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
  const supabase = getServiceSupabase()
  const { error } = await supabase.from('sugerencias').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
