export type User = {
  id: string
  email: string
  phone: string
  user_metadata: { full_name?: string; phone_number?: string; phone?: string }
}
export type Session = { user: User }
export type ApiError = Error & { code: string; status: number }

type Filter = { column: string; value: unknown }
type Op = 'select' | 'insert' | 'update' | 'delete'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Result<T = any> = { data: T; error: ApiError | null }

function createError(message: string, code: string, status: number): ApiError {
  return Object.assign(new Error(message), { code, status, name: 'ApiError' })
}

async function call(path: string, init: RequestInit = {}) {
  try {
    const response = await fetch(path, {
      credentials: 'same-origin',
      ...init,
      headers: {
        ...(init.body && typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      const detail = payload?.error
      const message = typeof detail === 'string' ? detail : detail?.message ?? 'Erro na requisição.'
      const code = typeof detail === 'object' && detail?.code ? detail.code : `http_${response.status}`
      return { payload, error: createError(message, code, response.status) }
    }
    return { payload, error: null }
  } catch {
    return { payload: null, error: createError('Failed to fetch', 'network_error', 0) }
  }
}

class QueryBuilder implements PromiseLike<Result> {
  private op: Op = 'select'
  private columns = '*'
  private filters: Filter[] = []
  private orderBy: { column: string; ascending: boolean } | null = null
  private limitTo: number | null = null
  private values: Record<string, unknown> = {}
  private mode: 'many' | 'maybe' | 'single' = 'many'

  constructor(private table: string) {}

  select(columns = '*') {
    this.columns = columns
    return this
  }
  insert(values: Record<string, unknown>) {
    this.op = 'insert'
    this.values = values
    return this
  }
  update(values: Record<string, unknown>) {
    this.op = 'update'
    this.values = values
    return this
  }
  delete() {
    this.op = 'delete'
    return this
  }
  eq(column: string, value: unknown) {
    this.filters.push({ column, value })
    return this
  }
  order(column: string, options: { ascending?: boolean } = {}) {
    this.orderBy = { column, ascending: options.ascending ?? true }
    return this
  }
  limit(count: number) {
    this.limitTo = count
    return this
  }
  maybeSingle() {
    this.mode = 'maybe'
    return this
  }
  single() {
    this.mode = 'single'
    return this
  }

  private async run(): Promise<Result> {
    const { payload, error } = await call('/api/db', {
      method: 'POST',
      body: JSON.stringify({
        table: this.table,
        op: this.op,
        columns: this.columns,
        filters: this.filters,
        order: this.orderBy,
        limit: this.mode === 'many' ? this.limitTo : 1,
        values: this.values,
      }),
    })
    if (error) return { data: null, error }
    const rows: unknown[] = payload?.data ?? []
    if (this.mode === 'many') return { data: rows, error: null }
    if (this.mode === 'single' && rows.length !== 1) {
      return { data: null, error: createError('Nenhum registro encontrado.', 'not_found', 406) }
    }
    return { data: rows[0] ?? null, error: null }
  }

  then<A = Result, B = never>(
    onfulfilled?: ((value: Result) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ) {
    return this.run().then(onfulfilled, onrejected)
  }
}

type AuthListener = (event: string, session: Session | null) => void
const listeners = new Set<AuthListener>()
let cachedSession: Session | null | undefined

function emit(event: string, session: Session | null) {
  cachedSession = session
  listeners.forEach((listener) => listener(event, session))
}

const auth = {
  async getSession(): Promise<{ data: { session: Session | null } }> {
    if (cachedSession === undefined) {
      const { payload } = await call('/api/auth/session')
      cachedSession = payload?.user ? { user: payload.user as User } : null
    }
    return { data: { session: cachedSession } }
  },
  onAuthStateChange(listener: AuthListener) {
    listeners.add(listener)
    return { data: { subscription: { unsubscribe: () => listeners.delete(listener) } } }
  },
  async signUp(args: { email: string; password: string; options?: { data?: Record<string, unknown>; emailRedirectTo?: string } }) {
    const { payload, error } = await call('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email: args.email, password: args.password, ...args.options?.data }),
    })
    if (error) return { data: { user: null, session: null }, error }
    const session = { user: payload.user as User }
    emit('SIGNED_IN', session)
    return { data: { user: session.user, session }, error: null }
  },
  async signInWithPassword(args: { email: string; password: string }) {
    const { payload, error } = await call('/api/auth/signin', { method: 'POST', body: JSON.stringify(args) })
    if (error) return { data: { user: null, session: null }, error }
    const session = { user: payload.user as User }
    emit('SIGNED_IN', session)
    return { data: { user: session.user, session }, error: null }
  },
  async signOut() {
    await call('/api/auth/signout', { method: 'POST' })
    emit('SIGNED_OUT', null)
    return { error: null }
  },
  async updateUser(args: { data: Record<string, unknown> }) {
    const { payload, error } = await call('/api/auth/update', { method: 'POST', body: JSON.stringify(args) })
    if (error) return { error }
    emit('USER_UPDATED', { user: payload.user as User })
    return { error: null }
  },
}

const MEDIA = '/api/media/'

const storage = {
  from(_bucket: string) {
    return {
      upload(
        path: string,
        file: File,
        options: { contentType?: string; onProgress?: (sent: number) => void } = {},
      ): Promise<{ error: ApiError | null }> {
        return new Promise((resolve) => {
          const xhr = new XMLHttpRequest()
          xhr.open('PUT', MEDIA + path)
          xhr.setRequestHeader('Content-Type', options.contentType ?? file.type)
          xhr.upload.onprogress = (event) => options.onProgress?.(event.loaded)
          xhr.onerror = () => resolve({ error: createError('Failed to fetch', 'network_error', 0) })
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) return resolve({ error: null })
            let message = 'Falha no envio do arquivo.'
            try {
              message = JSON.parse(xhr.responseText)?.error?.message ?? message
            } catch {
              /* resposta sem JSON */
            }
            resolve({ error: createError(message, `http_${xhr.status}`, xhr.status) })
          }
          xhr.send(file)
        })
      },
      async remove(paths: string[]) {
        const { error } = await call(`${MEDIA}remove`, { method: 'POST', body: JSON.stringify({ paths }) })
        return { error }
      },
      async list(prefix: string, _options?: Record<string, unknown>) {
        const { payload, error } = await call(`${MEDIA}list?prefix=${encodeURIComponent(prefix)}`)
        return { data: (payload?.data ?? []) as Array<{ name: string }>, error }
      },
      async createSignedUrl(path: string, _expiresIn?: number) {
        return { data: { signedUrl: MEDIA + path }, error: null }
      },
    }
  },
}

const functions = {
  async invoke<T>(name: string, options: { method?: 'GET' | 'POST'; body?: unknown } = {}) {
    const method = options.method ?? 'POST'
    const { payload, error } = await call(`/api/${name}`, {
      method,
      body: method === 'POST' ? JSON.stringify(options.body ?? {}) : undefined,
    })
    return { data: (payload ?? null) as T | null, error }
  },
}

export const api = {
  auth,
  storage,
  functions,
  from: (table: string) => new QueryBuilder(table),
  async rpc(name: string) {
    const { payload, error } = await call(`/api/rpc/${name}`, { method: 'POST', body: '{}' })
    return { data: error ? null : payload?.data ?? [], error }
  },
}
