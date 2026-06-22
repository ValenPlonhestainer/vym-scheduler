-- VyM Scheduler — Schema Supabase
-- Ejecutar en el SQL Editor de tu proyecto Supabase

-- ── Tokens de acceso ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tokens (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token             text UNIQUE NOT NULL,
  congregation_name text NOT NULL,
  active            boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- ── Congregaciones ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS congregations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id   uuid REFERENCES tokens(id) ON DELETE CASCADE,
  name       text NOT NULL,
  settings   jsonb
);

-- ── Hermanos ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hermanos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  congregation_id  uuid NOT NULL REFERENCES congregations(id) ON DELETE CASCADE,
  nombre           text NOT NULL,
  genero           text NOT NULL CHECK (genero IN ('masculino', 'femenino')),
  rol              text NOT NULL CHECK (rol IN ('anciano', 'siervo', 'publicador', 'hermana')),
  activo           boolean NOT NULL DEFAULT true,
  notas            text,
  privilegios      jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ── Semanas entre semana ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS semanas (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  congregation_id    uuid NOT NULL REFERENCES congregations(id) ON DELETE CASCADE,
  fecha              date NOT NULL,
  tema               text,
  lectura_biblica    text,
  cancion_apertura   integer,
  cancion_intermedia integer,
  cancion_cierre     integer,
  num_estudiantes    integer,
  titulos            jsonb,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- ── Asignaciones entre semana ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS asignaciones (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  congregation_id  uuid NOT NULL REFERENCES congregations(id) ON DELETE CASCADE,
  semana_id        uuid NOT NULL REFERENCES semanas(id) ON DELETE CASCADE,
  parte            text NOT NULL,
  hermano_id       uuid NOT NULL REFERENCES hermanos(id) ON DELETE CASCADE
);

-- ── Semanas fin de semana ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS semanas_fds (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  congregation_id     uuid NOT NULL REFERENCES congregations(id) ON DELETE CASCADE,
  fecha               date NOT NULL,
  fecha_locale        text,
  titulo_articulo     text,
  cancion_apertura    integer,
  cancion_intermedia  integer,
  cancion_cierre      integer,
  boceto              integer,
  disertacion_titulo  text,
  orador_nombre       text,
  orador_congregacion text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ── Asignaciones fin de semana ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS asignaciones_fds (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  congregation_id  uuid NOT NULL REFERENCES congregations(id) ON DELETE CASCADE,
  semana_fds_id    uuid NOT NULL REFERENCES semanas_fds(id) ON DELETE CASCADE,
  parte            text NOT NULL,
  hermano_id       uuid NOT NULL REFERENCES hermanos(id) ON DELETE CASCADE
);

-- ── Sugerencias ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sugerencias (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  congregation_id  uuid NOT NULL REFERENCES congregations(id) ON DELETE CASCADE,
  texto            text NOT NULL,
  created_by       uuid,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ── Índices de performance ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sugerencias_cong   ON sugerencias(congregation_id);
CREATE INDEX IF NOT EXISTS idx_hermanos_cong      ON hermanos(congregation_id);
CREATE INDEX IF NOT EXISTS idx_semanas_cong       ON semanas(congregation_id);
CREATE INDEX IF NOT EXISTS idx_asignaciones_cong  ON asignaciones(congregation_id);
CREATE INDEX IF NOT EXISTS idx_asignaciones_sem   ON asignaciones(semana_id);
CREATE INDEX IF NOT EXISTS idx_semanas_fds_cong   ON semanas_fds(congregation_id);
CREATE INDEX IF NOT EXISTS idx_asig_fds_cong      ON asignaciones_fds(congregation_id);
CREATE INDEX IF NOT EXISTS idx_asig_fds_sem       ON asignaciones_fds(semana_fds_id);

-- ── Row Level Security (defensa en profundidad) ───────────────────────────────
-- La app usa la service role key (bypassa RLS), pero habilitamos por seguridad.
ALTER TABLE tokens         ENABLE ROW LEVEL SECURITY;
ALTER TABLE congregations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE hermanos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE semanas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE asignaciones   ENABLE ROW LEVEL SECURITY;
ALTER TABLE semanas_fds    ENABLE ROW LEVEL SECURITY;
ALTER TABLE asignaciones_fds ENABLE ROW LEVEL SECURITY;

-- Política: solo la service role puede leer/escribir (las políticas anon quedan vacías).
-- Si en el futuro se usa la anon key desde el cliente, agregar políticas aquí.
