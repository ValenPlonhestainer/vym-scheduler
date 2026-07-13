import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { Rol, Hermano, ParteTipo, ParteTipoFDS, PARTES_INFO, Privilegios } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatFecha(fecha: string): string {
  if (!fecha) return ''
  const [year, month, day] = fecha.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function formatFechaCorta(fecha: string): string {
  if (!fecha) return ''
  const [year, month, day] = fecha.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function getMesAnio(fecha: string): string {
  if (!fecha) return ''
  const [year, month, day] = fecha.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
}

export const ROL_LABELS: Record<Rol, string> = {
  anciano: 'Anciano',
  siervo: 'Siervo ministerial',
  publicador: 'Publicador',
  hermana: 'Hermana',
}

export const ROL_COLORS: Record<Rol, string> = {
  anciano:    'badge-anciano',
  siervo:     'badge-siervo',
  publicador: 'badge-publicador',
  hermana:    'badge-hermana',
}

export function getPrivilegiosDefecto(rol: Rol): Privilegios {
  const esMasculinoConRol = (privs: Partial<Privilegios>): Privilegios => ({
    oracion: false, discurso_tesoros: false, busquemos_perlas: false,
    lectura_biblica: false,
    estudiante_conversacion: false, estudiante_discurso: false,
    estudiante_aux_conversacion: false, estudiante_aux_discurso: false,
    ayudante_estudiante: false, partes_vida_cristiana: false, presidente_reunion: false,
    conductor_estudio: false, lector_estudio: false, presidente_fin_semana: false, lector_atalaya: false,
    microfonos: false,
    ...privs,
  })
  switch (rol) {
    case 'anciano': return esMasculinoConRol({
      oracion: true, discurso_tesoros: true, busquemos_perlas: true, lectura_biblica: true,
      estudiante_conversacion: true, estudiante_discurso: true,
      estudiante_aux_conversacion: true, estudiante_aux_discurso: true,
      ayudante_estudiante: true, partes_vida_cristiana: true, presidente_reunion: true,
      conductor_estudio: true, lector_estudio: true, presidente_fin_semana: true, lector_atalaya: true,
    })
    case 'siervo': return esMasculinoConRol({
      oracion: true, discurso_tesoros: true, busquemos_perlas: true, lectura_biblica: true,
      estudiante_conversacion: true, estudiante_discurso: true,
      estudiante_aux_conversacion: true, estudiante_aux_discurso: true,
      ayudante_estudiante: true, partes_vida_cristiana: true,
      conductor_estudio: true, lector_estudio: true, presidente_fin_semana: true, lector_atalaya: true,
    })
    case 'publicador': return esMasculinoConRol({
      lectura_biblica: true,
      estudiante_conversacion: true, estudiante_discurso: true,
      estudiante_aux_conversacion: true, estudiante_aux_discurso: true,
      ayudante_estudiante: true, lector_estudio: true, lector_atalaya: true,
      microfonos: true,
    })
    case 'hermana': return esMasculinoConRol({
      estudiante_conversacion: true, estudiante_aux_conversacion: true, ayudante_estudiante: true,
    })
  }
}

const PARTE_A_PRIVILEGIO: Partial<Record<ParteTipo, keyof Privilegios>> = {
  oracion_apertura: 'oracion',
  oracion_cierre: 'oracion',
  presidente: 'presidente_reunion',
  discurso_tesoros: 'discurso_tesoros',
  perlas_escondidas: 'busquemos_perlas',
  lectura_biblica: 'lectura_biblica',
  estudiante_1: 'estudiante_conversacion', estudiante_2: 'estudiante_conversacion',
  estudiante_3: 'estudiante_conversacion', estudiante_4: 'estudiante_conversacion',
  aux_estudiante_1: 'estudiante_conversacion', aux_estudiante_2: 'estudiante_conversacion',
  aux_estudiante_3: 'estudiante_conversacion', aux_estudiante_4: 'estudiante_conversacion',
  ayudante_1: 'ayudante_estudiante', ayudante_2: 'ayudante_estudiante',
  ayudante_3: 'ayudante_estudiante', ayudante_4: 'ayudante_estudiante',
  aux_ayudante_1: 'ayudante_estudiante', aux_ayudante_2: 'ayudante_estudiante',
  aux_ayudante_3: 'ayudante_estudiante', aux_ayudante_4: 'ayudante_estudiante',
  parte_local_1: 'partes_vida_cristiana', parte_local_2: 'partes_vida_cristiana',
  conductor_estudio: 'conductor_estudio',
  lector_estudio: 'lector_estudio',
}

const PARTE_FDS_A_PRIVILEGIO: Record<ParteTipoFDS, keyof Privilegios> = {
  fds_oracion_apertura: 'oracion',
  fds_oracion_cierre: 'oracion',
  fds_presidente: 'presidente_fin_semana',
  fds_lector: 'lector_atalaya',
}

const PARES_DISCURSO: Partial<Record<keyof Privilegios, keyof Privilegios>> = {
  estudiante_conversacion: 'estudiante_discurso',
  estudiante_aux_conversacion: 'estudiante_aux_discurso',
}

export function hermaosElegiblesParaParte(hermanos: Hermano[], parte: ParteTipo): Hermano[] {
  const info = PARTES_INFO[parte]
  const privilegioClave = PARTE_A_PRIVILEGIO[parte]
  return hermanos.filter(h => {
    if (!h.activo) return false
    if (info.soloHombres && h.genero === 'femenino') return false
    if (!privilegioClave) return info.rolesPermitidos.includes(h.rol)
    const privs = h.privilegios ?? getPrivilegiosDefecto(h.rol)
    // Para slots de estudiante: apto si puede conversaciones O discursos
    const claveDiscurso = PARES_DISCURSO[privilegioClave]
    return privs[privilegioClave] || (claveDiscurso ? privs[claveDiscurso] : false)
  })
}

export function hermanosElegiblesParaParteFDS(hermanos: Hermano[], parte: ParteTipoFDS): Hermano[] {
  const privilegioClave = PARTE_FDS_A_PRIVILEGIO[parte]
  return hermanos.filter(h => {
    if (!h.activo) return false
    if (h.genero === 'femenino') return false
    const privs = h.privilegios ?? getPrivilegiosDefecto(h.rol)
    return privs[privilegioClave]
  })
}

export function generateId(): string {
  return crypto.randomUUID()
}

export function agruparSemanasPorMes<T extends { id: string; fecha: string }>(semanas: T[]): Record<string, T[]> {
  const grupos: Record<string, T[]> = {}
  for (const semana of semanas) {
    const [year, month] = semana.fecha.split('-')
    const key = `${year}-${month}`
    if (!grupos[key]) grupos[key] = []
    grupos[key].push(semana)
  }
  return grupos
}
