import { HttpError, json, type Env } from './lib'
import { requireAdmin } from './auth'

// Promoção de administradores pelo painel (/admin, aba "Admins").
// Só um admin autenticado promove, e só contas já cadastradas em
// /entrar: cada pessoa continua entrando com o próprio e-mail e senha
// e mantém o próprio perfil.
export async function handlePromoteAdmin(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') throw new HttpError(405, 'method_not_allowed', 'Método não permitido.')
  await requireAdmin(request, env)

  const body = (await request.json().catch(() => null)) as { email?: unknown } | null
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new HttpError(400, 'email_address_invalid', 'Informe um e-mail válido.')
  }

  const row = await env.DB.prepare('SELECT id, email FROM users WHERE email = ?1')
    .bind(email).first<{ id: string; email: string }>()
  if (!row) {
    throw new HttpError(
      404,
      'user_not_found',
      'Nenhuma conta encontrada para este e-mail. A pessoa precisa se cadastrar em /entrar primeiro.',
    )
  }

  const existing = await env.DB.prepare("SELECT id FROM user_roles WHERE user_id = ?1 AND role = 'admin'")
    .bind(row.id).first<{ id: string }>()
  if (!existing) {
    await env.DB.prepare('INSERT INTO user_roles (id, user_id, role) VALUES (?1, ?2, ?3)')
      .bind(crypto.randomUUID(), row.id, 'admin').run()
  }
  return json({ data: { user_id: row.id, email: row.email, already_admin: Boolean(existing) } })
}
