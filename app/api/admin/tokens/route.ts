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
  const { data } = await supabase
    .from('tokens')
    .select('id, token, congregation_name, active, created_at, congregacion_id')
    .order('created_at', { ascending: false })

  return NextResponse.json({ tokens: data ?? [] })
}

export async function POST(request: NextRequest) {
  if (!checkAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = getServiceSupabase()
  const body = await request.json().catch(() => ({}))
  const { congregation_name, token } = body

  if (!congregation_name?.trim() || !token?.trim()) {
    return NextResponse.json({ error: 'congregation_name y token son requeridos' }, { status: 400 })
  }

  const { data: tokenData, error: tokenError } = await supabase
    .from('tokens')
    .insert({
      token: token.trim(),
      congregation_name: congregation_name.trim(),
      active: true,
    })
    .select('id')
    .single()

  if (tokenError || !tokenData) {
    return NextResponse.json({ error: tokenError?.message ?? 'Error al crear token' }, { status: 500 })
  }

  const { error: congError } = await supabase
    .from('congregations')
    .insert({ token_id: tokenData.id, name: congregation_name.trim() })

  if (congError) {
    await supabase.from('tokens').delete().eq('id', tokenData.id)
    return NextResponse.json({ error: congError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
