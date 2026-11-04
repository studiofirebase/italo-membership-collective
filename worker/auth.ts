import { HttpError, json, nowIso, type Env, type SessionUser } from './lib'

const SESSION_COOKIE = 'session'
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30
const PBKDF2_ITERATIONS = 100_000
const encoder = new TextEncoder()

function toBase64Url(bytes: ArrayBuffer | Uint8Array) {
  const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ''
  for (const byte of array) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0))
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  return new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256),
  )
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS)
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(hash)}`
}

export async function verifyPassword(password: string, stored: string | null) {
  const [scheme, iterations, salt, hash] = (stored ?? '').split('$')
  if (scheme !== 'pbkdf2' || !iterations || !salt || !hash) {
    // Gasta o mesmo tempo para não revelar se o e-mail existe.
    await pbkdf2(password, new Uint8Array(16), PBKDF2_ITERATIONS)
    return false
  }
  const derived = await pbkdf2(password, fromBase64Url(salt), Number(iterations))
  return timingSafeEqual(derived, fromBase64Url(hash))
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

export async function signToken(secret: string, payload: Record<string, unknown>) {
  const header = toBase64Url(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)))
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(`${header}.${body}`))
  return `${header}.${body}.${toBase64Url(signature)}`
}

export async function verifyToken(secret: string, token: string) {
  const [header, body, signature] = token.split('.')
  if (!header || !body || !signature) return null
  const valid = await crypto.subtle.verify(
    'HMAC',
    await hmacKey(secret),
    fromBase64Url(signature),
    encoder.encode(`${header}.${body}`),
  )
  if (!valid) return null
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as { sub?: string; exp?: number }
    if (!payload.sub || !payload.exp || payload.exp < Date.now() / 1000) return null
    return payload as { sub: string; exp: number }
  } catch {
    return null
  }
}

function readCookie(request: Request, name: string) {
  const header = request.headers.get('Cookie') ?? ''
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return rest.join('=')
  }
  return null
}

function cookie(request: Request, name: string, value: string, maxAge: number) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : ''
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`
}

export function adminEmails(env: Env) {
  return (env.ADMIN_EMAILS ?? '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean)
}

export async function getSessionUser(request: Request, env: Env): Promise<SessionUser | null> {
  if (!env.JWT_SECRET) throw new HttpError(503, 'not_configured', 'JWT_SECRET não configurado.')
  const token = readCookie(request, SESSION_COOKIE)
  if (!token) return null
  const payload = await verifyToken(env.JWT_SECRET, token)
  if (!payload) return null
  const row = await env.DB.prepare(
    `SELECT u.id, u.email, u.full_name, u.phone,
            EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = 'admin') AS is_admin
     FROM users u WHERE u.id = ?1`,
  ).bind(payload.sub).first<{ id: string; email: string; full_name: string | null; phone: string | null; is_admin: number }>()
  if (!row) return null
  return { id: row.id, email: row.email, full_name: row.full_name, phone: row.phone, is_admin: Boolean(row.is_admin) }
}

export async function requireUser(request: Request, env: Env) {
  const user = await getSessionUser(request, env)
  if (!user) throw new HttpError(401, 'not_authenticated', 'Entre na sua conta para continuar.')
  return user
}

export async function requireAdmin(request: Request, env: Env) {
  const user = await requireUser(request, env)
  if (!user.is_admin) throw new HttpError(403, 'forbidden', 'Acesso restrito a administradores.')
  return user
}

export function publicUser(user: SessionUser) {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone ?? '',
    user_metadata: { full_name: user.full_name ?? '', phone_number: user.phone ?? '' },
  }
}

async function sessionResponse(request: Request, env: Env, user: SessionUser, extra: Record<string, unknown> = {}) {
  const token = await signToken(env.JWT_SECRET, {
    sub: user.id,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  })
  return json({ user: publicUser(user), ...extra }, 200, {
    'Set-Cookie': cookie(request, SESSION_COOKIE, token, SESSION_TTL_SECONDS),
  })
}

async function ensureRole(env: Env, userId: string, email: string) {
  const wantsAdmin = adminEmails(env).includes(email.toLowerCase())
  await env.DB.prepare('INSERT OR IGNORE INTO user_roles (id, user_id, role) VALUES (?1, ?2, ?3)')
    .bind(crypto.randomUUID(), userId, wantsAdmin ? 'admin' : 'user')
    .run()
}

async function loadSessionUser(env: Env, userId: string) {
  const row = await env.DB.prepare(
    `SELECT u.id, u.email, u.full_name, u.phone,
            EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = 'admin') AS is_admin
     FROM users u WHERE u.id = ?1`,
  ).bind(userId).first<{ id: string; email: string; full_name: string | null; phone: string | null; is_admin: number }>()
  if (!row) throw new HttpError(500, 'internal_error', 'Usuário não encontrado.')
  return { ...row, is_admin: Boolean(row.is_admin) } as SessionUser
}

