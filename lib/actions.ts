'use server'

import { cookies } from 'next/headers'
import { supabase } from './supabase'
import {
  Hermano, Semana, Asignacion, ParteTipo,
  SemanaFDS, AsignacionFDS, ParteTipoFDS,
} from './types'

function getCongId(): string {
  const id = cookies().get('congregation_id')?.value
  if (!id) throw new Error('No congregation_id cookie')
  return id
}

// ── Mappers ────────────────────────────────────────────────────────────────

function dbToHermano(r: Record<string, unknown>): Hermano {
  return {
    id: r.id as string,
    nombre: r.nombre as string,
    genero: r.genero as Hermano['genero'],
    rol: r.rol as Hermano['rol'],
    activo: r.activo as boolean,
    notas: r.notas as string | undefined,
    privilegios: r.privilegios as Hermano['privilegios'],
  }
}

function dbToSemana(r: Record<string, unknown>): Semana {
  return {
    id: r.id as string,
    fecha: r.fecha as string,
    tema: (r.tema as string) ?? '',
    lecturaBiblica: (r.lectura_biblica as string) ?? '',
    cancionApertura: r.cancion_apertura as number | undefined,
    cancionIntermedia: r.cancion_intermedia as number | undefined,
    cancionCierre: r.cancion_cierre as number | undefined,
    numEstudiantes: r.num_estudiantes as number | undefined,
    titulos: (r.titulos as Partial<Record<ParteTipo, string>>) ?? {},
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
    fechaLocale: r.fecha_locale as string | undefined,
    tituloArticulo: r.titulo_articulo as string | undefined,
    cancionApertura: r.cancion_apertura as number | undefined,
    cancionIntermedia: r.cancion_intermedia as number | undefined,
    cancionCierre: r.cancion_cierre as number | undefined,
    boceto: r.boceto as number | undefined,
    disertacionTitulo: r.disertacion_titulo as string | undefined,
    oradorNombre: r.orador_nombre as string | undefined,
    oradorCongregacion: r.orador_congregacion as string | undefined,
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

// ── Hermanos ───────────────────────────────────────────────────────────────

export async function getHermanos(): Promise<Hermano[]> {
  const congId = getCongId()
  const { data } = await supabase
    .from('hermanos')
    .select('*')
    .eq('congregation_id', congId)
    .order('nombre')
  return (data ?? []).map(dbToHermano)
}

export async function saveHermano(hermano: Hermano): Promise<void> {
  const congId = getCongId()
  await supabase.from('hermanos').upsert({
    id: hermano.id,
    congregation_id: congId,
    nombre: hermano.nombre,
    genero: hermano.genero,
    rol: hermano.rol,
    activo: hermano.activo,
    notas: hermano.notas ?? null,
    privilegios: hermano.privilegios ?? null,
  })
}

export async function deleteHermano(id: string): Promise<void> {
  const congId = getCongId()
  await supabase.from('asignaciones').delete().eq('hermano_id', id).eq('congregation_id', congId)
  await supabase.from('asignaciones_fds').delete().eq('hermano_id', id).eq('congregation_id', congId)
  await supabase.from('hermanos').delete().eq('id', id).eq('congregation_id', congId)
}

// ── Semanas entre semana ───────────────────────────────────────────────────

export async function getSemanas(): Promise<Semana[]> {
  const congId = getCongId()
  const { data } = await supabase
    .from('semanas')
    .select('*')
    .eq('congregation_id', congId)
    .order('fecha')
  return (data ?? []).map(dbToSemana)
}

export async function getSemana(id: string): Promise<Semana | undefined> {
  const congId = getCongId()
  const { data } = await supabase
    .from('semanas')
    .select('*')
    .eq('id', id)
    .eq('congregation_id', congId)
    .maybeSingle()
  return data ? dbToSemana(data) : undefined
}

export async function saveSemana(semana: Semana): Promise<void> {
  const congId = getCongId()
  await supabase.from('semanas').upsert({
    id: semana.id,
    congregation_id: congId,
    fecha: semana.fecha,
    tema: semana.tema,
    lectura_biblica: semana.lecturaBiblica,
    cancion_apertura: semana.cancionApertura ?? null,
    cancion_intermedia: semana.cancionIntermedia ?? null,
    cancion_cierre: semana.cancionCierre ?? null,
    num_estudiantes: semana.numEstudiantes ?? null,
    titulos: semana.titulos,
  })
}

export async function deleteSemana(id: string): Promise<void> {
  const congId = getCongId()
  await supabase.from('asignaciones').delete().eq('semana_id', id).eq('congregation_id', congId)
  await supabase.from('semanas').delete().eq('id', id).eq('congregation_id', congId)
}

// ── Asignaciones entre semana ──────────────────────────────────────────────

export async function getAsignaciones(semanaId: string): Promise<Asignacion[]> {
  const congId = getCongId()
  const { data } = await supabase
    .from('asignaciones')
    .select('*')
    .eq('semana_id', semanaId)
    .eq('congregation_id', congId)
  return (data ?? []).map(dbToAsignacion)
}

export async function getAllAsignaciones(): Promise<Asignacion[]> {
  const congId = getCongId()
  const { data } = await supabase
    .from('asignaciones')
    .select('*')
    .eq('congregation_id', congId)
  return (data ?? []).map(dbToAsignacion)
}

export async function getAllAsignacionesConFecha(): Promise<Array<Asignacion & { fecha: string }>> {
  const congId = getCongId()
  const { data } = await supabase
    .from('asignaciones')
    .select('*, semanas!inner(fecha)')
    .eq('congregation_id', congId)
  return (data ?? []).map(r => ({
    ...dbToAsignacion(r as unknown as Record<string, unknown>),
    fecha: (r.semanas as unknown as { fecha: string } | null)?.fecha ?? '',
  }))
}

export async function saveAllAsignaciones(
  semanaId: string,
  asignaciones: Omit<Asignacion, 'id' | 'semanaId'>[]
): Promise<void> {
  const congId = getCongId()
  await supabase.from('asignaciones').delete().eq('semana_id', semanaId).eq('congregation_id', congId)
  if (asignaciones.length === 0) return
  await supabase.from('asignaciones').insert(
    asignaciones.map(a => ({
      id: crypto.randomUUID(),
      congregation_id: congId,
      semana_id: semanaId,
      parte: a.parte,
      hermano_id: a.hermanoId,
    }))
  )
}

export async function getAsignacionesHermano(
  hermanoId: string
): Promise<Array<{ semana: Semana; parte: ParteTipo }>> {
  const congId = getCongId()
  const { data } = await supabase
    .from('asignaciones')
    .select('parte, semanas(*)')
    .eq('hermano_id', hermanoId)
    .eq('congregation_id', congId)
  return (data ?? [])
    .filter(r => r.semanas)
    .map(r => ({
      semana: dbToSemana(r.semanas as unknown as Record<string, unknown>),
      parte: r.parte as ParteTipo,
    }))
}

// ── Congregación ───────────────────────────────────────────────────────────

export async function getCongregacion(): Promise<string> {
  const congId = getCongId()
  const { data } = await supabase
    .from('congregations')
    .select('name')
    .eq('id', congId)
    .maybeSingle()
  return data?.name ?? ''
}

export async function saveCongregacion(nombre: string): Promise<void> {
  const congId = getCongId()
  await supabase.from('congregations').update({ name: nombre }).eq('id', congId)
}

// ── Semanas fin de semana ──────────────────────────────────────────────────

export async function getSemanasFDS(): Promise<SemanaFDS[]> {
  const congId = getCongId()
  const { data } = await supabase
    .from('semanas_fds')
    .select('*')
    .eq('congregation_id', congId)
    .order('fecha')
  return (data ?? []).map(dbToSemanaFDS)
}

export async function getSemanaFDS(id: string): Promise<SemanaFDS | undefined> {
  const congId = getCongId()
  const { data } = await supabase
    .from('semanas_fds')
    .select('*')
    .eq('id', id)
    .eq('congregation_id', congId)
    .maybeSingle()
  return data ? dbToSemanaFDS(data) : undefined
}

export async function saveSemanaFDS(semana: SemanaFDS): Promise<void> {
  const congId = getCongId()
  await supabase.from('semanas_fds').upsert({
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
  })
}

export async function deleteSemanaFDS(id: string): Promise<void> {
  const congId = getCongId()
  await supabase.from('asignaciones_fds').delete().eq('semana_fds_id', id).eq('congregation_id', congId)
  await supabase.from('semanas_fds').delete().eq('id', id).eq('congregation_id', congId)
}

// ── Asignaciones fin de semana ─────────────────────────────────────────────

export async function getAsignacionesFDS(semanaFDSId: string): Promise<AsignacionFDS[]> {
  const congId = getCongId()
  const { data } = await supabase
    .from('asignaciones_fds')
    .select('*')
    .eq('semana_fds_id', semanaFDSId)
    .eq('congregation_id', congId)
  return (data ?? []).map(dbToAsignacionFDS)
}

export async function getAllAsignacionesFDS(): Promise<AsignacionFDS[]> {
  const congId = getCongId()
  const { data } = await supabase
    .from('asignaciones_fds')
    .select('*')
    .eq('congregation_id', congId)
  return (data ?? []).map(dbToAsignacionFDS)
}

export async function getAllAsignacionesFDSConFecha(): Promise<Array<AsignacionFDS & { fecha: string }>> {
  const congId = getCongId()
  const { data } = await supabase
    .from('asignaciones_fds')
    .select('*, semanas_fds!inner(fecha)')
    .eq('congregation_id', congId)
  return (data ?? []).map(r => ({
    ...dbToAsignacionFDS(r as unknown as Record<string, unknown>),
    fecha: (r.semanas_fds as unknown as { fecha: string } | null)?.fecha ?? '',
  }))
}

export async function saveAllAsignacionesFDS(
  semanaFDSId: string,
  asignaciones: Omit<AsignacionFDS, 'id' | 'semanaFDSId'>[]
): Promise<void> {
  const congId = getCongId()
  await supabase.from('asignaciones_fds').delete().eq('semana_fds_id', semanaFDSId).eq('congregation_id', congId)
  if (asignaciones.length === 0) return
  await supabase.from('asignaciones_fds').insert(
    asignaciones.map(a => ({
      id: crypto.randomUUID(),
      congregation_id: congId,
      semana_fds_id: semanaFDSId,
      parte: a.parte,
      hermano_id: a.hermanoId,
    }))
  )
}
