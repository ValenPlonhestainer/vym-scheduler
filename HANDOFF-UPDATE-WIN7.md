# Handoff — Auto-update híbrido para Windows 7

> **Para Claude Code que trabaja en una COPIA del proyecto.** Este documento es autocontenido: contiene el problema, el diseño acordado, los archivos que vas a tocar y los snippets reales del repo que necesitás como referencia. No asumas nada que no esté acá; verificá en el código antes de editar.
>
> **Contexto de versión:** `package.json` está en `0.8.6`. La feature 0.8.6 (anon key + RLS + fixes) ya está commiteada y publicada. Esta tarea es nueva y va en una versión siguiente (p. ej. `0.8.7` / `0.9.0`).
>
> **Por qué una copia:** el usuario no quiere arriesgar errores en la carpeta original. Trabajá libremente acá.

---

## 1. El problema

`electron-updater` descarga el `.exe` usando el stack de red de **Chromium** (Electron). En Windows, ese stack valida TLS contra el **almacén de certificados del sistema operativo**. Un **Windows 7 sin parchear** no tiene TLS 1.2 ni los root certs modernos → el HTTPS hacia **R2 (Cloudflare)** falla **en silencio** → en Win7 nunca llega el update.

Plataformas Win8+/10/11: el auto-update actual con `electron-updater` **funciona bien**. No hay que romperlo.

## 2. El insight que habilita la solución

[lib/license.ts](lib/license.ts) ya habla HTTPS con Supabase usando el módulo **`https` de Node** (OpenSSL + CA bundle propio de Node, **independiente** del almacén de Win7) y **funciona en Win7** — si no funcionara, la app ni siquiera validaría la licencia al arrancar. O sea: **la vía Win7-friendly ya está probada en este mismo repo.**

Además, los navegadores que todavía corren en Win7 (Chrome 109, Firefox ESR 115) traen su propio TLS y **descargan de R2 sin problema**.

## 3. Diseño acordado: "híbrido" (notifica en-app, descarga el navegador)

En Windows 7 (y como fallback general), en vez de que `electron-updater` baje el `.exe`:

1. Al arrancar la app, bajar **solo `latest.yml`** desde R2 con el `https` de Node (mismo patrón que `license.ts`). Es un archivo chico → es la parte que Win7 **sí** puede hacer.
2. Parsear el campo `version` del YAML y compararlo con `app.getVersion()`.
3. Si hay una versión nueva, mostrar un popup **"Versión X disponible"** con un botón **Descargar**.
4. El botón hace `shell.openExternal('<URL de la página de descargas>')` → abre el navegador del sistema → el usuario baja el `.exe` (el navegador maneja el TLS de Cloudflare) y lo instala a mano.

**Ventaja:** aviso AUTOMÁTICO (parte chica vía Node, anda en Win7) + descarga CONFIABLE (la hace el navegador). Cero riesgo TLS nuevo en la app, cero superficie MITM nueva.

### Convivencia con `electron-updater` — DECIDIDO: enfoque A (usuario, 2026-06-22)

- **A) Detectar Win7 y ramificar.** `os.release()` en Win7 empieza con `6.1`. Si es Win7 → flujo híbrido (Node https + openExternal). Si no → `electron-updater` como hoy. No abrir esta pregunta de nuevo.
- ~~B) Híbrido como fallback~~ (descartado).

**Por qué A y no B (razón decisiva):** en Win7 el fallo de TLS hacia R2 es **silencioso** (tu propia diagnosis: *"falla en silencio → no hay update en Win7"*). B depende de **detectar ese fallo** para disparar el fallback, y si `electron-updater` no emite un `error` limpio (un cuelgue de TLS suele verse como timeout/silencio, no como error claro), B **nunca** cae al híbrido → Win7 sigue sin updates. B apuesta justo a la señal menos confiable. A decide el camino por `os.release()` **antes** de tocar la red: determinístico, no depende de ninguna señal que pueda fallar.

**Ventajas adicionales de A:** no toca el camino que ya funciona en Win10/11 (riesgo casi nulo de romper lo que anda); más fácil de testear (forzás la rama con env var, ver §6); menos estados ambiguos ("¿fue 'no hay update' o 'falló el transporte'?").

**Matiz aceptado:** `6.1` también es Windows Server 2008 R2, no solo Win7. Irrelevante para el parque del usuario (PCs de escritorio de congregaciones); y si una de esas cayera en el camino híbrido, tampoco rompe nada (igual avisa + abre el navegador).

**Mejora futura (NO para la v1):** si más adelante aparece una Win10/11 con certs rotos o tras proxy corporativo, se puede sumar la lógica de B *encima* de A — Win7 → híbrido siempre; resto → electron-updater, y si este emite un `error` explícito → fallback híbrido. Dejarlo para después, no complicar la primera versión.

## 4. Datos concretos del proyecto (verificados)

