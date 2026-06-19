'use server'

import { cookies } from 'next/headers'
import { randomUUID } from 'crypto'
import { getDb, getConfigValue, setConfigValue } from './db'
import {
  Hermano, Semana, Asignacion, ParteTipo,
  SemanaFDS, AsignacionFDS, ParteTipoFDS,
} from './types'

// Solo verifica que exista la cookie de sesión; no filtra queries por congId
// porque la DB local tiene una única congregación.
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
    activo: Boolean(r.activo),
    notas: (r.notas as string | null) ?? undefined,
    privilegios: r.privilegios ? JSON.parse(r.privilegios as string) : undefined,
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
    titulos: r.titulos ? JSON.parse(r.titulos as string) : {},
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
  getCongId()
  const db = getDb()
  const rows = db.prepare('SELECT * FROM hermanos ORDER BY nombre').all() as Record<string, unknown>[]
  return rows.map(dbToHermano)
}

export async function saveHermano(hermano: Hermano): Promise<void> {
  getCongId()
  const db = getDb()
  db.prepare(`
    INSERT INTO hermanos (id, nombre, genero, rol, activo, notas, privilegios)
    VALUES (@id, @nombre, @genero, @rol, @activo, @notas, @privilegios)
    ON CONFLICT(id) DO UPDATE SET
      nombre = excluded.nombre,
      genero = excluded.genero,
      rol = excluded.rol,
      activo = excluded.activo,
      notas = excluded.notas,
      privilegios = excluded.privilegios
  `).run({
    id: hermano.id,
    nombre: hermano.nombre,
    genero: hermano.genero,
    rol: hermano.rol,
    activo: hermano.activo ? 1 : 0,
    notas: hermano.notas ?? null,
    privilegios: hermano.privilegios ? JSON.stringify(hermano.privilegios) : null,
  })
}

export async function deleteHermano(id: string): Promise<void> {
  getCongId()
  const db = getDb()
  // Las FKs con ON DELETE CASCADE eliminan asignaciones automáticamente
  db.prepare('DELETE FROM hermanos WHERE id = ?').run(id)
}

// ── Semanas entre semana ───────────────────────────────────────────────────

export async function getSemanas(): Promise<Semana[]> {
  getCongId()
  const db = getDb()
  const rows = db.prepare('SELECT * FROM semanas ORDER BY fecha').all() as Record<string, unknown>[]
  return rows.map(dbToSemana)
}

export async function getSemana(id: string): Promise<Semana | undefined> {
  getCongId()
  const db = getDb()
  const row = db.prepare('SELECT * FROM semanas WHERE id = ?').get(id) as Record<string, unknown> | undefined
  return row ? dbToSemana(row) : undefined
}

export async function saveSemana(semana: Semana): Promise<void> {
  getCongId()
  const db = getDb()
  db.prepare(`
    INSERT INTO semanas (id, fecha, tema, lectura_biblica, cancion_apertura, cancion_intermedia, cancion_cierre, num_estudiantes, titulos)
    VALUES (@id, @fecha, @tema, @lectura_biblica, @cancion_apertura, @cancion_intermedia, @cancion_cierre, @num_estudiantes, @titulos)
    ON CONFLICT(id) DO UPDATE SET
      fecha = excluded.fecha,
      tema = excluded.tema,
      lectura_biblica = excluded.lectura_biblica,
      cancion_apertura = excluded.cancion_apertura,
      cancion_intermedia = excluded.cancion_intermedia,
      cancion_cierre = excluded.cancion_cierre,
      num_estudiantes = excluded.num_estudiantes,
      titulos = excluded.titulos
  `).run({
    id: semana.id,
    fecha: semana.fecha,
    tema: semana.tema ?? null,
    lectura_biblica: semana.lecturaBiblica ?? null,
    cancion_apertura: semana.cancionApertura ?? null,
    cancion_intermedia: semana.cancionIntermedia ?? null,
    cancion_cierre: semana.cancionCierre ?? null,
    num_estudiantes: semana.numEstudiantes ?? null,
    titulos: semana.titulos ? JSON.stringify(semana.titulos) : null,
  })
}

export async function deleteSemana(id: string): Promise<void> {
  getCongId()
  const db = getDb()
  db.prepare('DELETE FROM semanas WHERE id = ?').run(id)
}

// ── Asignaciones entre semana ──────────────────────────────────────────────

export async function getAsignaciones(semanaId: string): Promise<Asignacion[]> {
  getCongId()
  const db = getDb()
  const rows = db.prepare('SELECT * FROM asignaciones WHERE semana_id = ?').all(semanaId) as Record<string, unknown>[]
  return rows.map(dbToAsignacion)
}

export async function getAllAsignaciones(): Promise<Asignacion[]> {
  getCongId()
  const db = getDb()
  const rows = db.prepare('SELECT * FROM asignaciones').all() as Record<string, unknown>[]
  return rows.map(dbToAsignacion)
}

export async function getAllAsignacionesConFecha(): Promise<Array<Asignacion & { fecha: string }>> {
  getCongId()
  const db = getDb()
  const rows = db.prepare(`
    SELECT a.*, s.fecha
    FROM asignaciones a
    INNER JOIN semanas s ON a.semana_id = s.id
  `).all() as Record<string, unknown>[]
  return rows.map(r => ({ ...dbToAsignacion(r), fecha: r.fecha as string }))
}

