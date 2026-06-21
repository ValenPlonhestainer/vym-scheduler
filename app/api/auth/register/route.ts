import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { getSupabase } from '@/lib/supabase'

const COOKIE_OPTS = {
  httpOnly: true,
  secure: false,
  sameSite: 'strict' as const,
  maxAge: 60 * 60 * 24 * 365 * 10,
  path: '/',
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const nombre = ((body.nombre as string) ?? '').trim()
    const email = ((body.email as string) ?? '').trim().toLowerCase()
    const password = (body.password as string) ?? ''
    const modo: 'owner' | 'colaborador' = body.modo ?? 'owner'
    const codigo = ((body.codigo as string) ?? '').trim()

    if (!nombre || !email || !password || !codigo) {
      return NextResponse.json({ error: 'Todos los campos son requeridos' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
    }

    const sb = getSupabase()

    if (modo === 'owner') {
      // Validar token de licencia
      const { data: tokenRow } = await sb
        .from('tokens')
        .select('active, congregation_name, congregacion_id')
        .eq('token', codigo)
        .maybeSingle()

      if (!tokenRow) {
        return NextResponse.json({ error: 'Token de licencia no encontrado' }, { status: 400 })
      }
      if (!tokenRow.active) {
        return NextResponse.json({ error: 'Este token ha sido desactivado' }, { status: 400 })
      }

      let congregacionId: string = tokenRow.congregacion_id as string

      if (!congregacionId) {
        // Primera vez que se usa este token: crear la congregación
        const { data: cong, error: congError } = await sb
          .from('congregaciones')
          .insert({ nombre: tokenRow.congregation_name as string ?? nombre })
          .select('id')
          .single()
        if (congError) throw new Error(congError.message)
        congregacionId = cong.id as string

        // Vincular token a esta congregación
        await sb.from('tokens').update({ congregacion_id: congregacionId }).eq('token', codigo)
      } else {
        // Token ya tiene congregación — verificar que no tenga owner
        const { data: ownerExistente } = await sb
          .from('congregacion_miembros')
          .select('id')
          .eq('congregacion_id', congregacionId)
          .eq('rol', 'owner')
          .maybeSingle()
        if (ownerExistente) {
          return NextResponse.json({ error: 'Este token ya tiene una cuenta registrada. Iniciá sesión en cambio.' }, { status: 400 })
        }
      }

      // Crear usuario en Supabase Auth
      const { data: userData, error: userError } = await sb.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nombre },
      })
      if (userError) {
        if (userError.message.includes('already')) {
          return NextResponse.json({ error: 'Ya existe una cuenta con ese correo' }, { status: 400 })
        }
        throw new Error(userError.message)
      }

      const userId = userData.user.id

      // Vincular usuario como owner
      const { error: miembroError } = await sb.from('congregacion_miembros').insert({
        user_id: userId,
        congregacion_id: congregacionId,
        rol: 'owner',
        nombre,
      })
      if (miembroError) {
        await sb.auth.admin.deleteUser(userId)
        throw new Error(`Error al vincular usuario: ${miembroError.message}`)
      }

      const response = NextResponse.json({ ok: true })
      response.cookies.set('user_id', userId, COOKIE_OPTS)
      response.cookies.set('congregation_id', congregacionId, COOKIE_OPTS)
      response.cookies.set('user_role', 'owner', { ...COOKIE_OPTS, httpOnly: false })
      return response

    } else {
      // modo colaborador — validar código de invitación
      const { data: invitacion } = await sb
        .from('invitaciones')
        .select('congregacion_id, usado')
        .eq('codigo', codigo.toUpperCase())
        .maybeSingle()

      if (!invitacion) {
        return NextResponse.json({ error: 'Código de invitación no válido' }, { status: 400 })
      }
      if (invitacion.usado) {
        return NextResponse.json({ error: 'Este código de invitación ya fue utilizado' }, { status: 400 })
      }

      const congregacionId = invitacion.congregacion_id as string

      // Crear usuario
      const { data: userData, error: userError } = await sb.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nombre },
      })
      if (userError) {
        if (userError.message.includes('already')) {
          return NextResponse.json({ error: 'Ya existe una cuenta con ese correo' }, { status: 400 })
        }
        throw new Error(userError.message)
      }

      const userId = userData.user.id

      // Vincular como colaborador
      const { error: miembroErrorCol } = await sb.from('congregacion_miembros').insert({
        user_id: userId,
        congregacion_id: congregacionId,
        rol: 'colaborador',
        nombre,
      })
      if (miembroErrorCol) {
        await sb.auth.admin.deleteUser(userId)
        throw new Error(`Error al vincular usuario: ${miembroErrorCol.message}`)
      }

      // Marcar invitación como usada
      await sb.from('invitaciones').update({ usado: true }).eq('codigo', codigo.toUpperCase())

      const response = NextResponse.json({ ok: true })
      response.cookies.set('user_id', userId, COOKIE_OPTS)
      response.cookies.set('congregation_id', congregacionId, COOKIE_OPTS)
      response.cookies.set('user_role', 'colaborador', { ...COOKIE_OPTS, httpOnly: false })
      return response
    }
  } catch (err) {
    return NextResponse.json({ error: `Error interno: ${String(err)}` }, { status: 500 })
  }
}
