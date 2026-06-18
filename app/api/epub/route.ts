import { NextRequest, NextResponse } from 'next/server'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { loadPub } = require('meeting-schedules-parser/dist/node/index.cjs')

// MWB is bimonthly. Returns the first month of the bimestre (1,3,5,7,9,11)
function bimStartMonth(month: number): number {
  return month % 2 === 0 ? month - 1 : month
}

function buildApiUrl(year: number, month: number): string {
  const bimMonth = bimStartMonth(month)
  const issue = `${year}${String(bimMonth).padStart(2, '0')}`
  return `https://b.jw-cdn.org/apis/pub-media/GETPUBMEDIALINKS?pub=mwb&issue=${issue}&fileformat=EPUB&langwritten=S&output=json`
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') ?? '0')
  const month = parseInt(searchParams.get('month') ?? '0')

  if (!year || !month) {
    return NextResponse.json({ error: 'Parámetros year y month requeridos' }, { status: 400 })
  }

  try {
    // 1. Query jw.org for the specific bimestre EPUB
    const apiUrl = buildApiUrl(year, month)
    const catalogRes = await fetch(apiUrl, { cache: 'no-store' })

    if (!catalogRes.ok) {
      throw new Error(`jw.org no respondió (${catalogRes.status}) — puede que este bimestre aún no esté disponible`)
    }

    const catalog = await catalogRes.json()

    // 2. Extract the EPUB URL from the response
    const epubFiles: Array<{ file: { url: string } }> = catalog?.files?.S?.EPUB ?? []
    if (epubFiles.length === 0) throw new Error('No se encontró el archivo EPUB en jw.org')

    const epubUrl: string = epubFiles[0].file?.url
    if (!epubUrl) throw new Error('URL del EPUB vacía')

    // 3. Parse the EPUB with meeting-schedules-parser
    const data = await loadPub({ url: epubUrl })

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('El archivo EPUB no contiene datos de semanas')
    }

    // 4. Map to our internal format
    const semanas = data
      .filter((d: Record<string, unknown>) => d.mwb_week_date)
      .map((d: Record<string, unknown>) => ({
        fecha: String(d.mwb_week_date ?? ''),            // yyyy/mm/dd
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

    return NextResponse.json({ semanas, epubUrl })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error desconocido'
    console.error('[EPUB API]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
