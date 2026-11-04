import { HttpError, UUID_RE, entitlementSql, errorResponse, json, nowIso, type Env } from './lib'
import { getSessionUser, requireAdmin } from './auth'

const MAX_BYTES = 50 * 1024 * 1024
const ALLOWED_TYPES = new Set([
  'video/mp4', 'video/webm', 'video/quicktime',
  'image/jpeg', 'image/png', 'image/webp', 'image/avif',
])
const KEY_RE = /^videos\/([0-9a-f-]{36})\/(video|thumbnail)-[A-Za-z0-9._-]{1,120}$/i

function parseKey(raw: string) {
  const key = decodeURIComponent(raw)
  const match = KEY_RE.exec(key)
  if (!match || !UUID_RE.test(match[1])) throw new HttpError(400, 'bad_request', 'Caminho de mídia inválido.')
  return { key, videoId: match[1], kind: match[2] as 'video' | 'thumbnail' }
}

async function canRead(request: Request, env: Env, videoId: string, kind: 'video' | 'thumbnail') {
  const user = await getSessionUser(request, env)
  if (user?.is_admin) return true
  const video = await env.DB.prepare('SELECT access_type FROM videos WHERE id = ?1 AND is_published = 1')
    .bind(videoId).first<{ access_type: string }>()
  if (!video) return false
  if (kind === 'thumbnail') return true
  if (!user) return false
  if (video.access_type === 'subscription') {
    const row = await env.DB.prepare(`SELECT ${entitlementSql('?1', '?2')} AS ok`).bind(user.id, nowIso()).first<{ ok: number }>()
    return Boolean(row?.ok)
  }
  const row = await env.DB.prepare(
    "SELECT 1 AS ok FROM purchases WHERE user_id = ?1 AND video_id = ?2 AND status = 'paid'",
  ).bind(user.id, videoId).first()
  return Boolean(row)
}

export async function handleMedia(request: Request, rawEnv: Env, path: string): Promise<Response> {
  try {
    if (!rawEnv.MEDIA) {
      throw new HttpError(503, 'storage_unavailable', 'Armazenamento de arquivos (R2) não está ativado. Use uma URL externa para o vídeo.')
    }
    const env = rawEnv as Env & { MEDIA: R2Bucket }
    if (path === '/remove' && request.method === 'POST') {
      await requireAdmin(request, env)
      const body = (await request.json().catch(() => null)) as { paths?: unknown } | null
      const paths = Array.isArray(body?.paths) ? body.paths.filter((p): p is string => typeof p === 'string') : []
      const keys = paths.slice(0, 100).map((p) => parseKey(p).key)
      if (keys.length) await env.MEDIA.delete(keys)
      return json({ data: keys })
    }

    if (path === '/list' && request.method === 'GET') {
      await requireAdmin(request, env)
      const prefix = new URL(request.url).searchParams.get('prefix') ?? ''
      if (!/^videos\/[0-9a-f-]{36}$/i.test(prefix)) throw new HttpError(400, 'bad_request', 'Prefixo inválido.')
      const listed = await env.MEDIA.list({ prefix: `${prefix}/`, limit: 100 })
      return json({ data: listed.objects.map((o) => ({ name: o.key.slice(prefix.length + 1), size: o.size })) })
    }

    if (!path.startsWith('/')) throw new HttpError(404, 'not_found', 'Rota não encontrada.')
    const { key, videoId, kind } = parseKey(path.slice(1))

    if (request.method === 'PUT') {
      await requireAdmin(request, env)
      const type = (request.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase()
      const length = Number(request.headers.get('Content-Length') ?? 0)
      if (!ALLOWED_TYPES.has(type)) throw new HttpError(415, 'unsupported_media', 'Formato de arquivo não permitido.')
      if (kind === 'video' ? !type.startsWith('video/') : !type.startsWith('image/')) {
        throw new HttpError(415, 'unsupported_media', 'Tipo de arquivo incompatível com o destino.')
      }
      if (!length || length > MAX_BYTES) throw new HttpError(413, 'too_large', 'O arquivo excede 50 MB.')
      if (await env.MEDIA.head(key)) throw new HttpError(409, 'exists', 'Arquivo já existe.')
      await env.MEDIA.put(key, request.body, { httpMetadata: { contentType: type, cacheControl: 'private, max-age=3600' } })
      return json({ data: { path: key } })
    }

    if (request.method === 'GET' || request.method === 'HEAD') {
      if (!(await canRead(request, env, videoId, kind))) {
        throw new HttpError(403, 'forbidden', 'Você não tem acesso a esta mídia.')
      }
      const range = request.headers.get('Range')
      const object = await env.MEDIA.get(key, { range: request.headers })
      if (!object) throw new HttpError(404, 'not_found', 'Mídia não encontrada.')
      const headers = new Headers()
      object.writeHttpMetadata(headers)
      headers.set('Accept-Ranges', 'bytes')
      headers.set('Cache-Control', 'private, max-age=3600')
      headers.set('ETag', object.httpEtag)
      headers.set('X-Content-Type-Options', 'nosniff')
      const size = object.size
      if (range && 'range' in object && object.range) {
        const r = object.range as { offset?: number; length?: number; suffix?: number }
        const offset = r.suffix !== undefined ? size - r.suffix : (r.offset ?? 0)
        const length = r.suffix !== undefined ? r.suffix : (r.length ?? size - offset)
        headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${size}`)
        headers.set('Content-Length', String(length))
        return new Response(request.method === 'HEAD' ? null : (object as R2ObjectBody).body, { status: 206, headers })
      }
      headers.set('Content-Length', String(size))
      return new Response(request.method === 'HEAD' ? null : (object as R2ObjectBody).body, { headers })
    }

    if (request.method === 'DELETE') {
      await requireAdmin(request, env)
      await env.MEDIA.delete(key)
      return json({ data: [key] })
    }

    throw new HttpError(405, 'method_not_allowed', 'Método não permitido.')
  } catch (error) {
    return errorResponse(error)
  }
}
