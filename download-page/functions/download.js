// GET /download → 302 al instalador de la última versión publicada en R2.
// El navegador (Chrome/Firefox en Win7) sigue el redirect y baja el .exe.
import { getLatest } from './_latest.js'

export async function onRequest() {
  try {
    const { exeUrl } = await getLatest()
    return Response.redirect(exeUrl, 302)
  } catch (e) {
    return new Response(`No se pudo resolver la última versión: ${e.message}`, {
      status: 502,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  }
}