- **Bucket R2 público (provider de updates):** `https://pub-ea9f59664d6d4742a8da9c6c3db561fe.r2.dev`
  - `latest.yml` → `https://pub-ea9f59664d6d4742a8da9c6c3db561fe.r2.dev/latest.yml`
  - instalador → `https://pub-ea9f59664d6d4742a8da9c6c3db561fe.r2.dev/VyM-Scheduler-Setup-<version>.exe`
  - Definido en [electron-builder.config.js](electron-builder.config.js) (`publish.provider = 'generic'`, `url = ...r2.dev`) y en [scripts/publish-r2.mjs](scripts/publish-r2.mjs) (bucket `vym-updates`, sube `latest.yml`, `.exe`, `.blockmap`).
  - `artifactName`: `VyM-Scheduler-Setup-${version}.${ext}`.
- **Versión en runtime:** `app.getVersion()` (Electron) devuelve el `version` de `package.json`.
- **`latest.yml`** (formato electron-builder) tiene esta forma:
  ```yaml
  version: 0.8.6
  files:
    - url: VyM-Scheduler-Setup-0.8.6.exe
      sha512: <...>
      size: <...>
  path: VyM-Scheduler-Setup-0.8.6.exe
  sha512: <...>
  releaseDate: '2026-...'
  ```
  Para el chequeo alcanza con parsear `version:`. **No agregar una dependencia de YAML** sólo para esto: una regex simple `/^version:\s*(.+)$/m` sobre el texto es suficiente y evita sumar peso. Comparar versiones con un semver-compare casero (split por `.`, comparar numérico) — no hay `semver` en deps.

## 5. Archivos a tocar

### `electron/main.ts` — [ver actual](electron/main.ts)
- Ya tiene `setupAutoUpdater()` con `electron-updater` (autoDownload=false, popup por IPC). Acá va la ramificación Win7 vs resto (enfoque A).
- Agregar una función tipo `checkUpdateWin7()` que:
  - Baje `latest.yml` con `https` de Node (copiar el patrón de `httpsPost`/`https.request` de `license.ts`, pero GET).
  - Parsee `version`, compare con `app.getVersion()`.
  - Si hay nueva, mande al renderer un evento nuevo (p. ej. `update-available-manual` con `{ version, downloadUrl }`) y bufferice en `pendingUpdate` igual que hoy (hay un race conocido: el renderer monta tarde — por eso existe `get-update-status`).
- Agregar `ipcMain.on('open-download-page', () => shell.openExternal(URL))`. Importar `shell` de `electron`.
- **GOTCHA detectado:** el preload expone `getVersion: () => ipcRenderer.invoke('get-version')` **pero NO existe** `ipcMain.handle('get-version', ...)` en `main.ts`. Si vas a usar la versión en el renderer, agregá el handler (`ipcMain.handle('get-version', () => app.getVersion())`). Para el chequeo Win7 la comparación conviene hacerla en **main** (tenés `app.getVersion()` directo), no en el renderer.
- **Texto hardcodeado a limpiar (deuda menor, aprovechá el paso):** los logs dicen `'Verificando actualizaciones (GitHub)...'` (líneas ~136) pero el provider real es **R2**, no GitHub. Corregir a R2.

### `electron/preload.ts` — [ver actual](electron/preload.ts)
- Ya expone el bloque "Auto-update" en `electronAPI`. Sumar:
  - `onManualUpdateAvailable: (cb) => ipcRenderer.on('update-available-manual', (_e, info) => cb(info))`
  - `openDownloadPage: () => ipcRenderer.send('open-download-page')`
- Mantener el patrón existente (contextBridge, sin nodeIntegration).

### `components/update-dialog.tsx` — [ver actual](components/update-dialog.tsx)
- Hoy maneja estados `available | downloading | ready | installing` para el flujo `electron-updater`.
- Agregar un estado nuevo, p. ej. `manual` (`{ stage: 'manual'; version: string }`), que renderice un card con botón **"Descargar"** → `electronAPI.openDownloadPage()` (en vez de `confirmDownload()`).
- Suscribirse a `onManualUpdateAvailable` en el `useEffect`. Respetar el chequeo de `getUpdateStatus` para el race de montaje.
- Reusar el estilo del card existente (Tailwind, mismas clases) para consistencia visual.

