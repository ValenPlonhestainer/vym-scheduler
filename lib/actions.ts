'use server'

import { cookies } from 'next/headers'
import { randomUUID } from 'crypto'
import https from 'https'
import http from 'http'
import { getAuthedSupabase } from './supabase'
import {
  Hermano, Semana, Asignacion, ParteTipo,
  SemanaFDS, AsignacionFDS, ParteTipoFDS,
} from './types'
import { armarMensajesRecordatorio } from './recordatorios-core'

function getCongId(): string {
  const id = cookies().get('congregation_id')?.value
  if (!id) throw new Error('No congregation_id cookie')
  return id
}

// ── Mappers ───────────────────────────────────────────────────────

function dbToHermano(r: Record<string, unknown>): Hermano {
  return {
    id: r.id as string,
    nombre: r.nombre as string,
    genero: r.genero as Hermano['genero'],
    rol: r.rol as Hermano['rol'],
    activo: r.activo as boolean,
    notas: (r.notas as string | null) ?? undefined,
    telefono: (r.telefono as string | null) ?? undefined,
    privilegios: r.privilegios
      ? (typeof r.privilegios === 'string' ? JSON.parse(r.privilegios) : r.privilegios)
      : undefined,
  }
}

function dbToSemana(r: Record<string, unknown>): Semana {
  return {
    id: r.id as string,
    fecha: r.fecha as string,
    tema: (r.tema as string) ?? '',
    lecturaBiblica: (r.lectura_biblica as string) ?? '',
    cancionApertura: (r.cancion_apertura as number | null) ?? undefined,
    cancionIntermedia: (r.cancion_intermedia as number | null) ?? undefined,
    cancionCierre: (r.cancion_cierre as number | null) ?? undefined,
    numEstudiantes: (r.num_estudiantes as number | null) ?? undefined,
    titulos: r.titulos
      ? (typeof r.titulos === 'string' ? JSON.parse(r.titulos) : r.titulos)
      : {},
    microfonista1: (r.microfonista_1 as string | null) ?? undefined,
    microfonista2: (r.microfonista_2 as string | null) ?? undefined,
    acomodador1: (r.acomodador_1 as string | null) ?? undefined,
    acomodador2: (r.acomodador_2 as string | null) ?? undefined,
    recordatorioAuto: (r.recordatorio_auto as boolean | null) ?? true,
  }
}

function dbToAsignacion(r: Record<string, unknown>): Asignacion {
  return {
    id: r.id as string,
    semanaId: r.semana_id as string,
    parte: r.parte as ParteTipo,
    hermanoId: r.hermano_id as string,
  }
}

function dbToSemanaFDS(r: Record<string, unknown>): SemanaFDS {
  return {
    id: r.id as string,
    fecha: r.fecha as string,
    fechaLocale: (r.fecha_locale as string | null) ?? undefined,
    tituloArticulo: (r.titulo_articulo as string | null) ?? undefined,
    cancionApertura: (r.cancion_apertura as number | null) ?? undefined,
    cancionIntermedia: (r.cancion_intermedia as number | null) ?? undefined,
    cancionCierre: (r.cancion_cierre as number | null) ?? undefined,
    boceto: (r.boceto as number | null) ?? undefined,
    disertacionTitulo: (r.disertacion_titulo as string | null) ?? undefined,
    oradorNombre: (r.orador_nombre as string | null) ?? undefined,
    oradorCongregacion: (r.orador_congregacion as string | null) ?? undefined,
    oracionCierreTexto: (r.oracion_cierre_texto as string | null) ?? undefined,
    microfonista1: (r.microfonista_1 as string | null) ?? undefined,
    microfonista2: (r.microfonista_2 as string | null) ?? undefined,
    acomodador1: (r.acomodador_1 as string | null) ?? undefined,
    acomodador2: (r.acomodador_2 as string | null) ?? undefined,
    recordatorioAuto: (r.recordatorio_auto as boolean | null) ?? true,
  }
}

