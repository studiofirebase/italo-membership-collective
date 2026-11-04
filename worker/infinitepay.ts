import { HttpError, json, nowIso, type Env } from './lib'
import { requireUser } from './auth'

const DEFAULT_CHECKOUT_URL = 'https://checkout.infinitepay.io/italosevere/WKqeO7qiL8'
const ACCESS_DAYS = 30

function priceInCents(priceLabel: string | null) {
  const match = priceLabel?.match(/R\$\s*((?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?)(?=$|[^\d.,])/i)
  if (!match) throw new Error('O plano precisa ter um preço no formato R$ 29,90.')
  const cents = Math.round(Number(match[1].replace(/\./g, '').replace(',', '.')) * 100)
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new Error('O preço configurado para o plano é inválido.')
  return cents
}

function infinitePayHandle(configuredUrl: string | null) {
  const url = new URL(configuredUrl?.trim() || DEFAULT_CHECKOUT_URL)
  const host = url.hostname.toLowerCase()
  if (url.protocol !== 'https:' || url.username || url.password || !host.endsWith('infinitepay.io')) {
    throw new Error('O link configurado não é um checkout InfinitePay válido.')
  }
  const parts = url.pathname.split('/').filter(Boolean)
  const handle = parts[0] === 'plans' ? parts[1] : parts[0]
  if (!handle || !/^[a-zA-Z0-9_-]{1,80}$/.test(handle)) {
    throw new Error('Não foi possível identificar a conta InfinitePay do plano.')
  }
  return handle
}

export async function handleCheckout(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') throw new HttpError(405, 'method_not_allowed', 'Método não permitido.')
  const user = await requireUser(request, env)
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  const requestedName = typeof body.customer_name === 'string' ? body.customer_name.trim() : ''
  const requestedPhone = typeof body.phone_number === 'string' ? body.phone_number.trim().replace(/(?!^\+)\D/g, '') : ''
  const requestedDigits = requestedPhone.replace(/\D/g, '')
  if (requestedName.length > 120 || requestedDigits.length > 15 || (requestedDigits.length > 0 && requestedDigits.length < 8)) {
    return json({ error: 'Dados do cliente inválidos.' }, 400)
  }

  const plan = await env.DB.prepare(
    'SELECT id, name, price_label, infinitepay_url FROM plans WHERE is_active = 1 ORDER BY sort_order ASC LIMIT 1',
  ).first<{ id: string; name: string; price_label: string | null; infinitepay_url: string | null }>()
  if (!plan) return json({ error: 'Não há um plano ativo para assinar.' }, 404)

  const customerName = requestedName || user.full_name?.trim() || ''
  const phone = requestedPhone || user.phone || ''
  const normalizedPhone = phone.replace(/\D/g, '')
  const isInternational = phone.trim().startsWith('+') && !normalizedPhone.startsWith('55')
  if (normalizedPhone.length < (isInternational ? 8 : 10) || normalizedPhone.length > 15) {
    return json({ error: 'Informe um telefone válido antes de continuar.' }, 400)
  }
  if (customerName.length < 2) return json({ error: 'Informe seu nome antes de continuar.' }, 400)

  let subscriptionId: string | null = null
  try {
    const amount = priceInCents(plan.price_label)
    const handle = infinitePayHandle(plan.infinitepay_url)
    const phoneForCheckout =
      isInternational || normalizedPhone.length > 11 ? `+${normalizedPhone}` : `+55${normalizedPhone}`

    subscriptionId = crypto.randomUUID()
    await env.DB.batch([
      env.DB.prepare("INSERT INTO subscriptions (id, user_id, plan_id, provider, status) VALUES (?1, ?2, ?3, 'infinitepay', 'pending')")
        .bind(subscriptionId, user.id, plan.id),
      env.DB.prepare('INSERT INTO infinitepay_checkouts (subscription_id, order_nsu, handle, amount) VALUES (?1, ?1, ?2, ?3)')
        .bind(subscriptionId, handle, amount),
    ])

    const origin = (env.PUBLIC_URL ?? new URL(request.url).origin).replace(/\/+$/, '')
    const providerResponse = await fetch('https://api.checkout.infinitepay.io/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        handle,
        order_nsu: subscriptionId,
        webhook_url: `${origin}/api/infinitepay-webhook`,
        items: [{ quantity: 1, price: amount, description: `${plan.name} · ${ACCESS_DAYS} dias` }],
        customer: { name: customerName, email: user.email, phone_number: phoneForCheckout },
      }),
    })
    if (!providerResponse.ok) throw new Error(`InfinitePay returned ${providerResponse.status}.`)
    const result: unknown = await providerResponse.json()
    if (typeof result !== 'object' || result === null || !('url' in result) || typeof result.url !== 'string') {
      throw new Error('InfinitePay returned an invalid checkout URL.')
    }
    const checkoutUrl = new URL(result.url)
    if (
      checkoutUrl.protocol !== 'https:' ||
      !['checkout.infinitepay.io', 'checkout.infinitepay.com.br'].includes(checkoutUrl.hostname.toLowerCase())
    ) {
      throw new Error('InfinitePay returned an untrusted checkout URL.')
    }
    return json({ checkout_url: checkoutUrl.href })
  } catch (error) {
    console.error('InfinitePay checkout link creation failed.', error instanceof Error ? error.message : 'Unknown error')
    if (subscriptionId) {
      await env.DB.prepare("UPDATE subscriptions SET status = 'canceled' WHERE id = ?1 AND status = 'pending'")
        .bind(subscriptionId).run()
    }
    return json({ error: 'Não foi possível preparar o pagamento. Confira o preço e a configuração do plano.' }, 502)
  }
}

