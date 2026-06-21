import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'
import { getSupabase } from '@/lib/supabase'

function getCongId(): string {
  const id = cookies().get('congregation_id')?.value
  if (!id) throw new Error('No congregation_id cookie')
  return id
}

function getUserRole(): string {
  return cookies().get('user_role')?.value ?? 'colaborador'
}

// GET — listar invitaciones activas de la congregación
export async function GET() {
  try {
    const congId = getCongId()
    const sb = getSupabase()
    const { data, error } = await sb
      .from('invitaciones')
      .select('id, codigo, usado, created_at')
      .eq('congregacion_id', congId)
      .eq('usado', false)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return NextResponse.json({ invitaciones: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// POST — crear nueva invitación
export async function POST() {
  try {
    if (getUserRole() !== 'owner') {
      return NextResponse.json({ error: 'Solo el organizador puede generar códigos de invitación' }, { status: 403 })
    }
    const congId = getCongId()
    const sb = getSupabase()
    const codigo = randomBytes(4).toString('hex').toUpperCase()
    const { data, error } = await sb
      .from('invitaciones')
      .insert({ congregacion_id: congId, codigo })
      .select('codigo')
      .single()
    if (error) throw new Error(error.message)
    return NextResponse.json({ codigo: data.codigo })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// DELETE — eliminar invitación por id
export async function DELETE(request: NextRequest) {
  try {
    const congId = getCongId()
    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
    const sb = getSupabase()
    await sb.from('invitaciones').delete().eq('id', id).eq('congregacion_id', congId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
