import path from 'path'
import { EPUB_CACHE_SCHEMA } from './db-schema'

type BetterSQLite3Database = import('better-sqlite3').Database

let _epubDb: BetterSQLite3Database | null = null

let _dbUnavailable = false

// Devuelve la base SQLite de caché, o null cuando no está disponible
// (p. ej. en la web/Vercel, donde better-sqlite3 no se instala y el
// filesystem es de solo lectura). El caché es solo una optimización:
// las rutas deben funcionar igual sin él.
export function getDb(): BetterSQLite3Database | null {
  if (_epubDb) return _epubDb
  if (_dbUnavailable) return null
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3')
    const base = process.env.VYM_USER_DATA ?? process.cwd()
    const db: BetterSQLite3Database = new Database(path.join(base, 'epub_cache.db'))
    db.pragma('journal_mode = WAL')
    db.exec(EPUB_CACHE_SCHEMA)
    _epubDb = db
    return _epubDb
  } catch (e) {
    _dbUnavailable = true
    console.warn('[db] SQLite no disponible; caché de guía deshabilitado:', e instanceof Error ? e.message : e)
    return null
  }
}
