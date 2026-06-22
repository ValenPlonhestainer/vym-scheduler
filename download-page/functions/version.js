// GET /version → { version } de la última publicación. Lo consume index.html
// para mostrar el número sin hardcodearlo.
import { getLatest } from './_latest.js'

export async function onRequest() {
  try {
    const { version } = await getLatest()
    return new Response(JSON.stringify({ version }), {
      headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=60' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    })
  }
}
