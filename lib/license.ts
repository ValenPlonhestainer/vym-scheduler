import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { networkInterfaces, hostname } from 'os'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import path from 'path'

const APP_SALT = 'VyMScheduler-2024-salt'
const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export interface LicensePayload {
  token: string
  mac: string
  congregationName: string
  issuedAt: number
  expiresAt: number
}

export type LicenseStatus =
  | { valid: true; expiresAt: Date; congregationName: string; token: string }
  | { valid: false; reason: 'no_license' | 'expired' | 'tampered' | 'wrong_machine' }

export function getLicensePath(): string {
  const userData = process.env.VYM_USER_DATA
  if (userData) return path.join(userData, 'license.vym')
  return path.join(process.cwd(), 'license-dev.vym')
}

function getMacAddress(): string {
  const nets = networkInterfaces()
  for (const ifaces of Object.values(nets)) {
    for (const iface of (ifaces ?? [])) {
      if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
        return iface.mac
      }
    }
  }
  return hostname()
}

function deriveKey(mac: string): Buffer {
  return createHash('sha256').update(`${mac}:${APP_SALT}`).digest()
}

export function checkLocalLicense(licensePath: string): LicenseStatus {
  if (!existsSync(licensePath)) return { valid: false, reason: 'no_license' }

  try {
    const content = readFileSync(licensePath, 'utf8').trim()
    const [ivHex, cipherHex] = content.split(':')
    if (!ivHex || !cipherHex) return { valid: false, reason: 'tampered' }

    const mac = getMacAddress()
    const key = deriveKey(mac)
    const iv = Buffer.from(ivHex, 'hex')
    const ciphertext = Buffer.from(cipherHex, 'hex')

    const decipher = createDecipheriv('aes-256-cbc', key, iv)
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
    const payload: LicensePayload = JSON.parse(decrypted)

    if (payload.mac !== mac) return { valid: false, reason: 'wrong_machine' }
    if (Date.now() > payload.expiresAt) return { valid: false, reason: 'expired' }

    return {
      valid: true,
      expiresAt: new Date(payload.expiresAt),
      congregationName: payload.congregationName,
      token: payload.token,
    }
  } catch {
    return { valid: false, reason: 'tampered' }
  }
}

export function saveLicense(licensePath: string, payload: Omit<LicensePayload, 'mac'>): void {
  const mac = getMacAddress()
  const key = deriveKey(mac)
  const iv = randomBytes(16)
  const full: LicensePayload = { ...payload, mac }
  const cipher = createCipheriv('aes-256-cbc', key, iv)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(full), 'utf8'), cipher.final()])
  writeFileSync(licensePath, `${iv.toString('hex')}:${encrypted.toString('hex')}`, 'utf8')
}

export async function validateAndRenewLicense(
  token: string,
  licensePath: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/tokens?token=eq.${encodeURIComponent(token)}&select=active,congregation_name,license_duration_days`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        signal: AbortSignal.timeout(8000),
      }
    )

    if (!res.ok) return { ok: false, error: 'Error al conectar con el servidor' }

    const rows = await res.json() as Array<{ active: boolean; congregation_name: string; license_duration_days: number }>
    if (!rows.length) return { ok: false, error: 'Token no encontrado' }

    const row = rows[0]
    if (!row.active) return { ok: false, error: 'Este token ha sido desactivado' }

    const durationDays = row.license_duration_days ?? 30
    const now = Date.now()
    saveLicense(licensePath, {
      token,
      congregationName: row.congregation_name,
      issuedAt: now,
      expiresAt: now + durationDays * 24 * 60 * 60 * 1000,
    })

    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Sin conexión'
    return { ok: false, error: `No se pudo conectar: ${msg}` }
  }
}
