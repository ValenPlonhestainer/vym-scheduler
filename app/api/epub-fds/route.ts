import { NextRequest, NextResponse } from 'next/server'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { loadPub } = require('meeting-schedules-parser/dist/node/index.cjs')

interface FDSSemana {
  fecha: string
  fechaLocale: string
  tituloArticulo: string
  cancionIntermedia?: number
  cancionCierre?: number
}

async function fetchIssue(year: number, month: number): Promise<FDSSemana[]> {
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

  return data
    .filter((d: Record<string, unknown>) => d.w_study_date)
    .map((d: Record<string, unknown>) => ({
      fecha: String(d.w_study_date ?? '').replace(/\//g, '-'),
      fechaLocale: String(d.w_study_date_locale ?? ''),
      tituloArticulo: String(d.w_study_title ?? ''),
      cancionIntermedia: typeof d.w_study_opening_song === 'number' ? d.w_study_opening_song : undefined,
      cancionCierre: typeof d.w_study_concluding_song === 'number' ? d.w_study_concluding_song : undefined,
    }))
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  // fecha = YYYY-MM-DD (la fecha exacta que seleccionó el usuario)
  const fecha = searchParams.get('fecha') ?? ''

  if (!fecha || fecha.length < 10) {
    return NextResponse.json({ error: 'Parámetro fecha requerido (YYYY-MM-DD)' }, { status: 400 })
  }

  const [year, month] = fecha.split('-').map(Number)
  const fechaMs = new Date(fecha).getTime()

  try {
    // La Atalaya se publica con ~2 meses de anticipación respecto a la fecha de estudio.
    // Probamos desde 4 meses antes hasta el mes actual para encontrar el artículo correcto.
    const candidatos: FDSSemana[] = []

    for (let offset = 4; offset >= -1; offset--) {
      let m = month - offset
      let y = year
      while (m <= 0) { m += 12; y -= 1 }
      while (m > 12) { m -= 12; y += 1 }

      const semanas = await fetchIssue(y, m)
      candidatos.push(...semanas)
    }

    if (candidatos.length === 0) {
      return NextResponse.json({ error: 'No se encontraron artículos de La Atalaya para esta fecha' }, { status: 404 })
    }

    // Buscar el artículo cuya semana contiene la fecha seleccionada
    // Cada artículo cubre 7 días a partir de su fecha de inicio
    const DAY_MS = 86_400_000
    const enSemana = candidatos.find(s => {
      const inicio = new Date(s.fecha).getTime()
      return fechaMs >= inicio && fechaMs < inicio + 7 * DAY_MS
    })
    if (enSemana) {
      return NextResponse.json({ semana: enSemana })
    }

    // Fallback: el artículo cuya semana empieza más cerca pero antes de la fecha
    const anteriores = candidatos.filter(s => new Date(s.fecha).getTime() <= fechaMs)
    if (anteriores.length > 0) {
      anteriores.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      return NextResponse.json({ semana: anteriores[0] })
    }

    // Último recurso: el más cercano en cualquier dirección
    candidatos.sort((a, b) => {
      const da = Math.abs(new Date(a.fecha).getTime() - fechaMs)
      const db = Math.abs(new Date(b.fecha).getTime() - fechaMs)
      return da - db
    })
    return NextResponse.json({ semana: candidatos[0] })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error desconocido'
    console.error('[EPUB FDS API]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
