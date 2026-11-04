import { HttpError, UUID_RE, entitlementSql, json, nowIso, type Env, type SessionUser } from './lib'
import { getSessionUser } from './auth'

type Op = 'select' | 'insert' | 'update' | 'delete'
type Filter = { column: string; value: unknown }
type Query = {
  table: string
  op: Op
  columns?: string
  filters?: Filter[]
  order?: { column: string; ascending: boolean } | null
  limit?: number | null
  values?: Record<string, unknown>
  returning?: boolean
}

type TableRule = {
  columns: string[]
  booleans?: string[]
  json?: string[]
  generateId?: boolean
  // Colunas de dono: usuários comuns só enxergam/alteram linhas com owner = id da sessão.
  owner?: string
  publicSelect?: string
  adminOnlySelect?: boolean
  userInsert?: Record<string, unknown>
  userUpdate?: { where: string; set: Record<string, unknown> }
  userUpdateOwnColumns?: string[]
  adminWrite: boolean
}

const TABLES: Record<string, TableRule> = {
  plans: {
    columns: ['id', 'name', 'price_label', 'tagline', 'features', 'infinitepay_url', 'mercadopago_url', 'is_active', 'sort_order', 'created_at'],
    booleans: ['is_active'],
    json: ['features'],
    generateId: true,
    publicSelect: 'is_active = 1',
    adminWrite: true,
  },
  videos: {
    columns: ['id', 'title', 'description', 'thumbnail_url', 'video_url', 'access_type', 'price_label', 'purchase_url', 'is_published', 'sort_order', 'created_at'],
    booleans: ['is_published'],
    generateId: true,
    adminOnlySelect: true,
    adminWrite: true,
  },
  subscriptions: {
    columns: ['id', 'user_id', 'plan_id', 'provider', 'status', 'started_at', 'expires_at', 'created_at'],
    owner: 'user_id',
    userUpdate: { where: "status = 'pending'", set: { status: 'canceled' } },
    adminWrite: true,
  },
  purchases: {
    columns: ['id', 'user_id', 'video_id', 'provider', 'status', 'created_at'],
    generateId: true,
    owner: 'user_id',
    userInsert: { status: 'pending' },
    userUpdate: { where: "status = 'pending'", set: { status: 'canceled' } },
    adminWrite: true,
  },
  profiles: {
    columns: ['id', 'display_name', 'avatar_url', 'email', 'created_at'],
    owner: 'id',
    userUpdateOwnColumns: ['display_name', 'avatar_url'],
    adminWrite: false,
  },
  user_roles: {
    columns: ['id', 'user_id', 'role'],
    owner: 'user_id',
    adminWrite: false,
  },
}

function ident(rule: TableRule, column: string) {
  if (!rule.columns.includes(column)) throw new HttpError(400, 'bad_request', `Coluna inválida: ${column}`)
  return `"${column}"`
}

function serialize(rule: TableRule, column: string, value: unknown) {
  if (value === undefined) return null
  if (rule.booleans?.includes(column)) return value ? 1 : 0
  if (rule.json?.includes(column)) return JSON.stringify(value ?? [])
  if (typeof value === 'boolean') return value ? 1 : 0
  if (value !== null && typeof value === 'object') return JSON.stringify(value)
  return value
}

function deserialize(rule: TableRule, row: Record<string, unknown>) {
  const out = { ...row }
  for (const column of rule.booleans ?? []) if (column in out) out[column] = Boolean(out[column])
  for (const column of rule.json ?? []) {
    if (typeof out[column] === 'string') {
      try {
        out[column] = JSON.parse(out[column] as string)
      } catch {
        out[column] = []
      }
    }
  }
  return out
}

function selectList(rule: TableRule, columns: string | undefined) {
  if (!columns || columns.trim() === '*') return rule.columns.map((c) => `"${c}"`).join(', ')
  return columns.split(',').map((c) => ident(rule, c.trim())).join(', ')
}

