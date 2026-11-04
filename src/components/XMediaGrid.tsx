import { useMemo, useState } from 'react'
import { ExternalLink, Image as ImageIcon, Play, Video } from 'lucide-react'
import type { XMedia, XPost } from '@/hooks/useXMediaFeed'
import { Skeleton } from '@/components/ui/skeleton'

type Filter = 'all' | 'photo' | 'video'
type Item = { key: string; media: XMedia; isVideo: boolean; post: XPost }

const PAGE_SIZE = 12

const FILTERS: Array<{ id: Filter; label: string; icon?: typeof Video }> = [
  { id: 'all', label: 'Tudo' },
  { id: 'photo', label: 'Fotos', icon: ImageIcon },
  { id: 'video', label: 'Vídeos', icon: Video },
]

function isVideoMedia(media: XMedia) {
  return media.type !== 'photo' && media.url.startsWith('https://video.twimg.com/')
}

function MediaCard({ item, username }: { item: Item; username: string }) {
  const { media, isVideo, post } = item
  const [playing, setPlaying] = useState(false)
  // Fallback: link quebrado não some o card — mostra capa/ícone + "Ver no X".
  const [previewOk, setPreviewOk] = useState(true)
  const [photoOk, setPhotoOk] = useState(true)
  const [videoFailed, setVideoFailed] = useState(false)
  const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(post.created_at))
  const label = media.alt_text || (isVideo ? 'Vídeo publicado no X' : 'Foto publicada no X')
  const showPreviewImg = Boolean(media.preview_url) && previewOk

  return (
    <article className="group flex flex-col overflow-hidden rounded-lg border border-[#46464b] bg-[#1b1b1e] shadow-[0_14px_32px_#0005] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#929297]">
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#09090a]">
        {isVideo && playing && !videoFailed ? (
          <video
            src={media.url}
            poster={showPreviewImg ? media.preview_url : undefined}
            controls
            autoPlay
            playsInline
            aria-label={label}
            onError={() => setVideoFailed(true)}
            className="h-full w-full object-contain"
          />
        ) : isVideo ? (
          <button
            type="button"
            onClick={() => {
              setVideoFailed(false)
              setPlaying(true)
            }}
            aria-label={`Reproduzir vídeo de ${date}`}
            className="relative block h-full w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white"
          >
            {showPreviewImg ? (
              <img
                src={media.preview_url}
                alt={label}
                loading="lazy"
                decoding="async"
                onError={() => setPreviewOk(false)}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <span className="flex h-full w-full flex-col items-center justify-center gap-2 text-[#a8a8ad]" aria-hidden="true">
                <Video className="h-10 w-10" />
              </span>
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/30 transition-colors group-hover:bg-black/20">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-[#111113] shadow-lg transition-transform group-hover:scale-110">
                <Play aria-hidden="true" className="ml-1 h-7 w-7 fill-current" />
              </span>
            </span>
            {videoFailed ? (
              <span className="absolute inset-x-3 bottom-3 rounded-md bg-black/70 px-2 py-1 text-center text-[11px] font-semibold text-white">
                Vídeo indisponível no momento — toque para tentar de novo ou abra no X.
              </span>
            ) : null}
          </button>
        ) : photoOk ? (
          <img
            src={media.preview_url || media.url}
            alt={label}
            loading="lazy"
                decoding="async"
            onError={() => setPhotoOk(false)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <span className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center text-[#a8a8ad]">
            <ImageIcon aria-hidden="true" className="h-10 w-10" />
            <span className="text-xs font-semibold">Foto indisponível no momento</span>
          </span>
        )}
        <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white backdrop-blur">
          {isVideo ? <Video aria-hidden="true" className="h-3 w-3" /> : <ImageIcon aria-hidden="true" className="h-3 w-3" />}
          {isVideo ? 'Vídeo' : 'Foto'}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <p className="text-xs font-semibold uppercase tracking-[.08em] text-[#a8a8ad]">
          @{username} · {date}
        </p>
        {post.text && (
          <p className="line-clamp-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-[#f7f7f5]">
            {post.text.replace(/\s*https:\/\/t\.co\/\w+/g, '').trim()}
          </p>
        )}
        <a
          href={post.url}
          target="_blank"
          rel="noreferrer"
          className="mt-auto inline-flex min-h-10 items-center gap-1.5 text-sm font-bold text-[#d4d4d7] transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          Ver no X
          <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
        </a>
      </div>
    </article>
  )
}

export function XMediaGrid({
  posts,
  username,
  loading,
}: {
  posts: XPost[]
  username: string
  loading: boolean
}) {
  const [filter, setFilter] = useState<Filter>('all')
  const [visible, setVisible] = useState(PAGE_SIZE)

  const items = useMemo<Item[]>(
    () =>
      posts.flatMap((post) =>
        post.media.map((media, index) => ({
          key: `${post.id}-${index}`,
          media,
          isVideo: isVideoMedia(media),
          post,
        })),
      ),
    [posts],
  )
  const counts = useMemo(
    () => ({
      all: items.length,
      photo: items.filter((item) => !item.isVideo).length,
      video: items.filter((item) => item.isVideo).length,
    }),
    [items],
  )
  const filtered = items.filter((item) =>
    filter === 'all' ? true : filter === 'video' ? item.isVideo : !item.isVideo,
  )
  const shown = filtered.slice(0, visible)

  if (loading) {
    return (
      <div
        role="status"
        aria-label={`Carregando mídias de @${username}`}
        className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="aspect-[4/5] w-full rounded-lg bg-[#1b1b1e]" />
        ))}
      </div>
    )
  }
  if (items.length === 0) return null

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-2" role="tablist" aria-label="Filtrar mídias">
        {FILTERS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filter === id}
            onClick={() => {
              setFilter(id)
              setVisible(PAGE_SIZE)
            }}
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
              filter === id
                ? 'border-white bg-white text-[#111113]'
                : 'border-[#626267] text-[#d4d4d7] hover:border-white hover:text-white'
            }`}
          >
            {Icon && <Icon aria-hidden="true" className="h-4 w-4" />}
            {label}
            <span className={filter === id ? 'text-[#46464b]' : 'text-[#a8a8ad]'}>{counts[id]}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {shown.map((item) => (
          <MediaCard key={item.key} item={item} username={username} />
        ))}
      </div>

      {filtered.length > shown.length && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => setVisible((current) => current + PAGE_SIZE)}
            className="inline-flex min-h-12 items-center justify-center rounded-sm border border-[#929297] px-6 font-bold text-[#f7f7f5] transition-colors hover:bg-[#303034] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            Ver mais ({filtered.length - shown.length})
          </button>
        </div>
      )}
    </>
  )
}
