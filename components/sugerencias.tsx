"use client"

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { HelpCircle, X, Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { saveSugerencia } from '@/lib/actions'

export function Sugerencias() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const { toast } = useToast()

  // Solo en páginas internas (con sesión), igual que el sidebar.
  const visible = pathname !== '/' && !pathname.startsWith('/admin') && !pathname.startsWith('/registro')
  if (!visible) return null

  async function handleEnviar() {
    const limpio = texto.trim()
    if (!limpio) return
    setEnviando(true)
    try {
      const res = await saveSugerencia(limpio)
      if (res?.error) {
        toast({ title: 'No se pudo enviar', description: res.error, variant: 'destructive' })
      } else {
        toast({ title: '¡Gracias por tu sugerencia!', description: 'La tendremos en cuenta para futuras actualizaciones.' })
        setTexto('')
        setOpen(false)
      }
    } catch (err) {
      toast({ title: 'No se pudo enviar', description: String(err), variant: 'destructive' })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 no-print flex flex-col items-end gap-3">
      {/* Recuadro de sugerencias */}
      {open && (
        <div className="w-[calc(100vw-2.5rem)] max-w-sm rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Sugerencias</h2>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground rounded p-0.5"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              ¿Tenés una idea para mejorar la app? Dejá tu sugerencia en el recuadro y la
              tendremos en cuenta para mejorar el funcionamiento en futuras actualizaciones.
            </p>
            <Textarea
              value={texto}
              onChange={e => setTexto(e.target.value)}
              placeholder="Escribí tu sugerencia acá..."
              rows={4}
              maxLength={2000}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" size="sm" onClick={handleEnviar} disabled={enviando || !texto.trim()}>
                {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Botón flotante con el signo de pregunta */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 rounded-full border border-border bg-card text-foreground shadow-lg hover:bg-muted/60 transition-colors h-12 pl-3 pr-4"
        aria-label="Sugerencias"
        title="Sugerencias"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary">
          <HelpCircle className="h-5 w-5" />
        </span>
        <span className="text-sm font-medium hidden sm:inline">Sugerencias</span>
      </button>
    </div>
  )
}
