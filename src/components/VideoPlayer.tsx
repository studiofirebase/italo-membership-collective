import { useCallback, useEffect, useRef, useState } from 'react'
import { isHlsUrl, toEmbedSrc } from '@/lib/video-url'

/**
 * Reproduz vídeos MP4/WebM/MOV diretamente, streams HLS (.m3u8) via hls.js
 * e páginas de player permanente (ex.: OnNowPlay, YouTube, Vimeo) via `<iframe>`.
 *
 * Por que este componente existe: apenas o Safari toca `.m3u8` com `<video src>`
 * nativo. Chrome/Edge/Firefox precisam do hls.js (Media Source Extensions).
 * E links `.m3u8` temporários expiram — o endereço permanente do player vai
 * no `video_url` e cai no iframe, que não expira.
 *
 * Fallback: quando o link quebra (expirou, 403, rede), o card NÃO some.
 * Mantém a capa (poster), o título e botões de tentar de novo / abrir em nova guia.
 *
 * Uso:
 *   <VideoPlayer src={video.video_url} poster={video.thumbnail_url} title={video.title} />
 */

type VideoPlayerProps = {
  src: string
  fallbackSources?: string[]
  poster?: string | null
  title?: string
  className?: string
}

const LINK_BROKEN_MESSAGE =
  'O link deste vídeo expirou ou está indisponível no momento. Tente novamente — o card e a capa são mantidos.'
const GENERIC_ERROR_MESSAGE = 'Este vídeo não pôde ser reproduzido neste navegador.'

function FallbackShell({
  poster,
  posterOk,
  onPosterError,
  title,
  message,
  url,
  onRetry,
  className,
}: {
  poster?: string | null
  posterOk: boolean
  onPosterError: () => void
  title?: string
  message: string
  url: string
  onRetry: () => void
  className?: string
}) {
  return (
    <div className={className ?? 'w-full aspect-video bg-black'} role="alert">
      <div className="relative flex h-full flex-col items-center justify-center gap-3 overflow-hidden p-4 text-center">
        {poster && posterOk ? (
          <img
            src={poster}
            alt={title ?? 'Capa do vídeo'}
            onError={onPosterError}
            className="absolute inset-0 h-full w-full object-cover opacity-40"
          />
        ) : null}
        <div className="absolute inset-0 bg-black/55" aria-hidden="true" />
        <p className="relative text-sm font-medium text-white">{title ?? 'Vídeo indisponível'}</p>
        <p className="relative max-w-md text-sm text-white/70">{message}</p>
        <div className="relative flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md border border-white/20 bg-black/60 px-3 py-1.5 text-sm text-white hover:bg-white/10"
          >
            Tentar novamente
          </button>
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-white/20 bg-black/60 px-3 py-1.5 text-sm text-white hover:bg-white/10"
            >
              Abrir em nova guia
            </a>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function VideoPlayer({ src, fallbackSources = [], poster, title, className }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState('')
  const [posterOk, setPosterOk] = useState(true)
  const [retryKey, setRetryKey] = useState(0)
  const [sourceIndex, setSourceIndex] = useState(0)

  const sourceUrls = [...new Set([src, ...fallbackSources].map((value) => value.trim()).filter(Boolean))]
  const url = sourceUrls[sourceIndex] ?? ''
  const advanceAfterError = useCallback((message = LINK_BROKEN_MESSAGE) => {
    if (sourceIndex + 1 < sourceUrls.length) {
      setError('')
      setSourceIndex(sourceIndex + 1)
      setRetryKey((key) => key + 1)
    } else {
      setError(message)
    }
  }, [sourceIndex, sourceUrls.length])

  useEffect(() => {
    setPosterOk(true)
  }, [poster])

  useEffect(() => {
    setSourceIndex(0)
    setError('')
  }, [src, fallbackSources.join('\n')])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !url) return
    if (!isHlsUrl(url)) return
    setError('')

    // hls.js é carregado sob demanda para não pesar o bundle de quem só vê MP4.
    // Prefere hls.js sempre que suportado (Chrome/Edge/Firefox); o HLS nativo
    // (Safari/iOS) é o fallback para navegadores sem Media Source Extensions.
    let cancelled = false
    let hls: import('hls.js').default | null = null
    void import('hls.js').then(({ default: Hls }) => {
      if (cancelled) return
      if (!Hls.isSupported()) {
        if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = url
          return
        }
        advanceAfterError(GENERIC_ERROR_MESSAGE)
        return
      }
      hls = new Hls({ enableWorker: true })
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return
        // Se um endereço temporário expirar, tenta a próxima fonte cadastrada.
        advanceAfterError(data.type === Hls.ErrorTypes.NETWORK_ERROR
          ? LINK_BROKEN_MESSAGE
          : GENERIC_ERROR_MESSAGE)
      })
      hls.loadSource(url)
      hls.attachMedia(video)
    }).catch(() => {
      if (!cancelled) advanceAfterError(LINK_BROKEN_MESSAGE)
    })

    return () => {
      cancelled = true
      hls?.destroy()
    }
  }, [url, retryKey, advanceAfterError])

  const retry = () => {
    setError('')
    setPosterOk(true)
    setSourceIndex(0)
    setRetryKey((k) => k + 1)
  }

  // Sem URL: não some — mostra a capa/título com o mesmo shell de fallback.
  if (!url) {
    return (
      <FallbackShell
        poster={poster}
        posterOk={posterOk}
        onPosterError={() => setPosterOk(false)}
        title={title}
        message="Este vídeo ainda não tem link cadastrado."
        url=""
        onRetry={retry}
        className={className}
      />
    )
  }

  if (error) {
    return (
      <FallbackShell
        poster={poster}
        posterOk={posterOk}
        onPosterError={() => setPosterOk(false)}
        title={title}
        message={error}
        url={sourceUrls[0] ?? ''}
        onRetry={retry}
        className={className}
      />
    )
  }

  // Player permanente (embed): não passa pelo hls.js e não expira.
  const embedSrc = toEmbedSrc(url)
  if (embedSrc) {
    return (
      <div className={className ?? 'w-full aspect-video bg-black'}>
        <iframe
          src={embedSrc}
          title={title ?? 'Vídeo'}
          className="h-full w-full"
          loading="lazy"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          onError={() => advanceAfterError(LINK_BROKEN_MESSAGE)}
        />
      </div>
    )
  }

  if (isHlsUrl(url)) {
    return (
      <video
        key={retryKey}
        ref={videoRef}
        controls
        playsInline
        preload="metadata"
        poster={posterOk ? (poster ?? undefined) : undefined}
        aria-label={title ?? 'Vídeo'}
        onError={() => advanceAfterError(LINK_BROKEN_MESSAGE)}
        className={className ?? 'w-full aspect-video bg-black'}
      />
    )
  }

  return (
    <video
      src={url}
      controls
      playsInline
      preload="metadata"
      poster={posterOk ? (poster ?? undefined) : undefined}
      aria-label={title ?? 'Vídeo'}
      onError={() => advanceAfterError(LINK_BROKEN_MESSAGE)}
      className={className ?? 'w-full aspect-video bg-black'}
    />
  )
}
