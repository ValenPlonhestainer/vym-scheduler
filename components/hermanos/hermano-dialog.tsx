"use client"

import { useEffect, useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { saveHermano } from '@/lib/actions'
import { Loader2 } from 'lucide-react'
import { Hermano, Genero, Rol, Privilegios } from '@/lib/types'
import { getPrivilegiosDefecto, generateId } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  hermano: Hermano | null
  hermanos: Hermano[]
  onSaved: () => void
}

type PrivilegioConfig = {
  key: keyof Privilegios
  label: string
  rolesVisibles: Rol[]
  seccion: 'semana' | 'fds'
  soloHombres?: boolean
}

const PRIVILEGIOS_CONFIG: PrivilegioConfig[] = [
  { key: 'presidente_reunion',   label: 'Presidente de la reunión',              rolesVisibles: ['anciano'],                                         seccion: 'semana' },
  { key: 'oracion',              label: 'Oración',                               rolesVisibles: ['anciano', 'siervo'],                               seccion: 'semana' },
  { key: 'discurso_tesoros',     label: 'Discurso (Tesoros de la Biblia)',        rolesVisibles: ['anciano', 'siervo'],                               seccion: 'semana' },
  { key: 'busquemos_perlas',     label: 'Busquemos perlas escondidas',            rolesVisibles: ['anciano', 'siervo'],                               seccion: 'semana' },
  { key: 'lectura_biblica',          label: 'Lectura de la Biblia',                        rolesVisibles: ['anciano', 'siervo', 'publicador'],                  seccion: 'semana' },
  { key: 'estudiante_conversacion',  label: 'Estudiante sala principal — conversaciones',   rolesVisibles: ['publicador', 'hermana'],       seccion: 'semana' },
  { key: 'estudiante_discurso',      label: 'Estudiante sala principal — discursos',        rolesVisibles: ['publicador'],                  seccion: 'semana', soloHombres: true },
  { key: 'ayudante_estudiante',      label: 'Ayudante de estudiante',                       rolesVisibles: ['anciano', 'siervo', 'publicador', 'hermana'],       seccion: 'semana' },
  { key: 'partes_vida_cristiana',label: 'Partes de Nuestra Vida Cristiana',      rolesVisibles: ['anciano', 'siervo'],                               seccion: 'semana' },
  { key: 'conductor_estudio',    label: 'Conductor del Estudio Bíblico',         rolesVisibles: ['anciano', 'siervo'],                               seccion: 'semana' },
  { key: 'lector_estudio',       label: 'Lector del Estudio Bíblico',            rolesVisibles: ['anciano', 'siervo', 'publicador'],                 seccion: 'semana' },
  { key: 'presidente_fin_semana',label: 'Presidente de la reunión',              rolesVisibles: ['anciano', 'siervo'],                               seccion: 'fds'    },
  { key: 'lector_atalaya',       label: 'Lector de La Atalaya',                  rolesVisibles: ['anciano', 'siervo', 'publicador'],                 seccion: 'fds'    },
  { key: 'microfonos',           label: 'Micrófonos',                            rolesVisibles: ['hermana'],                                         seccion: 'semana' },
]

const defaultForm = (): Omit<Hermano, 'id'> => ({
  nombre: '',
  genero: 'masculino',
  rol: 'publicador',
  activo: true,
  notas: '',
  privilegios: getPrivilegiosDefecto('publicador'),
})

