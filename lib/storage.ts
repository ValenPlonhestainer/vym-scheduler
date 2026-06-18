import { AppData, Hermano, Semana, Asignacion, ParteTipo, SemanaFDS, AsignacionFDS, ParteTipoFDS } from './types'

const STORAGE_KEY = 'vym_scheduler_data'

const defaultData: AppData = {
  hermanos: [],
  semanas: [],
  asignaciones: [],
  congregacion: 'Mi Congregación',
}

export function getData(): AppData {
  if (typeof window === 'undefined') return defaultData
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultData
    return { ...defaultData, ...JSON.parse(raw) }
  } catch {
    return defaultData
  }
}

export function saveData(data: AppData): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function getHermanos(): Hermano[] {
  return getData().hermanos
}

export function saveHermano(hermano: Hermano): void {
  const data = getData()
  const idx = data.hermanos.findIndex(h => h.id === hermano.id)
  if (idx >= 0) {
    data.hermanos[idx] = hermano
  } else {
    data.hermanos.push(hermano)
  }
  saveData(data)
}

export function deleteHermano(id: string): void {
  const data = getData()
  data.hermanos = data.hermanos.filter(h => h.id !== id)
  data.asignaciones = data.asignaciones.filter(a => a.hermanoId !== id)
  saveData(data)
}

export function getSemanas(): Semana[] {
  return getData().semanas.sort((a, b) => a.fecha.localeCompare(b.fecha))
}

export function getSemana(id: string): Semana | undefined {
  return getData().semanas.find(s => s.id === id)
}

export function saveSemana(semana: Semana): void {
  const data = getData()
  const idx = data.semanas.findIndex(s => s.id === semana.id)
  if (idx >= 0) {
    data.semanas[idx] = semana
  } else {
    data.semanas.push(semana)
  }
  saveData(data)
}

export function deleteSemana(id: string): void {
  const data = getData()
  data.semanas = data.semanas.filter(s => s.id !== id)
  data.asignaciones = data.asignaciones.filter(a => a.semanaId !== id)
  saveData(data)
}

export function getAsignaciones(semanaId: string): Asignacion[] {
  return getData().asignaciones.filter(a => a.semanaId === semanaId)
}

export function getAllAsignaciones(): Asignacion[] {
  return getData().asignaciones
}

export function saveAsignacion(asignacion: Asignacion): void {
  const data = getData()
  const idx = data.asignaciones.findIndex(
    a => a.semanaId === asignacion.semanaId && a.parte === asignacion.parte
  )
  if (idx >= 0) {
    data.asignaciones[idx] = asignacion
  } else {
    data.asignaciones.push(asignacion)
  }
  saveData(data)
}

export function deleteAsignacion(semanaId: string, parte: ParteTipo): void {
  const data = getData()
  data.asignaciones = data.asignaciones.filter(
    a => !(a.semanaId === semanaId && a.parte === parte)
  )
  saveData(data)
}

export function saveAllAsignaciones(semanaId: string, asignaciones: Omit<Asignacion, 'id' | 'semanaId'>[]): void {
  const data = getData()
  data.asignaciones = data.asignaciones.filter(a => a.semanaId !== semanaId)
  const nuevas: Asignacion[] = asignaciones.map(a => ({
    id: crypto.randomUUID(),
    semanaId,
    parte: a.parte,
    hermanoId: a.hermanoId,
  }))
  data.asignaciones.push(...nuevas)
  saveData(data)
}

export function getCongregacion(): string {
  return getData().congregacion
}

export function saveCongregacion(nombre: string): void {
  const data = getData()
  data.congregacion = nombre
  saveData(data)
}

export function getUltimaAsignacion(hermanoId: string, parte: ParteTipo): string | null {
  const data = getData()
  const asigs = data.asignaciones
    .filter(a => a.hermanoId === hermanoId && a.parte === parte)
    .map(a => {
      const semana = data.semanas.find(s => s.id === a.semanaId)
      return semana?.fecha ?? null
    })
    .filter(Boolean) as string[]

  if (asigs.length === 0) return null
  return asigs.sort().reverse()[0]
}

export function getAsignacionesHermano(hermanoId: string): Array<{ semana: Semana; parte: ParteTipo }> {
  const data = getData()
  return data.asignaciones
    .filter(a => a.hermanoId === hermanoId)
    .map(a => {
      const semana = data.semanas.find(s => s.id === a.semanaId)
      return semana ? { semana, parte: a.parte } : null
    })
    .filter(Boolean) as Array<{ semana: Semana; parte: ParteTipo }>
}

export function hermanoTieneAsignacionEnSemana(hermanoId: string, semanaId: string, excludeParte?: ParteTipo): boolean {
  const data = getData()
  return data.asignaciones.some(
    a => a.hermanoId === hermanoId && a.semanaId === semanaId && a.parte !== excludeParte
  )
}

// ── Fin de semana ─────────────────────────────────────────────

export function getSemanasFDS(): SemanaFDS[] {
  return (getData().semanasFDS ?? []).sort((a, b) => a.fecha.localeCompare(b.fecha))
}

export function getSemanaFDS(id: string): SemanaFDS | undefined {
  return (getData().semanasFDS ?? []).find(s => s.id === id)
}

export function saveSemanaFDS(semana: SemanaFDS): void {
  const data = getData()
  if (!data.semanasFDS) data.semanasFDS = []
  const idx = data.semanasFDS.findIndex(s => s.id === semana.id)
  if (idx >= 0) {
    data.semanasFDS[idx] = semana
  } else {
    data.semanasFDS.push(semana)
  }
  saveData(data)
}

export function deleteSemanaFDS(id: string): void {
  const data = getData()
  data.semanasFDS = (data.semanasFDS ?? []).filter(s => s.id !== id)
  data.asignacionesFDS = (data.asignacionesFDS ?? []).filter(a => a.semanaFDSId !== id)
  saveData(data)
}

export function getAsignacionesFDS(semanaFDSId: string): AsignacionFDS[] {
  return (getData().asignacionesFDS ?? []).filter(a => a.semanaFDSId === semanaFDSId)
}

export function saveAllAsignacionesFDS(semanaFDSId: string, asignaciones: Omit<AsignacionFDS, 'id' | 'semanaFDSId'>[]): void {
  const data = getData()
  if (!data.asignacionesFDS) data.asignacionesFDS = []
  data.asignacionesFDS = data.asignacionesFDS.filter(a => a.semanaFDSId !== semanaFDSId)
  const nuevas: AsignacionFDS[] = asignaciones.map(a => ({
    id: crypto.randomUUID(),
    semanaFDSId,
    parte: a.parte,
    hermanoId: a.hermanoId,
  }))
  data.asignacionesFDS.push(...nuevas)
  saveData(data)
}

export function getUltimaAsignacionFDS(hermanoId: string, parte: ParteTipoFDS): string | null {
  const data = getData()
  const fechas = (data.asignacionesFDS ?? [])
    .filter(a => a.hermanoId === hermanoId && a.parte === parte)
    .map(a => (data.semanasFDS ?? []).find(s => s.id === a.semanaFDSId)?.fecha ?? null)
    .filter(Boolean) as string[]
  if (fechas.length === 0) return null
  return fechas.sort().reverse()[0]
}

export function hermanoTieneAsignacionEnSemanaFDS(hermanoId: string, semanaFDSId: string, excludeParte?: ParteTipoFDS): boolean {
  return (getData().asignacionesFDS ?? []).some(
    a => a.hermanoId === hermanoId && a.semanaFDSId === semanaFDSId && a.parte !== excludeParte
  )
}
