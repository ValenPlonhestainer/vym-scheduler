import path from 'path'
import { randomUUID } from 'crypto'
import { SCHEMA_SQL } from './db-schema'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Database = require('better-sqlite3')
type BetterSQLite3Database = import('better-sqlite3').Database

function getDbPath(): string {
  // Electron pasa la ruta de userData via variable de entorno
  const userData = process.env.VYM_USER_DATA
  if (userData) return path.join(userData, 'vym.db')
  // En desarrollo, usar el directorio del proyecto
  return path.join(process.cwd(), 'vym-dev.db')
}

let _db: BetterSQLite3Database | null = null

export function getDb(): BetterSQLite3Database {
  if (!_db) {
    const db: BetterSQLite3Database = new Database(getDbPath())
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    db.exec(SCHEMA_SQL)
    _db = db
  }
  return _db
}

export function ensureCongregationId(): string {
  const db = getDb()
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get('congregation_id') as { value: string } | undefined
  if (row) return row.value
  const newId = randomUUID()
  db.prepare('INSERT INTO config (key, value) VALUES (?, ?)').run('congregation_id', newId)
  return newId
}

export function getConfigValue(key: string): string | undefined {
  const db = getDb()
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key) as { value: string } | undefined
  return row?.value
}

export function setConfigValue(key: string, value: string): void {
  const db = getDb()
  db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(key, value)
}