function dbToAsignacionFDS(r: Record<string, unknown>): AsignacionFDS {
  return {
    id: r.id as string,
    semanaFDSId: r.semana_fds_id as string,
    parte: r.parte as ParteTipoFDS,
    hermanoId: r.hermano_id as string,
  }
}

// ── Hermanos ──────────────────────────────────────────────────────

export async function getHermanos(): Promise<Hermano[]> {
  const congId = getCongId()
  const sb = await getAuthedSupabase()
  const { data, error } = await sb
    .from('hermanos')
    .select('*')
    .eq('congregation_id', congId)
    .order('nombre')
  if (error) throw new Error(error.message)
  return (data ?? []).map(r => dbToHermano(r as Record<string, unknown>))
}

export async function saveHermano(hermano: Hermano): Promise<{ error?: string }> {
  try {
    const congId = getCongId()
    const sb = await getAuthedSupabase()
    const { error } = await sb.from('hermanos').upsert({
      id: hermano.id,
      congregation_id: congId,
      nombre: hermano.nombre,
      genero: hermano.genero,
      rol: hermano.rol,
      activo: hermano.activo,
      notas: hermano.notas ?? null,
      telefono: hermano.telefono ?? null,
      privilegios: hermano.privilegios ?? null,
    })
    if (error) return { error: error.message }
    return {}
  } catch (err) {
    return { error: String(err) }
  }
}

export async function deleteHermano(id: string): Promise<void> {
  const congId = getCongId()
  const sb = await getAuthedSupabase()
  const { error } = await sb.from('hermanos').delete().eq('id', id).eq('congregation_id', congId)
  if (error) throw new Error(error.message)
}

// ── Sugerencias ───────────────────────────────────────────────────

export async function saveSugerencia(texto: string): Promise<{ error?: string }> {
  try {
    const limpio = texto.trim()
    if (!limpio) return { error: 'La sugerencia está vacía' }
    const congId = getCongId()
    const sb = await getAuthedSupabase()
    const { error } = await sb.from('sugerencias').insert({
      id: randomUUID(),
      congregation_id: congId,
      texto: limpio.slice(0, 2000),
    })
    if (error) return { error: error.message }
    return {}
  } catch (err) {
    return { error: String(err) }
  }
}

// ── Semanas entre semana ──────────────────────────────────────────

export async function getSemanas(): Promise<Semana[]> {
  const congId = getCongId()
  const sb = await getAuthedSupabase()
  const { data, error } = await sb
    .from('semanas')
    .select('*')
    .eq('congregation_id', congId)
    .order('fecha')
  if (error) throw new Error(error.message)
  return (data ?? []).map(r => dbToSemana(r as Record<string, unknown>))
}

