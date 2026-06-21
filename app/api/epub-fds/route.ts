import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { loadPub } = require('meeting-schedules-parser/dist/node/index.cjs')

interface FDSSemana {
  fecha: string
  fechaLocale: string
  tituloArticulo: string
  cancionIntermedia?: number
  cancionCierre?: number
}

async function fetchAndCacheIssue(year: number, month: number, db: ReturnType<typeof getDb>): Promise<FDSSemana[]> {
  const cacheKey = `w-${year}-${month}`
  const cached = db.prepare('SELECT data FROM epub_cache WHERE key = ?').get(cacheKey) as { data: string } | undefined
  if (cached) return JSON.parse(cached.data) as FDSSemana[]

  const issue = `${year}${String(month).padStart(2, '0')}`
  const apiUrl = `https://b.jw-cdn.org/apis/pub-media/GETPUBMEDIALINKS?pub=w&issue=${issue}&fileformat=EPUB&langwritten=S&output=json`

  const catalogRes = await fetch(apiUrl, { cache: 'no-store' })
  if (!catalogRes.ok) return []

  const catalog = await catalogRes.json()
  const epubFiles: Array<{ file: { url: string } }> = catalog?.files?.S?.EPUB ?? []
  if (epubFiles.length === 0) return []

  const epubUrl: string = epubFiles[0].file?.url
  if (!epubUrl) return []

  const data = await loadPub({ url: epubUrl })
  if (!Array.isArray(data) || data.length === 0) return []

  const semanas: FDSSemana[] = data
    .filter((d: Record<string, unknown>) => d.w_study_date)
    .map((d: Record<string, unknown>) => ({
      fecha: String(d.w_study_date ?? '').replace(/\//g, '-'),
      fechaLocale: String(d.w_study_date_locale ?? ''),
      tituloArticulo: String(d.w_study_title ?? ''),
      cancionIntermedia: typeof d.w_study_opening_song === 'number' ? d.w_study_opening_song : undefined,
      cancionCierre: typeof d.w_study_concluding_song === 'number' ? d.w_study_concluding_song : undefined,
    }))

  db.prepare('INSERT OR REPLACE INTO epub_cache (key, data, cached_at) VALUES (?, ?, ?)').run(
    cacheKey, JSON.stringify(semanas), Date.now()
  )

  return semanas
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const fecha = searchParams.get('fecha') ?? ''

  if (!fecha || fecha.length < 10) {
    return NextResponse.json({ error: 'Parámetro fecha requerido (YYYY-MM-DD)' }, { status: 400 })
  }

  const [year, month] = fecha.split('-').map(Number)
  const fechaMs = new Date(fecha).getTime()

  const db = getDb()

  try {
    const candidatos: FDSSemana[] = []
    let networkError = false

    for (let offset = 4; offset >= -1; offset--) {
      let m = month - offset
      let y = year
      while (m <= 0) { m += 12; y -= 1 }
      while (m > 12) { m -= 12; y += 1 }

      try {
        const semanas = await fetchAndCacheIssue(y, m, db)
        candidatos.push(...semanas)
      } catch (e: unknown) {
        if (e instanceof TypeError || (e instanceof Error && (e.message.includes('fetch failed') || e.message.includes('ENOTFOUND') || e.message.includes('ECONNREFUSED')))) {
          networkError = true
        }
      }
    }

    if (candidatos.length === 0) {
      const errorMsg = networkError
        ? 'Necesitas conectarte a internet para descargar el programa bimestral'
        : 'No se encontraron artículos de La Atalaya para esta fecha'
      return NextResponse.json({ error: errorMsg }, { status: networkError ? 503 : 404 })
    }

    const DAY_MS = 86_400_000
    const enSemana = candidatos.find(s => {
      const inicio = new Date(s.fecha).getTime()
      return fechaMs >= inicio && fechaMs < inicio + 7 * DAY_MS
    })
    if (enSemana) return NextResponse.json({ semana: enSemana })

    const anteriores = candidatos.filter(s => new Date(s.fecha).getTime() <= fechaMs)
    if (anteriores.length > 0) {
      anteriores.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      return NextResponse.json({ semana: anteriores[0] })
    }

    candidatos.sort((a, b) => {
      const da = Math.abs(new Date(a.fecha).getTime() - fechaMs)
      const db2 = Math.abs(new Date(b.fecha).getTime() - fechaMs)
      return da - db2
    })
    return NextResponse.json({ semana: candidatos[0] })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error desconocido'
    console.error('[EPUB FDS API]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