export async function saveAllAsignaciones(
  semanaId: string,
  asignaciones: Omit<Asignacion, 'id' | 'semanaId'>[]
): Promise<void> {
  getCongId()
  const db = getDb()
  const deleteStmt = db.prepare('DELETE FROM asignaciones WHERE semana_id = ?')
  const insertStmt = db.prepare(
    'INSERT INTO asignaciones (id, semana_id, parte, hermano_id) VALUES (?, ?, ?, ?)'
  )
  db.transaction(() => {
    deleteStmt.run(semanaId)
    for (const a of asignaciones) {
      insertStmt.run(randomUUID(), semanaId, a.parte, a.hermanoId)
    }
  })()
}

export async function getAsignacionesHermano(
  hermanoId: string
): Promise<Array<{ semana: Semana; parte: ParteTipo }>> {
  getCongId()
  const db = getDb()
  const rows = db.prepare(`
    SELECT a.parte, s.*
    FROM asignaciones a
    INNER JOIN semanas s ON a.semana_id = s.id
    WHERE a.hermano_id = ?
    ORDER BY s.fecha
  `).all(hermanoId) as Record<string, unknown>[]
  return rows.map(r => ({
    semana: dbToSemana(r),
    parte: r.parte as ParteTipo,
  }))
}

// ── Congregación ───────────────────────────────────────────────────────────

export async function getCongregacion(): Promise<string> {
  getCongId()
  return getConfigValue('congregation_name') ?? ''
}

export async function saveCongregacion(nombre: string): Promise<void> {
  getCongId()
  setConfigValue('congregation_name', nombre)
}

// ── Semanas fin de semana ──────────────────────────────────────────────────

export async function getSemanasFDS(): Promise<SemanaFDS[]> {
  getCongId()
  const db = getDb()
  const rows = db.prepare('SELECT * FROM semanas_fds ORDER BY fecha').all() as Record<string, unknown>[]
  return rows.map(dbToSemanaFDS)
}

export async function getSemanaFDS(id: string): Promise<SemanaFDS | undefined> {
  getCongId()
  const db = getDb()
  const row = db.prepare('SELECT * FROM semanas_fds WHERE id = ?').get(id) as Record<string, unknown> | undefined
  return row ? dbToSemanaFDS(row) : undefined
}

export async function saveSemanaFDS(semana: SemanaFDS): Promise<void> {
  getCongId()
  const db = getDb()
  db.prepare(`
    INSERT INTO semanas_fds (id, fecha, fecha_locale, titulo_articulo, cancion_apertura, cancion_intermedia, cancion_cierre, boceto, disertacion_titulo, orador_nombre, orador_congregacion)
    VALUES (@id, @fecha, @fecha_locale, @titulo_articulo, @cancion_apertura, @cancion_intermedia, @cancion_cierre, @boceto, @disertacion_titulo, @orador_nombre, @orador_congregacion)
    ON CONFLICT(id) DO UPDATE SET
      fecha = excluded.fecha,
      fecha_locale = excluded.fecha_locale,
      titulo_articulo = excluded.titulo_articulo,
      cancion_apertura = excluded.cancion_apertura,
      cancion_intermedia = excluded.cancion_intermedia,
      cancion_cierre = excluded.cancion_cierre,
      boceto = excluded.boceto,
      disertacion_titulo = excluded.disertacion_titulo,
      orador_nombre = excluded.orador_nombre,
      orador_congregacion = excluded.orador_congregacion
  `).run({
    id: semana.id,
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
  getCongId()
  const db = getDb()
  db.prepare('DELETE FROM semanas_fds WHERE id = ?').run(id)
}

// ── Asignaciones fin de semana ─────────────────────────────────────────────

export async function getAsignacionesFDS(semanaFDSId: string): Promise<AsignacionFDS[]> {
  getCongId()
  const db = getDb()
  const rows = db.prepare('SELECT * FROM asignaciones_fds WHERE semana_fds_id = ?').all(semanaFDSId) as Record<string, unknown>[]
  return rows.map(dbToAsignacionFDS)
}

export async function getAllAsignacionesFDS(): Promise<AsignacionFDS[]> {
  getCongId()
  const db = getDb()
  const rows = db.prepare('SELECT * FROM asignaciones_fds').all() as Record<string, unknown>[]
  return rows.map(dbToAsignacionFDS)
}

export async function getAllAsignacionesFDSConFecha(): Promise<Array<AsignacionFDS & { fecha: string }>> {
  getCongId()
  const db = getDb()
  const rows = db.prepare(`
    SELECT a.*, s.fecha
    FROM asignaciones_fds a
    INNER JOIN semanas_fds s ON a.semana_fds_id = s.id
  `).all() as Record<string, unknown>[]
  return rows.map(r => ({ ...dbToAsignacionFDS(r), fecha: r.fecha as string }))
}

export async function saveAllAsignacionesFDS(
  semanaFDSId: string,
  asignaciones: Omit<AsignacionFDS, 'id' | 'semanaFDSId'>[]
): Promise<void> {
  getCongId()
  const db = getDb()
  const deleteStmt = db.prepare('DELETE FROM asignaciones_fds WHERE semana_fds_id = ?')
  const insertStmt = db.prepare(
    'INSERT INTO asignaciones_fds (id, semana_fds_id, parte, hermano_id) VALUES (?, ?, ?, ?)'
  )
  db.transaction(() => {
    deleteStmt.run(semanaFDSId)
    for (const a of asignaciones) {
      insertStmt.run(randomUUID(), semanaFDSId, a.parte, a.hermanoId)
    }
  })()
}
