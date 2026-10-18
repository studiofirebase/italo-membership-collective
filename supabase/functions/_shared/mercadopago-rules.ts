export async function verifySignature(secret: string, signature: string | null, requestId: string | null, dataId: string, now = Date.now()) {
  if (!signature || !requestId || !dataId) return false
  const parts = signature.split(',').map(part => part.trim().split('='))
  const ts = parts.find(([key]) => key === 'ts')?.[1]
  const digest = parts.find(([key]) => key === 'v1')?.[1]
  if (!ts || !/^\d+$/.test(ts) || !digest || !/^[a-f0-9]{64}$/i.test(digest)) return false
  const timestamp = Number(ts) * (ts.length <= 10 ? 1000 : 1)
  // Delivery timestamp, not event creation time. Retries receive fresh signatures.
  if (Math.abs(now - timestamp) > 10 * 60 * 1000) return false
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
  const bytes = Uint8Array.from(digest.match(/.{2}/g) ?? [], hex => parseInt(hex, 16))
  return crypto.subtle.verify('HMAC', key, bytes, new TextEncoder().encode(manifest))
}

export function paidUntil(date: string, frequency: number, type: string) {
  const start = new Date(date)
  if (!Number.isFinite(start.getTime()) || !Number.isInteger(frequency) || frequency < 1 || !['days', 'months'].includes(type)) throw new Error('Invalid billing period')
  if (type === 'days') start.setUTCDate(start.getUTCDate() + frequency)
  else {
    const day = start.getUTCDate()
    start.setUTCDate(1)
    start.setUTCMonth(start.getUTCMonth() + frequency)
    const last = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate()
    start.setUTCDate(Math.min(day, last))
  }
  return start.toISOString()
}

export function paymentGrantsAccess(payment: { status?: string; transaction_amount?: number; currency_id?: string }, terms: { transaction_amount: number; currency_id: string }) {
  return payment.status === 'approved' && payment.transaction_amount === terms.transaction_amount && payment.currency_id === terms.currency_id
}