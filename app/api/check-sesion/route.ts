import { NextResponse } from 'next/server'
import { getAuthedSupabase } from '@/lib/supabase'

export async function GET() {
  try {
    const sb = await getAuthedSupabase()
    const { data: activa, error } = await sb.rpc('licencia_activa')
    if (error) {
      // Ante un error transitorio no bloqueamos al usuario (igual que antes).
      return NextResponse.json({ active: true }, { status: 200 })
    }
    return NextResponse.json({ active: activa !== false })
  } catch {
    return NextResponse.json({ active: false }, { status: 401 })
  }
}
