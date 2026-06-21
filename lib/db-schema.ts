export const EPUB_CACHE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS epub_cache (
    key       TEXT PRIMARY KEY,
    data      TEXT NOT NULL,
    cached_at INTEGER NOT NULL
  );
`
