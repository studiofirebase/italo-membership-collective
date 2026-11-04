import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, ExternalLink, ShieldCheck } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { XMediaGrid } from '@/components/XMediaGrid'
import type { XMediaFeed } from '@/hooks/useXMediaFeed'
import { api } from '@/integrations/api/client'
import { normalizePhone } from '@/lib/customer-details'
import { getInfinitePayCheckoutUrl } from '@/lib/payment-checkout'
import { startSubscriptionCheckout } from '@/lib/startSubscriptionCheckout'

export function HomeCatalog({ feed }: { feed: XMediaFeed }) {
  const { user, profile, loading, isLocalAdminTest } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [checkoutUrl, setCheckoutUrl] = useState('')
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [needsCustomerDetails, setNeedsCustomerDetails] = useState(false)
  const checkoutBusyRef = useRef(false)
  const [priceLabel, setPriceLabel] = useState<string | null>(null)

  useEffect(() => {
    void api
      .from('plans')
      .select('price_label')
      .eq('is_active', true)
      .order('sort_order')
      .limit(1)
      .then(({ data }) => {
        const label = (data as { price_label: string | null }[] | null)?.[0]?.price_label
        if (label) setPriceLabel(label)
      })
  }, [])
  const displayName = profile?.display_name || user?.email

  const prepareCheckout = useCallback(async (details?: { name: string; phone: string }) => {
    if (checkoutBusyRef.current) return
    const savedName =
      profile?.display_name?.trim() ||
      (typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name.trim() : '')
    const savedPhone =
      user?.phone ||
      (typeof user?.user_metadata?.phone_number === 'string' ? user.user_metadata.phone_number : '') ||
      (typeof user?.user_metadata?.phone === 'string' ? user.user_metadata.phone : '')
    if (!isLocalAdminTest && (!savedName || !savedPhone) && !details) {
      setCustomerName(savedName)
      setCustomerPhone(savedPhone)
      setNeedsCustomerDetails(true)
      setCheckoutOpen(true)
      return
    }

    checkoutBusyRef.current = true
    setCheckoutError('')
    setCheckoutBusy(true)
    try {
      let url: string
      if (isLocalAdminTest) {
        url = getInfinitePayCheckoutUrl()
      } else if (user) {
        if (details) {
          const { error: profileError } = await api.auth.updateUser({
            data: { full_name: details.name, phone_number: details.phone },
          })
          if (profileError) throw profileError
        }
        url = await startSubscriptionCheckout(details)
      } else {
        throw new Error('A sessão expirou antes de iniciar o checkout.')
      }
      setNeedsCustomerDetails(false)
      setCheckoutUrl(url)
      setSelectedPaymentMethod(null)
      setCheckoutOpen(true)
    } catch (error) {
      console.error('Falha ao iniciar checkout da assinatura.', error)
      setCheckoutError('Não foi possível abrir o checkout. Tente novamente em instantes.')
    } finally {
      checkoutBusyRef.current = false
      setCheckoutBusy(false)
    }
  }, [isLocalAdminTest, profile?.display_name, user])

  const saveCustomerDetails = async () => {
    const normalizedName = customerName.trim()
    const normalizedPhone = normalizePhone(customerPhone)
    if (normalizedName.length < 2) {
      setCheckoutError('Informe seu nome completo.')
      return
    }
    if (!normalizedPhone) {
      setCheckoutError('Informe um telefone válido com DDD.')
      return
    }
    setCheckoutError('')
    await prepareCheckout({ name: normalizedName, phone: normalizedPhone })
  }

  useEffect(() => {
    const continueAfterConfirmation = searchParams.get('continue') === 'checkout'
    if (
      (!user && !isLocalAdminTest) ||
      (!continueAfterConfirmation &&
        window.sessionStorage.getItem('subscription-checkout-after-auth') !== 'pending')
    ) return

    window.sessionStorage.removeItem('subscription-checkout-after-auth')
    if (continueAfterConfirmation) navigate('/', { replace: true })
    void prepareCheckout()
  }, [isLocalAdminTest, navigate, prepareCheckout, searchParams, user])

  const handleSubscribe = async () => {
    if (loading || checkoutBusy) return
    if (!user && !isLocalAdminTest) {
      navigate('/entrar?continue=checkout')
      return
    }

    await prepareCheckout()
  }

  return (
    <div className="home-catalog bg-[#0a0a0b] text-[#f7f7f5]">
      <section className="relative isolate overflow-hidden">
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_#2a2a30_0%,_#0a0a0b_65%)]" />
        <div aria-hidden="true" className="absolute left-1/2 top-0 -z-10 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent" />
        <div className="mx-auto flex w-full max-w-[1220px] flex-col items-center px-6 py-16 text-center sm:px-8 sm:py-24 lg:px-10">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-1.5 text-xs font-bold uppercase tracking-[.15em] text-[#d4d4d7] backdrop-blur">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Conteúdo novo no X
          </span>
          <h1 className="max-w-3xl text-balance text-4xl font-bold leading-[1.1] text-[#f7f7f5] sm:text-6xl">
            Descubra o que está{' '}
            <span className="bg-gradient-to-r from-white to-[#9a9aa2] bg-clip-text text-transparent">por vir.</span>
          </h1>
          <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-[#c8c8cc]">
            Fotos e vídeos publicados por Italo Santos, direto do X. Assine para liberar o acesso completo.
          </p>

          <p className="mt-8 text-sm font-bold uppercase tracking-[.15em] text-[#a8a8ad]">Assinatura mensal</p>
          <p className="mt-1 text-5xl font-black text-white" data-testid="monthly-price">
            {priceLabel ?? 'R$ 1,00'}
            <span className="ml-1 text-lg font-semibold text-[#a8a8ad]">/mês</span>
          </p>

          <div className="mt-6 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
            {loading ? (
              <button type="button" disabled className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-7 py-3 text-base font-bold text-[#111113] shadow-[0_8px_30px_rgba(255,255,255,.18)] transition hover:-translate-y-0.5 hover:bg-[#f2f2f3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:cursor-wait disabled:opacity-70">
                Verificando acesso…
              </button>
            ) : user ? (
              <>
                <button type="button" onClick={handleSubscribe} disabled={checkoutBusy} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-7 py-3 text-base font-bold text-[#111113] shadow-[0_8px_30px_rgba(255,255,255,.18)] transition hover:-translate-y-0.5 hover:bg-[#f2f2f3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:cursor-wait disabled:opacity-70 w-full sm:w-auto">
                  {checkoutBusy ? 'Abrindo checkout…' : 'Assinar agora'}
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </button>
                <Link to="/membros" className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#929297] px-6 py-3 font-bold text-[#f7f7f5] transition hover:border-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white w-full sm:w-auto">
                  Área de membros
                </Link>
              </>
            ) : (
              <>
                <Link to="/entrar?continue=checkout" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-7 py-3 text-base font-bold text-[#111113] shadow-[0_8px_30px_rgba(255,255,255,.18)] transition hover:-translate-y-0.5 hover:bg-[#f2f2f3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:cursor-wait disabled:opacity-70 w-full sm:w-auto">
                  Assinar agora <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
                <Link to="/entrar" className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#929297] px-6 py-3 font-bold text-[#f7f7f5] transition hover:border-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white w-full sm:w-auto">
                  Entrar
                </Link>
                <Link
                  to="/entrar?mode=signup"
                  className="inline-flex min-h-12 items-center justify-center px-3 text-sm font-bold text-[#c8c8cc] underline-offset-4 hover:text-white hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                >
                  Criar conta
                </Link>
              </>
            )}
          </div>

          {user && displayName && (
            <p className="mt-5 text-sm text-[#a8a8ad]">
              Conectado como <span className="font-semibold text-[#d4d4d7]">{displayName}</span>
            </p>
          )}

          <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-[#a8a8ad]" aria-label="Vantagens">
            <li className="inline-flex items-center gap-1.5"><Check aria-hidden="true" className="h-4 w-4 text-emerald-400" />Acesso por 30 dias</li>
            <li className="inline-flex items-center gap-1.5"><Check aria-hidden="true" className="h-4 w-4 text-emerald-400" />Liberação automática</li>
            <li className="inline-flex items-center gap-1.5"><ShieldCheck aria-hidden="true" className="h-4 w-4 text-emerald-400" />Pagamento seguro InfinitePay</li>
          </ul>
          <p className="mt-3 text-xs text-[#77777d]">
            Pix e cartão. Apple Pay e Google Pay aparecem quando disponíveis no seu aparelho.
          </p>
          {checkoutError && (
            <p role="alert" className="mt-4 rounded-md border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
              {checkoutError}
            </p>
          )}
        </div>
      </section>

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-w-lg border-[#46464b] bg-[#111113] text-[#f7f7f5] sm:p-6">
          <DialogHeader>
            <DialogTitle className="pr-8 text-left text-xl">
              {needsCustomerDetails ? 'Complete seus dados' : 'Escolha a forma de pagamento'}
            </DialogTitle>
            <DialogDescription className="text-left text-[#c8c8cc]">
              {needsCustomerDetails
                ? 'Usaremos esses dados para preencher o pagamento da InfinitePay, sem pedir novamente no checkout.'
                : 'Selecione uma opção para continuar no ambiente seguro da InfinitePay. A disponibilidade depende da sua conta e dispositivo.'}
            </DialogDescription>
          </DialogHeader>
          {needsCustomerDetails ? (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="checkout-customer-name" className="text-[#f7f7f5]">Nome completo</Label>
                <Input
                  id="checkout-customer-name"
                  autoComplete="name"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  className="border-[#777c80] bg-[#202224] text-white"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="checkout-customer-phone" className="text-[#f7f7f5]">Celular (Brasil ou internacional)</Label>
                <Input
                  id="checkout-customer-phone"
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  className="border-[#777c80] bg-[#202224] text-white"
                />
              </div>
              <p className="text-sm text-[#c8c8cc]">E-mail usado na conta: {user?.email}</p>
              {checkoutError && <p role="alert" className="text-sm text-red-300">{checkoutError}</p>}
              <button
                type="button"
                onClick={() => void saveCustomerDetails()}
                disabled={checkoutBusy}
                className="inline-flex min-h-12 items-center justify-center rounded-sm border border-[#e6e6e8] bg-[#d4d4d7] px-4 py-3 font-bold text-[#111113] hover:bg-[#f2f2f3] disabled:opacity-60"
              >
                {checkoutBusy ? 'Preparando pagamento…' : 'Continuar'}
              </button>
            </div>
          ) : (
            <>
          <div className="grid gap-3">
            {['Google Pay', 'Apple Pay', 'Pix'].map((method) => (
              <button
                key={method}
                type="button"
                aria-pressed={selectedPaymentMethod === method}
                onClick={() => setSelectedPaymentMethod(method)}
                className={`inline-flex min-h-12 items-center justify-between rounded-sm border px-4 py-3 text-left font-bold text-[#f7f7f5] transition-colors hover:border-white hover:bg-[#303034] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white ${
                  selectedPaymentMethod === method ? 'border-white bg-[#303034]' : 'border-[#929297]'
                }`}
              >
                {method}
                <span aria-hidden="true" className={`flex h-4 w-4 items-center justify-center rounded-full border ${selectedPaymentMethod === method ? 'border-white' : 'border-[#929297]'}`}>
                  {selectedPaymentMethod === method && <span className="h-2 w-2 rounded-full bg-white" />}
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={!selectedPaymentMethod}
            onClick={() => {
              if (!selectedPaymentMethod) return
              setCheckoutOpen(false)
              window.location.assign(checkoutUrl)
            }}
            className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-sm border px-4 py-3 font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:cursor-not-allowed ${
              selectedPaymentMethod
                ? 'border-[#e6e6e8] bg-[#d4d4d7] text-[#111113] hover:bg-[#f2f2f3]'
                : 'cursor-not-allowed border-[#46464b] bg-[#242426] text-[#77777d]'
            }`}
          >
            Continuar para pagamento
            <ExternalLink aria-hidden="true" className="h-4 w-4" />
          </button>
            </>
          )}
        </DialogContent>
      </Dialog>

      <section
        id="catalog"
        aria-labelledby="catalog-heading"
        className="w-full border-y border-[#626267] bg-[#111113] py-12 sm:py-16"
      >
        <div className="mx-auto w-full max-w-[1220px] px-6 sm:px-8 lg:px-10">
          <div className="mb-8 max-w-2xl">
            <p className="mb-2 text-xs font-bold uppercase tracking-[.15em] text-[#c8c8cc]">
              Italo Santos · X
            </p>
            <h2 id="catalog-heading" className="text-3xl font-bold text-[#f7f7f5] sm:text-4xl">
              Vídeos e fotos publicados
            </h2>
            <p className="mt-3 text-[#c8c8cc]">
              Mídias reais da conta @{feed.username}, carregadas diretamente das publicações no X.
            </p>
          </div>

          {feed.error && (
            <p className="py-4 text-center text-sm text-[#c8c8cc]">
              {feed.error}
            </p>
          )}
          {!feed.loading && !feed.error && feed.posts.length === 0 && (
            <p className="py-6 text-center text-sm text-[#c8c8cc]">
              A conta não tem fotos ou vídeos próprios disponíveis para exibição no momento.
            </p>
          )}
          <XMediaGrid posts={feed.posts} username={feed.username} loading={feed.loading} />
        </div>
      </section>
    </div>
  )
}
