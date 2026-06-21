'use server'

import { cookies } from 'next/headers'
import { randomUUID } from 'crypto'
import { getSupabase } from './supabase'
import {
  Hermano, Semana, Asignacion, ParteTipo,
  SemanaFDS, AsignacionFDS, ParteTipoFDS,
} from './types'

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
    microfonista1: (r.microfonista_1 as string | null) ?? undefined,
    microfonista2: (r.microfonista_2 as string | null) ?? undefined,
    acomodador1: (r.acomodador_1 as string | null) ?? undefined,
    acomodador2: (r.acomodador_2 as string | null) ?? undefined,
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
  const sb = getSupabase()
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
    const sb = getSupabase()
    const { error } = await sb.from('hermanos').upsert({
      id: hermano.id,
      congregation_id: congId,
      nombre: hermano.nombre,
      genero: hermano.genero,
      rol: hermano.rol,
      activo: hermano.activo,
      notas: hermano.notas ?? null,
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
  const sb = getSupabase()
  const { error } = await sb.from('hermanos').delete().eq('id', id).eq('congregation_id', congId)
  if (error) throw new Error(error.message)
}

// ── Semanas entre semana ──────────────────────────────────────────

export async function getSemanas(): Promise<Semana[]> {
  const congId = getCongId()
  const sb = getSupabase()
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
  const sb = getSupabase()
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
    const sb = getSupabase()
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
    })
    if (error) return { error: error.message }
    return {}
  } catch (err) {
    return { error: String(err) }
  }
}

export async function deleteSemana(id: string): Promise<void> {
  const congId = getCongId()
  const sb = getSupabase()
  const { error } = await sb.from('semanas').delete().eq('id', id).eq('congregation_id', congId)
  if (error) throw new Error(error.message)
}

// ── Asignaciones entre semana ─────────────────────────────────────

export async function getAsignaciones(semanaId: string): Promise<Asignacion[]> {
  const congId = getCongId()
  const sb = getSupabase()
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
  const sb = getSupabase()
  const { data: semanas } = await sb.from('semanas').select('id').eq('congregation_id', congId)
  if (!semanas?.length) return []
  const ids = semanas.map(s => s.id)
  const { data, error } = await sb.from('asignaciones').select('*').in('semana_id', ids)
  if (error) throw new Error(error.message)
  return (data ?? []).map(r => dbToAsignacion(r as Record<string, unknown>))
}

export async function getAllAsignacionesConFecha(): Promise<Array<Asignacion & { fecha: string }>> {
  const congId = getCongId()
  const sb = getSupabase()
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
    const sb = getSupabase()
    const { data: semana } = await sb
      .from('semanas').select('id').eq('id', semanaId).eq('congregation_id', congId).maybeSingle()
    if (!semana) return { error: 'Semana no encontrada' }
    await sb.from('asignaciones').delete().eq('semana_id', semanaId)
    if (asignaciones.length > 0) {
      const { error } = await sb.from('asignaciones').insert(
        asignaciones.map(a => ({
          id: randomUUID(),
          semana_id: semanaId,
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
  const sb = getSupabase()
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
  const sb = getSupabase()
  const { data } = await sb.from('congregaciones').select('nombre').eq('id', congId).maybeSingle()
  return (data?.nombre as string) ?? ''
}

export async function saveCongregacion(nombre: string): Promise<void> {
  const congId = getCongId()
  const sb = getSupabase()
  await sb.from('congregaciones').update({ nombre }).eq('id', congId)
}

// ── Semanas fin de semana ─────────────────────────────────────────

export async function getSemanasFDS(): Promise<SemanaFDS[]> {
  const congId = getCongId()
  const sb = getSupabase()
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
  const sb = getSupabase()
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
    const sb = getSupabase()
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
      microfonista_1: semana.microfonista1 ?? null,
      microfonista_2: semana.microfonista2 ?? null,
      acomodador_1: semana.acomodador1 ?? null,
      acomodador_2: semana.acomodador2 ?? null,
    })
    if (error) return { error: error.message }
    return {}
  } catch (err) {
    return { error: String(err) }
  }
}

export async function deleteSemanaFDS(id: string): Promise<void> {
  const congId = getCongId()
  const sb = getSupabase()
  const { error } = await sb.from('semanas_fds').delete().eq('id', id).eq('congregation_id', congId)
  if (error) throw new Error(error.message)
}

// ── Asignaciones fin de semana ────────────────────────────────────

export async function getAsignacionesFDS(semanaFDSId: string): Promise<AsignacionFDS[]> {
  const congId = getCongId()
  const sb = getSupabase()
  const { data: semana } = await sb
    .from('semanas_fds').select('id').eq('id', semanaFDSId).eq('congregation_id', congId).maybeSingle()
  if (!semana) return []
  const { data, error } = await sb.from('asignaciones_fds').select('*').eq('semana_fds_id', semanaFDSId)
  if (error) throw new Error(error.message)
  return (data ?? []).map(r => dbToAsignacionFDS(r as Record<string, unknown>))
}

export async function getAllAsignacionesFDS(): Promise<AsignacionFDS[]> {
  const congId = getCongId()
  const sb = getSupabase()
  const { data: semanas } = await sb.from('semanas_fds').select('id').eq('congregation_id', congId)
  if (!semanas?.length) return []
  const ids = semanas.map(s => s.id)
  const { data, error } = await sb.from('asignaciones_fds').select('*').in('semana_fds_id', ids)
  if (error) throw new Error(error.message)
  return (data ?? []).map(r => dbToAsignacionFDS(r as Record<string, unknown>))
}

export async function getAllAsignacionesFDSConFecha(): Promise<Array<AsignacionFDS & { fecha: string }>> {
  const congId = getCongId()
  const sb = getSupabase()
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
    const sb = getSupabase()
    const { data: semana } = await sb
      .from('semanas_fds').select('id').eq('id', semanaFDSId).eq('congregation_id', congId).maybeSingle()
    if (!semana) return { error: 'Semana FDS no encontrada' }
    await sb.from('asignaciones_fds').delete().eq('semana_fds_id', semanaFDSId)
    if (asignaciones.length > 0) {
      const { error } = await sb.from('asignaciones_fds').insert(
        asignaciones.map(a => ({
          id: randomUUID(),
          semana_fds_id: semanaFDSId,
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