async function checkAttempts(env: Env, key: string) {
  const row = await env.DB.prepare('SELECT failures, window_started_at FROM auth_attempts WHERE key = ?1')
    .bind(key).first<{ failures: number; window_started_at: number }>()
  const windowMs = 15 * 60 * 1000
  if (row && Date.now() - row.window_started_at < windowMs && row.failures >= 8) {
    throw new HttpError(429, 'over_request_rate_limit', 'Muitas tentativas. Aguarde alguns minutos.')
  }
}

async function recordFailure(env: Env, key: string) {
  const windowMs = 15 * 60 * 1000
  await env.DB.prepare(
    `INSERT INTO auth_attempts (key, failures, window_started_at) VALUES (?1, 1, ?2)
     ON CONFLICT(key) DO UPDATE SET
       failures = CASE WHEN ?2 - window_started_at >= ?3 THEN 1 ELSE failures + 1 END,
       window_started_at = CASE WHEN ?2 - window_started_at >= ?3 THEN ?2 ELSE window_started_at END`,
  ).bind(key, Date.now(), windowMs).run()
}

async function readBody(request: Request) {
  const body = await request.json().catch(() => null)
  if (typeof body !== 'object' || body === null) throw new HttpError(400, 'bad_request', 'Requisição inválida.')
  return body as Record<string, unknown>
}

const str = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '')

export async function handleAuth(request: Request, env: Env, path: string): Promise<Response> {
  if (!env.JWT_SECRET) throw new HttpError(503, 'not_configured', 'JWT_SECRET não configurado.')

  if (path === '/session' && request.method === 'GET') {
    const user = await getSessionUser(request, env)
    return json({ user: user ? publicUser(user) : null, is_admin: user?.is_admin ?? false })
  }

  if (path === '/signout' && request.method === 'POST') {
    return json({ ok: true }, 200, { 'Set-Cookie': cookie(request, SESSION_COOKIE, '', 0) })
  }

  if (path === '/signup' && request.method === 'POST') {
    const body = await readBody(request)
    const email = str(body.email, 254).toLowerCase()
    const password = typeof body.password === 'string' ? body.password : ''
    const fullName = str(body.full_name, 120)
    const phone = str(body.phone_number, 32)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      throw new HttpError(400, 'email_address_invalid', 'E-mail inválido.')
    }
    if (password.length < 6 || password.length > 200) {
      throw new HttpError(422, 'weak_password', 'A senha deve ter de 6 a 200 caracteres.')
    }
    const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?1').bind(email).first()
    if (existing) throw new HttpError(422, 'user_already_exists', 'User already registered')

    const id = crypto.randomUUID()
    const passwordHash = await hashPassword(password)
    await env.DB.batch([
      env.DB.prepare('INSERT INTO users (id, email, password_hash, full_name, phone) VALUES (?1, ?2, ?3, ?4, ?5)')
        .bind(id, email, passwordHash, fullName || email.split('@')[0], phone || null),
      env.DB.prepare('INSERT INTO profiles (id, display_name, email) VALUES (?1, ?2, ?3)')
        .bind(id, fullName || email.split('@')[0], email),
    ])
    await ensureRole(env, id, email)
    return sessionResponse(request, env, await loadSessionUser(env, id))
  }

  if (path === '/signin' && request.method === 'POST') {
    const body = await readBody(request)
    const email = str(body.email, 254).toLowerCase()
    const password = typeof body.password === 'string' ? body.password : ''
    const ip = request.headers.get('CF-Connecting-IP') ?? 'local'
    const attemptKeys = [`email:${email}`, `ip:${ip}`]
    for (const key of attemptKeys) await checkAttempts(env, key)

    const row = await env.DB.prepare('SELECT id, password_hash FROM users WHERE email = ?1')
      .bind(email).first<{ id: string; password_hash: string | null }>()
    const valid = await verifyPassword(password, row?.password_hash ?? null)
    if (!row || !valid) {
      for (const key of attemptKeys) await recordFailure(env, key)
      throw new HttpError(400, 'invalid_credentials', 'Invalid login credentials')
    }
    await env.DB.prepare('DELETE FROM auth_attempts WHERE key = ?1').bind(attemptKeys[0]).run()
    await ensureRole(env, row.id, email)
    return sessionResponse(request, env, await loadSessionUser(env, row.id))
  }

  if (path === '/update' && request.method === 'POST') {
    const user = await requireUser(request, env)
    const body = await readBody(request)
    const data = (typeof body.data === 'object' && body.data !== null ? body.data : {}) as Record<string, unknown>
    const fullName = str(data.full_name, 120)
    const phone = str(data.phone_number, 32)
    await env.DB.batch([
      env.DB.prepare('UPDATE users SET full_name = COALESCE(NULLIF(?1, \'\'), full_name), phone = COALESCE(NULLIF(?2, \'\'), phone) WHERE id = ?3')
        .bind(fullName, phone, user.id),
      env.DB.prepare('UPDATE profiles SET display_name = COALESCE(NULLIF(?1, \'\'), display_name) WHERE id = ?2')
        .bind(fullName, user.id),
    ])
    return json({ user: publicUser(await loadSessionUser(env, user.id)) })
  }

  throw new HttpError(404, 'not_found', 'Rota não encontrada.')
}

