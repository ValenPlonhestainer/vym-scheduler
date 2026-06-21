export type Genero = 'masculino' | 'femenino'
export type Rol = 'anciano' | 'siervo' | 'publicador' | 'hermana'

export interface Privilegios {
  oracion: boolean
  discurso_tesoros: boolean
  busquemos_perlas: boolean
  lectura_biblica: boolean
  estudiante_conversacion: boolean
  estudiante_discurso: boolean
  estudiante_aux_conversacion: boolean
  estudiante_aux_discurso: boolean
  ayudante_estudiante: boolean
  partes_vida_cristiana: boolean
  presidente_reunion: boolean
  conductor_estudio: boolean
  lector_estudio: boolean
  presidente_fin_semana: boolean
  lector_atalaya: boolean
}

export interface Hermano {
  id: string
  nombre: string
  genero: Genero
  rol: Rol
  activo: boolean
  notas?: string
  privilegios?: Privilegios
}

export type ParteTipo =
  | 'oracion_apertura'
  | 'presidente'
  | 'discurso_tesoros'
  | 'perlas_escondidas'
  | 'lectura_biblica'
  | 'estudiante_1'
  | 'ayudante_1'
  | 'estudiante_2'
  | 'ayudante_2'
  | 'estudiante_3'
  | 'ayudante_3'
  | 'estudiante_4'
  | 'ayudante_4'
  | 'aux_estudiante_1'
  | 'aux_ayudante_1'
  | 'aux_estudiante_2'
  | 'aux_ayudante_2'
  | 'aux_estudiante_3'
  | 'aux_ayudante_3'
  | 'aux_estudiante_4'
  | 'aux_ayudante_4'
  | 'parte_local_1'
  | 'parte_local_2'
  | 'conductor_estudio'
  | 'lector_estudio'
  | 'oracion_cierre'

export interface ParteInfo {
  tipo: ParteTipo
  label: string
  seccion: 'apertura' | 'tesoros' | 'maestros' | 'cristiana' | 'cierre'
  rolesPermitidos: Rol[]
  soloHombres: boolean
  opcional?: boolean
  titulo?: string
  duracion?: string
}