export async function getSemana(id: string): Promise<Semana | undefined> {
  const congId = getCongId()
  const sb = await getAuthedSupabase()
  const { data, error } = await sb
    .from('semanas')
    .select('*')
    .eq('id', id)
    .eq('congregation_id', congId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? dbToSemana(data as Record<string, unknown>) : undefined
}

export async function saveSemana(semana: Semana): Promise<{ error?: string }> {
  try {
    const congId = getCongId()
    const sb = await getAuthedSupabase()
    const { error } = await sb.from('semanas').upsert({
      id: semana.id,
      congregation_id: congId,
      fecha: semana.fecha,
      tema: semana.tema ?? null,
      lectura_biblica: semana.lecturaBiblica ?? null,
      cancion_apertura: semana.cancionApertura ?? null,
      cancion_intermedia: semana.cancionIntermedia ?? null,
      cancion_cierre: semana.cancionCierre ?? null,
      num_estudiantes: semana.numEstudiantes ?? null,
      titulos: semana.titulos ?? {},
      microfonista_1: semana.microfonista1 ?? null,
      microfonista_2: semana.microfonista2 ?? null,
      acomodador_1: semana.acomodador1 ?? null,
      acomodador_2: semana.acomodador2 ?? null,
      recordatorio_auto: semana.recordatorioAuto ?? true,
    })
    if (error) return { error: error.message }
    return {}
  } catch (err) {
    return { error: String(err) }
  }
}

export async function deleteSemana(id: string): Promise<void> {
  const congId = getCongId()
  const sb = await getAuthedSupabase()
  const { error } = await sb.from('semanas').delete().eq('id', id).eq('congregation_id', congId)
  if (error) throw new Error(error.message)
}

// ── Asignaciones entre semana ─────────────────────────────────────

export async function getAsignaciones(semanaId: string): Promise<Asignacion[]> {
  const congId = getCongId()
  const sb = await getAuthedSupabase()
  // Verify semana belongs to congregation
  const { data: semana } = await sb
    .from('semanas').select('id').eq('id', semanaId).eq('congregation_id', congId).maybeSingle()
  if (!semana) return []
  const { data, error } = await sb.from('asignaciones').select('*').eq('semana_id', semanaId)
  if (error) throw new Error(error.message)
  return (data ?? []).map(r => dbToAsignacion(r as Record<string, unknown>))
}

export async function getAllAsignaciones(): Promise<Asignacion[]> {
  const congId = getCongId()
  const sb = await getAuthedSupabase()
  const { data: semanas } = await sb.from('semanas').select('id').eq('congregation_id', congId)
  if (!semanas?.length) return []
  const ids = semanas.map(s => s.id)
  const { data, error } = await sb.from('asignaciones').select('*').in('semana_id', ids)
  if (error) throw new Error(error.message)
  return (data ?? []).map(r => dbToAsignacion(r as Record<string, unknown>))
}

export async function getAllAsignacionesConFecha(): Promise<Array<Asignacion & { fecha: string }>> {
  const congId = getCongId()
  const sb = await getAuthedSupabase()
  const { data: semanas } = await sb.from('semanas').select('id, fecha').eq('congregation_id', congId)
  if (!semanas?.length) return []
  const semanaMap = new Map(semanas.map(s => [s.id, s.fecha as string]))
  const ids = semanas.map(s => s.id)
  const { data, error } = await sb.from('asignaciones').select('*').in('semana_id', ids)
  if (error) throw new Error(error.message)
  return (data ?? []).map(r => ({
    ...dbToAsignacion(r as Record<string, unknown>),
    fecha: semanaMap.get(r.semana_id as string) ?? '',
  }))
}

export async function saveAllAsignaciones(
  semanaId: string,
  asignaciones: Omit<Asignacion, 'id' | 'semanaId'>[]
): Promise<{ error?: string }> {
  try {
    const congId = getCongId()
    const sb = await getAuthedSupabase()
    const { data: semana } = await sb
      .from('semanas').select('id').eq('id', semanaId).eq('congregation_id', congId).maybeSingle()
    if (!semana) return { error: 'Semana no encontrada' }
    await sb.from('asignaciones').delete().eq('semana_id', semanaId)
    if (asignaciones.length > 0) {
      const { error } = await sb.from('asignaciones').insert(
        asignaciones.map(a => ({
          id: randomUUID(),
          semana_id: semanaId,
          congregation_id: congId,
          parte: a.parte,
          hermano_id: a.hermanoId,
        }))
      )
      if (error) return { error: error.message }
    }
    return {}
  } catch (err) {
    return { error: String(err) }
  }
}

export async function getAsignacionesHermano(
  hermanoId: string
): Promise<Array<{ semana: Semana; parte: ParteTipo }>> {
  const congId = getCongId()
  const sb = await getAuthedSupabase()
  const { data: semanas } = await sb
    .from('semanas').select('*').eq('congregation_id', congId).order('fecha')
  if (!semanas?.length) return []
  const semanaMap = new Map(semanas.map(s => [s.id as string, dbToSemana(s as Record<string, unknown>)]))
  const ids = semanas.map(s => s.id)
  const { data, error } = await sb
    .from('asignaciones').select('*').eq('hermano_id', hermanoId).in('semana_id', ids)
  if (error) throw new Error(error.message)
  return (data ?? [])
    .filter(r => semanaMap.has(r.semana_id as string))
    .map(r => ({
      semana: semanaMap.get(r.semana_id as string)!,
      parte: r.parte as ParteTipo,
    }))
}

// ── Congregación ──────────────────────────────────────────────────

export async function getCongregacion(): Promise<string> {
  const congId = getCongId()
  const sb = await getAuthedSupabase()
  const { data } = await sb.from('congregaciones').select('nombre').eq('id', congId).maybeSingle()
  return (data?.nombre as string) ?? ''
}

export async function saveCongregacion(nombre: string): Promise<void> {
  const congId = getCongId()
  const sb = await getAuthedSupabase()
  await sb.from('congregaciones').update({ nombre }).eq('id', congId)
}

// ── Semanas fin de semana ─────────────────────────────────────────

export async function getSemanasFDS(): Promise<SemanaFDS[]> {
  const congId = getCongId()
  const sb = await getAuthedSupabase()
  const { data, error } = await sb
    .from('semanas_fds')
    .select('*')
    .eq('congregation_id', congId)
    .order('fecha')
  if (error) throw new Error(error.message)
  return (data ?? []).map(r => dbToSemanaFDS(r as Record<string, unknown>))
}

export async function getSemanaFDS(id: string): Promise<SemanaFDS | undefined> {
  const congId = getCongId()
  const sb = await getAuthedSupabase()
  const { data, error } = await sb
    .from('semanas_fds')
    .select('*')
    .eq('id', id)
    .eq('congregation_id', congId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? dbToSemanaFDS(data as Record<string, unknown>) : undefined
}

export async function saveSemanaFDS(semana: SemanaFDS): Promise<{ error?: string }> {
  try {
    const congId = getCongId()
    const sb = await getAuthedSupabase()
    const { error } = await sb.from('semanas_fds').upsert({
      id: semana.id,
      congregation_id: congId,
      fecha: semana.fecha,
      fecha_locale: semana.fechaLocale ?? null,
      titulo_articulo: semana.tituloArticulo ?? null,
      cancion_apertura: semana.cancionApertura ?? null,
      cancion_intermedia: semana.cancionIntermedia ?? null,
      cancion_cierre: semana.cancionCierre ?? null,
      boceto: semana.boceto ?? null,
      disertacion_titulo: semana.disertacionTitulo ?? null,
      orador_nombre: semana.oradorNombre ?? null,
      orador_congregacion: semana.oradorCongregacion ?? null,
      oracion_cierre_texto: semana.oracionCierreTexto ?? null,
      microfonista_1: semana.microfonista1 ?? null,
      microfonista_2: semana.microfonista2 ?? null,
      acomodador_1: semana.acomodador1 ?? null,
      acomodador_2: semana.acomodador2 ?? null,
      recordatorio_auto: semana.recordatorioAuto ?? true,
    })
    if (error) return { error: error.message }
    return {}
  } catch (err) {
    return { error: String(err) }
  }
}

export async function deleteSemanaFDS(id: string): Promise<void> {
  const congId = getCongId()
  const sb = await getAuthedSupabase()
  const { error } = await sb.from('semanas_fds').delete().eq('id', id).eq('congregation_id', congId)
  if (error) throw new Error(error.message)
}

// ── Asignaciones fin de semana ────────────────────────────────────

export async function getAsignacionesFDS(semanaFDSId: string): Promise<AsignacionFDS[]> {
  const congId = getCongId()
  const sb = await getAuthedSupabase()
  const { data: semana } = await sb
    .from('semanas_fds').select('id').eq('id', semanaFDSId).eq('congregation_id', congId).maybeSingle()
  if (!semana) return []
  const { data, error } = await sb.from('asignaciones_fds').select('*').eq('semana_fds_id', semanaFDSId)
  if (error) throw new Error(error.message)
  return (data ?? []).map(r => dbToAsignacionFDS(r as Record<string, unknown>))
}

export async function getAllAsignacionesFDS(): Promise<AsignacionFDS[]> {
  const congId = getCongId()
  const sb = await getAuthedSupabase()
  const { data: semanas } = await sb.from('semanas_fds').select('id').eq('congregation_id', congId)
  if (!semanas?.length) return []
  const ids = semanas.map(s => s.id)
  const { data, error } = await sb.from('asignaciones_fds').select('*').in('semana_fds_id', ids)
  if (error) throw new Error(error.message)
  return (data ?? []).map(r => dbToAsignacionFDS(r as Record<string, unknown>))
}

export async function getAllAsignacionesFDSConFecha(): Promise<Array<AsignacionFDS & { fecha: string }>> {
  const congId = getCongId()
  const sb = await getAuthedSupabase()
  const { data: semanas } = await sb.from('semanas_fds').select('id, fecha').eq('congregation_id', congId)
  if (!semanas?.length) return []
  const semanaMap = new Map(semanas.map(s => [s.id, s.fecha as string]))
  const ids = semanas.map(s => s.id)
  const { data, error } = await sb.from('asignaciones_fds').select('*').in('semana_fds_id', ids)
  if (error) throw new Error(error.message)
  return (data ?? []).map(r => ({
    ...dbToAsignacionFDS(r as Record<string, unknown>),
    fecha: semanaMap.get(r.semana_fds_id as string) ?? '',
  }))
}

export async function saveAllAsignacionesFDS(
  semanaFDSId: string,
  asignaciones: Omit<AsignacionFDS, 'id' | 'semanaFDSId'>[]
): Promise<{ error?: string }> {
  try {
    const congId = getCongId()
    const sb = await getAuthedSupabase()
    const { data: semana } = await sb
      .from('semanas_fds').select('id').eq('id', semanaFDSId).eq('congregation_id', congId).maybeSingle()
    if (!semana) return { error: 'Semana FDS no encontrada' }
    await sb.from('asignaciones_fds').delete().eq('semana_fds_id', semanaFDSId)
    if (asignaciones.length > 0) {
      const { error } = await sb.from('asignaciones_fds').insert(
        asignaciones.map(a => ({
          id: randomUUID(),
          semana_fds_id: semanaFDSId,
          congregation_id: congId,
          parte: a.parte,
          hermano_id: a.hermanoId,
        }))
      )
      if (error) return { error: error.message }
    }
    return {}
  } catch (err) {
    return { error: String(err) }
  }
}

// ── Recordatorios por WhatsApp ─────────────────────────────────────
// Envía por WhatsApp (a través del bot) un recordatorio a cada hermano que
// tiene una parte asignada. El bot vive aparte (Railway); acá solo armamos los
// mensajes (con recordatorios-core) y se los mandamos a su "buzón" con una clave.
// La función está habilitada SOLO para la congregación configurada
// (RECORDATORIOS_CONGREGACION, por defecto "Carpinteria"), porque el bot usa un
// único WhatsApp; otras congregaciones no deben disparar envíos.

function normalizarNombre(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
}

function congregacionObjetivo(): string {
  return normalizarNombre(process.env.RECORDATORIOS_CONGREGACION ?? 'Carpinteria')
}

// ¿La congregación logueada tiene habilitados los recordatorios por WhatsApp?
export async function recordatoriosHabilitados(): Promise<boolean> {
  try {
    const nombre = normalizarNombre(await getCongregacion())
    const objetivo = congregacionObjetivo()
    return !!nombre && !!objetivo && (nombre === objetivo || nombre.includes(objetivo))
  } catch {
    return false
  }
}

// Activa/desactiva el aviso AUTOMÁTICO de una reunión puntual (toggle del historial).
// No afecta al botón manual, que envía igual.
export async function setRecordatorioAuto(
  id: string,
  tipo: 'semana' | 'fds',
  valor: boolean,
): Promise<{ error?: string }> {
  try {
    const congId = getCongId()
    const sb = await getAuthedSupabase()
    const tabla = tipo === 'fds' ? 'semanas_fds' : 'semanas'
    const { error } = await sb
      .from(tabla)
      .update({ recordatorio_auto: valor })
      .eq('id', id)
      .eq('congregation_id', congId)
    if (error) return { error: error.message }
    return {}
  } catch (err) {
    return { error: String(err) }
  }
}

// POST de JSON usando el módulo http/https de Node (no fetch). Es el mismo patrón
// que license.ts: en Windows 7 el TLS de fetch/Chromium puede fallar, pero el de
// Node funciona. Sirve tanto para http:// (local) como https:// (Railway).
function postJsonNode(
  url: string,
  payload: unknown,
  timeoutMs = 120000,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    let parsed: URL
    try { parsed = new URL(url) } catch { reject(new Error('La URL del bot no es válida')); return }
    const lib = parsed.protocol === 'http:' ? http : https
    const body = JSON.stringify(payload)
    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'http:' ? 80 : 443),
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      },
      (res) => {
        let data = ''
        res.on('data', (chunk: Buffer) => { data += chunk.toString() })
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }))
      },
    )
    req.setTimeout(timeoutMs, () => req.destroy(new Error('El bot no respondió a tiempo')))
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