### Nuevo: la "página de descargas"
- No requiere nada complejo: **un solo HTML** con un link al `.exe` que ya vive en R2.
- **HOST DECIDIDO (usuario, 2026-06-22): Cloudflare Pages.** No abrir esta pregunta de nuevo. Razón: el proyecto ya está todo en Cloudflare — el `.exe` y `latest.yml` viven en R2 (bucket `vym-updates`) y ya se usa `wrangler` en [scripts/publish-r2.mjs](scripts/publish-r2.mjs). Misma cuenta, mismo CLI, mismo token, mismo origen que R2, HTTPS gratis. Vercel/Netlify quedaron descartados por sumar un proveedor extra para una sola página estática. Win7 con Chrome 109 / Firefox ESR 115 carga Cloudflare sin problema (mismo TLS que ya resuelve R2).
- **Fase 1 (arrancar simple): página estática.** Un `index.html` con el link directo a `https://pub-ea9f59664d6d4742a8da9c6c3db561fe.r2.dev/VyM-Scheduler-Setup-<ultima>.exe`. Se actualiza a mano en cada release (paso nuevo en el flujo de publicación). Es lo más rápido y sin partes móviles.
- **Fase 2 (mejora, cuando moleste actualizar a mano): Pages Function que lee `latest.yml`.** Una function en Cloudflare Pages que, en cada visita/click, hace fetch de `https://pub-ea9f59664d6d4742a8da9c6c3db561fe.r2.dev/latest.yml`, parsea el campo `version` (misma regex que en el cliente, ver §4), arma la URL `VyM-Scheduler-Setup-<version>.exe` y redirige (302) o la inyecta en el HTML. Así la página siempre apunta al último build **sin tocarla en cada publish**. Opcional: bindear el bucket R2 directo a la Function (R2 binding) en vez de fetch público, pero el fetch al `.r2.dev` público alcanza y es más simple. No agregar dependencia de YAML: regex `/^version:\s*(.+)$/m` sobre el texto.

## 6. Cómo probar

1. **Compilar:** `npm run electron:build` (corre `next build` + `tsc` electron + `electron-rebuild better-sqlite3` + `electron-builder`). Ojo: pesado y produce `dist/` (varios GB, gitignored).
   - Para iterar rápido en lógica sin empaquetar: `npm run electron:dev` (sólo tsc + electron). **Pero** el auto-update real sólo corre con `app.isPackaged` (ver `if (app.isPackaged)` al final de `setupAutoUpdater`). Para testear el camino híbrido fuera de package, considerá un override temporal por env var.
2. **Simular Win7:** `os.release()` empieza con `6.1`. Para testear la rama sin un Win7 real, parchear temporalmente la detección detrás de una env var (p. ej. `VYM_FORCE_WIN7=1`) y quitarla antes de cerrar.
3. **Test real (lo que pidió el usuario):** en un Windows 7 real verificar que (a) el chequeo de `latest.yml` por Node https resuelve, y (b) `shell.openExternal` abre la página en el navegador del sistema.
4. **No romper Win10/11:** confirmar que el `electron-updater` actual sigue andando en el camino no-Win7 (enfoque A lo deja intacto).

### Riesgos / a confirmar
- Que los Win7 del usuario tengan **Chrome/Firefox actualizado**. IE11 (SChannel viejo) **sí** fallaría con Cloudflare → necesitaría otro host. Confirmar con el usuario su parque de Win7.
- Versionado: subir `package.json` a la versión nueva antes de `electron:build`, porque `artifactName` y `latest.yml` salen de ahí.

## 7. Flujo de publicación (referencia, no cambia)
1. Subir `version` en `package.json`.
2. `npm run electron:build` → genera `dist/VyM-Scheduler-Setup-<ver>.exe`, `.blockmap`, `latest.yml`.
3. `npm run publish:r2` → sube esos 3 a R2 (bucket `vym-updates`). Requiere `CLOUDFLARE_API_TOKEN` (en `.env.publish`, gitignored).
4. Página de descargas en Cloudflare Pages: si está en **Fase 1 (estática)**, actualizar a mano el link al nuevo `.exe`. Si ya está en **Fase 2 (Pages Function que lee `latest.yml`)**, este paso desaparece — la página se actualiza sola al publicar el nuevo `latest.yml` en R2.

## 8. Alternativas descartadas (por si el híbrido no alcanza)
- **Opción 2 (barata):** manejar `app.on('certificate-error')` sólo para el host de R2 + confiar en el `sha512` de `latest.yml`. Debilita el anti-MITM para ese host. Probar sólo si el híbrido no alcanza.
- **Opción 3 (full auto, más código):** updater propio que baja TAMBIÉN el `.exe` por Node `https` y lo instala solo (no necesita página). Reusa el patrón de `license.ts`. Más superficie de código y de bugs.

---

### Patrón HTTPS de Node a copiar (de `lib/license.ts`, adaptar a GET)
```ts
import https from 'https'

function httpsGet(url: string, timeoutMs: number): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const req = https.request(
      { hostname: parsed.hostname, path: parsed.pathname + parsed.search, method: 'GET' },
      (res) => {
        let data = ''
        res.on('data', (chunk: Buffer) => { data += chunk.toString() })
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }))
      }
    )
    req.setTimeout(timeoutMs, () => { req.destroy(new Error('timeout')) })
    req.on('error', reject)
    req.end()
  })
}
```
El original (`httpsPost`) está en [lib/license.ts:6-22](lib/license.ts#L6-L22).
