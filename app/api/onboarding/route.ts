import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getAuthedSupabase } from '@/lib/supabase'

// GET → ¿el usuario ya vio el tutorial de bienvenida?
// Fail-safe: ante cualquier error devolvemos { visto: true } para NO mostrar el
// tutorial de forma insistente si hay un problema transitorio de red/DB.
export async function GET() {
  try {
    const userId = cookies().get('user_id')?.value
    if (!userId) return NextResponse.json({ visto: true })

    const sb = await getAuthedSupabase()
    const { data, error } = await sb
      .from('congregacion_miembros')
      .select('onboarding_visto')
      .eq('user_id', userId)

    if (error) return NextResponse.json({ visto: true })

    // Sin membresías (no debería pasar en /inicio) ⇒ no mostrar.
    // Si CUALQUIER membresía ya lo tiene visto ⇒ no mostrar.
    const visto = !data || data.length === 0 || data.some(r => r.onboarding_visto === true)
    return NextResponse.json({ visto })
  } catch {
    return NextResponse.json({ visto: true })
  }
}

// POST → marcar el tutorial como visto para el usuario logueado.
export async function POST() {
  try {
    const sb = await getAuthedSupabase()
    const { error } = await sb.rpc('marcar_onboarding_visto')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
