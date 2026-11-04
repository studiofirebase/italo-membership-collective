import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { api } from '@/integrations/api/client'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { normalizeCheckoutUrl } from '@/lib/payment-checkout'
import { startSubscriptionCheckout } from '@/lib/startSubscriptionCheckout'
import { resolveMembershipMediaUrl } from '@/lib/membership-media'
import { parseVideoSources } from '@/lib/video-url'
import { VideoPlayer } from '@/components/VideoPlayer'

type Plan = {
  id: string
  name: string
  price_label: string | null
  tagline: string | null
  features: string[]
  infinitepay_url: string | null
  is_active: boolean
  sort_order: number
}

type Video = {
  id: string
  title: string
  description: string | null
  thumbnail_url: string | null
  video_url: string | null
  fallback_video_urls?: string[]
  access_type: 'subscription' | 'purchase'
  price_label: string | null
  purchase_url: string | null
  is_published: boolean
  sort_order: number
}

type Subscription = {
  id: string
  user_id: string
  plan_id: string | null
  provider: string
  status: 'pending' | 'active' | 'canceled'
  expires_at: string | null
  created_at: string
}

type Purchase = {
  id: string
  user_id: string
  video_id: string | null
  provider: string
  status: 'pending' | 'paid' | 'canceled'
  created_at: string
}

