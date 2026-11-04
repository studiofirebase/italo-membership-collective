import { useEffect, useState } from 'react'
import { api } from '@/integrations/api/client'

export type XMedia = {
  type: 'photo' | 'video' | 'animated_gif'
  url: string
  preview_url?: string
  alt_text?: string
}

export type XPost = {
  id: string
  text: string
  created_at: string
  url: string
  media: XMedia[]
}

export type XMediaFeed = {
  username: string
  posts: XPost[]
  loading: boolean
  error: string
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

function parseMedia(value: unknown): XMedia | null {
  if (!isRecord(value) || !isXMediaUrl(value.url)) return null
  if (value.type !== 'photo' && value.type !== 'video' && value.type !== 'animated_gif') return null
  if (value.preview_url !== undefined && !isXMediaUrl(value.preview_url)) return null

  return {
    type: value.type,
    url: value.url,
    ...(typeof value.preview_url === 'string' ? { preview_url: value.preview_url } : {}),
    ...(typeof value.alt_text === 'string' ? { alt_text: value.alt_text } : {}),
  }
}

function parseFeed(payload: unknown): { username: string; posts: XPost[]; error?: string } {
  if (!isRecord(payload)) throw new Error('O servidor da API não respondeu. Rode `npm run dev` (inicia API + site) e recarregue.')

  const username = typeof payload.username === 'string' ? payload.username.replace(/^@/, '') : 'severepics'
  if (typeof payload.error === 'string' && payload.error) {
    return { username, posts: [], error: payload.error }
  }

  const rawPosts = Array.isArray(payload.posts) ? payload.posts : []
  const posts = rawPosts.flatMap((rawPost): XPost[] => {
    if (!isRecord(rawPost) || typeof rawPost.id !== 'string' || !/^\d+$/.test(rawPost.id)) return []
    if (typeof rawPost.created_at !== 'string' || Number.isNaN(Date.parse(rawPost.created_at))) return []

    const media = Array.isArray(rawPost.media)
      ? rawPost.media.map(parseMedia).filter((item): item is XMedia => item !== null)
      : []
    if (media.length === 0) return []

    return [{
      id: rawPost.id,
      text: typeof rawPost.text === 'string' ? rawPost.text : '',
      created_at: rawPost.created_at,
      url: `https://x.com/${encodeURIComponent(username)}/status/${rawPost.id}`,
      media,
    }]
  })

  return { username, posts }
}

export function useXMediaFeed(): XMediaFeed {
  const [feed, setFeed] = useState<XMediaFeed>({
    username: 'severepics',
    posts: [],
    loading: true,
    error: '',
  })

  useEffect(() => {
    let active = true

    const loadFeed = async () => {
      try {
        const response = await api.functions.invoke<unknown>('twitter-feed', { method: 'GET' })
        if (response.error) {
          if ((response.error as { status?: number }).status === 404) {
            throw new Error('A função de mídias do X ainda não foi publicada.')
          }
          throw response.error
        }

        const result = parseFeed(response.data)
        if (active) {
          setFeed({
            username: result.username,
            posts: result.posts,
            loading: false,
            error: result.error ?? '',
          })
        }
      } catch (error) {
        console.error('Não foi possível carregar as mídias da conta do X.', error)
        if (active) {
          setFeed((current) => ({
            ...current,
            loading: false,
            error: error instanceof Error
              ? error.message
              : 'Não foi possível carregar as mídias da conta conectada no X.',
          }))
        }
      }
    }

    void loadFeed()
    return () => {
      active = false
    }
  }, [])

  return feed
}
