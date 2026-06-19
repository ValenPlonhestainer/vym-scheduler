import { NextRequest, NextResponse } from 'next/server'
import { getDb, ensureCongregationId, setConfigValue, getConfigValue } from '@/lib/db'
import { checkLocalLicense, validateAndRenewLicense, getLicensePath } from '@/lib/license'

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 60 * 60 * 24 * 365 * 10,
  path: '/',
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const token = ((body.token as string) ?? '').trim()

  if (!token) {
    return NextResponse.json({ error: 'Token requerido' }, { status: 400 })
  }

  const licensePath = getLicensePath()
  const licStatus = checkLocalLicense(licensePath)
  const savedToken = getConfigValue('token')

  // Si la licencia local es válida y el token coincide → sesión directa sin internet
  if (licStatus.valid && savedToken === token) {
    const congId = ensureCongregationId()
    const response = NextResponse.json({ ok: true })
    response.cookies.set('congregation_token', token, COOKIE_OPTS)
    response.cookies.set('congregation_id', congId, COOKIE_OPTS)
    return response
  }

  // Licencia expirada, no existe, o token distinto → validar online y renovar
  const renewal = await validateAndRenewLicense(token, licensePath)
  if (!renewal.ok) {
    const isExpired = licStatus.valid === false && licStatus.reason === 'expired'
    const errorMsg = isExpired
      ? `Licencia expirada. ${renewal.error ?? 'Conectate a internet para renovarla.'}`
      : (renewal.error ?? 'Token inválido o sin conexión.')
    return NextResponse.json({ error: errorMsg }, { status: 401 })
  }

  // Guardar token localmente para futuras sesiones offline
  setConfigValue('token', token)

  // Si cambió el nombre de congregación, actualizar config local
  const newLicStatus = checkLocalLicense(licensePath)
  if (newLicStatus.valid) {
    setConfigValue('congregation_name', newLicStatus.congregationName)
  }

  const congId = ensureCongregationId()
  const response = NextResponse.json({ ok: true })
  response.cookies.set('congregation_token', token, COOKIE_OPTS)
  response.cookies.set('congregation_id', congId, COOKIE_OPTS)

  // Suprimir advertencia de variable no usada — getDb() se importa para trigger de init
  void getDb

  return response
}
