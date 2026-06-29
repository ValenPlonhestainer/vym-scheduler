import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { loadPub } = require('meeting-schedules-parser/dist/node/index.cjs')

function bimStartMonth(month: number): number {
  return month % 2 === 0 ? month - 1 : month
}

function nextBimestre(year: number, month: number): { year: number; month: number } {
  const next = bimStartMonth(month) + 2
  return next > 12 ? { year: year + 1, month: 1 } : { year, month: next }
}

function buildApiUrl(year: number, month: number): string {
  const bimMonth = bimStartMonth(month)
  const issue = `${year}${String(bimMonth).padStart(2, '0')}`
  return `https://b.jw-cdn.org/apis/pub-media/GETPUBMEDIALINKS?pub=mwb&issue=${issue}&fileformat=EPUB&langwritten=S&output=json`
}

async function fetchAndParseBimestre(year: number, month: number) {
  const apiUrl = buildApiUrl(year, month)
  const catalogRes = await fetch(apiUrl, { cache: 'no-store' })
  if (!catalogRes.ok) return null
  const catalog = await catalogRes.json()
  const epubFiles: Array<{ file: { url: string } }> = catalog?.files?.S?.EPUB ?? []
  if (!epubFiles.length) return null
  const epubUrl: string = epubFiles[0].file?.url
  if (!epubUrl) return null
  const data = await loadPub({ url: epubUrl })
  if (!Array.isArray(data) || !data.length) return null
  const semanas = data
    .filter((d: Record<string, unknown>) => d.mwb_week_date)
    .map((d: Record<string, unknown>) => ({
      fecha: String(d.mwb_week_date ?? ''),
      tema: d.mwb_tgw_talk ?? '',
      lecturaBiblica: d.mwb_weekly_bible_reading ?? '',
      cancionApertura: typeof d.mwb_song_first === 'number' ? d.mwb_song_first : undefined,
      cancionIntermedia: typeof d.mwb_song_middle === 'number' ? d.mwb_song_middle : undefined,
      cancionCierre: typeof d.mwb_song_conclude === 'number' ? d.mwb_song_conclude : undefined,
      numEstudiantes: typeof d.mwb_ayf_count === 'number' ? d.mwb_ayf_count : 2,
      titulos: {
        discurso_tesoros: d.mwb_tgw_talk ?? '',
        perlas_escondidas: d.mwb_tgw_gems_title ?? 'Busquemos perlas escondidas (10 min.)',
        lectura_biblica: d.mwb_tgw_bread ?? '',
        ...(d.mwb_ayf_part1_type ? { estudiante_1: d.mwb_ayf_part1_type } : {}),
        ...(d.mwb_ayf_part2_type ? { estudiante_2: d.mwb_ayf_part2_type } : {}),
        ...(d.mwb_ayf_part3_type ? { estudiante_3: d.mwb_ayf_part3_type } : {}),
        ...(d.mwb_ayf_part4_type ? { estudiante_4: d.mwb_ayf_part4_type } : {}),
        parte_local_1: d.mwb_lc_part1 ?? '',
        parte_local_2: d.mwb_lc_part2 ?? '',
      },
    }))
  return { semanas, epubUrl }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') ?? '0')
  const month = parseInt(searchParams.get('month') ?? '0')

  if (!year || !month) {
    return NextResponse.json({ error: 'Parámetros year y month requeridos' }, { status: 400 })
  }

  const db = getDb()
  const cacheKey = `mwb-${year}-${bimStartMonth(month)}`

  // Intentar servir desde caché (best-effort: db es null en la web)
  const cached = db?.prepare('SELECT data FROM epub_cache WHERE key = ?').get(cacheKey) as { data: string } | undefined
  if (cached) {
    return NextResponse.json(JSON.parse(cached.data))
  }

  try {
    // Descargar bimestre actual + siguiente en paralelo
    const next = nextBimestre(year, month)
    const nextKey = `mwb-${next.year}-${next.month}`
    const nextCached = db?.prepare('SELECT key FROM epub_cache WHERE key = ?').get(nextKey)

    const [result, nextResult] = await Promise.all([
      fetchAndParseBimestre(year, month),
      nextCached ? Promise.resolve(null) : fetchAndParseBimestre(next.year, next.month).catch(() => null),
    ])

    if (!result) throw new Error(`jw.org no respondió — puede que este bimestre aún no esté disponible`)

    db?.prepare('INSERT OR REPLACE INTO epub_cache (key, data, cached_at) VALUES (?, ?, ?)').run(
      cacheKey, JSON.stringify(result), Date.now()
    )

    if (nextResult) {
      db?.prepare('INSERT OR REPLACE INTO epub_cache (key, data, cached_at) VALUES (?, ?, ?)').run(
        nextKey, JSON.stringify(nextResult), Date.now()
      )
    }

    return NextResponse.json(result)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error desconocido'
    const isNetwork = e instanceof TypeError || msg.includes('fetch failed') || msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT')
    console.error('[EPUB API]', msg)
    return NextResponse.json({
      error: isNetwork ? 'Necesitas conectarte a internet para descargar el programa bimestral' : msg
    }, { status: isNetwork ? 503 : 500 })
  }
}
