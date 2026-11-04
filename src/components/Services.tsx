import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { api } from '@/integrations/api/client'

type XMedia = {
  type: 'photo' | 'video' | 'animated_gif'
  url: string
  preview_url?: string
  alt_text?: string
}

type XPost = {
  id: string
  text: string
  created_at: string
  url: string
  media: XMedia[]
}

type XFeedResponse = {
  username: string
  posts: XPost[]
  error?: string
}

function isXMediaUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' &&
      (url.hostname === 'pbs.twimg.com' || url.hostname === 'video.twimg.com')
  } catch {
    return false
  }
}

export function Services() {
  const [posts, setPosts] = useState<XPost[]>([])
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    const loadPosts = async () => {
      try {
        const { data, error: invokeError } =
          await api.functions.invoke<XFeedResponse>('twitter-feed', { method: 'GET' })

        if (!active) return

        if (invokeError || !data || data.error) {
          console.error('Não foi possível carregar as publicações do X.', invokeError ?? data?.error)
          setPosts([])
          setUsername(data?.username || 'severepics')
          setError(data?.error || 'Não foi possível carregar as mídias da conta conectada no X.')
        } else {
          const connectedMedia = (data.posts ?? [])
            .map((post) => ({
              ...post,
              media: (post.media ?? []).filter((media) =>
                isXMediaUrl(media.url) &&
                (!media.preview_url || isXMediaUrl(media.preview_url)),
              ),
            }))
            .filter((post) => post.media.length > 0)

          setPosts(connectedMedia)
          setUsername(data.username || 'severepics')
          setError('')
        }
      } catch (loadError) {
        console.error('Falha ao consultar as publicações do X.', loadError)
        if (active) {
          setPosts([])
          setUsername('severepics')
          setError('Não foi possível carregar as mídias da conta conectada no X.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadPosts()
    return () => {
      active = false
    }
  }, [])

  return (
    <section
      id="services"
      className="relative overflow-hidden py-20"
      style={{
        background: 'linear-gradient(135deg, #2d1810 0%, #1a0f08 30%, #0f0704 60%, #1a0f08 100%)',
      }}
    >
      <div className="absolute inset-0" aria-hidden="true">
        <div className="absolute left-1/4 top-0 h-96 w-96 rounded-full bg-red-900/20 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-amber-900/15 blur-2xl" />
      </div>

      <div className="container relative z-10 mx-auto px-6 sm:px-8 lg:px-12">
        <header className="mb-16 text-center">
          <div className="mb-6 inline-flex items-center gap-3">
            <div className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
            <span className="text-sm font-semibold text-amber-200/80">Novidades do laboratório</span>
            <div className="h-3 w-3 animate-pulse rounded-full bg-amber-500" />
          </div>
          <h2 className="mb-6 text-5xl font-black leading-tight text-amber-100 sm:text-6xl lg:text-7xl">
            Novidades no X
          </h2>
          <p className="mx-auto max-w-3xl text-xl leading-relaxed text-amber-200/90">
            Publicações recentes{username ? ` de @${username}` : ''}.
          </p>
        </header>

        {loading && (
          <p role="status" className="py-12 text-center text-amber-100">
            Carregando publicações...
          </p>
        )}

        {!loading && error && (
          <div role="alert" className="mx-auto max-w-2xl rounded-2xl border border-amber-100/20 bg-black/30 p-6 text-center text-amber-100">
            <p>{error}</p>
            {username && (
              <a
                href={`https://x.com/${encodeURIComponent(username)}`}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-2 underline underline-offset-4"
              >
                Ver perfil no X <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
        )}

        {!loading && !error && posts.length === 0 && (
          <p className="py-12 text-center text-amber-100">
            A conta conectada não tem publicações recentes com fotos ou vídeos.
          </p>
        )}

        {!loading && !error && posts.length > 0 && (
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <article
                key={post.id}
                className="overflow-hidden rounded-2xl border border-amber-100/15 bg-white p-4 text-gray-800 shadow-2xl transition-transform duration-300 hover:-translate-y-1"
              >
                <div className={`mb-4 grid gap-2 ${post.media.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {post.media.map((media, index) => {
                    const isVideo = media.type !== 'photo' &&
                      media.url.startsWith('https://video.twimg.com/')

                    return isVideo ? (
                      <video
                        key={`${post.id}-${index}`}
                        src={media.url}
                        poster={media.preview_url}
                        controls={media.type === 'video'}
                        autoPlay={media.type === 'animated_gif'}
                        loop={media.type === 'animated_gif'}
                        muted
                        playsInline
                        className="aspect-video w-full rounded-lg bg-gray-100 object-cover"
                      />
                    ) : (
                      <img
                        key={`${post.id}-${index}`}
                        src={media.preview_url || media.url}
                        alt={media.alt_text || 'Mídia publicada no X'}
                        className="aspect-video w-full rounded-lg bg-gray-100 object-cover"
                        loading="lazy"
                      />
                    )
                  })}
                </div>

                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                  {post.text}
                </p>

                <div className="mt-5 flex items-center justify-between gap-3 border-t border-gray-200 pt-4 text-xs text-gray-500">
                  <time dateTime={post.created_at}>
                    {new Intl.DateTimeFormat('pt-BR', {
                      dateStyle: 'medium',
                    }).format(new Date(post.created_at))}
                  </time>
                  <a
                    href={post.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 font-semibold text-gray-700 hover:text-black"
                  >
                    Ver no X <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                  </a>
                </div>
                <div className="mt-3 text-right text-[10px] font-mono tracking-wider text-gray-400">
                  ITALO SANTOS
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
