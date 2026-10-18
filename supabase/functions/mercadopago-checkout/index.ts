import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { z } from 'npm:zod@3'
import { database, json, mercadoPago, signedInUser } from '../_shared/mercadopago.ts'

const Body = z.object({ plan_id: z.string().uuid(), return_url: z.string().url() })

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const user = await signedInUser(req)
    if (!user?.email) return json({ error: 'Entre na sua conta para assinar.' }, 401)
    const parsed = Body.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return json({ error: 'Dados inválidos.' }, 400)
    const origin = req.headers.get('origin')
    const returnUrl = new URL(parsed.data.return_url)
    if (!origin || returnUrl.origin !== origin || returnUrl.protocol !== 'https:' || returnUrl.pathname !== '/membros') return json({ error: 'Endereço de retorno inválido.' }, 400)
    if (!Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') || !Deno.env.get('MERCADOPAGO_WEBHOOK_SECRET')) return json({ error: 'A confirmação automática do Mercado Pago ainda não foi configurada.' }, 503)
    const db = database()
    const { data: plan, error: planError } = await db.from('plans').select('*').eq('id', parsed.data.plan_id).eq('is_active', true).maybeSingle()
    if (planError) throw planError
    if (!plan?.mercadopago_url) return json({ error: 'Plano indisponível.' }, 400)
    const planUrl = new URL(plan.mercadopago_url)
    if (planUrl.protocol !== 'https:' || !/(^|\.)mercadopago\.com(\.br|\.ar|\.mx|\.co|\.pe|\.uy|\.cl)?$/.test(planUrl.hostname)) return json({ error: 'Cadastre o link do plano de assinatura do Mercado Pago.' }, 400)
    const providerPlanId = planUrl.searchParams.get('preapproval_plan_id')
    if (!providerPlanId || !/^[a-zA-Z0-9_-]{1,100}$/.test(providerPlanId)) return json({ error: 'O link deve conter preapproval_plan_id do plano Mercado Pago.' }, 400)
    const providerPlan = await mercadoPago(`/preapproval_plan/${encodeURIComponent(providerPlanId)}`)
    const terms = providerPlan.auto_recurring
    if (providerPlan.status !== 'active' || !terms || !(terms.transaction_amount > 0) || !terms.currency_id || !Number.isInteger(terms.frequency) || terms.frequency < 1 || !['days', 'months'].includes(terms.frequency_type)) return json({ error: 'Plano do Mercado Pago inativo ou sem cobrança válida.' }, 400)
    // Read prices from the actual provider plan, never from the display label.
    // A pending preapproval without a card token supplies its own hosted checkout.
    const recurring = { frequency: terms.frequency, frequency_type: terms.frequency_type, transaction_amount: terms.transaction_amount, currency_id: terms.currency_id }
    const { data: sub, error } = await db.from('subscriptions').insert({ user_id: user.id, plan_id: plan.id, provider: 'mercadopago', status: 'pending', expires_at: new Date().toISOString() }).select('id').single()
    if (error || !sub) throw error ?? new Error('Unable to create subscription')
    const { error: bindingError } = await db.from('mercadopago_checkouts').insert({ subscription_id: sub.id, provider_plan_id: providerPlanId, plan_terms: recurring })
    if (bindingError) throw bindingError
    let created
    try {
      created = await mercadoPago('/preapproval', { method: 'POST', headers: { 'X-Idempotency-Key': sub.id }, body: JSON.stringify({ reason: plan.name, external_reference: sub.id, payer_email: user.email, back_url: returnUrl.href, auto_recurring: recurring, status: 'pending' }) })
    } catch (error) {
      await db.from('subscriptions').update({ status: 'canceled' }).eq('id', sub.id)
      throw error
    }
    const checkout = new URL(created.init_point)
    if (checkout.protocol !== 'https:' || !/(^|\.)mercadopago\.com(\.br|\.ar|\.mx|\.co|\.pe|\.uy|\.cl)?$/.test(checkout.hostname)) throw new Error('Invalid provider checkout')
    const { error: updateError } = await db.from('subscriptions').update({ provider_subscription_id: String(created.id) }).eq('id', sub.id)
    if (updateError) throw updateError
    const { error: checkoutError } = await db.from('mercadopago_checkouts').update({ checkout_url: checkout.href }).eq('subscription_id', sub.id)
    if (checkoutError) throw checkoutError
    return json({ checkout_url: checkout.href })
  } catch (error) {
    console.error('Mercado Pago checkout failed', error instanceof Error ? error.message : 'Unknown error')
    return json({ error: 'Não foi possível iniciar a assinatura. Confira a configuração do Mercado Pago e tente novamente.' }, 502)
  }
})