export const PARTES_INFO: Record<ParteTipo, ParteInfo> = {
  oracion_apertura: {
    tipo: 'oracion_apertura',
    label: 'Oración de apertura',
    seccion: 'apertura',
    rolesPermitidos: ['anciano', 'siervo'],
    soloHombres: true,
  },
  presidente: {
    tipo: 'presidente',
    label: 'Presidente de la reunión',
    seccion: 'apertura',
    rolesPermitidos: ['anciano', 'siervo'],
    soloHombres: true,
  },
  discurso_tesoros: {
    tipo: 'discurso_tesoros',
    label: 'Discurso (10 min.)',
    seccion: 'tesoros',
    rolesPermitidos: ['anciano', 'siervo'],
    soloHombres: true,
    duracion: '10 min.',
  },
  perlas_escondidas: {
    tipo: 'perlas_escondidas',
    label: 'Busquemos perlas escondidas (10 min.)',
    seccion: 'tesoros',
    rolesPermitidos: ['anciano', 'siervo'],
    soloHombres: true,
    duracion: '10 min.',
  },
  lectura_biblica: {
    tipo: 'lectura_biblica',
    label: 'Lectura de la Biblia (4 min.)',
    seccion: 'tesoros',
    rolesPermitidos: ['anciano', 'siervo', 'publicador'],
    soloHombres: true,
    duracion: '4 min.',
  },
  estudiante_1: {
    tipo: 'estudiante_1',
    label: 'Estudiante 1',
    seccion: 'maestros',
    rolesPermitidos: ['anciano', 'siervo', 'publicador', 'hermana'],
    soloHombres: false,
  },
  ayudante_1: {
    tipo: 'ayudante_1',
    label: 'Ayudante 1',
    seccion: 'maestros',
    rolesPermitidos: ['anciano', 'siervo', 'publicador', 'hermana'],
    soloHombres: false,
  },
  estudiante_2: {
    tipo: 'estudiante_2',
    label: 'Estudiante 2',
    seccion: 'maestros',
    rolesPermitidos: ['anciano', 'siervo', 'publicador', 'hermana'],
    soloHombres: false,
  },
  ayudante_2: {
    tipo: 'ayudante_2',
    label: 'Ayudante 2',
    seccion: 'maestros',
    rolesPermitidos: ['anciano', 'siervo', 'publicador', 'hermana'],
    soloHombres: false,
  },
  estudiante_3: {
    tipo: 'estudiante_3',
    label: 'Estudiante 3',
    seccion: 'maestros',
    rolesPermitidos: ['anciano', 'siervo', 'publicador', 'hermana'],
    soloHombres: false,
    opcional: true,
  },
  ayudante_3: {
    tipo: 'ayudante_3',
    label: 'Ayudante 3',
    seccion: 'maestros',
    rolesPermitidos: ['anciano', 'siervo', 'publicador', 'hermana'],
    soloHombres: false,
    opcional: true,
  },
  estudiante_4: {
    tipo: 'estudiante_4',
    label: 'Estudiante 4',
    seccion: 'maestros',
    rolesPermitidos: ['anciano', 'siervo', 'publicador', 'hermana'],
    soloHombres: false,
    opcional: true,
  },
  ayudante_4: {
    tipo: 'ayudante_4',
    label: 'Ayudante 4',
    seccion: 'maestros',
    rolesPermitidos: ['anciano', 'siervo', 'publicador', 'hermana'],
    soloHombres: false,
    opcional: true,
  },
  aux_estudiante_1: { tipo: 'aux_estudiante_1', label: 'Estudiante 1 (Sala aux.)', seccion: 'maestros', rolesPermitidos: ['anciano', 'siervo', 'publicador', 'hermana'], soloHombres: false, opcional: true },
  aux_ayudante_1:  { tipo: 'aux_ayudante_1',  label: 'Ayudante 1 (Sala aux.)',  seccion: 'maestros', rolesPermitidos: ['anciano', 'siervo', 'publicador', 'hermana'], soloHombres: false, opcional: true },
  aux_estudiante_2: { tipo: 'aux_estudiante_2', label: 'Estudiante 2 (Sala aux.)', seccion: 'maestros', rolesPermitidos: ['anciano', 'siervo', 'publicador', 'hermana'], soloHombres: false, opcional: true },
  aux_ayudante_2:  { tipo: 'aux_ayudante_2',  label: 'Ayudante 2 (Sala aux.)',  seccion: 'maestros', rolesPermitidos: ['anciano', 'siervo', 'publicador', 'hermana'], soloHombres: false, opcional: true },
  aux_estudiante_3: { tipo: 'aux_estudiante_3', label: 'Estudiante 3 (Sala aux.)', seccion: 'maestros', rolesPermitidos: ['anciano', 'siervo', 'publicador', 'hermana'], soloHombres: false, opcional: true },
  aux_ayudante_3:  { tipo: 'aux_ayudante_3',  label: 'Ayudante 3 (Sala aux.)',  seccion: 'maestros', rolesPermitidos: ['anciano', 'siervo', 'publicador', 'hermana'], soloHombres: false, opcional: true },
  aux_estudiante_4: { tipo: 'aux_estudiante_4', label: 'Estudiante 4 (Sala aux.)', seccion: 'maestros', rolesPermitidos: ['anciano', 'siervo', 'publicador', 'hermana'], soloHombres: false, opcional: true },
  aux_ayudante_4:  { tipo: 'aux_ayudante_4',  label: 'Ayudante 4 (Sala aux.)',  seccion: 'maestros', rolesPermitidos: ['anciano', 'siervo', 'publicador', 'hermana'], soloHombres: false, opcional: true },
  parte_local_1: {
    tipo: 'parte_local_1',
    label: 'Parte local 1',
    seccion: 'cristiana',
    rolesPermitidos: ['anciano', 'siervo'],
    soloHombres: true,
  },
  parte_local_2: {
    tipo: 'parte_local_2',
    label: 'Parte local 2',
    seccion: 'cristiana',
    rolesPermitidos: ['anciano', 'siervo'],
    soloHombres: true,
    opcional: true,
  },
  conductor_estudio: {
    tipo: 'conductor_estudio',
    label: 'Conductor del estudio bíblico (30 min.)',
    seccion: 'cristiana',
    rolesPermitidos: ['anciano', 'siervo'],
    soloHombres: true,
    duracion: '30 min.',
  },
  lector_estudio: {
    tipo: 'lector_estudio',
    label: 'Lector del estudio bíblico',
    seccion: 'cristiana',
    rolesPermitidos: ['anciano', 'siervo'],
    soloHombres: true,
  },
  oracion_cierre: {
    tipo: 'oracion_cierre',
    label: 'Oración de cierre',
    seccion: 'cierre',
    rolesPermitidos: ['anciano', 'siervo'],
    soloHombres: true,
  },
}

