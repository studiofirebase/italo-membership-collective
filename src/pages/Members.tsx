import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'

type Plan = {
  id: string
  name: string
  price_label: string | null
  tagline: string | null
  features: string[]
  infinitepay_url: string | null
  mercadopago_url: string | null
  is_active: boolean
  sort_order: number
}

type Video = {
  id: string
  title: string
  description: string | null
  thumbnail_url: string | null
  video_url: string | null
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
  provider: 'infinitepay' | 'mercadopago'
  status: 'pending' | 'active' | 'canceled'
  expires_at: string | null
  created_at: string
}

type Purchase = {
  id: string
  user_id: string
  video_id: string | null
  provider: 'infinitepay' | 'mercadopago'
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

  const load = useCallback(async () => {
    setDataLoading(true)
    const [plansRes, videosRes] = await Promise.all([
      supabase.from('plans').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('videos').select('*').eq('is_published', true).order('sort_order'),
    ])
    setPlans((plansRes.data as Plan[]) ?? [])
    setVideos((videosRes.data as Video[]) ?? [])

    if (session?.user) {
      const uid = session.user.id
      const [subRes, purRes] = await Promise.all([
        supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .limit(1),
        supabase.from('purchases').select('*').eq('user_id', uid),
      ])
      setSubscription((subRes.data?.[0] as Subscription) ?? null)
      setPurchases((purRes.data as Purchase[]) ?? [])
    }
    setDataLoading(false)
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

  const subscribe = async (plan: Plan, provider: 'infinitepay' | 'mercadopago') => {
    const url = provider === 'infinitepay' ? plan.infinitepay_url : plan.mercadopago_url
    if (url) window.open(url, '_blank', 'noopener')
    await supabase.from('subscriptions').insert({
      user_id: session!.user.id,
      plan_id: plan.id,
      provider,
      status: 'pending',
    })
    load()
  }

  const buyVideo = async (video: Video) => {
    if (video.purchase_url) window.open(video.purchase_url, '_blank', 'noopener')
    await supabase.from('purchases').insert({
      user_id: session!.user.id,
      video_id: video.id,
      provider: 'infinitepay',
      status: 'pending',
    })
    load()
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
            MOJJU
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
                        {plan.infinitepay_url && (
                          <Button
                            onClick={() => subscribe(plan, 'infinitepay')}
                            className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold cursor-pointer"
                          >
                            Assinar com InfinitePay
                          </Button>
                        )}
                        {plan.mercadopago_url && (
                          <Button
                            onClick={() => subscribe(plan, 'mercadopago')}
                            variant="outline"
                            className="w-full bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white cursor-pointer"
                          >
                            Pagar com Mercado Pago
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

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
                  {unlocked && video.video_url ? (
                    <video
                      src={video.video_url}
                      controls
                      playsInline
                      className="w-full aspect-video bg-black"
                    />
                  ) : (
                    <div className="relative w-full aspect-video bg-white/5">
                      {video.thumbnail_url ? (
                        <img src={video.thumbnail_url} alt={video.title} className="absolute inset-0 w-full h-full object-cover opacity-50" />
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
                        <span className="text-amber-300 text-sm font-medium">Aguardando confirmação do pagamento…</span>
                      ) : video.access_type === 'purchase' ? (
                        <Button
                          onClick={() => buyVideo(video)}
                          className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold cursor-pointer"
                        >
                          Comprar {video.price_label ? `· ${video.price_label}` : ''}
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
