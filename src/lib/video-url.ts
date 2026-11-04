/** Detecta URLs de stream HLS (.m3u8), ignorando query strings e fragmentos. */
export function isHlsUrl(value: string | null | undefined): boolean {
  if (!value) return false
  return /\.m3u8($|[?#])/i.test(value.trim())
}

/**
 * Lê uma ou mais fontes salvas em `video_url`.
 * Um único link continua no formato antigo; várias fontes ficam como JSON
 * nesse mesmo campo para não exigir alteração de esquema no banco.
 */
export function parseVideoSources(value: string | null | undefined): string[] {
  if (!value?.trim()) return []
  const raw = value.trim()
  let entries: unknown[]
  if (raw.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(raw)
      entries = Array.isArray(parsed) ? parsed : [raw]
    } catch {
      entries = raw.split(/\r?\n/)
    }
  } else {
    entries = raw.split(/\r?\n/)
  }

  return [...new Set(entries
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean))]
}

/** Deixa as fontes em linhas para edição no painel administrativo. */
export function formatVideoSources(value: string | null | undefined): string {
  return parseVideoSources(value).join('\n')
}

/** Mantém os registros antigos simples e serializa apenas quando há reserva. */
export function serializeVideoSources(value: string | null | undefined): string | null {
  const sources = parseVideoSources(value)
  if (sources.length > 1) return JSON.stringify(sources)
  return sources[0] ?? null
}

/**
 * Converte página de player em URL pronta para `<iframe>`.
 * Retorna `null` quando não é embed (arquivo direto, HLS ou URL desconhecida).
 *
 * Por que existe: hosts como a OnNowPlay entregam links `.m3u8` temporários
 * (expiram com "Session Expired") e um endereço permanente do player.
 * O permanente vai no `video_url` e cai aqui em vez do hls.js.
 */
export function toEmbedSrc(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed || isHlsUrl(trimmed)) return null

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }
  if (!/^https?:$/.test(url.protocol)) return null
  const host = url.hostname.toLowerCase()

  // YouTube: watch/shorts/youtu.be viram /embed/ (a página watch nega iframe).
  if (host === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0]
    return id ? `https://www.youtube.com/embed/${id}` : null
  }
  if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
    if (url.pathname.startsWith('/embed/') && url.pathname.length > '/embed/'.length) return trimmed
    if (url.pathname === '/watch') {
      const id = url.searchParams.get('v')
      return id ? `https://www.youtube.com/embed/${id}` : null
    }
    const short = url.pathname.match(/^\/shorts\/([\w-]{6,})/)
    if (short) return `https://www.youtube.com/embed/${short[1]}`
    return null
  }

  // Vimeo: página do vídeo vira player.
  if (host === 'vimeo.com') {
    const match = url.pathname.match(/^\/(\d+)/)
    return match ? `https://player.vimeo.com/video/${match[1]}` : null
  }
  if (host === 'player.vimeo.com') return trimmed

  // OnNowPlay: página/embed do player (tudo que não for o .m3u8 cru).
  if (host.includes('onnowplay.com')) return trimmed

  // Genérico: páginas explícitas de embed.
  const path = url.pathname.toLowerCase()
  if (path.includes('/embed/') || path.includes('/player/')) return trimmed
  return null
}
