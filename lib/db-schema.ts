export const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS config (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS hermanos (
    id          TEXT PRIMARY KEY,
    nombre      TEXT NOT NULL,
    genero      TEXT NOT NULL CHECK (genero IN ('masculino', 'femenino')),
    rol         TEXT NOT NULL CHECK (rol IN ('anciano', 'siervo', 'publicador', 'hermana')),
    activo      INTEGER NOT NULL DEFAULT 1,
    notas       TEXT,
    privilegios TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS semanas (
    id                 TEXT PRIMARY KEY,
    fecha              TEXT NOT NULL,
    tema               TEXT,
    lectura_biblica    TEXT,
    cancion_apertura   INTEGER,
    cancion_intermedia INTEGER,
    cancion_cierre     INTEGER,
    num_estudiantes    INTEGER,
    titulos            TEXT,
    created_at         TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS asignaciones (
    id         TEXT PRIMARY KEY,
    semana_id  TEXT NOT NULL REFERENCES semanas(id) ON DELETE CASCADE,
    parte      TEXT NOT NULL,
    hermano_id TEXT NOT NULL REFERENCES hermanos(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS semanas_fds (
    id                  TEXT PRIMARY KEY,
    fecha               TEXT NOT NULL,
    fecha_locale        TEXT,
    titulo_articulo     TEXT,
    cancion_apertura    INTEGER,
    cancion_intermedia  INTEGER,
    cancion_cierre      INTEGER,
    boceto              INTEGER,
    disertacion_titulo  TEXT,
    orador_nombre       TEXT,
    orador_congregacion TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS asignaciones_fds (
    id            TEXT PRIMARY KEY,
    semana_fds_id TEXT NOT NULL REFERENCES semanas_fds(id) ON DELETE CASCADE,
    parte         TEXT NOT NULL,
    hermano_id    TEXT NOT NULL REFERENCES hermanos(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_semanas_fecha     ON semanas(fecha);
  CREATE INDEX IF NOT EXISTS idx_semanas_fds_fecha ON semanas_fds(fecha);
  CREATE INDEX IF NOT EXISTS idx_asig_sem          ON asignaciones(semana_id);
  CREATE INDEX IF NOT EXISTS idx_asig_herm         ON asignaciones(hermano_id);
  CREATE INDEX IF NOT EXISTS idx_asig_fds_sem      ON asignaciones_fds(semana_fds_id);
  CREATE INDEX IF NOT EXISTS idx_asig_fds_herm     ON asignaciones_fds(hermano_id);
`