// Resultado del envío (tipo interno; el componente lo infiere con Awaited<ReturnType<...>>).
interface ResultadoRecordatorios {
  ok: boolean
  enviados: number
  errores: number
  sinTelefono: string[]
  totalConParte: number
  detalleErrores: string[]
  mensajeError?: string
}

// Envía los recordatorios de TODA la semana (entre semana + fin de semana) de la
// semana a la que pertenece `fechaReferencia` (la fecha de la reunión que se está
// viendo). Junta las partes de ambas reuniones en un solo mensaje por hermano.
export async function enviarRecordatoriosSemanaCompleta(
  fechaReferencia: string,
): Promise<ResultadoRecordatorios> {
  const base: ResultadoRecordatorios = {
    ok: false, enviados: 0, errores: 0, sinTelefono: [], totalConParte: 0, detalleErrores: [],
  }

  const url = process.env.BOT_RECORDATORIOS_URL
  const secret = process.env.BOT_RECORDATORIOS_SECRET
  if (!url || !secret) {
    return { ...base, mensajeError: 'El bot de recordatorios todavía no está configurado (faltan las variables BOT_RECORDATORIOS_URL y BOT_RECORDATORIOS_SECRET).' }
  }

  if (!(await recordatoriosHabilitados())) {
    return { ...base, mensajeError: 'Los recordatorios por WhatsApp están habilitados solo para la congregación configurada.' }
  }

  try {
    const congId = getCongId()
    const sb = await getAuthedSupabase()
    const { mensajes, sinTelefono, totalConParte } =
      await armarMensajesRecordatorio(sb, congId, fechaReferencia, 'semana-completa')

    base.totalConParte = totalConParte
    base.sinTelefono = sinTelefono

    if (mensajes.length === 0) {
      return {
        ...base,
        ok: true,
        mensajeError: sinTelefono.length
          ? 'Ninguno de los asignados tiene teléfono cargado.'
          : 'No hay hermanos asignados en esta semana.',
      }
    }

    let resp: { status: number; body: string }
    try {
      resp = await postJsonNode(url, { secret, mensajes })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { ...base, mensajeError: `No se pudo contactar al bot: ${msg}` }
    }

    let data: {
      ok?: boolean
      error?: string
      enviados?: number
      errores?: number
      detalle?: Array<{ nombre?: string; ok?: boolean; error?: string }>
    } | null = null
    try { data = JSON.parse(resp.body) } catch { /* respuesta no-JSON */ }

    if (resp.status < 200 || resp.status >= 300 || !data?.ok) {
      return { ...base, mensajeError: data?.error ?? `El bot respondió con un error (HTTP ${resp.status}).` }
    }

    base.enviados = data.enviados ?? mensajes.length
    base.errores = data.errores ?? 0
    base.detalleErrores = (data.detalle ?? [])
      .filter(d => d.ok === false)
      .map(d => `${d.nombre ?? '?'}: ${d.error ?? 'error'}`)
    base.ok = true
    return base
  } catch (err) {
    return { ...base, mensajeError: String(err) }
  }
}
