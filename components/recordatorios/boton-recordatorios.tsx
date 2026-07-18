"use client"

import { useState, useEffect } from 'react'
import { Send, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { enviarRecordatoriosSemanaCompleta, recordatoriosHabilitados } from '@/lib/actions'
import { useToast } from '@/hooks/use-toast'

type Resultado = Awaited<ReturnType<typeof enviarRecordatoriosSemanaCompleta>>

interface Props {
  // Fecha de la reunión que se está viendo. Se usa para ubicar la semana y juntar
  // sus dos reuniones (entre semana + fin de semana) en un solo aviso por hermano.
  fechaReferencia: string
}

// Botón para enviar por WhatsApp (vía el bot) un recordatorio a los hermanos
// asignados en la semana. Junta ambas reuniones y envía lo ÚLTIMO GUARDADO.
export function BotonRecordatorios({ fechaReferencia }: Props) {
  const { toast } = useToast()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  // Los recordatorios están habilitados solo para la congregación configurada.
  const [habilitado, setHabilitado] = useState(false)

  useEffect(() => {
    recordatoriosHabilitados().then(setHabilitado).catch(() => setHabilitado(false))
  }, [])

  async function enviar() {
    setEnviando(true)
    try {
      const r = await enviarRecordatoriosSemanaCompleta(fechaReferencia)
      setConfirmOpen(false)
      setResultado(r)
      if (!r.ok && r.mensajeError) {
        toast({ title: 'No se pudieron enviar', description: r.mensajeError, variant: 'destructive' })
      }
    } catch (err) {
      toast({ title: 'Error al enviar', description: String(err), variant: 'destructive' })
    } finally {
      setEnviando(false)
    }
  }

  // En congregaciones sin recordatorios habilitados, el botón no aparece.
  if (!habilitado) return null

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setConfirmOpen(true)}
        title="Enviar recordatorios por WhatsApp a los asignados"
      >
        <Send className="h-4 w-4" />
        <span className="hidden sm:inline">Recordatorios</span>
      </Button>

      {/* Confirmación */}
      <Dialog open={confirmOpen} onOpenChange={o => { if (!enviando) setConfirmOpen(o) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar recordatorios por WhatsApp</DialogTitle>
            <DialogDescription>
              Se les enviará un recordatorio por WhatsApp a los hermanos asignados en esta
              reunión, según lo <b>último guardado</b>. Si recién hiciste cambios, guardá primero.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={enviando}>
              Cancelar
            </Button>
            <Button onClick={enviar} disabled={enviando}>
              {enviando && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Enviar ahora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resultado */}
      <Dialog open={!!resultado} onOpenChange={o => { if (!o) setResultado(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {resultado?.ok && <CheckCircle2 className="h-5 w-5 text-green-500" />}
              Resultado del envío
            </DialogTitle>
          </DialogHeader>
          {resultado && (
            <div className="space-y-2 text-sm">
              <p>✅ Enviados: <b>{resultado.enviados}</b></p>
              {resultado.errores > 0 && <p>⚠️ Con error al enviar: <b>{resultado.errores}</b></p>}
              {resultado.sinTelefono.length > 0 && (
                <div className="rounded-md border border-amber-700/40 bg-amber-950/20 px-3 py-2">
                  <p className="text-amber-300">
                    📵 Sin teléfono cargado ({resultado.sinTelefono.length}) — no recibieron el aviso:
                  </p>
                  <p className="text-muted-foreground">{resultado.sinTelefono.join(', ')}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Cargá su teléfono en la pantalla de Hermanos para incluirlos.
                  </p>
                </div>
              )}
              {resultado.detalleErrores.length > 0 && (
                <div>
                  <p>Detalle de los que fallaron:</p>
                  <ul className="text-muted-foreground list-disc pl-5">
                    {resultado.detalleErrores.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
              {resultado.mensajeError && (
                <p className="text-red-500">{resultado.mensajeError}</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setResultado(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
