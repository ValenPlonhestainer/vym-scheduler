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

// Días por defecto si la congregación todavía no configuró (Carpintería: martes/sábado).
const DIA_ENTRE_SEMANA_DEFECTO = 2 // ISO: 1=lunes … 7=domingo
const DIA_FIN_DE_SEMANA_DEFECTO = 6

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

// A partir del lunes de la semana ("YYYY-MM-DD") y el día ISO (1=lunes … 7=domingo),
// devuelve la fecha de ESE día ("YYYY-MM-DD"). Sirve para mostrar el día real en que
// se reúne la congregación (la app guarda la reunión de entre semana con la fecha del lunes).
function fechaDelDia(claveLunes: string, diaIso: number): string {
  const [y, m, d] = claveLunes.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + (diaIso - 1))
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

// Fecha "YYYY/MM/DD" o "YYYY-MM-DD" → "sábado 19 de julio" (sin coma).
function fechaLegible(fecha: string): string {
  const [y, m, d] = fecha.replace(/\//g, '-').split('-').map(Number)
  if (!y || !m || !d) return fecha
  const dt = new Date(y, m - 1, d)
  const diaSemana = dt.toLocaleDateString('es-AR', { weekday: 'long' })
  const mes = dt.toLocaleDateString('es-AR', { month: 'long' })
  return `${diaSemana} ${d} de ${mes}`
}

// Saca la duración del final de la etiqueta ("Lectura de la Biblia (4 min.)" →
// "Lectura de la Biblia"), que en un recordatorio sobra.
function limpiarEtiqueta(label: string): string {
  return label.replace(/\s*\(\s*\d+\s*min\.?\s*\)\s*$/i, '').trim()
}

type Titulos = Record<string, string>

function tituloDe(titulos: Titulos, parte: string): string | undefined {
  const t = titulos?.[parte]
  const s = t == null ? '' : String(t).trim()
  return s || undefined
}

const RE_MAESTROS = /^(aux_)?(estudiante|ayudante)_(\d)$/

// Etiqueta de una parte de la reunión de ENTRE SEMANA, incorporando el título de
// jw.org (guardado en `titulos`) según las reglas de la congregación.
function etiquetaParteSemana(parte: string, titulos: Titulos): string {
  // Seamos mejores maestros (estudiante/ayudante, sala principal o auxiliar).
  const mm = parte.match(RE_MAESTROS)
  if (mm) {
    const esAux = !!mm[1]
    const esAyudante = mm[2] === 'ayudante'
    const idx = mm[3]
    const sufAux = esAux ? ' (Sala auxiliar)' : ''
    // El ayudante y la sala auxiliar comparten el título del estudiante principal.
    const titulo = tituloDe(titulos, `estudiante_${idx}`)
    if (titulo && titulo.toLowerCase() === 'discurso') {
      return `Discurso (Seamos mejores maestros)${sufAux}`
    }
    if (!titulo) {
      return `${esAyudante ? 'Ayudante' : 'Titular'} (Seamos mejores maestros)${sufAux}`
    }
    return `${esAyudante ? 'Ayudante' : 'Titular'} de '${titulo}'${sufAux}`
  }

  switch (parte) {
    case 'discurso_tesoros': {
      const t = tituloDe(titulos, parte)
      return t ? `Discurso: '${t}'` : 'Discurso (Tesoros de la Biblia)'
    }
    case 'perlas_escondidas':
      return 'Busquemos perlas escondidas'
    case 'lectura_biblica': {
      const t = tituloDe(titulos, parte)
      return t ? `Lectura de la Biblia (${t})` : 'Lectura de la Biblia'
    }
    case 'parte_local_1':
    case 'parte_local_2': {
      const t = tituloDe(titulos, parte)
      return t ? `'${t}'` : 'Parte de Nuestra Vida Cristiana'
    }
    case 'conductor_estudio':
      return 'Conductor del estudio bíblico'
    case 'lector_estudio':
      return 'Lector del estudio bíblico'
    default:
      return limpiarEtiqueta(PARTES_INFO[parte as ParteTipo]?.label ?? parte)
  }
}

interface Bloque { etiquetaReunion: string; fecha: string; partes: string[] }

// Arma UN mensaje por hermano, juntando (si hay) sus partes de las dos reuniones.
function construirTexto(nombre: string, bloques: Bloque[], contacto: string | null): string {
  const saludo = `Hola ${nombre} 🙂`
  const cierre = contacto
    ? `Por cualquier duda o inconveniente comunicate con ${contacto}`
    : 'Por cualquier cosa avisá. ¡Gracias!'

  if (bloques.length === 1 && bloques[0].partes.length === 1) {
    return `${saludo} Te paso un recordatorio: en la reunión del ${fechaLegible(bloques[0].fecha)} ` +
      `tenés asignado: ${bloques[0].partes[0]}. ${cierre}`
  }
  const cuerpo = bloques
    .map(b => `${b.etiquetaReunion} (${fechaLegible(b.fecha)}):\n${b.partes.map(p => `• ${p}`).join('\n')}`)
    .join('\n\n')
  return `${saludo} Te paso un recordatorio de tus asignaciones de esta semana:\n\n${cuerpo}\n\n${cierre}`
}

interface HermanoMin { id: string; nombre: string; telefono: string }
interface SemanaMin {
  id: string; fecha: string
  titulos: Titulos
  microfonista_1: string | null; microfonista_2: string | null
  acomodador_1: string | null; acomodador_2: string | null
  recordatorio_auto: boolean | null
}
interface ConfigCong {
  diaEntreSemana: number
  diaFinDeSemana: number
  contacto: string | null
}

async function leerConfig(sb: SupabaseClient, congId: string): Promise<ConfigCong> {
  const { data } = await sb
    .from('congregaciones')
    .select('dia_entre_semana, dia_fin_de_semana, contacto_recordatorios')
    .eq('id', congId)
    .maybeSingle()
  return {
    diaEntreSemana: (data?.dia_entre_semana as number | null) ?? DIA_ENTRE_SEMANA_DEFECTO,
    diaFinDeSemana: (data?.dia_fin_de_semana as number | null) ?? DIA_FIN_DE_SEMANA_DEFECTO,
    contacto: ((data?.contacto_recordatorios as string | null) ?? '').trim() || null,
  }
}

async function leerHermanos(sb: SupabaseClient, congId: string): Promise<HermanoMin[]> {
  const { data } = await sb.from('hermanos').select('id, nombre, telefono').eq('congregation_id', congId)
  return (data ?? []).map(r => ({
    id: r.id as string,
    nombre: r.nombre as string,
    telefono: ((r.telefono as string | null) ?? '').trim(),
  }))
}

// Devuelve la reunión (entre semana o fds) de esa semana ISO, con sus asignaciones
// ya convertidas a etiquetas legibles (con títulos de jw.org en la de entre semana).
async function leerReunion(
  sb: SupabaseClient,
  congId: string,
  clave: string,
  tabla: 'semanas' | 'semanas_fds',
): Promise<{ semana: SemanaMin; partesPorHermano: Map<string, string[]>; autoActivo: boolean } | null> {
  const esFDS = tabla === 'semanas_fds'
  const cols = esFDS
    ? 'id, fecha, microfonista_1, microfonista_2, acomodador_1, acomodador_2, recordatorio_auto'
    : 'id, fecha, titulos, microfonista_1, microfonista_2, acomodador_1, acomodador_2, recordatorio_auto'
  const { data: semanas } = await sb.from(tabla).select(cols).eq('congregation_id', congId)
  const filas = (semanas ?? []) as unknown as SemanaMin[]
  const semana = filas.find(s => claveSemana(s.fecha) === clave)
  if (!semana) return null

  const titulos: Titulos = (() => {
    const t = semana.titulos as unknown
    if (!t) return {}
    if (typeof t === 'string') { try { return JSON.parse(t) } catch { return {} } }
    return t as Titulos
  })()

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
    const etiqueta = esFDS
      ? limpiarEtiqueta(PARTES_INFO_FDS[parte as ParteTipoFDS]?.label ?? parte)
      : etiquetaParteSemana(parte, titulos)
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

  const [config, hermanos] = await Promise.all([
    leerConfig(sb, congId),
    leerHermanos(sb, congId),
  ])
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

  // Fecha REAL de cada reunión, según el día que configuró la congregación.
  const fechaSemana = fechaDelDia(clave, config.diaEntreSemana)
  const fechaFDS = fechaDelDia(clave, config.diaFinDeSemana)

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
    if (pSemana) bloques.push({ etiquetaReunion: 'Reunión entre semana', fecha: fechaSemana, partes: pSemana })
    if (pFDS) bloques.push({ etiquetaReunion: 'Reunión de fin de semana', fecha: fechaFDS, partes: pFDS })
    if (bloques.length === 0) continue
    if (!h.telefono) { sinTelefono.push(h.nombre); continue }
    mensajes.push({ telefono: h.telefono, nombre: h.nombre, texto: construirTexto(h.nombre, bloques, config.contacto) })
  }

  return {
    mensajes,
    sinTelefono: sinTelefono.sort((a, b) => a.localeCompare(b)),
    totalConParte: idsConParte.size,
  }
}
