// Publica los artefactos de actualización a Cloudflare R2 (bucket: vym-updates).
// Lee la versión de package.json y sube: latest.yml, el instalador .exe y su .blockmap.
//
// Requiere CLOUDFLARE_API_TOKEN (con permiso Workers R2 Storage: Edit).
// Se toma de la variable de entorno o del archivo .env.publish (gitignored, NO se empaqueta).
//
// Uso:  npm run publish:r2   (correr DESPUÉS de npm run electron:build)

import { execSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BUCKET = 'vym-updates'

function loadToken() {
  if (process.env.CLOUDFLARE_API_TOKEN) return process.env.CLOUDFLARE_API_TOKEN
  const envPath = path.join(root, '.env.publish')
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^\s*CLOUDFLARE_API_TOKEN\s*=\s*(.+?)\s*$/)
      if (m) return m[1].replace(/^["']|["']$/g, '')
    }
  }
  return null
}

const token = loadToken()
if (!token) {
  console.error('ERROR: falta CLOUDFLARE_API_TOKEN (ponelo en .env.publish o como variable de entorno).')
  process.exit(1)
}

const { version } = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
const exe = `VyM-Scheduler-Setup-${version}.exe`
const files = ['latest.yml', `${exe}.blockmap`, exe]

const env = { ...process.env, CLOUDFLARE_API_TOKEN: token }

for (const name of files) {
  const local = path.join(root, 'dist', name)
  if (!existsSync(local)) {
    console.error(`ERROR: no existe dist/${name}. ¿Corriste "npm run electron:build"?`)
    process.exit(1)
  }
  console.log(`>> Subiendo ${name} ...`)
  execSync(
    `npx wrangler r2 object put "${BUCKET}/${name}" --file "${local}" --remote`,
    { stdio: 'inherit', env },
  )
}

console.log(`\n✅ Publicado v${version} en R2 (bucket ${BUCKET}).`)