export async function handleDb(request: Request, env: Env): Promise<Response> {
  const user = await getSessionUser(request, env)
  const body = (await request.json().catch(() => null)) as Query | null
  if (!body || typeof body.table !== 'string' || !(body.table in TABLES)) {
    throw new HttpError(400, 'bad_request', 'Consulta inválida.')
  }
  const rule = TABLES[body.table]
  const table = body.table
  const op = body.op
  const filters = Array.isArray(body.filters) ? body.filters : []
  const isAdmin = Boolean(user?.is_admin)

  const where: string[] = []
  const params: unknown[] = []
  const bind = (value: unknown) => {
    params.push(value)
    return `?${params.length}`
  }
  for (const filter of filters) {
    where.push(`${ident(rule, filter.column)} = ${bind(serialize(rule, filter.column, filter.value))}`)
  }

  const requireLogin = (): SessionUser => {
    if (!user) throw new HttpError(401, 'not_authenticated', 'Entre na sua conta para continuar.')
    return user
  }

  if (op === 'select') {
    if (!isAdmin) {
      if (rule.adminOnlySelect) throw new HttpError(403, 'forbidden', 'Acesso negado.')
      if (rule.owner) where.push(`"${rule.owner}" = ${bind(requireLogin().id)}`)
      else if (rule.publicSelect) where.push(rule.publicSelect)
    }
    let sql = `SELECT ${selectList(rule, body.columns)} FROM ${table}`
    if (where.length) sql += ` WHERE ${where.join(' AND ')}`
    if (body.order) sql += ` ORDER BY ${ident(rule, body.order.column)} ${body.order.ascending ? 'ASC' : 'DESC'}`
    if (body.limit && Number.isInteger(body.limit) && body.limit > 0) sql += ` LIMIT ${Math.min(body.limit, 1000)}`
    const { results } = await env.DB.prepare(sql).bind(...params).all<Record<string, unknown>>()
    return json({ data: results.map((row) => deserialize(rule, row)) })
  }

  const values = (typeof body.values === 'object' && body.values !== null ? body.values : {}) as Record<string, unknown>
  for (const key of Object.keys(values)) ident(rule, key)

  if (op === 'insert') {
    const session = requireLogin()
    const row: Record<string, unknown> = { ...values }
    if (!isAdmin || !rule.adminWrite) {
      if (!rule.userInsert) throw new HttpError(403, 'forbidden', 'Acesso negado.')
      Object.assign(row, rule.userInsert)
      if (rule.owner) row[rule.owner] = session.id
    }
    if (rule.generateId) {
      if (row.id !== undefined && (typeof row.id !== 'string' || !UUID_RE.test(row.id))) {
        throw new HttpError(400, 'bad_request', 'ID inválido.')
      }
      row.id = row.id ?? crypto.randomUUID()
    }
    const cols = Object.keys(row)
    const sql = `INSERT INTO ${table} (${cols.map((c) => ident(rule, c)).join(', ')}) VALUES (${cols
      .map((c) => bind(serialize(rule, c, row[c]))).join(', ')}) RETURNING *`
    try {
      const { results } = await env.DB.prepare(sql).bind(...params).all<Record<string, unknown>>()
      return json({ data: results.map((r) => deserialize(rule, r)) })
    } catch (error) {
      console.error('DB insert failed', error instanceof Error ? error.message : 'unknown')
      throw new HttpError(400, 'constraint_violation', 'Não foi possível salvar os dados.')
    }
  }

  if (op === 'update') {
    const session = requireLogin()
    const row: Record<string, unknown> = { ...values }
    if (!isAdmin || !rule.adminWrite) {
      if (rule.userUpdate) {
        const keys = Object.keys(row)
        const expected = rule.userUpdate.set
        const matches = keys.length === Object.keys(expected).length &&
          Object.entries(expected).every(([k, v]) => row[k] === v)
        if (!matches) throw new HttpError(403, 'forbidden', 'Acesso negado.')
        where.push(rule.userUpdate.where)
        where.push(`"${rule.owner}" = ${bind(session.id)}`)
      } else if (rule.userUpdateOwnColumns) {
        if (!Object.keys(row).every((key) => rule.userUpdateOwnColumns!.includes(key))) {
          throw new HttpError(403, 'forbidden', 'Acesso negado.')
        }
        where.push(`"${rule.owner}" = ${bind(session.id)}`)
      } else {
        throw new HttpError(403, 'forbidden', 'Acesso negado.')
      }
    }
    const cols = Object.keys(row)
    if (cols.length === 0 || cols.includes('id') || cols.includes('user_id')) {
      throw new HttpError(400, 'bad_request', 'Atualização inválida.')
    }
    const setSql = cols.map((c) => `${ident(rule, c)} = ${bind(serialize(rule, c, row[c]))}`).join(', ')
    let sql = `UPDATE ${table} SET ${setSql}`
    if (where.length) sql += ` WHERE ${where.join(' AND ')}`
    sql += ' RETURNING *'
    try {
      const { results } = await env.DB.prepare(sql).bind(...params).all<Record<string, unknown>>()
      return json({ data: results.map((r) => deserialize(rule, r)) })
    } catch (error) {
      console.error('DB update failed', error instanceof Error ? error.message : 'unknown')
      throw new HttpError(400, 'constraint_violation', 'Não foi possível salvar os dados.')
    }
  }

  if (op === 'delete') {
    requireLogin()
    if (!isAdmin || !rule.adminWrite) throw new HttpError(403, 'forbidden', 'Acesso negado.')
    if (where.length === 0) throw new HttpError(400, 'bad_request', 'Exclusão sem filtro não é permitida.')
    const { results } = await env.DB.prepare(`DELETE FROM ${table} WHERE ${where.join(' AND ')} RETURNING *`)
      .bind(...params).all<Record<string, unknown>>()
    return json({ data: results.map((r) => deserialize(rule, r)) })
  }

  throw new HttpError(400, 'bad_request', 'Operação inválida.')
}

