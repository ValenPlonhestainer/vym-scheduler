import path from 'path'
import { EPUB_CACHE_SCHEMA } from './db-schema'

type BetterSQLite3Database = import('better-sqlite3').Database

let _epubDb: BetterSQLite3Database | null = null

export function getDb(): BetterSQLite3Database {
  if (_epubDb) return _epubDb
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require('better-sqlite3')
  const base = process.env.VYM_USER_DATA ?? process.cwd()
  const db: BetterSQLite3Database = new Database(path.join(base, 'epub_cache.db'))
  db.pragma('journal_mode = WAL')
  db.exec(EPUB_CACHE_SCHEMA)
  _epubDb = db
  return _epubDb
}
