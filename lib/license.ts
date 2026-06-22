import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import https from 'https'
import path from 'path'

function httpsPost(url: string, headers: Record<string, string>, body: string, timeoutMs: number): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const req = https.request(
      { hostname: parsed.hostname, path: parsed.pathname + parsed.search, method: 'POST', headers },
      (res) => {
        let data = ''
        res.on('data', (chunk: Buffer) => { data += chunk.toString() })
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }))
      }
    )
    req.setTimeout(timeoutMs, () => { req.destroy(new Error('timeout')) })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

const APP_SALT = 'VyMScheduler-2024-salt'
const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY!

export interface LicensePayload {
  token: string
  machineId: string
  congregationName: string
  issuedAt: number
  expiresAt: number
}

export type LicenseStatus =
  | { valid: true; expiresAt: Date; congregationName: string; token: string }
  | { valid: false; reason: 'no_license' | 'expired' | 'tampered' | 'wrong_machine' }

function sanitizeToken(token: string): string {
  return token.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60)
}

export function getLicensePath(token?: string): string {
  const userData = process.env['VYM_USER_DATA']
  const base = userData ?? process.cwd()
  const filename = token ? `${sanitizeToken(token)}.vym` : 'license.vym'
  return path.join(base, filename)
}

// ID estable de la máquina — se genera una vez y se guarda en machine_id.txt
// Evita el problema de MACs que cambian al desconectar la red
function getMachineId(): string {
  const userData = process.env.VYM_USER_DATA
  if (!userData) return 'fallback-no-userdata'
  const idPath = path.join(userData, 'machine_id.txt')
  try {
    if (existsSync(idPath)) return readFileSync(idPath, 'utf8').trim()
  } catch { /* ignorar */ }
  const id = randomBytes(16).toString('hex')
  try { writeFileSync(idPath, id, 'utf8') } catch { /* ignorar */ }
  return id
}

function deriveKey(machineId: string): Buffer {
  return createHash('sha256').update(`${machineId}:${APP_SALT}`).digest()
}

export function checkLocalLicense(licensePath: string): LicenseStatus {
  if (!existsSync(licensePath)) return { valid: false, reason: 'no_license' }

  try {
    const content = readFileSync(licensePath, 'utf8').trim()
    const [ivHex, cipherHex] = content.split(':')
    if (!ivHex || !cipherHex) return { valid: false, reason: 'tampered' }

    const machineId = getMachineId()
    const key = deriveKey(machineId)
    const iv = Buffer.from(ivHex, 'hex')
    const ciphertext = Buffer.from(cipherHex, 'hex')

    const decipher = createDecipheriv('aes-256-cbc', key, iv)
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
    const payload: LicensePayload = JSON.parse(decrypted)

    if (payload.machineId !== machineId) return { valid: false, reason: 'wrong_machine' }
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

export function saveLicense(licensePath: string, payload: Omit<LicensePayload, 'machineId'>): void {
  const machineId = getMachineId()
  const key = deriveKey(machineId)
  const iv = randomBytes(16)
  const full: LicensePayload = { ...payload, machineId }
  const cipher = createCipheriv('aes-256-cbc', key, iv)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(full), 'utf8'), cipher.final()])
  writeFileSync(licensePath, `${iv.toString('hex')}:${encrypted.toString('hex')}`, 'utf8')
}

export async function validateAndRenewLicense(
  token: string,
  licensePath: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    // RPC SECURITY DEFINER: valida el token y, si está activo, refresca
    // last_renewed_at internamente. Se llama con la anon key (pública).
    const rpcUrl = `${SUPABASE_URL}/rest/v1/rpc/validar_renovar_licencia`
    const res = await httpsPost(
      rpcUrl,
      { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      JSON.stringify({ p_token: token }),
      8000
    )

    if (res.status < 200 || res.status >= 300) return { ok: false, error: 'Error al conectar con el servidor' }

    const rows = JSON.parse(res.body) as Array<{ found: boolean; active: boolean; congregation_name: string; license_duration_days: number }>
    const row = rows[0]
    if (!row || !row.found) return { ok: false, error: 'Token no encontrado' }
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
