import { HttpError, json, type Env } from './lib'
import { requireAdmin } from './auth'
import { parseVideoSources } from '../src/lib/video-url'

// Links externos (.m3u8 temporários, por ex.) morrem sem aviso. Estas rotas
// (só admin) permitem detectar os quebrados e trocar vários de uma vez.

type VideoLinkRow = { id: string; title: string; video_url: string | null }

async function probeUrl(url: string): Promise<{ ok: boolean; status: number }> {
  const attempt = async (method: 'HEAD' | 'GET') => {
    const response = await fetch(url, {
      method,
      redirect: 'manual',
      signal: AbortSignal.timeout(8000),
      headers: method === 'GET' ? { Range: 'bytes=0-0' } : {},
    })
    return { ok: response.ok, status: response.status }
  }
  try {
    try {
      return await attempt('HEAD')
    } catch {
      return await attempt('GET')
    }
  } catch {
    return { ok: false, status: 0 }
  }
}

export async function handleCheckLinks(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') throw new HttpError(405, 'method_not_allowed', 'Método não permitido.')
  await requireAdmin(request, env)

  const { results } = await env.DB.prepare(
    `SELECT id, title, video_url FROM videos
     WHERE is_published = 1 AND video_url IS NOT NULL AND video_url != ''
     ORDER BY sort_order ASC`,
  ).all<VideoLinkRow>()

  const checks = await Promise.all(
    results.map(async (row) => {
      const sources = parseVideoSources(row.video_url)
      if (sources.length === 0) return { id: row.id, title: row.title, ok: false, status: 0 }
      const statuses = await Promise.all(sources.map(probeUrl))
      const working = statuses.find((result) => result.ok)
      return { id: row.id, title: row.title, ok: Boolean(working), status: working?.status ?? statuses[0].status }
    }),
  )
  return json({ data: checks })
}

type BulkItem = { id: unknown; url?: unknown; urls?: unknown }

export async function handleBulkVideoUrls(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') throw new HttpError(405, 'method_not_allowed', 'Método não permitido.')
  await requireAdmin(request, env)

  const body = (await request.json().catch(() => null)) as { items?: unknown } | null
  if (!body || !Array.isArray(body.items)) throw new HttpError(400, 'bad_request', 'Envie items: [{ id, url }].')
  const items = body.items as BulkItem[]
  if (items.length === 0 || items.length > 200) throw new HttpError(400, 'bad_request', 'Envie de 1 a 200 itens.')

  const clean = items.map((item) => {
    if (typeof item.id !== 'string' || !item.id) throw new HttpError(400, 'bad_request', 'Cada item precisa de id.')
    const rawSources = Array.isArray(item.urls) ? item.urls : [item.url]
    if (rawSources.length === 0 || rawSources.length > 6) {
      throw new HttpError(400, 'bad_request', `Informe de 1 a 6 fontes para ${item.id}.`)
    }
    const urls = rawSources.map((value) => {
      if (typeof value !== 'string' || !value.trim()) throw new HttpError(400, 'bad_request', `Fonte vazia para ${item.id}.`)
      let parsed: URL
      try {
        parsed = new URL(value.trim())
      } catch {
        throw new HttpError(400, 'bad_request', `URL inválida para ${item.id}.`)
      }
      if (!/^https?:$/.test(parsed.protocol)) throw new HttpError(400, 'bad_request', `URL inválida para ${item.id}.`)
      return value.trim()
    })
    return { id: item.id, value: urls.length === 1 ? urls[0] : JSON.stringify(urls) }
  })

  const existing = await env.DB.prepare(
    `SELECT id FROM videos WHERE id IN (${clean.map(() => '?').join(', ')})`,
  ).bind(...clean.map((c) => c.id)).all<{ id: string }>()
  const known = new Set(existing.results.map((row) => row.id))
  const unknown = clean.filter((c) => !known.has(c.id)).map((c) => c.id)
  const valid = clean.filter((c) => known.has(c.id))

  if (valid.length) {
    await env.DB.batch(valid.map((c) => env.DB.prepare('UPDATE videos SET video_url = ?1 WHERE id = ?2').bind(c.value, c.id)))
  }
  return json({ data: { updated: valid.map((c) => c.id), unknown } })
}