export function HermanoDialog({ open, onOpenChange, hermano, hermanos, onSaved }: Props) {
  const [form, setForm] = useState(defaultForm())
  const [nombreError, setNombreError] = useState('')
  const { toast } = useToast()

  useEffect(() => {
    if (open) {
      setNombreError('')
      setForm(hermano
        ? {
            nombre: hermano.nombre,
            genero: hermano.genero,
            rol: hermano.rol,
            activo: hermano.activo,
            notas: hermano.notas ?? '',
            // Backfill de defaults para datos viejos que no tengan campos nuevos (ej: microfonos)
            privilegios: { ...getPrivilegiosDefecto(hermano.rol), ...hermano.privilegios },
          }
        : defaultForm()
      )
    }
  }, [open, hermano])

  function handleRolChange(nuevoRol: Rol) {
    const defaults = getPrivilegiosDefecto(nuevoRol)
    // Mantener solo los privilegios que aplican al nuevo rol; desmarcar los que no aplican
    setForm(f => {
      const privActuales = f.privilegios ?? getPrivilegiosDefecto(f.rol)
      const privActualizados = { ...privActuales } as Privilegios
      for (const cfg of PRIVILEGIOS_CONFIG) {
        if (!cfg.rolesVisibles.includes(nuevoRol)) {
          privActualizados[cfg.key] = false
        } else if (!PRIVILEGIOS_CONFIG.find(c => c.key === cfg.key)?.rolesVisibles.includes(f.rol)) {
          // si antes no tenía acceso a este privilegio, usar el default
          privActualizados[cfg.key] = defaults[cfg.key]
        }
      }
      if (['anciano', 'siervo'].includes(nuevoRol)) {
        privActualizados.estudiante_conversacion = true
        privActualizados.estudiante_discurso = true
        privActualizados.estudiante_aux_conversacion = true
        privActualizados.estudiante_aux_discurso = true
      }
      // El rol determina el género: Hermana → femenino; el resto → masculino.
      // Evita que una hermana quede con género masculino y se cuele como microfonista.
      const nuevoGenero: Genero = nuevoRol === 'hermana' ? 'femenino' : 'masculino'
      if (nuevoGenero === 'femenino') {
        for (const cfg of PRIVILEGIOS_CONFIG) {
          if (cfg.soloHombres) privActualizados[cfg.key] = false
        }
      }
      return { ...f, rol: nuevoRol, genero: nuevoGenero, privilegios: privActualizados }
    })
  }

  function togglePrivilegio(key: keyof Privilegios, valor: boolean) {
    setForm(f => ({
      ...f,
      privilegios: { ...(f.privilegios ?? getPrivilegiosDefecto(f.rol)), [key]: valor },
    }))
  }

  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre.trim()) return
    const nombreNorm = form.nombre.trim().toLowerCase()
    const duplicado = hermanos.find(h =>
      h.nombre.trim().toLowerCase() === nombreNorm && h.id !== hermano?.id
    )
    if (duplicado) {
      setNombreError(`Ya existe un hermano con ese nombre: "${duplicado.nombre}"`)
      return
    }
    setNombreError('')
    setSaving(true)
    try {
      const privsFinales = { ...(form.privilegios ?? getPrivilegiosDefecto(form.rol)) }
      if (['anciano', 'siervo'].includes(form.rol)) {
        privsFinales.estudiante_conversacion = true
        privsFinales.estudiante_discurso = true
        privsFinales.estudiante_aux_conversacion = true
        privsFinales.estudiante_aux_discurso = true
      }
      const data: Hermano = { id: hermano?.id ?? generateId(), ...form, privilegios: privsFinales }
      const result = await saveHermano(data)
      if (result?.error) {
        toast({ title: 'Error al guardar', description: result.error, variant: 'destructive' })
      } else {
        toast({ title: hermano ? 'Hermano actualizado' : 'Hermano agregado', description: data.nombre })
        onSaved()
      }
    } catch (err) {
      toast({ title: 'Error al guardar', description: String(err), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const rolOptions: { value: Rol; label: string }[] = [
    { value: 'anciano',    label: 'Anciano' },
    { value: 'siervo',     label: 'Siervo ministerial' },
    { value: 'publicador', label: 'Publicador' },
    { value: 'hermana',    label: 'Hermana' },
  ]

  const privActuales = form.privilegios ?? getPrivilegiosDefecto(form.rol)
  const esMasculino = form.genero === 'masculino'
  const privSemana = PRIVILEGIOS_CONFIG.filter(c =>
    c.seccion === 'semana' && c.rolesVisibles.includes(form.rol) && (!c.soloHombres || esMasculino)
  )
  const privFDS = PRIVILEGIOS_CONFIG.filter(c =>
    c.seccion === 'fds' && c.rolesVisibles.includes(form.rol) && (!c.soloHombres || esMasculino)
  )

  const todosDesactivados =
    ['anciano', 'siervo'].includes(form.rol) &&
    PRIVILEGIOS_CONFIG.filter(c => c.rolesVisibles.includes(form.rol)).every(c => !privActuales[c.key])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{hermano ? 'Editar hermano' : 'Agregar hermano'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre completo</Label>
            <Input
              id="nombre"
              value={form.nombre}
              onChange={e => { setForm(f => ({ ...f, nombre: e.target.value })); setNombreError('') }}
              placeholder="Ej: Juan García"
              required
              className={nombreError ? 'border-red-500 focus-visible:ring-red-500' : ''}
            />
            {nombreError && (
              <p className="text-xs text-red-500">{nombreError}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Género</Label>
              <Select value={form.genero} onValueChange={v => {
                const nuevoGenero = v as Genero
                setForm(f => {
                  let privs = f.privilegios ?? getPrivilegiosDefecto(f.rol)
                  if (nuevoGenero === 'femenino') {
                    privs = { ...privs }
                    for (const cfg of PRIVILEGIOS_CONFIG) {
                      if (cfg.soloHombres) privs[cfg.key] = false
                    }
                  }
                  return { ...f, genero: nuevoGenero, privilegios: privs }
                })
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="masculino">Masculino</SelectItem>
                  <SelectItem value="femenino">Femenino</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Rol</Label>
              <Select value={form.rol} onValueChange={v => handleRolChange(v as Rol)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {rolOptions.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Aviso sin privilegios */}
          {todosDesactivados && (
            <div className="flex items-start gap-2 rounded-md border border-amber-700/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-300">
              <span className="mt-0.5 shrink-0">⚠️</span>
              <span>Este hermano no aparecerá en ningún dropdown de asignación porque no tiene ningún privilegio habilitado.</span>
            </div>
          )}

          {/* Privilegios */}
          {privSemana.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reunión entre semana</p>
              <div className="space-y-1.5 pl-1">
                {privSemana.map(cfg => (
                  <label key={cfg.key} className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                      checked={privActuales[cfg.key]}
                      onChange={e => togglePrivilegio(cfg.key, e.target.checked)}
                    />
                    <span className="text-sm text-foreground">{cfg.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {privFDS.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reunión de fin de semana</p>
              <div className="space-y-1.5 pl-1">
                {privFDS.map(cfg => (
                  <label key={cfg.key} className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                      checked={privActuales[cfg.key]}
                      onChange={e => togglePrivilegio(cfg.key, e.target.checked)}
                    />
                    <span className="text-sm text-foreground">{cfg.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="notas">Notas (opcional)</Label>
            <Textarea
              id="notas"
              value={form.notas}
              onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
              placeholder="Ej: viaja seguido, solo sala principal..."
              rows={2}
            />
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="activo"
              checked={form.activo}
              onCheckedChange={v => setForm(f => ({ ...f, activo: v }))}
            />
            <Label htmlFor="activo">Hermano activo</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