export async function handleRpc(request: Request, env: Env, name: string): Promise<Response> {
  const user = await getSessionUser(request, env)
  const now = nowIso()

  if (name === 'get_membership_videos') {
    const uid = user?.id ?? ''
    const admin = user?.is_admin ? 1 : 0
    const { results } = await env.DB.prepare(
      `SELECT v.id, v.title, v.description, v.thumbnail_url,
        CASE WHEN ?1 = 1
          OR (v.access_type = 'subscription' AND ${entitlementSql('?2', '?3')})
          OR (v.access_type = 'purchase' AND EXISTS (
                SELECT 1 FROM purchases p WHERE p.user_id = ?2 AND p.video_id = v.id AND p.status = 'paid'))
        THEN v.video_url ELSE NULL END AS video_url,
        v.access_type, v.price_label, v.purchase_url, v.is_published, v.sort_order, v.created_at
       FROM videos v
       WHERE v.is_published = 1 OR ?1 = 1
       ORDER BY v.sort_order ASC, v.created_at DESC`,
    ).bind(admin, uid, now).all<Record<string, unknown>>()
    return json({ data: results.map((row) => ({ ...row, is_published: Boolean(row.is_published) })) })
  }

  if (name === 'admin_subscriber_details') {
    if (!user?.is_admin) throw new HttpError(403, 'forbidden', 'Acesso restrito a administradores.')
    const { results } = await env.DB.prepare(
      `SELECT s.id AS subscription_id, u.email, u.full_name, u.phone,
              c.order_nsu, c.transaction_nsu, c.amount, c.paid_amount, c.paid_at, c.capture_method
       FROM subscriptions s
       LEFT JOIN users u ON u.id = s.user_id
       LEFT JOIN infinitepay_checkouts c ON c.subscription_id = s.id`,
    ).all()
    return json({ data: results })
  }

  throw new HttpError(404, 'not_found', 'Função não encontrada.')
}
