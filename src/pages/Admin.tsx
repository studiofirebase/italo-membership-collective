import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { api } from '@/integrations/api/client'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DEFAULT_INFINITEPAY_CHECKOUT_URL } from '@/lib/payment-checkout'
import {
  isMembershipMediaPath,
  MEMBERSHIP_MEDIA_BUCKET,
} from '@/lib/membership-media'
import { formatVideoSources, parseVideoSources, serializeVideoSources } from '@/lib/video-url'

const MAX_VIDEO_FILE_SIZE = 50 * 1024 * 1024
const MAX_THUMBNAIL_FILE_SIZE = 10 * 1024 * 1024
const MEDIA_MIME_BY_EXTENSION: Record<string, string> = {
  avif: 'image/avif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  mov: 'video/quicktime',
  mp4: 'video/mp4',
  png: 'image/png',
  webp: 'image/webp',
  webm: 'video/webm',
}

function getMediaExtension(file: File) {
  return file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? ''
}

function getMediaContentType(file: File) {
  return MEDIA_MIME_BY_EXTENSION[getMediaExtension(file)] || file.type
}

const ACCESS_DAYS = 30

type PlanRow = {
  id: string
  name: string
  price_label: string | null
  tagline: string | null
  features: string[]
  infinitepay_url: string | null
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
  started_at: string | null
  expires_at: string | null
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

type SubDetail = {
  subscription_id: string
  email: string | null
  full_name: string | null
  phone: string | null
  order_nsu: string | null
  transaction_nsu: string | null
  amount: number | null
  paid_amount: number | null
  paid_at: string | null
  capture_method: string | null
}

const brl = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const methodLabel = (method: string | null) =>
  method === 'pix' ? 'Pix' : method === 'credit_card' ? 'Cartão de crédito' : method === 'debit_card' ? 'Cartão de débito' : method

type ProfileRow = { id: string; display_name: string | null; email: string | null }

const emptyPlan = (): Omit<PlanRow, 'id'> => ({
  name: '',
  price_label: '',
  tagline: '',
  features: [],
  infinitepay_url: DEFAULT_INFINITEPAY_CHECKOUT_URL,
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
  const { session, isAdmin, isLocalAdminTest, loading, checkingAdminRole, adminRoleError, signOut } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'planos' | 'videos' | 'membros' | 'admins'>('planos')

  const [plans, setPlans] = useState<PlanRow[]>([])
  const [videos, setVideos] = useState<VideoRow[]>([])
  const [subs, setSubs] = useState<SubRow[]>([])
  const [purs, setPurs] = useState<PurRow[]>([])
  const [planPanel, setPlanPanel] = useState(false)
  const [videoPanel, setVideoPanel] = useState(false)
  const [details, setDetails] = useState<Record<string, SubDetail>>({})
  const [people, setPeople] = useState<Record<string, ProfileRow>>({})
  const [subscriptionSearch, setSubscriptionSearch] = useState('')
  const [subscriptionStatus, setSubscriptionStatus] = useState('all')
  const [expiryDrafts, setExpiryDrafts] = useState<Record<string, string>>({})
  const [busySubscriptionId, setBusySubscriptionId] = useState<string | null>(null)
  const [subscriptionError, setSubscriptionError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [isLoadingData, setIsLoadingData] = useState(false)

  const [planForm, setPlanForm] = useState<Omit<PlanRow, 'id'> & { id?: string }>(emptyPlan())
  const [planFeaturesText, setPlanFeaturesText] = useState('')
  const [videoForm, setVideoForm] = useState<Omit<VideoRow, 'id'> & { id?: string }>(emptyVideo())
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [videoFormError, setVideoFormError] = useState('')
  const [isSavingVideo, setIsSavingVideo] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [linkChecks, setLinkChecks] = useState<Array<{ id: string; title: string; ok: boolean; status: number }> | null>(null)
  const [checkingLinks, setCheckingLinks] = useState(false)
  const [linkCheckError, setLinkCheckError] = useState('')
  const [bulkText, setBulkText] = useState('')
  const [bulkResult, setBulkResult] = useState('')
  const [bulkBusy, setBulkBusy] = useState(false)
  const [promoteEmail, setPromoteEmail] = useState('')
  const [promoteBusy, setPromoteBusy] = useState(false)
  const [promoteResult, setPromoteResult] = useState('')
  const [promoteError, setPromoteError] = useState('')

  const load = useCallback(async () => {
    setIsLoadingData(true)
    setLoadError('')
    try {
      if (isLocalAdminTest) {
        const createdAt = new Date().toISOString()
        setPlans([{
          id: 'local-demo-plan',
          name: 'Plano de demonstração',
          price_label: 'R$ 29/mês',
          tagline: 'Dados fictícios para teste local',
          features: ['Conteúdo exclusivo', 'Acesso mensal'],
          infinitepay_url: null,
          is_active: true,
          sort_order: 0,
        }])
        setVideos([{
          id: 'local-demo-video',
          title: 'Vídeo de demonstração',
          description: 'Conteúdo fictício do painel local.',
          thumbnail_url: null,
          video_url: null,
          access_type: 'subscription',
          price_label: null,
          purchase_url: null,
          is_published: true,
          sort_order: 0,
        }])
        setSubs([{
          id: 'local-demo-active',
          user_id: 'local-demo-member',
          plan_id: 'local-demo-plan',
          provider: 'infinitepay',
          status: 'active',
          started_at: createdAt,
          expires_at: null,
          created_at: createdAt,
        }, {
          id: 'local-demo-pending',
          user_id: 'local-demo-pending-member',
          plan_id: 'local-demo-plan',
          provider: 'infinitepay',
          status: 'pending',
          started_at: null,
          expires_at: null,
          created_at: createdAt,
        }])
        setPurs([{
          id: 'local-demo-purchase',
          user_id: 'local-demo-member',
          video_id: 'local-demo-video',
          provider: 'infinitepay',
          status: 'pending',
          created_at: createdAt,
        }])
        setPeople({
          'local-demo-member': { id: 'local-demo-member', display_name: 'Membro de demonstração', email: 'membro-demo@local.test' },
          'local-demo-pending-member': { id: 'local-demo-pending-member', display_name: 'Assinante pendente', email: 'pendente-demo@local.test' },
        })
        return
      }

      const [plansRes, videosRes, subsRes, pursRes, profRes, detailsRes] = await Promise.all([
        api.from('plans').select('*').order('sort_order'),
        api.rpc('get_membership_videos'),
        api.from('subscriptions').select('*').order('created_at', { ascending: false }),
        api.from('purchases').select('*').order('created_at', { ascending: false }),
        api.from('profiles').select('id, display_name, email'),
        api.rpc('admin_subscriber_details'),
      ])
      const queryError = plansRes.error ?? videosRes.error ?? subsRes.error ?? pursRes.error ?? profRes.error
      if (queryError) throw queryError

      setPlans((plansRes.data as PlanRow[]) ?? [])
      setVideos((videosRes.data as VideoRow[]) ?? [])
      setSubs((subsRes.data as SubRow[]) ?? [])
      setPurs((pursRes.data as PurRow[]) ?? [])
      const detailMap: Record<string, SubDetail> = {}
      for (const d of (detailsRes.data as SubDetail[] | null) ?? []) detailMap[d.subscription_id] = d
      setDetails(detailMap)
      const map: Record<string, ProfileRow> = {}
      for (const p of (profRes.data as ProfileRow[]) ?? []) map[p.id] = p
      setPeople(map)
    } catch (error) {
      console.error('Falha ao carregar dados do painel administrativo.', error)
      setLoadError('Não foi possível carregar os dados. Verifique sua conexão e tente novamente.')
    } finally {
      setIsLoadingData(false)
    }
  }, [isLocalAdminTest])

  useEffect(() => {
    if (isAdmin) load()
  }, [isAdmin, load])

  const checkLinks = async () => {
    if (checkingLinks || isLocalAdminTest) return
    setCheckingLinks(true)
    setLinkCheckError('')
    setBulkResult('')
    try {
      const { data, error } = await api.functions.invoke<{ data: Array<{ id: string; title: string; ok: boolean; status: number }> }>('admin-check-links')
      if (error) throw error
      setLinkChecks(data?.data ?? [])
    } catch (error) {
      console.error('Falha ao verificar os links dos vídeos.', error)
      setLinkCheckError('Não foi possível verificar os links. Tente novamente.')
    } finally {
      setCheckingLinks(false)
    }
  }

  const applyBulkUrls = async () => {
    if (bulkBusy || isLocalAdminTest) return
    setBulkResult('')
    setLinkCheckError('')
    const items: Array<{ id: string; urls: string[] }> = []
    const lines = bulkText.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      const [id, ...rest] = line.split(/\s+/)
      const urls = rest.join(' ').split('|').map((url) => url.trim()).filter(Boolean)
      const validUrls = urls.length > 0 && urls.length <= 6 && urls.every((value) => {
        try {
          return /^https?:$/.test(new URL(value).protocol)
        } catch {
          return false
        }
      })
      if (!id || !validUrls) {
        setLinkCheckError(`Linha ${i + 1} inválida. Use: id_da_video https://principal | https://reserva`)
        return
      }
      items.push({ id, urls })
    }
    if (items.length === 0) {
      setLinkCheckError('Cole ao menos uma linha no formato: id_da_video https://principal | https://reserva')
      return
    }
    setBulkBusy(true)
    try {
      const { data, error } = await api.functions.invoke<{ data: { updated: string[]; unknown: string[] } }>(
        'admin-bulk-video-urls',
        { body: { items } },
      )
      if (error) throw error
      const updated = data?.data?.updated ?? []
      const unknown = data?.data?.unknown ?? []
      setBulkResult(
        `${updated.length} link(s) atualizado(s).${unknown.length ? ` IDs não encontrados: ${unknown.join(', ')}` : ''}`,
      )
      setBulkText('')
      setLinkChecks(null)
      await load()
    } catch (error) {
      console.error('Falha ao atualizar os links em massa.', error)
      setLinkCheckError('Não foi possível atualizar os links. Confira o formato e tente novamente.')
    } finally {
      setBulkBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-white/50">Carregando…</p>
      </div>
    )
  }
  if (!session && !isLocalAdminTest) return <Navigate to="/entrar" replace />
  if (checkingAdminRole) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-white/50">Verificando acesso administrativo…</p>
      </div>
    )
  }
  if (adminRoleError) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-4 px-4">
        <p role="alert" className="text-center text-white/70">
          Não foi possível verificar sua permissão administrativa. Verifique sua conexão e tente novamente.
        </p>
        <Button onClick={() => window.location.reload()} className="bg-white/10 text-white hover:bg-white/20">
          Tentar novamente
        </Button>
      </div>
    )
  }
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
    if (isLocalAdminTest) return
    const payload = {
      name: planForm.name,
      price_label: planForm.price_label || null,
      tagline: planForm.tagline || null,
      features: planFeaturesText.split('\n').map((s) => s.trim()).filter(Boolean),
      infinitepay_url: planForm.infinitepay_url || null,
      is_active: planForm.is_active,
      sort_order: Number(planForm.sort_order) || 0,
    }
    if (planForm.id) {
      await api.from('plans').update(payload).eq('id', planForm.id)
    } else {
      await api.from('plans').insert(payload)
    }
    setPlanForm(emptyPlan())
    setPlanPanel(false)
    setPlanFeaturesText('')
    load()
  }

  const saveVideo = async () => {
    if (isLocalAdminTest) return
    setVideoFormError('')
    if (videoForm.is_published && !videoFile && parseVideoSources(videoForm.video_url).length === 0) {
      setVideoFormError('Envie um arquivo de vídeo ou informe uma URL antes de publicar.')
      return
    }

    const videoExtension = videoFile ? getMediaExtension(videoFile) : ''
    const thumbnailExtension = thumbnailFile ? getMediaExtension(thumbnailFile) : ''
    const supportedVideo = videoFile &&
      ['video/mp4', 'video/webm', 'video/quicktime'].includes(getMediaContentType(videoFile)) &&
      ['mp4', 'webm', 'mov'].includes(videoExtension)
    const supportedThumbnail = thumbnailFile &&
      ['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(getMediaContentType(thumbnailFile)) &&
      ['jpg', 'jpeg', 'png', 'webp', 'avif'].includes(thumbnailExtension)

    if (videoFile && (!supportedVideo || videoFile.size > MAX_VIDEO_FILE_SIZE)) {
      setVideoFormError('Use um vídeo MP4, WebM ou MOV de até 50 MB.')
      return
    }
    if (thumbnailFile && (!supportedThumbnail || thumbnailFile.size > MAX_THUMBNAIL_FILE_SIZE)) {
      setVideoFormError('Use uma capa JPG, PNG, WebP ou AVIF de até 10 MB.')
      return
    }

    setIsSavingVideo(true)
    setUploadProgress(0)
    const videoId = videoForm.id ?? crypto.randomUUID()
    const uploadedPaths: string[] = []
    let uploadedBytes = 0
    const totalUploadBytes = (videoFile?.size ?? 0) + (thumbnailFile?.size ?? 0)
    try {
      const uploadAsset = async (file: File, prefix: 'video' | 'thumbnail', extension: string) => {
        const path = `videos/${videoId}/${prefix}-${crypto.randomUUID()}.${extension}`
        const { error } = await api.storage.from(MEMBERSHIP_MEDIA_BUCKET).upload(path, file, {
          contentType: getMediaContentType(file),
          onProgress: (sent) => {
            setUploadProgress(Math.round(((uploadedBytes + sent) / totalUploadBytes) * 100))
          },
        })
        if (error) throw error
        uploadedPaths.push(path)
        uploadedBytes += file.size
        setUploadProgress(totalUploadBytes > 0 ? Math.round((uploadedBytes / totalUploadBytes) * 100) : 100)
        return path
      }

      const videoUrl = videoFile
        ? await uploadAsset(videoFile, 'video', videoExtension)
        : serializeVideoSources(videoForm.video_url)
      const thumbnailUrl = thumbnailFile
        ? await uploadAsset(thumbnailFile, 'thumbnail', thumbnailExtension)
        : videoForm.thumbnail_url || null
      const payload = {
        title: videoForm.title.trim(),
        description: videoForm.description || null,
        thumbnail_url: thumbnailUrl,
        video_url: videoUrl,
        access_type: videoForm.access_type,
        price_label: videoForm.price_label || null,
        purchase_url: videoForm.purchase_url || null,
        is_published: videoForm.is_published,
        sort_order: Number(videoForm.sort_order) || 0,
      }

      const result = videoForm.id
        ? await api.from('videos').update(payload).eq('id', videoId).select('id').maybeSingle()
        : await api.from('videos').insert({ id: videoId, ...payload }).select('id').maybeSingle()
      if (result.error) throw result.error
      if (!result.data) throw new Error('O vídeo não foi salvo. Verifique sua permissão administrativa.')

      const retainedPaths = new Set([videoUrl, thumbnailUrl].filter(isMembershipMediaPath))
      const replacedPaths = [videoForm.video_url, videoForm.thumbnail_url]
        .filter((path): path is string => isMembershipMediaPath(path) && !retainedPaths.has(path))
      if (replacedPaths.length > 0) {
        const { error } = await api.storage.from(MEMBERSHIP_MEDIA_BUCKET).remove(replacedPaths)
        if (error) console.warn('Não foi possível remover os arquivos de mídia substituídos.')
      }

      setVideoForm(emptyVideo())
      setVideoPanel(false)
      setVideoFile(null)
      setThumbnailFile(null)
      await load()
    } catch (error) {
      console.error('Falha ao salvar vídeo ou enviar mídia.', error)
      if (uploadedPaths.length > 0) {
        const { error: cleanupError } = await api.storage.from(MEMBERSHIP_MEDIA_BUCKET).remove(uploadedPaths)
        if (cleanupError) console.warn('Não foi possível remover o upload incompleto.')
      }
      setVideoFormError('Não foi possível salvar o vídeo. Verifique os arquivos e tente novamente.')
    } finally {
      setIsSavingVideo(false)
    }
  }

  const updateSubscription = async (id: string, updates: Partial<SubRow>, successMessage: string) => {
    if (isLocalAdminTest) return
    setBusySubscriptionId(id)
    setSubscriptionError('')
    try {
      const { data, error } = await api
        .from('subscriptions')
        .update(updates)
        .eq('id', id)
        .select('id')
        .maybeSingle()
      if (error) throw error
      if (!data) throw new Error('A assinatura não foi encontrada ou você não tem permissão para alterá-la.')
      await load()
      setSubscriptionError(successMessage)
    } catch (error) {
      console.error('Falha ao atualizar assinatura.', error)
      setSubscriptionError('Não foi possível atualizar a assinatura. Tente novamente.')
    } finally {
      setBusySubscriptionId(null)
    }
  }

  const activateSub = (id: string) => {
    const now = new Date()
    const expiresAt = new Date(now.getTime() + ACCESS_DAYS * 24 * 60 * 60 * 1000)
    return updateSubscription(
      id,
      { status: 'active', started_at: now.toISOString(), expires_at: expiresAt.toISOString() },
      `Acesso liberado por ${ACCESS_DAYS} dias.`,
    )
  }

  const cancelSub = async (id: string) => {
    await updateSubscription(id, { status: 'canceled' }, 'Assinatura cancelada.')
  }

  const saveSubExpiry = async (subscription: SubRow) => {
    const date = expiryDrafts[subscription.id] ?? subscription.expires_at?.slice(0, 10) ?? ''
    if (!date) return
    const expiresAt = new Date(`${date}T23:59:59.999Z`)
    if (Number.isNaN(expiresAt.getTime())) {
      setSubscriptionError('Informe uma data de vencimento válida.')
      return
    }
    await updateSubscription(
      subscription.id,
      { expires_at: expiresAt.toISOString() },
      'Vencimento atualizado.',
    )
  }

  const clearSubExpiry = async (subscription: SubRow) => {
    await updateSubscription(
      subscription.id,
      { expires_at: null },
      'Vencimento removido; o acesso não terá prazo definido.',
    )
  }
  const payPurchase = async (id: string) => {
    if (isLocalAdminTest) return
    await api.from('purchases').update({ status: 'paid' }).eq('id', id)
    load()
  }
  const deletePlan = async (id: string) => {
    if (isLocalAdminTest) return
    await api.from('plans').delete().eq('id', id)
    load()
  }
  const deleteVideo = async (id: string) => {
    if (isLocalAdminTest) return
    const { error } = await api.from('videos').delete().eq('id', id)
    if (error) {
      setVideoFormError('Não foi possível excluir este vídeo.')
      return
    }
    const { data: files, error: listError } = await api.storage
      .from(MEMBERSHIP_MEDIA_BUCKET)
      .list(`videos/${id}`, { limit: 100 })
    if (!listError && files?.length) {
      const paths = files.map((file) => `videos/${id}/${file.name}`)
      const { error: removeError } = await api.storage.from(MEMBERSHIP_MEDIA_BUCKET).remove(paths)
      if (removeError) console.warn('Não foi possível remover todos os arquivos do vídeo excluído.')
    }
    await load()
  }

  const promoteAdmin = async () => {
    if (promoteBusy || isLocalAdminTest) return
    setPromoteResult('')
    setPromoteError('')
    const email = promoteEmail.trim().toLowerCase()
    if (!email) {
      setPromoteError('Informe o e-mail da conta.')
      return
    }
    setPromoteBusy(true)
    try {
      const { data, error } = await api.functions.invoke<{ data: { email: string; already_admin: boolean } }>(
        'admin-promote',
        { body: { email } },
      )
      if (error) throw error
      const promotedEmail = data?.data?.email ?? email
      setPromoteResult(
        data?.data?.already_admin
          ? `${promotedEmail} já é admin.`
          : `${promotedEmail} agora é admin. Cada pessoa entra com seu próprio e-mail e senha.`,
      )
      setPromoteEmail('')
    } catch (err) {
      console.error('Falha ao promover admin.', err)
      setPromoteError(err instanceof Error ? err.message : 'Não foi possível promover. Tente novamente.')
    } finally {
      setPromoteBusy(false)
    }
  }

  const inputCls = 'bg-black/40 border-white/15 text-white placeholder:text-white/30'
  const statusBadge = (s: string) =>
    s === 'active' || s === 'paid'
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
      : s === 'pending'
        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
        : s === 'expired'
          ? 'bg-orange-500/15 text-orange-300 border-orange-500/30'
        : 'bg-white/10 text-white/60 border-white/20'

  const isExpired = (subscription: SubRow) =>
    subscription.status === 'active' &&
    subscription.expires_at !== null &&
    new Date(subscription.expires_at).getTime() <= Date.now()

  const filteredSubscriptions = subs.filter((subscription) => {
    const person = people[subscription.user_id]
    const plan = plans.find((item) => item.id === subscription.plan_id)
    const search = subscriptionSearch.trim().toLocaleLowerCase('pt-BR')
    const matchesSearch =
      !search ||
      [person?.display_name, person?.email, plan?.name, subscription.provider, subscription.user_id,
        details[subscription.id]?.email, details[subscription.id]?.full_name, details[subscription.id]?.phone,
        details[subscription.id]?.order_nsu, details[subscription.id]?.transaction_nsu]
        .some((value) => value?.toLocaleLowerCase('pt-BR').includes(search))
    const status = isExpired(subscription) ? 'expired' : subscription.status
    return matchesSearch && (subscriptionStatus === 'all' || status === subscriptionStatus)
  })
  const activeSubscriptions = subs.filter((subscription) => subscription.status === 'active' && !isExpired(subscription)).length
  const expiredSubscriptions = subs.filter(isExpired).length
  const pendingSubscriptions = subs.filter((subscription) => subscription.status === 'pending').length

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="border-b border-white/10 bg-black/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="font-bagel text-xl tracking-wider hover:opacity-80">Italo Santos</Link>
            <span className="text-white/40 text-sm">Painel Admin</span>
          </div>
          <div className="flex items-center gap-4">
            {!isLocalAdminTest && <Link to="/membros" className="text-white/70 hover:text-white text-sm font-medium">Área de membros</Link>}
            <Button
              variant="outline"
              onClick={async () => {
                await signOut()
                navigate('/entrar', { replace: true })
              }}
              className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              Sair
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {isLocalAdminTest && (
          <div role="status" className="mb-6 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
            Demonstração local: os dados abaixo são fictícios e nenhuma alteração é salva no Supabase.
          </div>
        )}
        {loadError && (
          <div role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            <span>{loadError}</span>
            <Button size="sm" variant="outline" onClick={load} className="border-red-300/30 bg-transparent text-red-100 hover:bg-red-500/20 hover:text-white">
              Tentar novamente
            </Button>
          </div>
        )}

        <div className="flex gap-2 mb-8">
          {(['planos', 'videos', 'membros', 'admins'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2.5 rounded-full text-sm font-medium cursor-pointer transition-colors ${
                tab === t ? 'bg-red-600 text-white' : 'bg-white/5 text-white/70 hover:bg-white/10'
              }`}
            >
              {t === 'planos' ? 'Planos' : t === 'videos' ? 'Vídeos' : t === 'membros' ? 'Assinantes' : 'Admins'}
            </button>
          ))}
        </div>

        {/* PLANS */}
        {tab === 'planos' && (
          <div className="space-y-10">
            {planPanel && (
            <section aria-label={planForm.id ? 'Editar plano' : 'Novo plano'}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold">{planForm.id ? 'Editar plano' : 'Novo plano'}</h2>
                <button type="button" onClick={() => { setPlanForm(emptyPlan()); setPlanFeaturesText(''); setPlanPanel(false) }} className="rounded-full px-3 py-1 text-sm text-white/60 hover:bg-white/10 hover:text-white cursor-pointer">Fechar ✕</button>
              </div>
              <div className="glass-effect rounded-2xl bg-white/5 border border-white/10 p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-white/80">Nome</Label>
                  <Input value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} placeholder="Plano Mensal" className={inputCls} />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/80">Preço exibido</Label>
                  <Input value={planForm.price_label} onChange={(e) => setPlanForm({ ...planForm, price_label: e.target.value })} placeholder="R$ 29,90/mês" className={inputCls} />
                  <p className="text-xs text-white/50">Informe o valor no formato R$ 29,90 para gerar o pagamento na InfinitePay.</p>
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
                  <Label className="text-white/80">Checkout InfinitePay (Pix, Apple Pay e Google Pay)</Label>
                  <Input value={planForm.infinitepay_url} onChange={(e) => setPlanForm({ ...planForm, infinitepay_url: e.target.value })} placeholder="https://..." className={inputCls} />
                </div>
                <p className="text-xs text-white/50 md:col-span-2">
                  O checkout InfinitePay pode oferecer Pix, Apple Pay e Google Pay conforme disponibilidade da conta, navegador e dispositivo. Quando a InfinitePay confirma o pagamento, o acesso de 30 dias é liberado automaticamente; você também pode liberar manualmente na aba Assinantes.
                </p>
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
                  <Button onClick={savePlan} disabled={isLocalAdminTest || !planForm.name} className="bg-red-600 hover:bg-red-700 text-white font-semibold cursor-pointer">
                    {planForm.id ? 'Salvar alterações' : 'Criar plano'}
                  </Button>
                  <Button variant="outline" onClick={() => { setPlanForm(emptyPlan()); setPlanFeaturesText(''); setPlanPanel(false) }} className="bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white cursor-pointer">
                    Cancelar
                  </Button>
                </div>
              </div>
            </section>
            )}

            <section>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">Planos</h2>
                  <p className="text-sm text-white/50">{plans.length} cadastrado(s) · {plans.filter((p) => p.is_active).length} ativo(s)</p>
                </div>
                <Button onClick={() => { setPlanForm(emptyPlan()); setPlanFeaturesText(''); setPlanPanel(true) }} className="bg-red-600 hover:bg-red-700 text-white font-semibold cursor-pointer">+ Novo plano</Button>
              </div>
              {plans.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-white/50">Nenhum plano ainda. Crie o primeiro para começar a vender assinaturas.</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {plans.map((p) => (
                    <div key={p.id} className={`flex flex-col rounded-2xl border p-5 ${p.is_active ? 'border-white/15 bg-white/5' : 'border-white/10 bg-white/[0.02] opacity-70'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold">{p.name}</p>
                          {p.tagline && <p className="mt-0.5 text-sm text-white/60">{p.tagline}</p>}
                        </div>
                        <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full border ${p.is_active ? statusBadge('active') : statusBadge('canceled')}`}>
                          {p.is_active ? 'Ativo' : 'Oculto'}
                        </span>
                      </div>
                      <p className="mt-4 text-3xl font-bold text-white">{p.price_label}</p>
                      {(p.features ?? []).length > 0 && (
                        <ul className="mt-3 space-y-1 text-sm text-white/70">
                          {(p.features ?? []).slice(0, 4).map((f) => <li key={f} className="flex gap-2"><span className="text-emerald-400">✓</span>{f}</li>)}
                        </ul>
                      )}
                      <p className="mt-3 text-xs text-white/40">InfinitePay: {p.infinitepay_url ? 'link configurado' : 'link padrão'}</p>
                      <div className="mt-4 flex gap-2 border-t border-white/10 pt-4">
                        <Button size="sm" variant="outline" onClick={() => { setPlanForm({ ...p, infinitepay_url: p.infinitepay_url ?? DEFAULT_INFINITEPAY_CHECKOUT_URL }); setPlanFeaturesText((p.features ?? []).join('\n')); setPlanPanel(true) }} className="bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white cursor-pointer">
                          Editar
                        </Button>
                        <Button size="sm" variant="outline" disabled={isLocalAdminTest} onClick={() => deletePlan(p.id)} className="bg-transparent border-red-500/40 text-red-400 hover:bg-red-600/20 hover:text-red-300 cursor-pointer">
                          Excluir
                        </Button>
                      </div>
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
            {videoPanel && (
            <section aria-label={videoForm.id ? 'Editar vídeo' : 'Novo vídeo'}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold">{videoForm.id ? 'Editar vídeo' : 'Novo vídeo'}</h2>
                <button type="button" disabled={isSavingVideo} onClick={() => { setVideoForm(emptyVideo()); setVideoFile(null); setThumbnailFile(null); setVideoFormError(''); setVideoPanel(false) }} className="rounded-full px-3 py-1 text-sm text-white/60 hover:bg-white/10 hover:text-white cursor-pointer">Fechar ✕</button>
              </div>
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
                  <Label htmlFor="membership-video-file" className="text-white/80">Arquivo de vídeo</Label>
                  <input
                    id="membership-video-file"
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                    disabled={isLocalAdminTest || isSavingVideo}
                    onChange={(event) => { setVideoFile(event.target.files?.[0] ?? null); setVideoFormError('') }}
                    className="block w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm text-white file:mr-3 file:rounded file:border-0 file:bg-white/15 file:px-3 file:py-1.5 file:text-white"
                  />
                  <p className="text-xs text-white/50">{videoFile?.name ?? 'MP4, WebM ou MOV · até 50 MB'}</p>
                  <Label htmlFor="membership-video-urls" className="text-white/80">Fontes do vídeo (uma por linha)</Label>
                  <textarea
                    id="membership-video-urls"
                    aria-label="URLs das fontes do vídeo, uma por linha"
                    value={isMembershipMediaPath(videoForm.video_url) ? '' : formatVideoSources(videoForm.video_url)}
                    onChange={(e) => setVideoForm({ ...videoForm, video_url: e.target.value })}
                    placeholder={isMembershipMediaPath(videoForm.video_url) ? 'Arquivo privado já enviado' : 'https://...'}
                    rows={4}
                    className={`${inputCls} min-h-24 resize-y`}
                  />
                  {isMembershipMediaPath(videoForm.video_url)
                    ? <p className="text-xs text-emerald-200/70">Vídeo salvo no armazenamento privado. Envie outro arquivo para substituir.</p>
                    : <p className="text-xs text-amber-200/70">O primeiro link é a fonte principal; as linhas seguintes são tentadas automaticamente se uma fonte falhar.</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="membership-thumbnail-file" className="text-white/80">Imagem de capa</Label>
                  <input
                    id="membership-thumbnail-file"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif,.jpg,.jpeg,.png,.webp,.avif"
                    disabled={isLocalAdminTest || isSavingVideo}
                    onChange={(event) => { setThumbnailFile(event.target.files?.[0] ?? null); setVideoFormError('') }}
                    className="block w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm text-white file:mr-3 file:rounded file:border-0 file:bg-white/15 file:px-3 file:py-1.5 file:text-white"
                  />
                  <p className="text-xs text-white/50">{thumbnailFile?.name ?? 'JPG, PNG, WebP ou AVIF · até 10 MB'}</p>
                  <Input aria-label="URL externa da capa" value={isMembershipMediaPath(videoForm.thumbnail_url) ? '' : videoForm.thumbnail_url} onChange={(e) => setVideoForm({ ...videoForm, thumbnail_url: e.target.value })} placeholder={isMembershipMediaPath(videoForm.thumbnail_url) ? 'Capa privada já enviada' : 'URL externa da capa (opcional)'} className={inputCls} />
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
                  <Button onClick={saveVideo} disabled={isLocalAdminTest || isSavingVideo || !videoForm.title.trim()} className="bg-red-600 hover:bg-red-700 text-white font-semibold cursor-pointer">
                    {isSavingVideo ? 'Enviando e salvando…' : videoForm.id ? 'Salvar alterações' : 'Adicionar vídeo'}
                  </Button>
                  <Button variant="outline" disabled={isSavingVideo} onClick={() => { setVideoForm(emptyVideo()); setVideoFile(null); setThumbnailFile(null); setVideoFormError(''); setVideoPanel(false) }} className="bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white cursor-pointer">
                    Cancelar
                  </Button>
                </div>
                {isSavingVideo && (
                  <div role="status" aria-live="polite" className="space-y-2 md:col-span-2">
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-red-500 transition-[width]" style={{ width: `${uploadProgress}%` }} />
                    </div>
                    <p className="text-xs text-white/60">Enviando mídia: {uploadProgress}%</p>
                  </div>
                )}
                {videoFormError && <p role="alert" className="text-sm text-red-300 md:col-span-2">{videoFormError}</p>}
              </div>
            </section>
            )}

            <section>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">Vídeos</h2>
                  <p className="text-sm text-white/50">{videos.length} cadastrado(s) · {videos.filter((v) => v.is_published).length} publicado(s)</p>
                </div>
                <Button onClick={() => { setVideoForm(emptyVideo()); setVideoFile(null); setThumbnailFile(null); setVideoFormError(''); setVideoPanel(true) }} className="bg-red-600 hover:bg-red-700 text-white font-semibold cursor-pointer">+ Novo vídeo</Button>
              </div>
              {videos.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-white/50">Nenhum vídeo ainda. Adicione o primeiro para liberar conteúdo aos membros.</p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-white/10 divide-y divide-white/10">
                  {videos.map((v) => (
                    <div key={v.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-white/[0.03] px-4 py-3">
                      <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white/10 text-lg">▶</span>
                      <div className="min-w-[180px] flex-1">
                        <p className="truncate font-semibold">{v.title}</p>
                        <p className="text-xs text-white/50">
                          {v.access_type === 'purchase' ? `Venda avulsa · ${v.price_label ?? 'sem preço'}` : 'Incluso na assinatura'}
                          {' · '}{v.video_url ? 'vídeo ✓' : 'sem vídeo'}{' · '}{v.thumbnail_url ? 'capa ✓' : 'sem capa'}
                        </p>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full border ${v.is_published ? statusBadge('active') : statusBadge('canceled')}`}>
                        {v.is_published ? 'Publicado' : 'Oculto'}
                      </span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => { setVideoForm({ ...v, video_url: isMembershipMediaPath(v.video_url) ? v.video_url : formatVideoSources(v.video_url) }); setVideoFile(null); setThumbnailFile(null); setVideoFormError(''); setVideoPanel(true) }} className="bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white cursor-pointer">
                          Editar
                        </Button>
                        <Button size="sm" variant="outline" disabled={isLocalAdminTest} onClick={() => deleteVideo(v.id)} className="bg-transparent border-red-500/40 text-red-400 hover:bg-red-600/20 hover:text-red-300 cursor-pointer">
                          Excluir
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section aria-label="Saúde dos links">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">Saúde dos links</h2>
                  <p className="text-sm text-white/50">Detecta vídeos publicados com link quebrado (ex.: .m3u8 expirado) e troca vários de uma vez.</p>
                </div>
                <Button onClick={() => void checkLinks()} disabled={checkingLinks || isLocalAdminTest} className="bg-red-600 hover:bg-red-700 text-white font-semibold cursor-pointer">
                  {checkingLinks ? 'Verificando…' : 'Verificar links'}
                </Button>
              </div>
              {linkCheckError && <p role="alert" className="mb-4 text-sm text-red-300">{linkCheckError}</p>}
              {linkChecks && (
                <div className="mb-6 overflow-hidden rounded-xl border border-white/10 divide-y divide-white/10">
                  <p className="bg-white/[0.03] px-4 py-3 text-sm text-white/70">
                    {linkChecks.filter((c) => c.ok).length} funcionando · {linkChecks.filter((c) => !c.ok).length} quebrado(s)
                  </p>
                  {linkChecks.map((c) => (
                    <div key={c.id} data-video-id={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-white/[0.03] px-4 py-3">
                      <div className="min-w-[180px] flex-1">
                        <p className="truncate font-semibold">{c.title}</p>
                        <p className="text-xs text-white/50">{c.id}</p>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full border ${c.ok ? statusBadge('active') : statusBadge('expired')}`}>
                        {c.ok ? 'OK' : `Quebrado${c.status ? ` · ${c.status}` : ''}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-white/80">Trocar URLs em massa</Label>
                <textarea
                  aria-label="Fontes de vídeo em massa (id + URLs por linha)"
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  rows={4}
                  placeholder={'video-id https://fonte-principal | https://fonte-reserva\n(uma linha por vídeo; use até 6 links separados por |)'}
                  className={`w-full rounded-md px-3 py-2 text-sm ${inputCls}`}
                />
                <div>
                  <Button onClick={() => void applyBulkUrls()} disabled={bulkBusy || isLocalAdminTest} className="bg-red-600 hover:bg-red-700 text-white font-semibold cursor-pointer">
                    {bulkBusy ? 'Atualizando…' : 'Atualizar URLs'}
                  </Button>
                </div>
                {bulkResult && <p role="status" className="text-sm text-emerald-300">{bulkResult}</p>}
              </div>
            </section>
          </div>
        )}

        {/* MEMBERS */}
        {tab === 'membros' && (
          <div className="space-y-10">
            <section>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold">Controle de assinantes</h2>
                  <p className="mt-1 text-sm text-white/50">
                    Consulte o status, libere ou cancele acessos e gerencie vencimentos.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={load}
                  disabled={isLoadingData}
                  className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
                >
                  {isLoadingData ? 'Atualizando…' : 'Atualizar lista'}
                </Button>
              </div>

              <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <p className="text-sm text-white/50">Ativas</p>
                  <p className="mt-1 text-2xl font-bold text-emerald-300">{activeSubscriptions}</p>
                </div>
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                  <p className="text-sm text-white/50">Aguardando pagamento</p>
                  <p className="mt-1 text-2xl font-bold text-amber-300">{pendingSubscriptions}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-white/50">Expiradas</p>
                  <p className="mt-1 text-2xl font-bold text-white/70">{expiredSubscriptions}</p>
                </div>
              </div>

              <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
                <Input
                  value={subscriptionSearch}
                  onChange={(event) => setSubscriptionSearch(event.target.value)}
                  placeholder="Buscar por nome, e-mail, celular, pedido ou transação"
                  aria-label="Buscar assinantes"
                  className={inputCls}
                />
                <select
                  value={subscriptionStatus}
                  onChange={(event) => setSubscriptionStatus(event.target.value)}
                  aria-label="Filtrar assinantes por status"
                  className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                >
                  <option value="all">Todos os status</option>
                  <option value="active">Ativas</option>
                  <option value="pending">Aguardando</option>
                  <option value="expired">Expiradas</option>
                  <option value="canceled">Canceladas</option>
                </select>
              </div>

              {subscriptionError && (
                <p role="status" className={`mb-4 text-sm ${subscriptionError.includes('Não foi possível') ? 'text-red-300' : 'text-emerald-300'}`}>
                  {subscriptionError}
                </p>
              )}

              {subs.length === 0 ? (
                <p className="text-white/40 text-sm">Nenhuma assinatura ainda.</p>
              ) : filteredSubscriptions.length === 0 ? (
                <p className="text-white/40 text-sm">Nenhuma assinatura corresponde à busca e ao filtro selecionados.</p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-white/10 divide-y divide-white/10">
                  {filteredSubscriptions.map((s) => {
                    const expired = isExpired(s)
                    const plan = plans.find((item) => item.id === s.plan_id)
                    const expiryValue = expiryDrafts[s.id] ?? s.expires_at?.slice(0, 10) ?? ''
                    const busy = busySubscriptionId === s.id
                    const d = details[s.id]
                    const accountName = d?.full_name || people[s.user_id]?.display_name || d?.email || s.user_id.slice(0, 8)
                    const accountEmail = d?.email || people[s.user_id]?.email
                    const paid = Boolean(d?.paid_at)
                    const statusText = expired ? 'Expirada' : s.status === 'pending' ? 'Aguardando' : s.status === 'active' ? 'Ativa' : 'Cancelada'
                    const daysLeft = s.expires_at ? Math.ceil((new Date(s.expires_at).getTime() - Date.now()) / 86400000) : null
                    return (
                      <details key={s.id} className="group bg-white/[0.03] open:bg-white/[0.06]">
                        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 hover:bg-white/5 [&::-webkit-details-marker]:hidden">
                          <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-bold uppercase">
                            {accountName.slice(0, 1)}
                          </span>
                          <div className="min-w-[180px] flex-1">
                            <p className="truncate font-semibold">{accountName}</p>
                            <p className="truncate text-xs text-white/60">{accountEmail}{d?.phone ? ` · ${d.phone}` : ''}</p>
                          </div>
                          <div className="hidden min-w-[130px] text-xs text-white/60 sm:block">
                            <p className="text-xs text-white/80">{plan?.name ?? 'Plano removido'}</p>
                            <p className="text-xs">{new Date(s.created_at).toLocaleDateString('pt-BR')}</p>
                          </div>
                          <div className="min-w-[120px] text-xs">
                            <p className={`text-xs ${paid ? 'font-semibold text-emerald-300' : 'text-white/50'}`}>
                              {paid && d?.paid_amount != null ? `${brl(d.paid_amount)} · ${methodLabel(d.capture_method) ?? 'Pago'}` : d?.order_nsu ? 'Pagamento pendente' : 'Sem pagamento'}
                            </p>
                            <p className="text-xs text-white/50">
                              {s.status === 'active' && daysLeft !== null && daysLeft > 0 ? `vence em ${daysLeft} dia${daysLeft === 1 ? '' : 's'}` : s.status === 'active' ? 'sem prazo' : ''}
                            </p>
                          </div>
                          <span className={`rounded-full border px-2.5 py-1 text-xs ${statusBadge(expired ? 'expired' : s.status)}`}>{statusText}</span>
                          <span aria-hidden="true" className="text-white/40 transition group-open:rotate-180">▾</span>
                        </summary>

                        <div className="space-y-4 border-t border-white/10 px-4 py-4">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-white/70">
                              <p className={`font-semibold ${paid ? 'text-emerald-300' : 'text-amber-300'}`}>
                                {paid ? 'Pagamento identificado' : 'Pagamento não identificado'}
                              </p>
                              {d?.amount != null && (
                                <p className="mt-1">
                                  {paid && d.paid_amount != null ? `Pago ${brl(d.paid_amount)}` : `Valor ${brl(d.amount)}`}
                                  {paid && d.capture_method ? ` · ${methodLabel(d.capture_method)}` : ''}
                                  {paid && d.paid_at ? ` · ${new Date(d.paid_at).toLocaleString('pt-BR')}` : ''}
                                </p>
                              )}
                              {d?.order_nsu ? <p className="mt-1 break-all text-white/50">Pedido {d.order_nsu}</p> : <p className="mt-1 text-white/50">Sem checkout InfinitePay vinculado (liberação manual ou histórica).</p>}
                              {d?.transaction_nsu && <p className="break-all text-white/50">Transação {d.transaction_nsu}</p>}
                            </div>
                            <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-white/70">
                              <p className="font-semibold text-white/80">Conta</p>
                              <p className="mt-1">{accountName}{accountEmail ? ` · ${accountEmail}` : ''}</p>
                              {d?.phone && <p>{d.phone}</p>}
                              <p className="mt-1 break-all text-white/50">ID {s.user_id}</p>
                              <p className="text-white/50">{s.provider === 'infinitepay' ? 'InfinitePay' : `${s.provider} (histórico)`}</p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-end gap-3">
                            <div className="space-y-1.5">
                              <Label htmlFor={`subscription-expiry-${s.id}`} className="text-xs text-white/60">
                                Vencimento do acesso
                              </Label>
                              <Input
                                id={`subscription-expiry-${s.id}`}
                                type="date"
                                value={expiryValue}
                                onChange={(event) => setExpiryDrafts((current) => ({ ...current, [s.id]: event.target.value }))}
                                className={`${inputCls} w-44`}
                              />
                            </div>
                            <Button
                              size="sm"
                              disabled={isLocalAdminTest || busy || !expiryValue || expiryValue === (s.expires_at?.slice(0, 10) ?? '')}
                              onClick={() => saveSubExpiry(s)}
                              className="bg-white/10 text-white hover:bg-white/20 cursor-pointer"
                            >
                              Salvar vencimento
                            </Button>
                            {s.expires_at && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isLocalAdminTest || busy}
                                onClick={() => clearSubExpiry(s)}
                                className="border-white/20 bg-transparent text-white/70 hover:bg-white/10 hover:text-white"
                              >
                                Sem prazo
                              </Button>
                            )}
                            <div className="ml-auto flex gap-2">
                              {s.status !== 'active' && (
                                <Button size="sm" disabled={isLocalAdminTest || busy} onClick={() => activateSub(s.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer">
                                  Liberar acesso
                                </Button>
                              )}
                              {s.status === 'active' && (
                                <Button size="sm" variant="outline" disabled={isLocalAdminTest || busy} onClick={() => cancelSub(s.id)} className="bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white cursor-pointer">
                                  Cancelar acesso
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </details>
                    )
                  })}
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
                        <Button size="sm" disabled={isLocalAdminTest} onClick={() => payPurchase(p.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer">
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

        {/* ADMINS */}
        {tab === 'admins' && (
          <section aria-label="Administradores" className="space-y-6">
            <div>
              <h2 className="text-xl font-bold">Admins</h2>
              <p className="text-sm text-white/50">
                Cada pessoa entra com seu próprio e-mail e senha e mantém o próprio perfil.
                Para tornar alguém admin, ela precisa já ter uma conta (cadastro em /entrar).
              </p>
            </div>
            <div className="glass-effect rounded-2xl bg-white/5 border border-white/10 p-6 space-y-4 max-w-xl">
              <div className="space-y-2">
                <Label htmlFor="promote-email" className="text-white/80">E-mail da conta</Label>
                <Input
                  id="promote-email"
                  type="email"
                  autoComplete="email"
                  value={promoteEmail}
                  onChange={(e) => setPromoteEmail(e.target.value)}
                  placeholder="pessoa@email.com"
                  disabled={isLocalAdminTest || promoteBusy}
                  className={inputCls}
                />
              </div>
              <Button
                onClick={promoteAdmin}
                disabled={isLocalAdminTest || promoteBusy || !promoteEmail.trim()}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold cursor-pointer"
              >
                {promoteBusy ? 'Promovendo…' : 'Promover a admin'}
              </Button>
              {isLocalAdminTest && (
                <p className="text-xs text-amber-200/70">Demonstração local: a promoção não é salva.</p>
              )}
              {promoteResult && <p role="status" className="text-sm text-emerald-300">{promoteResult}</p>}
              {promoteError && <p role="alert" className="text-sm text-red-300">{promoteError}</p>}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
