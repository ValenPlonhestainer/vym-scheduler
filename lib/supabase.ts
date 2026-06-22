import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!

export const SESSION_COOKIE_OPTS = {
  httpOnly: true,
  secure: false,
  sameSite: 'strict' as const,
  maxAge: 60 * 60 * 24 * 365 * 10,
  path: '/',
}

// Cliente ANÓNIMO (sin sesión de usuario). Para auth (signIn/signUp) y RPCs
// públicas (validar_renovar_licencia). La anon key es pública y respeta RLS.
export function getAnonSupabase(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// Cliente SERVICE ROLE (saltea RLS). EXCLUSIVO del panel admin que corre en
// Vercel server-side. NO se usa en el build de Electron (ahí la env var no
// existe). Nunca debe llamarse desde código que se empaquete en el cliente.
export function getServiceSupabase(): SupabaseClient {
  return createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function jwtExp(jwt: string): number {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString('utf8'))
    return typeof payload.exp === 'number' ? payload.exp : 0
  } catch {
    return 0
  }
}

// Construye un cliente con un access_token explícito (anon key + Bearer JWT).
export function supabaseWithToken(accessToken: string): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
}

// Cliente AUTENTICADO con el JWT del usuario tomado de las cookies de sesión.
// Refresca el access_token si está por vencer y persiste el nuevo en las cookies.
// Usable desde Server Actions y Route Handlers (ambos permiten cookies().set()).
export async function getAuthedSupabase(): Promise<SupabaseClient> {
  const store = cookies()
  let access = store.get('sb_access_token')?.value
  const refresh = store.get('sb_refresh_token')?.value

  if (!access) throw new Error('No hay sesión activa')

  const now = Math.floor(Date.now() / 1000)
  if (refresh && jwtExp(access) - now < 60) {
    const { data, error } = await getAnonSupabase().auth.refreshSession({ refresh_token: refresh })
    if (!error && data.session) {
      access = data.session.access_token
      try {
        store.set('sb_access_token', data.session.access_token, SESSION_COOKIE_OPTS)
        store.set('sb_refresh_token', data.session.refresh_token, SESSION_COOKIE_OPTS)
      } catch {
        /* contexto sin permiso de escritura de cookies: se usa el token refrescado igual */
      }
    }
  }

  return supabaseWithToken(access)
}
