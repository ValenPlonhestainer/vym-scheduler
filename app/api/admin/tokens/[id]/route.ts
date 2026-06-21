import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSupabase } from '@/lib/supabase'

function checkAdmin() {
  const adminAuth = cookies().get('admin_auth')?.value
  return adminAuth === process.env.ADMIN_SECRET
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!checkAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = getSupabase()

  const body = await request.json().catch(() => ({}))
  const { active, congregation_name, license_duration_days } = body

  if (typeof active === 'boolean') {
    const { error } = await supabase.from('tokens').update({ active }).eq('id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (!active) {
      // Sincronizar nombre en congregations si se pasa
    }
    return NextResponse.json({ ok: true })
  }

  if (typeof congregation_name === 'string' && congregation_name.trim()) {
    const name = congregation_name.trim()
    const { error: te } = await supabase.from('tokens').update({ congregation_name: name }).eq('id', params.id)
    if (te) return NextResponse.json({ error: te.message }, { status: 500 })
    // Actualizar también en congregations
    const { error: ce } = await supabase.from('congregations').update({ name }).eq('token_id', params.id)
    if (ce) return NextResponse.json({ error: ce.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (typeof license_duration_days === 'number' && license_duration_days >= 0) {
    const { error } = await supabase
      .from('tokens')
      .update({ license_duration_days })
      .eq('id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Parámetro inválido' }, { status: 400 })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  if (!checkAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = getSupabase()
  const { error } = await supabase.from('tokens').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
