'use client'

import { useEffect, useRef, useState } from 'react'

const LOCAL_STORAGE_KEYS = [
  'vym_prog_semana',
  'vym_prog_asigs',
  'vym_prog_fds',
  'vym_prog_asigsfds',
  'vym_prog_tipo',
  'vym_prog_salaaux',
]

const CHECK_INTERVAL = 10_000

function shouldSkipCheck(): boolean {
  if (typeof window === 'undefined') return true
  const p = window.location.pathname
  return p === '/' || p === '/registro' || p === '/seleccionar' || p.startsWith('/admin')
}

export function SessionGuard() {
  const [blocked, setBlocked] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const blockedRef = useRef(false)

  async function checkSession() {
    if (shouldSkipCheck() || blockedRef.current) return
    try {
      // URL relativa: mismo origen que la página (localhost:3721), así las
      // cookies de sesión (httpOnly, sameSite=strict) viajan. Con la URL
      // absoluta a 127.0.0.1 era cross-origin y las cookies no se enviaban.
      const res = await fetch('/api/check-sesion', {
        credentials: 'include',
        cache: 'no-store',
      })
      if (!res.ok) return
      const data = await res.json()
      if (data.active === false) {
        blockedRef.current = true
        setBlocked(true)
        if (intervalRef.current) clearInterval(intervalRef.current)
      }
    } catch {
      // Ignorar errores de red
    }
  }

  useEffect(() => {
    checkSession()
    intervalRef.current = setInterval(checkSession, CHECK_INTERVAL)

    // Chequeo extra al recuperar el foco / volver a la pestaña: si el admin
    // desactivó el token mientras la app estaba en segundo plano, lo detecta
    // apenas el usuario vuelve, sin esperar al próximo tick del intervalo.
    const onFocus = () => checkSession()
    const onVisible = () => { if (document.visibilityState === 'visible') checkSession() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  function handleLogout() {
    LOCAL_STORAGE_KEYS.forEach((k) => localStorage.removeItem(k))
    window.location.href = '/api/auth/logout'
  }

  if (!blocked) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
        <div className="text-4xl mb-4">🔒</div>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
          Acceso suspendido
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
          El administrador desactivó el acceso de esta congregación. Contactá al
          administrador si creés que es un error.
        </p>
        <button
          onClick={handleLogout}
          className="w-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
