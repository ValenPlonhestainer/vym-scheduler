// recordatorios-core.ts — Lógica compartida para armar los mensajes de
// recordatorio (la usan el botón manual en actions.ts y la ruta automática en
// app/api/recordatorios-auto). Es código SOLO de servidor: recibe un cliente de
// Supabase ya creado (autenticado o de servicio) y NO debe importarse desde
// componentes de cliente. No es un Server Action (por eso vive fuera de actions.ts):
// así no queda expuesto como endpoint que devuelva teléfonos.
import type { SupabaseClient } from '@supabase/supabase-js'
import { PARTES_INFO, PARTES_INFO_FDS, ParteTipo, ParteTipoFDS } from './types'

export type ScopeRecordatorio = 'semana-completa' | 'solo-semana' | 'solo-fds'

export interface MensajeBot {
  telefono: string
  nombre: string
  texto: string
}

export interface MensajesArmados {
  mensajes: MensajeBot[]
  sinTelefono: string[]
  totalConParte: number
}

// Clave de la semana ISO (lunes a domingo) de una fecha: "YYYY-MM-DD" del lunes.
// Empareja la reunión de entre semana con la de fin de semana de la MISMA semana.
export function claveSemana(fecha: string): string | null {
  const [y, m, d] = fecha.replace(/\//g, '-').split('-').map(Number)
  if (!y || !m || !d) return null
  const dt = new Date(y, m - 1, d)
  const dow = dt.getDay() // 0=domingo … 6=sábado
  const toMonday = dow === 0 ? 6 : dow - 1
  const lunes = new Date(dt)
  lunes.setDate(dt.getDate() - toMonday)
  return `${lunes.getFullYear()}-${String(lunes.getMonth() + 1).padStart(2, '0')}-${String(lunes.getDate()).padStart(2, '0')}`
}

// Fecha "YYYY/MM/DD" o "YYYY-MM-DD" → "sábado 19 de julio".
function fechaLegible(fecha: string): string {
  const [y, m, d] = fecha.replace(/\//g, '-').split('-').map(Number)
  if (!y || !m || !d) return fecha
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

// Saca la duración del final de la etiqueta ("Lectura de la Biblia (4 min.)" →
// "Lectura de la Biblia"), que en un recordatorio sobra.
function limpiarEtiqueta(label: string): string {
  return label.replace(/\s*\(\s*\d+\s*min\.?\s*\)\s*$/i, '').trim()
}

interface Bloque { etiquetaReunion: string; fecha: string; partes: string[] }

// Arma UN mensaje por hermano, juntando (si hay) sus partes de las dos reuniones.
function construirTexto(nombre: string, bloques: Bloque[]): string {
  const saludo = `Hola ${nombre} 🙂`
  if (bloques.length === 1 && bloques[0].partes.length === 1) {
    return `${saludo} Te paso un recordatorio: en la reunión del ${fechaLegible(bloques[0].fecha)} ` +
      `tenés asignado: ${bloques[0].partes[0]}. Por cualquier cosa avisá. ¡Gracias!`
  }
  const cuerpo = bloques
    .map(b => `${b.etiquetaReunion} (${fechaLegible(b.fecha)}):\n${b.partes.map(p => `• ${p}`).join('\n')}`)
    .join('\n\n')
  return `${saludo} Te paso un recordatorio de tus asignaciones de esta semana:\n\n${cuerpo}\n\nPor cualquier cosa avisá. ¡Gracias!`
}

interface HermanoMin { id: string; nombre: string; telefono: string }
interface SemanaMin {
  id: string; fecha: string
  microfonista_1: string | null; microfonista_2: string | null
  acomodador_1: string | null; acomodador_2: string | null
  recordatorio_auto: boolean | null
}

async function leerHermanos(sb: SupabaseClient, congId: string): Promise<HermanoMin[]> {
  const { data } = await sb.from('hermanos').select('id, nombre, telefono').eq('congregation_id', congId)
  return (data ?? []).map(r => ({
    id: r.id as string,
    nombre: r.nombre as string,
    telefono: ((r.telefono as string | null) ?? '').trim(),
  }))
}

// Devuelve la reunión (entre semana o fds) de esa semana ISO, con sus asignaciones.
async function leerReunion(
  sb: SupabaseClient,
  congId: string,
  clave: string,
  tabla: 'semanas' | 'semanas_fds',
): Promise<{ semana: SemanaMin; partesPorHermano: Map<string, string[]>; autoActivo: boolean } | null> {
  const { data: semanas } = await sb
    .from(tabla)
    .select('id, fecha, microfonista_1, microfonista_2, acomodador_1, acomodador_2, recordatorio_auto')
    .eq('congregation_id', congId)
  const semana = (semanas ?? []).find(s => claveSemana(s.fecha as string) === clave) as SemanaMin | undefined
  if (!semana) return null

  const esFDS = tabla === 'semanas_fds'
  const tablaAsig = esFDS ? 'asignaciones_fds' : 'asignaciones'
  const col = esFDS ? 'semana_fds_id' : 'semana_id'
  const { data: asigs } = await sb.from(tablaAsig).select('parte, hermano_id').eq(col, semana.id)

  const partesPorHermano = new Map<string, string[]>()
  const agregar = (hermanoId: string | null | undefined, etiqueta: string) => {
    if (!hermanoId) return
    const arr = partesPorHermano.get(hermanoId) ?? []
    arr.push(etiqueta)
    partesPorHermano.set(hermanoId, arr)
  }

  for (const a of asigs ?? []) {
    const parte = a.parte as string
    const etiqueta = limpiarEtiqueta(esFDS
      ? (PARTES_INFO_FDS[parte as ParteTipoFDS]?.label ?? parte)
      : (PARTES_INFO[parte as ParteTipo]?.label ?? parte))
    agregar(a.hermano_id as string, etiqueta)
  }
  agregar(semana.microfonista_1, 'Microfonista')
  agregar(semana.microfonista_2, 'Microfonista')
  agregar(semana.acomodador_1, 'Acomodador')
  agregar(semana.acomodador_2, 'Acomodador')

  return { semana, partesPorHermano, autoActivo: semana.recordatorio_auto !== false }
}

// Arma los mensajes de recordatorio de la semana ISO de `fechaReferencia`.
//  - 'solo-semana' / 'solo-fds': solo esa reunión.
//  - 'semana-completa': junta las dos en un mensaje por hermano.
export async function armarMensajesRecordatorio(
  sb: SupabaseClient,
  congId: string,
  fechaReferencia: string,
  scope: ScopeRecordatorio,
): Promise<MensajesArmados> {
  const clave = claveSemana(fechaReferencia)
  if (!clave) return { mensajes: [], sinTelefono: [], totalConParte: 0 }

  const hermanos = await leerHermanos(sb, congId)
  const hermanoPorId = new Map(hermanos.map(h => [h.id, h]))

  const incluirSemana = scope === 'semana-completa' || scope === 'solo-semana'
  const incluirFDS = scope === 'semana-completa' || scope === 'solo-fds'

  // El toggle por reunión solo aplica al envío AUTOMÁTICO; el manual (semana-completa)
  // envía igual, esté el toggle como esté.
  const respetarToggle = scope !== 'semana-completa'

  let reunionSemana = incluirSemana ? await leerReunion(sb, congId, clave, 'semanas') : null
  if (reunionSemana && respetarToggle && !reunionSemana.autoActivo) reunionSemana = null

  let reunionFDS = incluirFDS ? await leerReunion(sb, congId, clave, 'semanas_fds') : null
  if (reunionFDS && respetarToggle && !reunionFDS.autoActivo) reunionFDS = null

  const idsConParte = new Set<string>([
    ...(reunionSemana?.partesPorHermano.keys() ?? []),
    ...(reunionFDS?.partesPorHermano.keys() ?? []),
  ])

  const mensajes: MensajeBot[] = []
  const sinTelefono: string[] = []
  for (const hermanoId of idsConParte) {
    const h = hermanoPorId.get(hermanoId)
    if (!h) continue
    const bloques: Bloque[] = []
    const pSemana = reunionSemana?.partesPorHermano.get(hermanoId)
    const pFDS = reunionFDS?.partesPorHermano.get(hermanoId)
    if (pSemana) bloques.push({ etiquetaReunion: 'Reunión entre semana', fecha: reunionSemana!.semana.fecha, partes: pSemana })
    if (pFDS) bloques.push({ etiquetaReunion: 'Reunión de fin de semana', fecha: reunionFDS!.semana.fecha, partes: pFDS })
    if (bloques.length === 0) continue
    if (!h.telefono) { sinTelefono.push(h.nombre); continue }
    mensajes.push({ telefono: h.telefono, nombre: h.nombre, texto: construirTexto(h.nombre, bloques) })
  }

  return {
    mensajes,
    sinTelefono: sinTelefono.sort((a, b) => a.localeCompare(b)),
    totalConParte: idsConParte.size,
  }
}
