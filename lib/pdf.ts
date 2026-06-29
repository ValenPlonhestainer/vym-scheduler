import jsPDF from 'jspdf'
import { Semana, ParteTipo, PARTES_INFO, Hermano, Asignacion, SemanaFDS, AsignacionFDS } from './types'
import { bocetoPDFLabel } from '../data/bocetos'

const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

function dateRange(fecha: string): string {
  const [year, month, day] = fecha.split('-').map(Number)
  const start = new Date(year, month - 1, day)
  const end = new Date(year, month - 1, day + 6)
  const mStart = MONTHS[start.getMonth()]
  const mEnd = MONTHS[end.getMonth()]
  if (start.getMonth() === end.getMonth()) {
    return `${mStart} ${day}-${day + 6}`
  }
  return `${mStart} ${day} - ${mEnd} ${end.getDate()}`
}

function semanaLunes(fecha: string): number {
  const d = new Date(fecha + 'T12:00:00Z')
  const dow = d.getUTCDay()
  const toMonday = dow === 0 ? 6 : dow - 1
  const monday = new Date(d.getTime() - toMonday * 86_400_000)
  monday.setUTCHours(0, 0, 0, 0)
  return monday.getTime()
}

function fdsDeSemana(semanaFecha: string, semanasFDS: SemanaFDS[]): SemanaFDS[] {
  const weekStart = semanaLunes(semanaFecha)
  const weekEnd = weekStart + 6 * 86_400_000 + 86_399_999
  return semanasFDS.filter(fds => {
    const t = new Date(fds.fecha + 'T12:00:00Z').getTime()
    return t >= weekStart && t <= weekEnd
  })
}

function encontrarFDSParaSemana(semanaFecha: string, semanasFDS: SemanaFDS[]): SemanaFDS | undefined {
  return fdsDeSemana(semanaFecha, semanasFDS)
    .sort((a, b) => {
      const score = (f: SemanaFDS) =>
        [f.tituloArticulo, f.oradorNombre, f.disertacionTitulo, f.oradorCongregacion].filter(Boolean).length
      return score(b) - score(a)
    })[0]
}

function asigsFDSSemana(
  semanaFecha: string,
  semanasFDS: SemanaFDS[],
  todasAsigs: AsignacionFDS[]
): Record<string, string> {
  const ids = fdsDeSemana(semanaFecha, semanasFDS).map(f => f.id)
  const map: Record<string, string> = {}
  for (const a of todasAsigs) {
    if (ids.includes(a.semanaFDSId)) map[a.parte] = a.hermanoId
  }
  return map
}

