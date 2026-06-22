'use client'

import { useEffect, useState } from 'react'

type UpdateState =
  | { stage: 'idle' }
  | { stage: 'available'; version: string }
  | { stage: 'downloading'; percent: number }
  | { stage: 'ready' }
  | { stage: 'installing' }
  | { stage: 'manual'; version: string }

export function UpdateDialog() {
  const [update, setUpdate] = useState<UpdateState>({ stage: 'idle' })

  useEffect(() => {
    const api = (window as any).electronAPI
    if (!api) return

    api.onUpdateAvailable?.((info: { version: string }) => {
      setUpdate({ stage: 'available', version: info.version })
    })

    api.onDownloadProgress?.((progress: { percent: number }) => {
      setUpdate({ stage: 'downloading', percent: progress.percent })
    })

    api.onUpdateDownloaded?.(() => {
      setUpdate({ stage: 'ready' })
    })

    // Flujo híbrido Win7: aviso de versión nueva, la descarga la hace el navegador.
    api.onManualUpdateAvailable?.((info: { version: string; downloadUrl: string }) => {
      setUpdate({ stage: 'manual', version: info.version })
    })

    // Por si el evento se emitió antes de que montáramos: consultar el estado
    // actual del updater al cargar.
    api.getUpdateStatus?.().then((s: { stage: string; version?: string } | null) => {
      if (!s) return
      setUpdate((prev) => {
        if (prev.stage !== 'idle') return prev
        if (s.stage === 'available' && s.version) return { stage: 'available', version: s.version }
        if (s.stage === 'downloaded') return { stage: 'ready' }
        if (s.stage === 'manual' && s.version) return { stage: 'manual', version: s.version }
        return prev
      })
    }).catch(() => {})
  }, [])

  if (update.stage === 'idle') return null

  function handleConfirm() {
    ;(window as any).electronAPI?.confirmDownload?.()
    setUpdate({ stage: 'downloading', percent: 0 })
  }

  function handleInstall() {
    const api = (window as any).electronAPI
    api?.showUpdateNotification?.()
    setUpdate({ stage: 'installing' })
    setTimeout(() => {
      api?.installUpdate?.()
    }, 2500)
  }

  function handleOpenDownloadPage() {
    ;(window as any).electronAPI?.openDownloadPage?.()
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4">

        {update.stage === 'available' && (
          <>
            <div className="text-3xl mb-4 text-center">🔄</div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1 text-center">
              Actualización disponible
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6 text-center">
              La versión <span className="font-medium text-zinc-700 dark:text-zinc-300">{update.version}</span> está
              disponible. ¿Querés actualizar ahora?
            </p>
            <button
              onClick={handleConfirm}
              className="w-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Actualizar
            </button>
          </>
        )}

        {update.stage === 'manual' && (
          <>
            <div className="text-3xl mb-4 text-center">🔄</div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1 text-center">
              Actualización disponible
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6 text-center">
              La versión <span className="font-medium text-zinc-700 dark:text-zinc-300">{update.version}</span> está
              disponible. Se abrirá la página de descargas en tu navegador para bajar el instalador.
            </p>
            <button
              onClick={handleOpenDownloadPage}
              className="w-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Descargar
            </button>
          </>
        )}

        {update.stage === 'downloading' && (
          <>
            <div className="text-3xl mb-4 text-center">⬇️</div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1 text-center">
              Descargando actualización
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-5 text-center">
              {update.percent}%
            </p>
            <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-zinc-900 dark:bg-zinc-100 rounded-full transition-all duration-300"
                style={{ width: `${update.percent}%` }}
              />
            </div>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-3 text-center">
              No cerrés el programa mientras descarga
            </p>
          </>
        )}

        {update.stage === 'ready' && (
          <>
            <div className="text-3xl mb-4 text-center">✅</div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1 text-center">
              Lista para instalar
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6 text-center">
              La actualización fue descargada. El programa se va a reiniciar para aplicarla.
            </p>
            <button
              onClick={handleInstall}
              className="w-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Instalar y reiniciar
            </button>
          </>
        )}

        {update.stage === 'installing' && (
          <>
            <div className="flex justify-center mb-4">
              <div className="h-8 w-8 rounded-full border-2 border-zinc-300 dark:border-zinc-600 border-t-zinc-900 dark:border-t-zinc-100 animate-spin" />
            </div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1 text-center">
              Instalando actualización
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center">
              El programa se cerrará y se reiniciará automáticamente en unos segundos.
            </p>
          </>
        )}

      </div>
    </div>
  )
}
