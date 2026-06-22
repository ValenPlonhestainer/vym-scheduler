import { NextRequest, NextResponse } from 'next/server'
import { getAnonSupabase, supabaseWithToken, SESSION_COOKIE_OPTS } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'

const COOKIE_OPTS = SESSION_COOKIE_OPTS

// Mapea los errores que levantan las RPCs registrar_owner / registrar_colaborador.
function mensajeErrorRpc(raw: string): string {
  if (raw.includes('token_no_encontrado')) return 'Token de licencia no encontrado'
  if (raw.includes('token_inactivo')) return 'Este token ha sido desactivado'
  if (raw.includes('token_ya_registrado')) return 'Este token ya tiene una cuenta registrada. Iniciá sesión en cambio.'
  if (raw.includes('invitacion_invalida')) return 'Código de invitación no válido'
  if (raw.includes('invitacion_usada')) return 'Este código de invitación ya fue utilizado'
  if (raw.includes('no_autenticado')) return 'No se pudo crear la sesión. Intentá de nuevo.'
  return `Error al registrar: ${raw}`
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

    const anon = getAnonSupabase()

    // Crear el usuario de auth (autoconfirm ON ⇒ devuelve sesión al instante).
    let session: Session | null = null
    const { data: signUpData, error: signUpError } = await anon.auth.signUp({
      email,
      password,
      options: { data: { nombre } },
    })

    if (signUpError) {
      const msg = signUpError.message.toLowerCase()
      if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
        // El correo ya existe. Puede ser un registro previo que quedó a medias
        // (usuario creado pero sin congregación). Reintentamos completándolo.
        const { data: signInData, error: signInError } =
          await anon.auth.signInWithPassword({ email, password })
        if (signInError || !signInData.session) {
          return NextResponse.json({ error: 'Ya existe una cuenta con ese correo' }, { status: 400 })
        }
        // ¿Ya tiene congregación? entonces es una cuenta completa: que inicie sesión.
        const sbCheck = supabaseWithToken(signInData.session.access_token)
        const { data: yaMiembro } = await sbCheck
          .from('congregacion_miembros')
          .select('congregacion_id')
          .eq('user_id', signInData.user.id)
          .maybeSingle()
        if (yaMiembro) {
          return NextResponse.json({ error: 'Ya existe una cuenta con ese correo. Iniciá sesión.' }, { status: 400 })
        }
        session = signInData.session
      } else {
        throw new Error(signUpError.message)
      }
    } else {
      session = signUpData.session
    }

    if (!session) {
      return NextResponse.json({ error: 'No se pudo crear la sesión. Revisá la configuración de email.' }, { status: 500 })
    }

    const sb = supabaseWithToken(session.access_token)
    const rpcName = modo === 'owner' ? 'registrar_owner' : 'registrar_colaborador'
    const { data: congId, error: rpcError } = await sb.rpc(rpcName, { p_codigo: codigo, p_nombre: nombre })

    if (rpcError || !congId) {
      return NextResponse.json({ error: mensajeErrorRpc(rpcError?.message ?? 'desconocido') }, { status: 400 })
    }

    const rol = modo === 'owner' ? 'owner' : 'colaborador'
    const response = NextResponse.json({ ok: true })
    response.cookies.set('user_id', session.user.id, COOKIE_OPTS)
    response.cookies.set('congregation_id', congId as string, COOKIE_OPTS)
    response.cookies.set('user_role', rol, { ...COOKIE_OPTS, httpOnly: false })
    response.cookies.set('sb_access_token', session.access_token, COOKIE_OPTS)
    response.cookies.set('sb_refresh_token', session.refresh_token, COOKIE_OPTS)
    return response
  } catch (err) {
    return NextResponse.json({ error: `Error interno: ${String(err)}` }, { status: 500 })
  }
}