export function generarPDFMensual(
  semanas: Semana[],
  hermanos: Hermano[],
  todasAsignaciones: Asignacion[],
  congregacion: string,
  mesAnio: string,
  semanasFDS: SemanaFDS[] = [],
  todasAsignacionesFDS: AsignacionFDS[] = [],
  // Todas las semanas entre semana (cualquier mes), para detectar FDS huérfanas
  // considerando semanas que cruzan de mes. Por defecto, las del mes.
  todasLasSemanas: Semana[] = semanas
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const pageW = 210
  const pageH = 297
  const mL = 10
  const mR = 10
  const cW = pageW - mL - mR
  let y = 12

  function checkPage(needed: number) {
    if (y + needed > pageH - 10) {
      doc.addPage()
      y = 12
    }
  }

  const nombre = (id?: string) => id ? (hermanos.find(h => h.id === id)?.nombre ?? '') : ''
  const stripNum = (s: string) => s.replace(/^\d+[.)]\s*/, '')

  const ROW_H = 8
  const LINE_H = 6

  function sectionBar(label: string, r: number, g: number, b: number) {
    checkPage(12)
    doc.setFillColor(r, g, b)
    doc.rect(mL, y, cW, 7, 'F')
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text(label.toUpperCase(), mL + 3, y + 4.8)
    doc.setTextColor(0, 0, 0)
    y += 10
  }

  function row(label: string, name: string, titleStyle = false, num?: number) {
    checkPage(ROW_H + 1)
    doc.setFontSize(8.5)
    const fullLabel = num != null ? `${num}.  ${label}` : label
    doc.setFont('helvetica', titleStyle ? 'bold' : 'normal')
    const maxW = name ? cW - 60 : cW - 4
    const lines = doc.splitTextToSize(fullLabel, maxW)

    doc.setTextColor(titleStyle ? 10 : 60, titleStyle ? 10 : 60, titleStyle ? 10 : 60)
    for (let i = 0; i < lines.length; i++) {
      doc.text(lines[i], mL + 3, y + i * LINE_H)
    }

    if (name) {
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(90, 90, 90)
      doc.text(name, pageW - mR, y, { align: 'right' })
    }

    doc.setTextColor(0, 0, 0)
    y += Math.max(lines.length * LINE_H, ROW_H)
  }


  function cancionRow(label: string, num: number) {
    checkPage(6)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(180, 30, 30)
    doc.text(`${label}: ${num}`, mL + 3, y)
    doc.setTextColor(0, 0, 0)
    y += 5.5
  }

  function multiCol(items: Array<[string, string]>, lineH = 5.5, labelColor?: [number, number, number]) {
    checkPage(lineH)
    const colW = cW / items.length
    doc.setFontSize(8)
    const lc = labelColor ?? [10, 10, 10]

    for (let i = 0; i < items.length; i++) {
      const [label, name] = items[i]
      if (!label) continue
      const x = mL + 3 + i * colW
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(lc[0], lc[1], lc[2])
      doc.text(label + (name ? ': ' : ''), x, y)
      if (name) {
        const labelW = doc.getTextWidth(label + ': ')
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(90, 90, 90)
        doc.text(name, x + labelW, y)
      }
    }

    doc.setTextColor(0, 0, 0)
    y += lineH
  }

  let primeraSemana = true
  for (const semana of semanas) {
    const asigsSemana = todasAsignaciones.filter(a => a.semanaId === semana.id)
    const asigMap: Partial<Record<ParteTipo, string>> = {}
    for (const a of asigsSemana) asigMap[a.parte] = a.hermanoId

    const fds = encontrarFDSParaSemana(semana.fecha, semanasFDS)
    const asigsFDSMap = asigsFDSSemana(semana.fecha, semanasFDS, todasAsignacionesFDS)

    if (primeraSemana) {
      primeraSemana = false
    } else {
      doc.addPage()
      y = 12
    }

    // ── Encabezado de semana ──
    const range = dateRange(semana.fecha)
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 0, 0)
    doc.text('RESUMEN SEMANAL', mL + 2, y)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(180, 30, 30)
    doc.text(range, pageW / 2, y, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 80, 80)
    doc.text(congregacion, pageW - mR, y, { align: 'right' })
    y += 3
    doc.setDrawColor(160, 160, 160)
    doc.line(mL, y, pageW - mR, y)
    y += 3.5

    // Label reunión entre semana
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(120, 120, 120)
    doc.text('REUNIÓN ENTRE SEMANA', mL + 2, y)
    doc.setTextColor(0, 0, 0)
    y += 8

    if (semana.lecturaBiblica) {
      doc.setFontSize(8.5)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(10, 10, 10)
      doc.text(`Lectura: ${semana.lecturaBiblica}`, mL + 3, y)
      doc.setTextColor(0, 0, 0)
      y += 5
    }

    // Apertura
    const presidente = nombre(asigMap['presidente'])
    const oracionIn = nombre(asigMap['oracion_apertura'])
    const oracionFin = nombre(asigMap['oracion_cierre'])

    multiCol([['Presidente', presidente]])
    multiCol([['Oración de inicio', oracionIn]])
    multiCol([['Oración final', oracionFin]])

    // Tesoros
    sectionBar('Tesoros de la Biblia', 55, 55, 55)

    const discursoTitulo = stripNum(semana.titulos?.discurso_tesoros ?? '')
    row(
      discursoTitulo || 'Discurso',
      nombre(asigMap['discurso_tesoros']),
      !!discursoTitulo,
      1
    )

    const perlasTitulo = stripNum(semana.titulos?.perlas_escondidas ?? '')
    row(
      perlasTitulo || 'Busquemos perlas escondidas',
      nombre(asigMap['perlas_escondidas']),
      !!perlasTitulo,
      2
    )

    row('Lectura de la Biblia', nombre(asigMap['lectura_biblica']), true, 3)

    // Maestros
    sectionBar('Seamos mejores maestros', 133, 100, 4)

    const numEst = semana.numEstudiantes
      ?? (semana.titulos?.estudiante_4 ? 4
        : semana.titulos?.estudiante_3 ? 3
        : 2)
    const estSlots: Array<[ParteTipo, ParteTipo]> = ([
      ['estudiante_1', 'ayudante_1'],
      ['estudiante_2', 'ayudante_2'],
      ['estudiante_3', 'ayudante_3'],
      ['estudiante_4', 'ayudante_4'],
    ] as Array<[ParteTipo, ParteTipo]>).slice(0, numEst)

    const tieneAuxGlobal = estSlots.some(([estParte]) => {
      const n = estParte.replace('estudiante_', '')
      return !!(nombre(asigMap[`aux_estudiante_${n}` as ParteTipo]) || nombre(asigMap[`aux_ayudante_${n}` as ParteTipo]))
    })

    if (tieneAuxGlobal) {
      const labelColW = 75
      const auxX = mL + 3 + labelColW
      const colW = (cW - labelColW) / 2
      const mainX = auxX + colW
      const auxCX = auxX + colW / 2
      const mainCX = mainX + colW / 2

      // Encabezados de columna
      checkPage(ROW_H)
      doc.setFontSize(7.5)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(80, 80, 80)
      doc.text('Sala auxiliar',  auxCX,  y, { align: 'center' })
      doc.text('Sala principal', mainCX, y, { align: 'center' })
      doc.setTextColor(0, 0, 0)
      y += 5

      estSlots.forEach(([estParte, ayuParte], idx) => {
        const partNum = 4 + idx
        const titulo = stripNum(semana.titulos?.[estParte] ?? '')
        const n = estParte.replace('estudiante_', '')
        const auxEstNombre = nombre(asigMap[`aux_estudiante_${n}` as ParteTipo])
        const auxAyuNombre = nombre(asigMap[`aux_ayudante_${n}` as ParteTipo])
        const mainName = [nombre(asigMap[estParte]), nombre(asigMap[ayuParte])].filter(Boolean).join(' & ')
        const auxName  = [auxEstNombre, auxAyuNombre].filter(Boolean).join(' & ')
        const label = `${partNum}.  ${titulo || PARTES_INFO[estParte].label}`

        const labelLines = doc.splitTextToSize(label, labelColW - 3)
        const auxLines   = auxName  ? doc.splitTextToSize(auxName,  colW - 4) : []
        const mainLines  = mainName ? doc.splitTextToSize(mainName, colW - 4) : []
        const rowLines   = Math.max(labelLines.length, auxLines.length, mainLines.length, 1)
        checkPage(rowLines * LINE_H + 2)

        doc.setFontSize(8.5)
        doc.setFont('helvetica', titulo ? 'bold' : 'normal')
        doc.setTextColor(titulo ? 10 : 60, titulo ? 10 : 60, titulo ? 10 : 60)
        labelLines.forEach((l: string, i: number) => doc.text(l, mL + 3, y + i * LINE_H))

        doc.setFont('helvetica', 'normal')
        doc.setTextColor(90, 90, 90)
        auxLines.forEach((l: string, i: number)  => doc.text(l, auxCX,  y + i * LINE_H, { align: 'center' }))
        mainLines.forEach((l: string, i: number) => doc.text(l, mainCX, y + i * LINE_H, { align: 'center' }))

        doc.setTextColor(0, 0, 0)
        y += rowLines * LINE_H + 1
      })
    } else {
      estSlots.forEach(([estParte, ayuParte], idx) => {
        const partNum = 4 + idx
        const titulo = stripNum(semana.titulos?.[estParte] ?? '')
        const mainName = [nombre(asigMap[estParte]), nombre(asigMap[ayuParte])].filter(Boolean).join(' & ')
        row(titulo || PARTES_INFO[estParte].label, mainName, !!titulo, partNum)
      })
    }

    // Cristiana
    sectionBar('Nuestra vida cristiana', 140, 20, 20)

    let vcCounter = 4 + numEst
    for (const parte of ['parte_local_1', 'parte_local_2'] as ParteTipo[]) {
      const titulo = stripNum(semana.titulos?.[parte] ?? '')
      const hNombre = nombre(asigMap[parte])
      if (!titulo && !hNombre) continue
      row(titulo || PARTES_INFO[parte].label, hNombre, !!titulo, vcCounter)
      vcCounter++
    }

    const conductor = nombre(asigMap['conductor_estudio'])
    const lector = nombre(asigMap['lector_estudio'])
    if (conductor || lector) {
      checkPage(ROW_H + 1)
      doc.setFontSize(8.5)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(10, 10, 10)
      doc.text(`${vcCounter}.  Estudio bíblico de la congregación`, mL + 3, y)

      const partes: string[] = []
      if (conductor) partes.push(`Conductor: ${conductor}`)
      if (lector) partes.push(`Lector: ${lector}`)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(60, 60, 60)
      doc.text(partes.join('   '), pageW - mR, y, { align: 'right' })
      doc.setTextColor(0, 0, 0)
      y += ROW_H
    }

    // Microfonistas y Acomodadores — entre semana
    const mic1 = nombre(semana.microfonista1)
    const mic2 = nombre(semana.microfonista2)
    const aco1 = nombre(semana.acomodador1)
    const aco2 = nombre(semana.acomodador2)
    if (mic1 || mic2 || aco1 || aco2) {
      y += LINE_H
      checkPage(LINE_H * 2 + 4)
      if (mic1 || mic2) {
        multiCol([['Microfonista 1', mic1], ['Microfonista 2', mic2]], 5.5, [128, 0, 0])
      }
      if (aco1 || aco2) {
        multiCol([['Acomodador 1', aco1], ['Acomodador 2', aco2]], 5.5, [128, 0, 0])
      }
    }

    // ── REUNIÓN DE FIN DE SEMANA ─────────────────────────────────
    if (fds) {
      y += 2
      doc.setDrawColor(140, 140, 140)
      doc.setLineDashPattern([1, 1], 0)
      doc.line(mL, y, pageW - mR, y)
      doc.setLineDashPattern([], 0)
      y += 3

      doc.setFontSize(7)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(120, 120, 120)
      doc.text('REUNIÓN DE FIN DE SEMANA', mL + 2, y)
      doc.setTextColor(0, 0, 0)
      y += 4

      // Apertura FDS
      sectionBar('Apertura', 60, 40, 100)

      multiCol([['Presidente', nombre(asigsFDSMap['fds_presidente'])]])
      multiCol([['Oración de apertura', nombre(asigsFDSMap['fds_oracion_apertura'])]])

      // Disertación pública
      sectionBar('Disertación pública', 133, 100, 4)

      const disertLabel = fds.boceto
        ? bocetoPDFLabel(fds.boceto)
        : fds.disertacionTitulo ?? ''
      if (disertLabel) {
        checkPage(ROW_H + 1)
        doc.setFontSize(8.5)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(10, 10, 10)
        const lines = doc.splitTextToSize(disertLabel, cW - 4)
        for (let i = 0; i < lines.length; i++) doc.text(lines[i], mL + 3, y + i * LINE_H)
        doc.setTextColor(0, 0, 0)
        y += Math.max(lines.length * LINE_H, ROW_H)
      }

      const oradorInfo: string[] = []
      if (fds.oradorNombre) oradorInfo.push(fds.oradorNombre)
      if (fds.oradorCongregacion) oradorInfo.push(`(${fds.oradorCongregacion})`)
      if (oradorInfo.length > 0) {
        checkPage(ROW_H)
        doc.setFontSize(8.5)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(10, 10, 10)
        doc.text('Orador: ', mL + 3, y)
        const labelW = doc.getTextWidth('Orador: ')
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(90, 90, 90)
        doc.text(oradorInfo.join(' '), mL + 3 + labelW, y)
        doc.setTextColor(0, 0, 0)
        y += ROW_H
      }

      // Estudio de La Atalaya
      sectionBar('Estudio de La Atalaya', 20, 50, 120)

      if (fds.tituloArticulo) {
        checkPage(ROW_H + 1)
        doc.setFontSize(8.5)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(10, 10, 10)
        const lines = doc.splitTextToSize(fds.tituloArticulo, cW - 4)
        for (let i = 0; i < lines.length; i++) doc.text(lines[i], mL + 3, y + i * LINE_H)
        doc.setTextColor(0, 0, 0)
        y += Math.max(lines.length * LINE_H, ROW_H)
      }


      const fdsLector = nombre(asigsFDSMap['fds_lector'])
      if (fdsLector) multiCol([['Lector', fdsLector]])

      // Cierre FDS — texto libre (autocompletado con el orador)
      const fdsOrCi = fds.oracionCierreTexto ?? ''
      if (fdsOrCi) multiCol([['Oración de cierre', fdsOrCi]])

      // Microfonistas y Acomodadores — fin de semana
      const fdsMic1 = nombre(fds.microfonista1)
      const fdsMic2 = nombre(fds.microfonista2)
      const fdsAco1 = nombre(fds.acomodador1)
      const fdsAco2 = nombre(fds.acomodador2)
      if (fdsMic1 || fdsMic2 || fdsAco1 || fdsAco2) {
        y += LINE_H
        checkPage(LINE_H * 2 + 4)
        if (fdsMic1 || fdsMic2) multiCol([['Microfonista 1', fdsMic1], ['Microfonista 2', fdsMic2]], 5.5, [128, 0, 0])
        if (fdsAco1 || fdsAco2) multiCol([['Acomodador 1', fdsAco1], ['Acomodador 2', fdsAco2]], 5.5, [128, 0, 0])
      }
    }

    y += 8
  }

  // FDS meetings without a matching weekday semana (one representative per week)
  const fdsHuerfanas = (() => {
    const seen = new Map<number, SemanaFDS>()
    for (const fds of semanasFDS) {
      const key = semanaLunes(fds.fecha)
      // Huérfana solo si NO hay reunión entre semana en su semana ISO (en ningún mes).
      if (!todasLasSemanas.some(s => semanaLunes(s.fecha) === key) && !seen.has(key)) {
        seen.set(key, fds)
      }
    }
    return [...seen.values()]
  })()

  for (const fds of fdsHuerfanas) {
    const asigsFDSMap = asigsFDSSemana(fds.fecha, semanasFDS, todasAsignacionesFDS)

    doc.addPage()
    y = 12

    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 0, 0)
    doc.text('RESUMEN SEMANAL', mL + 2, y)
    const [, fm, fd] = fds.fecha.split('-').map(Number)
    const fdsDateLabel = `${MONTHS[fm - 1]} ${fd}`
    doc.setTextColor(180, 30, 30)
    doc.text(fdsDateLabel, pageW / 2, y, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 80, 80)
    doc.text(congregacion, pageW - mR, y, { align: 'right' })
    y += 3
    doc.setDrawColor(160, 160, 160)
    doc.line(mL, y, pageW - mR, y)
    y += 3.5

    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(120, 120, 120)
    doc.text('REUNIÓN DE FIN DE SEMANA', mL + 2, y)
    doc.setTextColor(0, 0, 0)
    y += 8

    sectionBar('Apertura', 60, 40, 100)
    multiCol([['Presidente', nombre(asigsFDSMap['fds_presidente'])]])
    multiCol([['Oración de apertura', nombre(asigsFDSMap['fds_oracion_apertura'])]])

    sectionBar('Disertación pública', 133, 100, 4)
    const disertLabel = fds.boceto
      ? bocetoPDFLabel(fds.boceto)
      : fds.disertacionTitulo ?? ''
    if (disertLabel) {
      checkPage(ROW_H + 1)
      doc.setFontSize(8.5)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(10, 10, 10)
      const lines = doc.splitTextToSize(disertLabel, cW - 4)
      for (let i = 0; i < lines.length; i++) doc.text(lines[i], mL + 3, y + i * LINE_H)
      doc.setTextColor(0, 0, 0)
      y += Math.max(lines.length * LINE_H, ROW_H)
    }
    const oradorInfo: string[] = []
    if (fds.oradorNombre) oradorInfo.push(fds.oradorNombre)
    if (fds.oradorCongregacion) oradorInfo.push(`(${fds.oradorCongregacion})`)
    if (oradorInfo.length > 0) {
      checkPage(ROW_H)
      doc.setFontSize(8.5)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(10, 10, 10)
      doc.text('Orador: ', mL + 3, y)
      const labelW = doc.getTextWidth('Orador: ')
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(90, 90, 90)
      doc.text(oradorInfo.join(' '), mL + 3 + labelW, y)
      doc.setTextColor(0, 0, 0)
      y += ROW_H
    }

    sectionBar('Estudio de La Atalaya', 20, 50, 120)
    if (fds.tituloArticulo) {
      checkPage(ROW_H + 1)
      doc.setFontSize(8.5)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(10, 10, 10)
      const lines = doc.splitTextToSize(fds.tituloArticulo, cW - 4)
      for (let i = 0; i < lines.length; i++) doc.text(lines[i], mL + 3, y + i * LINE_H)
      doc.setTextColor(0, 0, 0)
      y += Math.max(lines.length * LINE_H, ROW_H)
    }
    const fdsLector = nombre(asigsFDSMap['fds_lector'])
    if (fdsLector) multiCol([['Lector', fdsLector]])
    const fdsOrCi = fds.oracionCierreTexto ?? ''
    if (fdsOrCi) multiCol([['Oración de cierre', fdsOrCi]])

    const hMic1 = nombre(fds.microfonista1)
    const hMic2 = nombre(fds.microfonista2)
    const hAco1 = nombre(fds.acomodador1)
    const hAco2 = nombre(fds.acomodador2)
    if (hMic1 || hMic2 || hAco1 || hAco2) {
      y += LINE_H
      checkPage(LINE_H * 2 + 4)
      if (hMic1 || hMic2) multiCol([['Microfonista 1', hMic1], ['Microfonista 2', hMic2]], 5.5, [128, 0, 0])
      if (hAco1 || hAco2) multiCol([['Acomodador 1', hAco1], ['Acomodador 2', hAco2]], 5.5, [128, 0, 0])
    }

    y += 8
  }

  doc.save(`programa-${mesAnio.replace(/\s/g, '-').toLowerCase()}.pdf`)
}
