// app/api/recordatorios-auto/route.ts
// Ruta que usa el BOT (Railway) como "alarma": el bot la llama el día anterior a
// cada reunión y ésta le devuelve la lista de mensajes a enviar, ya armados, para
// la congregación configurada (Carpintería). El bot después los manda por WhatsApp.
// Usa el cliente de servicio (sin sesión de usuario) porque la dispara el bot.
import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'
import { armarMensajesRecordatorio } from '@/lib/recordatorios-core'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
}

// "HOY" en zona horaria de Argentina, como "YYYY-MM-DD".
function hoyArgentina(): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const val = (t: string) => partes.find(p => p.type === t)?.value ?? ''
  return `${val('year')}-${val('month')}-${val('day')}`
}

export async function POST(req: NextRequest) {
  try {
    const secretEsperado = process.env.BOT_RECORDATORIOS_SECRET
    if (!secretEsperado) {
      return NextResponse.json({ ok: false, error: 'Falta BOT_RECORDATORIOS_SECRET en el servidor' }, { status: 500 })
    }

    let body: { secret?: string; tipo?: string } = {}
    try { body = await req.json() } catch { /* body vacío */ }

    if (!body.secret || body.secret !== secretEsperado) {
      return NextResponse.json({ ok: false, error: 'Clave secreta incorrecta' }, { status: 401 })
    }

    const tipo = body.tipo === 'fds' ? 'fds' : 'semana'
    const scope = tipo === 'fds' ? 'solo-fds' : 'solo-semana'

    // Congregación habilitada (por nombre configurable; por defecto Carpinteria).
    const objetivo = normalizar(process.env.RECORDATORIOS_CONGREGACION ?? 'Carpinteria')

    let sb
    try {
      sb = getServiceSupabase()
    } catch {
      return NextResponse.json({ ok: false, error: 'El servidor no tiene configurado el acceso de servicio (SUPABASE_SERVICE_ROLE_KEY)' }, { status: 500 })
    }

    const { data: congs, error: errCong } = await sb.from('congregaciones').select('id, nombre')
    if (errCong) {
      return NextResponse.json({ ok: false, error: errCong.message }, { status: 500 })
    }
    const cong = (congs ?? []).find(c => {
      const n = normalizar((c.nombre as string) ?? '')
      return n === objetivo || n.includes(objetivo)
    })
    if (!cong) {
      return NextResponse.json({ ok: false, error: `No se encontró la congregación "${objetivo}"` }, { status: 404 })
    }

    const { mensajes, sinTelefono, totalConParte } =
      await armarMensajesRecordatorio(sb, cong.id as string, hoyArgentina(), scope)

    return NextResponse.json({
      ok: true,
      tipo,
      congregacion: cong.nombre,
      total: totalConParte,
      sinTelefono,
      mensajes,
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
