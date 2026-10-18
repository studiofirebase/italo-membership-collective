import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type PlanRow = {
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

type VideoRow = {
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

type SubRow = {
  id: string
  user_id: string
  plan_id: string | null
  provider: string
  status: 'pending' | 'active' | 'canceled'
  created_at: string
}

type PurRow = {
  id: string
  user_id: string
  video_id: string | null
  provider: string
  status: 'pending' | 'paid' | 'canceled'
  created_at: string
}

type ProfileRow = { id: string; display_name: string | null; email: string | null }

const emptyPlan = (): Omit<PlanRow, 'id'> => ({
  name: '',
  price_label: '',
  tagline: '',
  features: [],
  infinitepay_url: '',
  mercadopago_url: '',
  is_active: true,
  sort_order: 0,
})

const emptyVideo = (): Omit<VideoRow, 'id'> => ({
  title: '',
  description: '',
  thumbnail_url: '',
  video_url: '',
  access_type: 'subscription',
  price_label: '',
  purchase_url: '',
  is_published: true,
  sort_order: 0,
})

export default function Admin() {
  const { session, isAdmin, loading } = useAuth()
  const [tab, setTab] = useState<'planos' | 'videos' | 'membros'>('planos')

  const [plans, setPlans] = useState<PlanRow[]>([])
  const [videos, setVideos] = useState<VideoRow[]>([])
  const [subs, setSubs] = useState<SubRow[]>([])
  const [purs, setPurs] = useState<PurRow[]>([])
  const [people, setPeople] = useState<Record<string, ProfileRow>>({})

  const [planForm, setPlanForm] = useState<Omit<PlanRow, 'id'> & { id?: string }>(emptyPlan())
  const [planFeaturesText, setPlanFeaturesText] = useState('')
  const [videoForm, setVideoForm] = useState<Omit<VideoRow, 'id'> & { id?: string }>(emptyVideo())

  const load = useCallback(async () => {
    const [plansRes, videosRes, subsRes, pursRes, profRes] = await Promise.all([
      supabase.from('plans').select('*').order('sort_order'),
      supabase.from('videos').select('*').order('sort_order'),
      supabase.from('subscriptions').select('*').order('created_at', { ascending: false }),
      supabase.from('purchases').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, display_name, email'),
    ])
    setPlans((plansRes.data as PlanRow[]) ?? [])
    setVideos((videosRes.data as VideoRow[]) ?? [])
    setSubs((subsRes.data as SubRow[]) ?? [])
    setPurs((pursRes.data as PurRow[]) ?? [])
    const map: Record<string, ProfileRow> = {}
    for (const p of (profRes.data as ProfileRow[]) ?? []) map[p.id] = p
    setPeople(map)
  }, [])

  useEffect(() => {
    if (isAdmin) load()
  }, [isAdmin, load])

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-white/50">Carregando…</p>
      </div>
    )
  }
  if (!session) return <Navigate to="/entrar" replace />
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-white/60">Acesso restrito ao administrador.</p>
        <Link to="/" className="text-red-400 hover:text-red-300 font-medium">Voltar ao site</Link>
      </div>
    )
  }

  const label = (userId: string) => {
    const p = people[userId]
    return p?.display_name || p?.email || userId.slice(0, 8)
  }

  const savePlan = async () => {
    const payload = {
      name: planForm.name,
      price_label: planForm.price_label || null,
      tagline: planForm.tagline || null,
      features: planFeaturesText.split('\n').map((s) => s.trim()).filter(Boolean),
      infinitepay_url: planForm.infinitepay_url || null,
      mercadopago_url: planForm.mercadopago_url || null,
      is_active: planForm.is_active,
      sort_order: Number(planForm.sort_order) || 0,
    }
    if (planForm.id) {
      await supabase.from('plans').update(payload).eq('id', planForm.id)
    } else {
      await supabase.from('plans').insert(payload)
    }
    setPlanForm(emptyPlan())
    setPlanFeaturesText('')
    load()
  }

  const saveVideo = async () => {
    const payload = {
      title: videoForm.title,
      description: videoForm.description || null,
      thumbnail_url: videoForm.thumbnail_url || null,
      video_url: videoForm.video_url || null,
      access_type: videoForm.access_type,
      price_label: videoForm.price_label || null,
      purchase_url: videoForm.purchase_url || null,
      is_published: videoForm.is_published,
      sort_order: Number(videoForm.sort_order) || 0,
    }
    if (videoForm.id) {
      await supabase.from('videos').update(payload).eq('id', videoForm.id)
    } else {
      await supabase.from('videos').insert(payload)
    }
    setVideoForm(emptyVideo())
    load()
  }

  const activateSub = async (id: string) => {
    await supabase.from('subscriptions').update({ status: 'active', started_at: new Date().toISOString() }).eq('id', id)
    load()
  }
  const cancelSub = async (id: string) => {
    await supabase.from('subscriptions').update({ status: 'canceled' }).eq('id', id)
    load()
  }
  const payPurchase = async (id: string) => {
    await supabase.from('purchases').update({ status: 'paid' }).eq('id', id)
    load()
  }
  const deleteSub = async (id: string) => {
    await supabase.from('subscriptions').delete().eq('id', id)
    load()
  }
  const deletePlan = async (id: string) => {
    await supabase.from('plans').delete().eq('id', id)
    load()
  }
  const deleteVideo = async (id: string) => {
    await supabase.from('videos').delete().eq('id', id)
    load()
  }

  const inputCls = 'bg-black/40 border-white/15 text-white placeholder:text-white/30'
  const statusBadge = (s: string) =>
    s === 'active' || s === 'paid'
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
      : s === 'pending'
        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
        : 'bg-white/10 text-white/60 border-white/20'

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="border-b border-white/10 bg-black/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="font-bagel text-xl tracking-wider hover:opacity-80">MOJJU</Link>
            <span className="text-white/40 text-sm">Painel Admin</span>
          </div>
          <Link to="/membros" className="text-white/70 hover:text-white text-sm font-medium">Área de membros</Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex gap-2 mb-8">
          {(['planos', 'videos', 'membros'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2.5 rounded-full text-sm font-medium cursor-pointer transition-colors ${
                tab === t ? 'bg-red-600 text-white' : 'bg-white/5 text-white/70 hover:bg-white/10'
              }`}
            >
              {t === 'planos' ? 'Planos' : t === 'videos' ? 'Vídeos' : 'Assinantes'}
            </button>
          ))}
        </div>

        {/* PLANS */}
        {tab === 'planos' && (
          <div className="space-y-10">
            <section>
              <h2 className="text-xl font-bold mb-4">{planForm.id ? 'Editar plano' : 'Novo plano'}</h2>
              <div className="glass-effect rounded-2xl bg-white/5 border border-white/10 p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-white/80">Nome</Label>
                  <Input value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} placeholder="Plano Mensal" className={inputCls} />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/80">Preço exibido</Label>
                  <Input value={planForm.price_label} onChange={(e) => setPlanForm({ ...planForm, price_label: e.target.value })} placeholder="R$ 29/mês" className={inputCls} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-white/80">Descrição curta</Label>
                  <Input value={planForm.tagline} onChange={(e) => setPlanForm({ ...planForm, tagline: e.target.value })} placeholder="Acesso completo à biblioteca" className={inputCls} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-white/80">Benefícios (um por linha)</Label>
                  <textarea
                    value={planFeaturesText}
                    onChange={(e) => setPlanFeaturesText(e.target.value)}
                    rows={3}
                    placeholder={'Todos os vídeos\nNovidades todo mês'}
                    className="w-full rounded-md bg-black/40 border border-white/15 text-white px-3 py-2 text-sm placeholder:text-white/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/80">Link InfinitePay (principal)</Label>
                  <Input value={planForm.infinitepay_url} onChange={(e) => setPlanForm({ ...planForm, infinitepay_url: e.target.value })} placeholder="https://..." className={inputCls} />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/80">Link Mercado Pago (alternativo)</Label>
                  <Input value={planForm.mercadopago_url} onChange={(e) => setPlanForm({ ...planForm, mercadopago_url: e.target.value })} placeholder="https://..." className={inputCls} />
                </div>
                <div className="flex items-center gap-6 md:col-span-2">
                  <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer">
                    <input type="checkbox" checked={planForm.is_active} onChange={(e) => setPlanForm({ ...planForm, is_active: e.target.checked })} className="accent-red-600" />
                    Plano ativo (visível no site)
                  </label>
                  <div className="flex items-center gap-2 text-sm text-white/80">
                    Ordem:
                    <Input type="number" value={planForm.sort_order} onChange={(e) => setPlanForm({ ...planForm, sort_order: Number(e.target.value) })} className={`w-20 ${inputCls}`} />
                  </div>
                </div>
                <div className="flex gap-3 md:col-span-2">
                  <Button onClick={savePlan} disabled={!planForm.name} className="bg-red-600 hover:bg-red-700 text-white font-semibold cursor-pointer">
                    {planForm.id ? 'Salvar alterações' : 'Criar plano'}
                  </Button>
                  {planForm.id && (
                    <Button variant="outline" onClick={() => { setPlanForm(emptyPlan()); setPlanFeaturesText('') }} className="bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white cursor-pointer">
                      Cancelar
                    </Button>
                  )}
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4">Planos cadastrados</h2>
              {plans.length === 0 ? (
                <p className="text-white/40 text-sm">Nenhum plano ainda.</p>
              ) : (
                <div className="space-y-3">
                  {plans.map((p) => (
                    <div key={p.id} className="rounded-xl bg-white/5 border border-white/10 p-4 flex flex-wrap items-center gap-3">
                      <div className="flex-1 min-w-[200px]">
                        <p className="font-semibold">{p.name} <span className="text-red-400 ml-2">{p.price_label}</span></p>
                        <p className="text-white/50 text-xs mt-0.5 truncate">
                          InfinitePay: {p.infinitepay_url ? '✓ configurado' : '—'} · Mercado Pago: {p.mercadopago_url ? '✓ configurado' : '—'}
                        </p>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full border ${p.is_active ? statusBadge('active') : statusBadge('canceled')}`}>
                        {p.is_active ? 'Ativo' : 'Oculto'}
                      </span>
                      <Button size="sm" variant="outline" onClick={() => { setPlanForm({ ...p }); setPlanFeaturesText((p.features ?? []).join('\n')) }} className="bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white cursor-pointer">
                        Editar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => deletePlan(p.id)} className="bg-transparent border-red-500/40 text-red-400 hover:bg-red-600/20 hover:text-red-300 cursor-pointer">
                        Excluir
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* VIDEOS */}
        {tab === 'videos' && (
          <div className="space-y-10">
            <section>
              <h2 className="text-xl font-bold mb-4">{videoForm.id ? 'Editar vídeo' : 'Novo vídeo'}</h2>
              <div className="glass-effect rounded-2xl bg-white/5 border border-white/10 p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-white/80">Título</Label>
                  <Input value={videoForm.title} onChange={(e) => setVideoForm({ ...videoForm, title: e.target.value })} className={inputCls} />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/80">Tipo de acesso</Label>
                  <select
                    value={videoForm.access_type}
                    onChange={(e) => setVideoForm({ ...videoForm, access_type: e.target.value as 'subscription' | 'purchase' })}
                    className="w-full rounded-md bg-black/40 border border-white/15 text-white px-3 py-2 text-sm cursor-pointer"
                  >
                    <option value="subscription">Assinatura (incluso)</option>
                    <option value="purchase">Venda avulsa</option>
                  </select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-white/80">Descrição</Label>
                  <Input value={videoForm.description} onChange={(e) => setVideoForm({ ...videoForm, description: e.target.value })} className={inputCls} />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/80">URL do vídeo</Label>
                  <Input value={videoForm.video_url} onChange={(e) => setVideoForm({ ...videoForm, video_url: e.target.value })} placeholder="https://... (mp4/webm)" className={inputCls} />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/80">URL da capa (thumbnail)</Label>
                  <Input value={videoForm.thumbnail_url} onChange={(e) => setVideoForm({ ...videoForm, thumbnail_url: e.target.value })} placeholder="https://... (jpg/png)" className={inputCls} />
                </div>
                {videoForm.access_type === 'purchase' && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-white/80">Preço exibido</Label>
                      <Input value={videoForm.price_label} onChange={(e) => setVideoForm({ ...videoForm, price_label: e.target.value })} placeholder="R$ 19" className={inputCls} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-white/80">Link de compra (InfinitePay)</Label>
                      <Input value={videoForm.purchase_url} onChange={(e) => setVideoForm({ ...videoForm, purchase_url: e.target.value })} placeholder="https://..." className={inputCls} />
                    </div>
                  </>
                )}
                <div className="flex items-center gap-6 md:col-span-2">
                  <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer">
                    <input type="checkbox" checked={videoForm.is_published} onChange={(e) => setVideoForm({ ...videoForm, is_published: e.target.checked })} className="accent-red-600" />
                    Publicado (visível no site)
                  </label>
                  <div className="flex items-center gap-2 text-sm text-white/80">
                    Ordem:
                    <Input type="number" value={videoForm.sort_order} onChange={(e) => setVideoForm({ ...videoForm, sort_order: Number(e.target.value) })} className={`w-20 ${inputCls}`} />
                  </div>
                </div>
                <div className="flex gap-3 md:col-span-2">
                  <Button onClick={saveVideo} disabled={!videoForm.title} className="bg-red-600 hover:bg-red-700 text-white font-semibold cursor-pointer">
                    {videoForm.id ? 'Salvar alterações' : 'Adicionar vídeo'}
                  </Button>
                  {videoForm.id && (
                    <Button variant="outline" onClick={() => setVideoForm(emptyVideo())} className="bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white cursor-pointer">
                      Cancelar
                    </Button>
                  )}
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4">Vídeos cadastrados</h2>
              {videos.length === 0 ? (
                <p className="text-white/40 text-sm">Nenhum vídeo ainda.</p>
              ) : (
                <div className="space-y-3">
                  {videos.map((v) => (
                    <div key={v.id} className="rounded-xl bg-white/5 border border-white/10 p-4 flex flex-wrap items-center gap-3">
                      <div className="flex-1 min-w-[200px]">
                        <p className="font-semibold">
                          {v.title}
                          <span className="text-white/40 text-xs ml-2">
                            {v.access_type === 'purchase' ? `Avulso · ${v.price_label ?? 'sem preço'}` : 'Assinatura'}
                          </span>
                        </p>
                        <p className="text-white/50 text-xs mt-0.5 truncate">URL vídeo: {v.video_url ? '✓' : '—'} · Capa: {v.thumbnail_url ? '✓' : '—'}</p>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full border ${v.is_published ? statusBadge('active') : statusBadge('canceled')}`}>
                        {v.is_published ? 'Publicado' : 'Oculto'}
                      </span>
                      <Button size="sm" variant="outline" onClick={() => setVideoForm({ ...v })} className="bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white cursor-pointer">
                        Editar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => deleteVideo(v.id)} className="bg-transparent border-red-500/40 text-red-400 hover:bg-red-600/20 hover:text-red-300 cursor-pointer">
                        Excluir
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* MEMBERS */}
        {tab === 'membros' && (
          <div className="space-y-10">
            <section>
              <h2 className="text-xl font-bold mb-4">Assinaturas</h2>
              {subs.length === 0 ? (
                <p className="text-white/40 text-sm">Nenhuma assinatura ainda.</p>
              ) : (
                <div className="space-y-3">
                  {subs.map((s) => (
                    <div key={s.id} className="rounded-xl bg-white/5 border border-white/10 p-4 flex flex-wrap items-center gap-3">
                      <div className="flex-1 min-w-[200px]">
                        <p className="font-semibold">{label(s.user_id)}</p>
                        <p className="text-white/50 text-xs mt-0.5">
                          {s.provider === 'infinitepay' ? 'InfinitePay' : 'Mercado Pago'} · {new Date(s.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full border ${statusBadge(s.status)}`}>
                        {s.status === 'pending' ? 'Aguardando' : s.status === 'active' ? 'Ativa' : 'Cancelada'}
                      </span>
                      {s.status !== 'active' && (
                        <Button size="sm" onClick={() => activateSub(s.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer">
                          Liberar acesso
                        </Button>
                      )}
                      {s.status === 'active' && (
                        <Button size="sm" variant="outline" onClick={() => cancelSub(s.id)} className="bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white cursor-pointer">
                          Cancelar
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => deleteSub(s.id)} className="bg-transparent border-red-500/40 text-red-400 hover:bg-red-600/20 hover:text-red-300 cursor-pointer">
                        Excluir
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4">Compras avulsas</h2>
              {purs.length === 0 ? (
                <p className="text-white/40 text-sm">Nenhuma compra ainda.</p>
              ) : (
                <div className="space-y-3">
                  {purs.map((p) => (
                    <div key={p.id} className="rounded-xl bg-white/5 border border-white/10 p-4 flex flex-wrap items-center gap-3">
                      <div className="flex-1 min-w-[200px]">
                        <p className="font-semibold">{label(p.user_id)}</p>
                        <p className="text-white/50 text-xs mt-0.5">
                          {videos.find((v) => v.id === p.video_id)?.title ?? 'Vídeo removido'} · {new Date(p.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full border ${statusBadge(p.status)}`}>
                        {p.status === 'pending' ? 'Aguardando' : p.status === 'paid' ? 'Paga' : 'Cancelada'}
                      </span>
                      {p.status !== 'paid' && (
                        <Button size="sm" onClick={() => payPurchase(p.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer">
                          Marcar como paga
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