export default function Members() {
  const { session, profile, isAdmin, loading, signOut } = useAuth()
  const [plans, setPlans] = useState<Plan[]>([])
  const [videos, setVideos] = useState<Video[]>([])
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [dataError, setDataError] = useState('')
  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')

  const load = useCallback(async () => {
    setDataLoading(true)
    setDataError('')
    try {
      const [plansRes, videosRes] = await Promise.all([
        api.from('plans').select('*').eq('is_active', true).order('sort_order'),
        api.rpc('get_membership_videos'),
      ])
      if (plansRes.error) throw plansRes.error
      if (videosRes.error) throw videosRes.error

      // Resolve cada fonte separadamente para trocar para a reserva se uma URL
      // externa expirar. O player mantém a capa caso todas as fontes falhem.
      const loadedVideos = await Promise.all(((videosRes.data as Video[]) ?? []).map(async (video) => {
        const sourceUrls = parseVideoSources(video.video_url)
        const [thumbnail_url, resolvedSources] = await Promise.all([
          resolveMembershipMediaUrl(video.thumbnail_url).catch(() => video.thumbnail_url),
          Promise.all(sourceUrls.map((source) => resolveMembershipMediaUrl(source).catch(() => source))),
        ])
        const availableSources = resolvedSources.filter((source): source is string => Boolean(source))
        return {
          ...video,
          thumbnail_url,
          video_url: availableSources[0] ?? null,
          fallback_video_urls: availableSources.slice(1),
        }
      }))
      setPlans((plansRes.data as Plan[]) ?? [])
      setVideos(loadedVideos)

      if (session?.user) {
        const uid = session.user.id
        const [subRes, purRes] = await Promise.all([
          api
            .from('subscriptions')
            .select('*')
            .eq('user_id', uid)
            .order('created_at', { ascending: false })
            .limit(1),
          api.from('purchases').select('*').eq('user_id', uid),
        ])
        if (subRes.error) throw subRes.error
        if (purRes.error) throw purRes.error
        setSubscription((subRes.data?.[0] as Subscription) ?? null)
        setPurchases((purRes.data as Purchase[]) ?? [])
      }
    } catch (error) {
      console.error('Falha ao carregar a área de membros.', error)
      setDataError('Não foi possível carregar o conteúdo. Tente novamente em instantes.')
    } finally {
      setDataLoading(false)
    }
  }, [session?.user])

  useEffect(() => {
    if (session) load()
  }, [session, load])

  const hasActiveSubscription = useMemo(() => {
    if (!subscription) return false
    if (subscription.status !== 'active') return false
    if (!subscription.expires_at) return true
    return new Date(subscription.expires_at) > new Date()
  }, [subscription])

  const paidVideoIds = useMemo(
    () => new Set(purchases.filter((p) => p.status === 'paid').map((p) => p.video_id)),
    [purchases],
  )
  const pendingVideoIds = useMemo(
    () => new Set(purchases.filter((p) => p.status === 'pending').map((p) => p.video_id)),
    [purchases],
  )

  const subscribe = async () => {
    if (checkoutBusy) return
    setCheckoutError('')
    setCheckoutBusy(true)
    let checkoutWindow: Window | null = null
    try {
      checkoutWindow = window.open('about:blank', '_blank')
      if (!checkoutWindow) throw new Error('Pop-up bloqueado pelo navegador.')
      checkoutWindow.opener = null
      const checkoutUrl = await startSubscriptionCheckout()
      await load()
      checkoutWindow.location.replace(checkoutUrl)
    } catch (error) {
      checkoutWindow?.close()
      console.error('Falha ao iniciar checkout da assinatura.', error)
      setCheckoutError('Não foi possível iniciar o checkout. Confirme que seu perfil tem nome e telefone e tente novamente.')
    } finally {
      setCheckoutBusy(false)
    }
  }

  const buyVideo = async (video: Video) => {
    if (checkoutBusy) return
    setCheckoutError('')
    setCheckoutBusy(true)
    let checkoutWindow: Window | null = null
    try {
      if (!video.purchase_url) throw new Error('Checkout não configurado para este vídeo.')
      const checkoutUrl = normalizeCheckoutUrl(video.purchase_url)
      checkoutWindow = window.open('about:blank', '_blank')
      if (!checkoutWindow) throw new Error('Pop-up bloqueado pelo navegador.')
      checkoutWindow.opener = null
      const { error } = await api.from('purchases').insert({
        user_id: session!.user.id,
        video_id: video.id,
        provider: 'infinitepay',
        status: 'pending',
      })
      if (error) throw error
      await load()
      checkoutWindow.location.replace(checkoutUrl)
    } catch (error) {
      checkoutWindow?.close()
      console.error('Falha ao iniciar checkout do vídeo.', error)
      setCheckoutError('Não foi possível iniciar o checkout. Tente novamente.')
    } finally {
      setCheckoutBusy(false)
    }
  }

  const cancelPending = async (table: 'subscriptions' | 'purchases', id: string) => {
    if (checkoutBusy) return
    setCheckoutError('')
    setCheckoutBusy(true)
    try {
      const { data, error } = await api
        .from(table)
        .update({ status: 'canceled' })
        .eq('id', id)
        .eq('status', 'pending')
        .select('id')
      if (error) throw error
      if (!data?.length) throw new Error('Nenhum pedido pendente foi cancelado.')
      await load()
    } catch (error) {
      console.error('Falha ao cancelar o pagamento pendente.', error)
      setCheckoutError('Não foi possível cancelar o pedido. Tente novamente.')
    } finally {
      setCheckoutBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-white/50">Carregando…</p>
      </div>
    )
  }
  if (!session) return <Navigate to="/entrar" replace />

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Top bar */}
      <div className="border-b border-white/10 bg-black/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="font-bagel text-xl tracking-wider hover:opacity-80">
            Italo Santos
          </Link>
          <div className="flex items-center gap-3 text-sm">
            {isAdmin && (
              <Link to="/admin" className="text-white/70 hover:text-white font-medium">
                Painel admin
              </Link>
            )}
            <Button
              variant="outline"
              onClick={() => signOut()}
              className="bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white cursor-pointer"
            >
              Sair
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10">
        <h1 className="font-bagel text-3xl sm:text-4xl mb-2">Área de Membros</h1>
        <p className="text-white/60 mb-10">Olá, {profile?.display_name ?? 'assinante'} 👋</p>
        {dataError && <p role="alert" className="mb-8 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{dataError}</p>}

        {/* Subscription status */}
        <div className="mb-14">
          {dataLoading ? (
            <p className="text-white/40">Carregando…</p>
          ) : hasActiveSubscription ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-6 py-5">
              <p className="font-semibold text-emerald-300">Assinatura ativa ✓</p>
              <p className="text-white/70 text-sm mt-1">
                Você tem acesso a todo o conteúdo exclusivo para assinantes.
              </p>
            </div>
          ) : subscription?.status === 'pending' ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-6 py-5">
              <p className="font-semibold text-amber-300">Pagamento em análise</p>
              <p className="text-white/70 text-sm mt-1">
                Recebemos seu pedido de assinatura. Assim que o pagamento for confirmado, seu acesso é liberado.
              </p>
              <Button
                variant="outline"
                onClick={() => void cancelPending('subscriptions', subscription.id)}
                disabled={checkoutBusy}
                className="mt-4 bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white cursor-pointer"
              >
                Cancelar pedido
              </Button>
            </div>
          ) : (
            <div>
              <h2 className="text-xl font-bold mb-1">Assine para desbloquear tudo</h2>
              <p className="text-white/60 mb-6">Escolha um plano para ter acesso ao conteúdo exclusivo.</p>
              {plans.length === 0 ? (
                <p className="text-white/40 text-sm">Nenhum plano disponível no momento.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {plans.map((plan) => (
                    <div
                      key={plan.id}
                      className="glass-effect rounded-2xl bg-white/5 border border-white/10 p-6 flex flex-col"
                    >
                      <h3 className="text-2xl font-bold">{plan.name}</h3>
                      {plan.price_label && <p className="text-3xl font-black text-red-500 mt-2">{plan.price_label}</p>}
                      {plan.tagline && <p className="text-white/60 text-sm mt-2">{plan.tagline}</p>}
                      {Array.isArray(plan.features) && plan.features.length > 0 && (
                        <ul className="mt-4 space-y-2 text-sm text-white/80 flex-1">
                          {plan.features.map((f, i) => (
                            <li key={i} className="flex gap-2">
                              <span className="text-red-500">✓</span> {f}
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="mt-6 space-y-3">
                        <Button
                          onClick={() => void subscribe()}
                          disabled={checkoutBusy}
                          className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold cursor-pointer"
                        >
                          Pagar com InfinitePay
                        </Button>
                        <p className="text-xs text-white/50">
                          O checkout pode oferecer Pix, Apple Pay e Google Pay conforme a disponibilidade para sua conta, navegador e dispositivo.
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        {checkoutError && (
          <p role="alert" className="-mt-10 mb-10 text-sm text-red-300">
            {checkoutError}
          </p>
        )}

        {/* Videos */}
        <h2 className="text-xl font-bold mb-1">Conteúdo exclusivo</h2>
        <p className="text-white/60 mb-6">
          Vídeos para assinantes e títulos avulsos à venda.
        </p>
        {dataLoading ? (
          <p className="text-white/40">Carregando…</p>
        ) : videos.length === 0 ? (
          <p className="text-white/40 text-sm">Nenhum vídeo publicado ainda.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((video) => {
              const unlocked =
                video.access_type === 'subscription' ? hasActiveSubscription : paidVideoIds.has(video.id)
              const pendingPurchase = video.access_type === 'purchase' && pendingVideoIds.has(video.id)
              return (
                <div key={video.id} className="rounded-xl overflow-hidden bg-white/5 border border-white/10 flex flex-col">
                  {unlocked ? (
                    <VideoPlayer
                      src={video.video_url ?? ''}
                      fallbackSources={video.fallback_video_urls}
                      poster={video.thumbnail_url}
                      title={video.title}
                      className="w-full aspect-video bg-black"
                    />
                  ) : (
                    <div className="relative w-full aspect-video bg-white/5">
                      {video.thumbnail_url ? (
                        <img
                          src={video.thumbnail_url}
                          alt={video.title}
                          onError={(e) => {
                            // Fallback: capa quebrada não some o card — esconde só o img.
                            e.currentTarget.style.display = 'none'
                          }}
                          className="absolute inset-0 w-full h-full object-cover opacity-50"
                        />
                      ) : null}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-14 h-14 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-2xl">
                          {video.access_type === 'subscription' ? '🔒' : '🛒'}
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="p-4 flex flex-col flex-1">
                    <h3 className="font-semibold">{video.title}</h3>
                    {video.description && <p className="text-white/60 text-sm mt-1 flex-1">{video.description}</p>}
                    <div className="mt-4">
                      {unlocked ? (
                        <span className="text-emerald-400 text-sm font-medium">Disponível acima ✓</span>
                      ) : pendingPurchase ? (
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-amber-300 text-sm font-medium">Aguardando confirmação do pagamento…</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const pending = purchases.find((p) => p.status === 'pending' && p.video_id === video.id)
                              if (pending) void cancelPending('purchases', pending.id)
                            }}
                            disabled={checkoutBusy}
                            className="bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white cursor-pointer"
                          >
                            Cancelar
                          </Button>
                        </div>
                      ) : video.access_type === 'purchase' ? (
                        <Button
                          onClick={() => void buyVideo(video)}
                          disabled={checkoutBusy}
                          className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold cursor-pointer"
                        >
                          Apple Pay · InfinitePay {video.price_label ? `· ${video.price_label}` : ''}
                        </Button>
                      ) : (
                        <span className="text-white/50 text-sm">Incluído na assinatura</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
