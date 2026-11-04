import { json, type Env } from './lib'
import { parseXTimeline } from '../src/lib/xTimeline'

type XMedia = {
  media_key: string
  type: 'photo' | 'video' | 'animated_gif'
  url?: string
  preview_image_url?: string
  alt_text?: string
  variants?: Array<{ content_type: string; url: string; bitrate?: number }>
}

function isXMediaUrl(value?: string) {
  if (!value) return false

  try {
    const url = new URL(value)
    return url.protocol === 'https:' &&
      (url.hostname === 'pbs.twimg.com' || url.hostname === 'video.twimg.com')
  } catch {
    return false
  }
}

function getMediaUrl(media: XMedia) {
  if (media.type === 'photo') {
    return isXMediaUrl(media.url) ? media.url : undefined
  }

  const videoUrl = media.variants
    ?.filter((variant) => variant.content_type === 'video/mp4' && isXMediaUrl(variant.url))
    .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0]?.url

  if (videoUrl) return videoUrl
  return isXMediaUrl(media.preview_image_url) ? media.preview_image_url : undefined
}

const MAX_PAGES = 10

async function fetchApiPosts(username: string, bearerToken: string) {
  const headers = { Authorization: 'Bearer ' + bearerToken }
  const userUrl = new URL(`https://api.x.com/2/users/by/username/${encodeURIComponent(username)}`)
  const userResponse = await fetch(userUrl, { headers })

  if (!userResponse.ok) {
    throw new Error(`X user lookup failed (${userResponse.status})`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userResult = (await userResponse.json()) as any
  const userId = userResult.data?.id
  if (!userId) {
    throw new Error('X profile lookup returned no user ID')
  }

  type ApiPost = {
    id: string
    text: string
    created_at: string
    attachments?: { media_keys?: string[] }
    referenced_tweets?: Array<{ type: string }>
  }
  const mediaByKey = new Map<string, XMedia>()
  const allPosts: ApiPost[] = []
  let nextToken: string | undefined

  for (let page = 0; page < MAX_PAGES; page++) {
    const postsUrl = new URL(`https://api.x.com/2/users/${encodeURIComponent(userId)}/tweets`)
    postsUrl.searchParams.set('max_results', '100')
    postsUrl.searchParams.set('tweet.fields', 'created_at,attachments,referenced_tweets')
    postsUrl.searchParams.set('expansions', 'attachments.media_keys')
    postsUrl.searchParams.set('media.fields', 'url,preview_image_url,alt_text,type,variants')
    if (nextToken) postsUrl.searchParams.set('pagination_token', nextToken)

    const postsResponse = await fetch(postsUrl, { headers })
    if (!postsResponse.ok) {
      if (page > 0) break
      throw new Error(`X posts lookup failed (${postsResponse.status})`)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const postsResult = (await postsResponse.json()) as any
    for (const media of (postsResult.includes?.media ?? []) as XMedia[]) {
      mediaByKey.set(media.media_key, media)
    }
    allPosts.push(...((postsResult.data ?? []) as ApiPost[]))
    nextToken = postsResult.meta?.next_token
    if (!nextToken) break
  }

  return allPosts
    .filter((post) => !post.referenced_tweets?.some((ref) => ref.type === 'retweeted'))
    .map((post) => {
      const media = (post.attachments?.media_keys ?? [])
        .map((mediaKey) => mediaByKey.get(mediaKey))
        .filter((item): item is XMedia => Boolean(item))
        .map((item) => ({
          type: item.type,
          url: getMediaUrl(item),
          preview_url: isXMediaUrl(item.preview_image_url) ? item.preview_image_url : undefined,
          alt_text: item.alt_text,
        }))
        .filter((item): item is typeof item & { url: string } => Boolean(item.url))

      return {
        id: post.id,
        text: post.text,
        created_at: post.created_at,
        url: `https://x.com/${username}/status/${post.id}`,
        media,
      }
    })
    .filter((post) => post.media.length > 0)
}

async function fetchFallbackPosts(url: string) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`X fallback failed (${response.status})`)
  const result = (await response.json()) as { posts?: unknown[] }
  return result.posts ?? []
}

async function fetchSyndicationPosts(username: string) {
  const url = new URL(`https://syndication.twitter.com/srv/timeline-profile/screen-name/${encodeURIComponent(username)}`)
  url.searchParams.set('lang', 'en')
  url.searchParams.set('limit', '20')
  url.searchParams.set('theme', 'dark')
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,*/*',
      Referer: 'https://platform.twitter.com/',
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
    },
  })
  const html = await response.text()
  if (!response.ok) throw new Error(`X timeline failed (${response.status})`)
  return parseXTimeline(html, username)
}

const CACHE_TTL_MS = 15 * 60 * 1000
let cachedFeed: { username: string; posts: unknown[]; at: number } | null = null

export async function handleTwitterFeed(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405)

  const username = (env.MEMBERSHIP_TWITTER_USERNAME ?? 'severepics').trim().replace(/^@/, '')
  const bearerToken = env.MEMBERSHIP_TWITTER_BEARER_TOKEN?.trim()

  if (!/^[A-Za-z0-9_]{1,15}$/.test(username)) {
    return json({ username, posts: [], error: 'O nome da conta do X configurada é inválido.' })
  }
  const cacheHeaders = { 'Cache-Control': 'public, max-age=300' }
  if (cachedFeed && cachedFeed.username === username && Date.now() - cachedFeed.at < CACHE_TTL_MS) {
    return json({ username, posts: cachedFeed.posts }, 200, cacheHeaders)
  }

  try {
    let posts: unknown[] = bearerToken ? await fetchApiPosts(username, bearerToken).catch(() => []) : []
    if (posts.length === 0 && env.X_FEED_FALLBACK_URL) {
      posts = await fetchFallbackPosts(env.X_FEED_FALLBACK_URL).catch(() => [])
    }
    if (posts.length === 0) posts = await fetchSyndicationPosts(username)
    if (posts.length === 0) return json({ username, posts })
    cachedFeed = { username, posts, at: Date.now() }
    return json({ username, posts }, 200, cacheHeaders)
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown error'
    const status = detail.match(/\((\d{3})\)$/)?.[1]
    console.error('X feed request failed', detail)
    if (cachedFeed && cachedFeed.username === username) {
      return json({ username, posts: cachedFeed.posts })
    }
    return json({
      username,
      posts: [],
      error: status === '402'
        ? 'A API do X exige créditos ou um plano de acesso (HTTP 402).'
        : status === '429'
        ? 'O X limitou temporariamente o carregamento das mídias. Tente novamente em alguns minutos.'
        : 'Não foi possível carregar as mídias da conta conectada no X.',
      error_code: status ? `X_HTTP_${status}` : 'X_FEED_UNAVAILABLE',
    })
  }
}
