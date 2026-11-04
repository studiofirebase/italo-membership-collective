export interface Env {
  DB: D1Database
  MEDIA?: R2Bucket
  ASSETS: Fetcher
  JWT_SECRET: string
  ADMIN_EMAILS?: string
  PUBLIC_URL?: string
  MEMBERSHIP_TWITTER_USERNAME?: string
  MEMBERSHIP_TWITTER_BEARER_TOKEN?: string
  X_FEED_FALLBACK_URL?: string
}

export type SessionUser = {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  is_admin: boolean
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
  }
}

export function json(body: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  })
}

export function errorResponse(error: unknown) {
  if (error instanceof HttpError) {
    return json({ error: { code: error.code, message: error.message } }, error.status)
  }
  console.error('Unhandled error', error instanceof Error ? error.message : 'Unknown error')
  return json({ error: { code: 'internal_error', message: 'Erro interno.' } }, 500)
}

export const nowIso = () => new Date().toISOString()

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function entitlementSql(userParam: string, nowParam: string) {
  return `EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id = ${userParam} AND s.status = 'active' AND (s.expires_at IS NULL OR s.expires_at > ${nowParam}))`
}
