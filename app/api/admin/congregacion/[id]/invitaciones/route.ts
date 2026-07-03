import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'
import { getServiceSupabase } from '@/lib/supabase'

function checkAdmin() {
  const adminAuth = cookies().get('admin_auth')?.value
  return adminAuth === process.env.ADMIN_SECRET
}

// GET — listar códigos de colaborador sin usar de la congregación
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  if (!checkAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const sb = getServiceSupabase()
  const { data, error } = await sb
    .from('invitaciones')
    .select('id, codigo, usado, created_at')
    .eq('congregacion_id', params.id)
    .eq('usado', false)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ invitaciones: data ?? [] })
}

// POST — generar un nuevo código de colaborador para la congregación
export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  if (!checkAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const sb = getServiceSupabase()
  const codigo = randomBytes(4).toString('hex').toUpperCase()
  const { data, error } = await sb
    .from('invitaciones')
    .insert({ congregacion_id: params.id, codigo })
    .select('id, codigo, usado, created_at')
    .single()

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Error al generar código' }, { status: 500 })
  return NextResponse.json({ invitacion: data })
}

// DELETE — eliminar un código por id (?codigoId=)
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!checkAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const codigoId = req.nextUrl.searchParams.get('codigoId')
  if (!codigoId) return NextResponse.json({ error: 'Falta codigoId' }, { status: 400 })

  const sb = getServiceSupabase()
  const { error } = await sb
    .from('invitaciones')
    .delete()
    .eq('id', codigoId)
    .eq('congregacion_id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