type Webhook = {
  invoice_slug: string
  amount: number
  paid_amount: number
  capture_method: 'pix' | 'credit_card'
  transaction_nsu: string
  order_nsu: string
}

function parseWebhook(value: unknown): Webhook | null {
  if (typeof value !== 'object' || value === null) return null
  const body = value as Record<string, unknown>
  if (
    typeof body.invoice_slug !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(body.invoice_slug) ||
    typeof body.order_nsu !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.order_nsu) ||
    typeof body.transaction_nsu !== 'string' || !/^[a-zA-Z0-9_-]{8,128}$/.test(body.transaction_nsu) ||
    !Number.isSafeInteger(body.amount) || !Number.isSafeInteger(body.paid_amount) ||
    (body.amount as number) <= 0 || (body.paid_amount as number) < (body.amount as number) ||
    (body.capture_method !== 'pix' && body.capture_method !== 'credit_card')
  ) return null
  return body as Webhook
}

export async function handleWebhook(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
  try {
    const payload = parseWebhook(await request.json().catch(() => null))
    if (!payload) return json({ error: 'Invalid payment notification.' }, 400)

    const checkout = await env.DB.prepare(
      'SELECT subscription_id, handle, amount, paid_at, transaction_nsu FROM infinitepay_checkouts WHERE order_nsu = ?1',
    ).bind(payload.order_nsu).first<{ subscription_id: string; handle: string; amount: number; paid_at: string | null; transaction_nsu: string | null }>()
    if (!checkout) return json({ error: 'Unknown payment order.' }, 404)
    if (checkout.amount !== payload.amount) return json({ error: 'Payment amount mismatch.' }, 400)
    if (checkout.paid_at) {
      return checkout.transaction_nsu === payload.transaction_nsu
        ? json({ received: true })
        : json({ error: 'Subscription order could not be activated.' }, 409)
    }

    const verification = await fetch('https://api.checkout.infinitepay.io/payment_check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        handle: checkout.handle,
        order_nsu: payload.order_nsu,
        transaction_nsu: payload.transaction_nsu,
        slug: payload.invoice_slug,
      }),
    })
    if (!verification.ok) {
      console.error('InfinitePay payment_check failed.', verification.status)
      return json({ error: 'Payment verification is temporarily unavailable.' }, 400)
    }
    const check = (await verification.json()) as Record<string, unknown> | null
    if (!check || check.amount !== checkout.amount || check.success !== true || check.paid !== true) {
      return json({ error: 'Payment is not confirmed.' }, 400)
    }

    const now = new Date()
    const expires = new Date(now.getTime() + ACCESS_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const activated = await env.DB.prepare(
      `UPDATE subscriptions
       SET status = 'active', started_at = COALESCE(started_at, ?2), expires_at = ?3
       WHERE id = ?1 AND provider = 'infinitepay' AND status = 'pending'`,
    ).bind(checkout.subscription_id, now.toISOString(), expires).run()
    if (!activated.meta.changes) {
      const current = await env.DB.prepare('SELECT status FROM subscriptions WHERE id = ?1')
        .bind(checkout.subscription_id).first<{ status: string }>()
      if (current?.status !== 'active') return json({ error: 'Subscription order could not be activated.' }, 409)
    }
    await env.DB.prepare(
      `UPDATE infinitepay_checkouts
       SET transaction_nsu = ?2, invoice_slug = ?3, capture_method = ?4, paid_amount = ?5, paid_at = ?6
       WHERE subscription_id = ?1 AND paid_at IS NULL`,
    ).bind(checkout.subscription_id, payload.transaction_nsu, payload.invoice_slug, payload.capture_method, payload.paid_amount, nowIso()).run()
    return json({ received: true })
  } catch (error) {
    console.error('InfinitePay webhook processing failed.', error instanceof Error ? error.message : 'Unknown error')
    return json({ error: 'Payment confirmation is temporarily unavailable.' }, 400)
  }
}
