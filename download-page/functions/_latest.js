// Helper compartido por las Pages Functions: lee latest.yml de R2 y devuelve
// la última versión + la URL del instalador. No se enruta (prefijo "_").
const R2_BASE = 'https://pub-ea9f59664d6d4742a8da9c6c3db561fe.r2.dev'

export async function getLatest() {
  // cf.cacheTtl: cachea latest.yml en el edge 60s para no pegarle a R2 en cada visita.
  const res = await fetch(`${R2_BASE}/latest.yml`, { cf: { cacheTtl: 60 } })
  if (!res.ok) throw new Error(`latest.yml HTTP ${res.status}`)
  const text = await res.text()
  // Misma regex que el cliente (ver §4 del handoff): sin dependencia de YAML.
  const m = text.match(/^version:\s*(.+)$/m)
  if (!m) throw new Error('no se encontró "version" en latest.yml')
  const version = m[1].trim().replace(/^["']|["']$/g, '')
  return { version, exeUrl: `${R2_BASE}/VyM-Scheduler-Setup-${version}.exe` }
}