export const PARTES_ORDEN: ParteTipo[] = [
  'oracion_apertura',
  'presidente',
  'discurso_tesoros',
  'perlas_escondidas',
  'lectura_biblica',
  'estudiante_1',
  'ayudante_1',
  'estudiante_2',
  'ayudante_2',
  'estudiante_3',
  'ayudante_3',
  'estudiante_4',
  'ayudante_4',
  'parte_local_1',
  'parte_local_2',
  'conductor_estudio',
  'lector_estudio',
  'oracion_cierre',
]

export interface Semana {
  id: string
  fecha: string
  tema: string
  lecturaBiblica: string
  cancionApertura?: number
  cancionIntermedia?: number
  cancionCierre?: number
  numEstudiantes?: number
  titulos: Partial<Record<ParteTipo, string>>
  microfonista1?: string
  microfonista2?: string
  acomodador1?: string
  acomodador2?: string
}

export interface Asignacion {
  id: string
  semanaId: string
  parte: ParteTipo
  hermanoId: string
}

export interface AppData {
  hermanos: Hermano[]
  semanas: Semana[]
  asignaciones: Asignacion[]
  congregacion: string
  semanasFDS?: SemanaFDS[]
  asignacionesFDS?: AsignacionFDS[]
}

// ── Fin de semana ──────────────────────────────────────────────

export type ParteTipoFDS =
  | 'fds_oracion_apertura'
  | 'fds_presidente'
  | 'fds_lector'
  | 'fds_oracion_cierre'

export interface ParteInfoFDS {
  tipo: ParteTipoFDS
  label: string
  rolesPermitidos: Rol[]
  soloHombres: boolean
}

export const PARTES_INFO_FDS: Record<ParteTipoFDS, ParteInfoFDS> = {
  fds_oracion_apertura: {
    tipo: 'fds_oracion_apertura',
    label: 'Oración de apertura',
    rolesPermitidos: ['anciano', 'siervo'],
    soloHombres: true,
  },
  fds_presidente: {
    tipo: 'fds_presidente',
    label: 'Presidente',
    rolesPermitidos: ['anciano', 'siervo'],
    soloHombres: true,
  },
  fds_lector: {
    tipo: 'fds_lector',
    label: 'Lector del Estudio de La Atalaya',
    rolesPermitidos: ['anciano', 'siervo'],
    soloHombres: true,
  },
  fds_oracion_cierre: {
    tipo: 'fds_oracion_cierre',
    label: 'Oración de cierre',
    rolesPermitidos: ['anciano', 'siervo'],
    soloHombres: true,
  },
}

export interface SemanaFDS {
  id: string
  fecha: string              // yyyy-mm-dd
  // Auto desde parser de La Atalaya
  fechaLocale?: string       // "Artículo de estudio X: DD-DD de mes YYYY"
  tituloArticulo?: string    // título del artículo del Estudio de La Atalaya
  cancionApertura?: number   // primera canción (manual)
  cancionIntermedia?: number // canción antes del estudio (w_study_opening_song)
  cancionCierre?: number     // canción de cierre (w_study_concluding_song)
  // Disertación pública — texto libre
  boceto?: number
  disertacionTitulo?: string
  oradorNombre?: string
  oradorCongregacion?: string
  microfonista1?: string
  microfonista2?: string
  acomodador1?: string
  acomodador2?: string
}

export interface AsignacionFDS {
  id: string
  semanaFDSId: string
  parte: ParteTipoFDS
  hermanoId: string
}

export const SECCION_LABELS: Record<string, string> = {
  apertura: 'Apertura',
  tesoros: 'Tesoros de la Biblia',
  maestros: 'Seamos mejores maestros',
  cristiana: 'Nuestra vida cristiana',
  cierre: 'Cierre',
}
