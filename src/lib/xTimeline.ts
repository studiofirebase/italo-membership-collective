export type XTimelineMedia = {
  type: 'photo' | 'video' | 'animated_gif'
  url: string
  preview_url?: string
  alt_text?: string
}

export type XTimelinePost = {
  id: string
  text: string
  created_at: string
  url: string
  media: XTimelineMedia[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isXMediaUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false

  try {
    const url = new URL(value)
    return url.protocol === 'https:' &&
      (url.hostname === 'pbs.twimg.com' || url.hostname === 'video.twimg.com')
  } catch {
    return false
  }
}

function getMedia(value: unknown): XTimelineMedia | null {
  if (!isRecord(value)) return null

  const type = value.type
  if (type !== 'photo' && type !== 'video' && type !== 'animated_gif') return null

  const preview = value.media_url_https ?? value.preview_image_url
  const variants = isRecord(value.video_info) && Array.isArray(value.video_info.variants)
    ? value.video_info.variants
    : []
  const videoUrl = variants
    .filter((item): item is Record<string, unknown> =>
      isRecord(item) && item.content_type === 'video/mp4' && isXMediaUrl(item.url))
    .sort((a, b) => (typeof b.bitrate === 'number' ? b.bitrate : 0) -
      (typeof a.bitrate === 'number' ? a.bitrate : 0))[0]?.url
  const url = type === 'photo' ? value.media_url_https : videoUrl
  if (!isXMediaUrl(url)) return null

  return {
    type,
    url,
    ...(isXMediaUrl(preview) ? { preview_url: preview } : {}),
    ...(typeof value.ext_alt_text === 'string' ? { alt_text: value.ext_alt_text } : {}),
  }
}

export function parseXTimeline(html: string, username: string): XTimelinePost[] {
  const script = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
  if (!script) throw new Error('A resposta pública do X não contém dados da timeline.')

  const payload: unknown = JSON.parse(script[1])
  if (!isRecord(payload) || !isRecord(payload.props) || !isRecord(payload.props.pageProps)) {
    throw new Error('A resposta pública do X tem um formato inválido.')
  }

  const pageProps = payload.props.pageProps
  const timeline = isRecord(pageProps.timeline) ? pageProps.timeline : null
  const entries = timeline && Array.isArray(timeline.entries) ? timeline.entries : []
  const posts = new Map<string, XTimelinePost>()

  for (const entry of entries) {
    if (!isRecord(entry) || !isRecord(entry.content) || !isRecord(entry.content.tweet)) continue

    const tweet = entry.content.tweet
    const author = isRecord(tweet.user) ? tweet.user.screen_name : null
    const id = typeof tweet.id_str === 'string' ? tweet.id_str : ''
    const createdAt = typeof tweet.created_at === 'string' ? tweet.created_at : ''
    if (author !== username || !/^\d+$/.test(id) || !createdAt || !Number.isFinite(Date.parse(createdAt))) {
      continue
    }

    const legacyMedia = isRecord(tweet.extended_entities) && Array.isArray(tweet.extended_entities.media)
      ? tweet.extended_entities.media
      : []
    const media = legacyMedia.map(getMedia).filter((item): item is XTimelineMedia => item !== null)
    if (media.length === 0) continue

    posts.set(id, {
      id,
      text: typeof tweet.full_text === 'string' ? tweet.full_text : '',
      created_at: createdAt,
      url: `https://x.com/${encodeURIComponent(username)}/status/${id}`,
      media,
    })
  }

  return [...posts.values()].slice(0, 6)
}
