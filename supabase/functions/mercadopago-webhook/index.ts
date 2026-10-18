import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { z } from 'npm:zod@3'
import { database, json, mercadoPago } from '../_shared/mercadopago.ts'
import { paidUntil, paymentGrantsAccess, verifySignature } from '../_shared/mercadopago-rules.ts'

const Notification = z.object({ type: z.string().max(100), data: z.object({ id: z.union([z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/), z.number().int().positive()]) }) })

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const secret = Deno.env.get('MERCADOPAGO_WEBHOOK_SECRET')
  if (!secret || !Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')) return json({ error: 'Webhook not configured' }, 503)
  try {
    const parsed = Notification.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return json({ error: 'Invalid notification' }, 400)
    const notification = parsed.data
    const dataId = new URL(req.url).searchParams.get('data.id')
    if (!dataId || dataId.toLowerCase() !== String(notification.data.id).toLowerCase()) return json({ error: 'Invalid resource identifier' }, 400)
    if (!await verifySignature(secret, req.headers.get('x-signature'), req.headers.get('x-request-id'), dataId)) return json({ error: 'Invalid signature' }, 401)
    if (!['subscription_preapproval', 'subscription_authorized_payment'].includes(notification.type)) return json({ received: true, ignored: true })
    const invoice = notification.type === 'subscription_authorized_payment' ? await mercadoPago(`/authorized_payments/${encodeURIComponent(dataId)}`) : null
    const preapprovalId = invoice ? String(invoice.preapproval_id ?? '') : dataId
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(preapprovalId)) return json({ error: 'Invalid subscription' }, 400)
    const preapproval = await mercadoPago(`/preapproval/${encodeURIComponent(preapprovalId)}`)
    const localId = z.string().uuid().safeParse(preapproval.external_reference)
    // Legacy/shared links cannot safely identify a member. Never match by email.
    if (!localId.success) return json({ received: true, ignored: true })
    const db = database()
    const { data: binding, error: bindingError } = await db.from('mercadopago_checkouts').select('plan_terms').eq('subscription_id', localId.data).maybeSingle()
    if (bindingError) throw bindingError
    if (!binding) return json({ received: true, ignored: true })
    const { data: sub, error: subError } = await db.from('subscriptions').select('id,provider_subscription_id').eq('id', localId.data).eq('provider', 'mercadopago').maybeSingle()
    if (subError) throw subError
    // Retry if creation has not yet saved the provider ID; no unsafe auto-binding.
    if (!sub?.provider_subscription_id) return json({ error: 'Checkout binding not ready' }, 503)
    if (sub.provider_subscription_id !== preapprovalId) return json({ error: 'Subscription mismatch' }, 400)
    const terms = binding.plan_terms
    if (!terms || preapproval.auto_recurring?.transaction_amount !== terms.transaction_amount || preapproval.auto_recurring?.currency_id !== terms.currency_id) return json({ error: 'Plan mismatch' }, 400)
    const updated = preapproval.last_modified ?? preapproval.date_created
    if (!updated || !Number.isFinite(Date.parse(updated))) throw new Error('Invalid provider modification date')
    const { error: lifecycleError } = await db.rpc('sync_mercadopago_lifecycle', { p_subscription_id: sub.id, p_provider_subscription_id: preapprovalId, p_status: preapproval.status, p_updated_at: updated })
    if (lifecycleError) throw lifecycleError
    if (!invoice?.payment?.id) return json({ received: true })
    const paymentId = String(invoice.payment.id)
    if (!/^\d+$/.test(paymentId)) return json({ error: 'Invalid payment' }, 400)
    // Query current payment state, including refunds/chargebacks, not payload claims.
    const payment = await mercadoPago(`/v1/payments/${paymentId}`)
    if (payment.transaction_amount !== terms.transaction_amount || payment.currency_id !== terms.currency_id) return json({ error: 'Payment mismatch' }, 400)
    const approved = paymentGrantsAccess(payment, terms)
    const approvedAt = approved ? payment.date_approved : null
    if (approved && (!approvedAt || !Number.isFinite(Date.parse(approvedAt)))) throw new Error('Missing approval date')
    const cycleStart = invoice.debit_date && Number.isFinite(Date.parse(invoice.debit_date)) ? invoice.debit_date : approvedAt
    const until = approved ? paidUntil(cycleStart, terms.frequency, terms.frequency_type) : null
    const paymentUpdated = payment.date_last_updated ?? payment.date_created
    if (!paymentUpdated || !Number.isFinite(Date.parse(paymentUpdated))) throw new Error('Invalid payment modification date')
    const { error } = await db.rpc('apply_mercadopago_charge', { p_subscription_id: sub.id, p_provider_subscription_id: preapprovalId, p_payment_id: paymentId, p_status: payment.status, p_approved_at: approvedAt, p_paid_until: until, p_updated_at: paymentUpdated })
    if (error) throw error
    return json({ received: true })
  } catch (error) {
    console.error('Mercado Pago webhook processing failed', error instanceof Error ? error.message : 'Unknown error')
    // Never acknowledge failed database/provider operations: Mercado Pago must retry.
    return json({ error: 'Notification processing temporarily unavailable' }, 503)
  }
})