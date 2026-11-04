// Seed do D1 LOCAL para os testes de fallback de /membros.
// Roda antes da suíte; fora do localhost não faz nada (nunca mexe em produção).
// Cria o usuário E2E (signup da API, sem e-mail real) + vídeos de teste +
// 1 assinatura ativa, e o usuário admin E2E (promovido via ADMIN_EMAILS).

import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  BASE_URL,
  E2E_ADMIN_CREDS_FILE,
  E2E_ADMIN_PASSWORD,
  E2E_ADMIN_VIDEO_TITLE,
  E2E_BROKEN_THUMB,
  E2E_BROKEN_VIDEO,
  E2E_EMAIL,
  E2E_EMBED_TITLE,
  E2E_EMBED_URL,
  E2E_PASSWORD,
  E2E_VIDEO_TITLE,
  IS_LOCAL,
} from './helpers';

function adminEmail(): string {
  const raw = readFileSync('wrangler.jsonc', 'utf8').replace(/^\s*\/\/.*$/gm, '');
  const vars = (JSON.parse(raw) as { vars?: { ADMIN_EMAILS?: string } }).vars ?? {};
  const email = (vars.ADMIN_EMAILS ?? '').split(',').map((s) => s.trim()).filter(Boolean)[0];
  if (!email) throw new Error('seed: ADMIN_EMAILS vazio no wrangler.jsonc');
  return email.toLowerCase();
}

async function ensureUser(email: string, password: string): Promise<string> {
  const payload = JSON.stringify({ email, password, full_name: 'E2E' });
  const signup = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  });
  if (signup.ok) {
    return (await signup.json() as { user?: { id?: string } }).user?.id ?? '';
  }
  const signin = await fetch(`${BASE_URL}/api/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!signin.ok) throw new Error(`seed: signup/signin falhou para ${email} (HTTP ${signin.status})`);
  return (await signin.json() as { user?: { id?: string } }).user?.id ?? '';
}

async function setup() {
  if (!IS_LOCAL) {
    console.log(`global-setup: base remota (${BASE_URL}), sem seed.`);
    return;
  }

  const userId = await ensureUser(E2E_EMAIL, E2E_PASSWORD);
  if (!userId) throw new Error('seed: usuário E2E sem id');
  const adminMail = adminEmail();
  const adminId = await ensureUser(adminMail, E2E_ADMIN_PASSWORD);
  if (!adminId) throw new Error('seed: admin E2E sem id');
  writeFileSync(E2E_ADMIN_CREDS_FILE, JSON.stringify({ email: adminMail, password: E2E_ADMIN_PASSWORD }));

  const dir = mkdtempSync(join(tmpdir(), 'e2e-seed-'));
  const file = join(dir, 'seed.sql');
  const q = (s: string) => s.replace(/'/g, "''");
  writeFileSync(
    file,
    `INSERT OR REPLACE INTO videos (id, title, description, thumbnail_url, video_url, access_type, is_published, sort_order)
     VALUES ('e2e-broken-video', '${q(E2E_VIDEO_TITLE)}', 'seed e2e', '${E2E_BROKEN_THUMB}', '${E2E_BROKEN_VIDEO}', 'subscription', 1, 0);
     INSERT OR REPLACE INTO videos (id, title, description, thumbnail_url, video_url, access_type, is_published, sort_order)
     VALUES ('e2e-embed-video', '${q(E2E_EMBED_TITLE)}', 'seed e2e', NULL, '${E2E_EMBED_URL}', 'subscription', 1, 1);
     INSERT OR REPLACE INTO videos (id, title, description, thumbnail_url, video_url, access_type, is_published, sort_order)
     VALUES ('e2e-admin-video', '${q(E2E_ADMIN_VIDEO_TITLE)}', 'seed e2e', NULL, 'https://127.0.0.1:9/e2e-admin-video.m3u8', 'subscription', 1, 2);
     INSERT OR REPLACE INTO subscriptions (id, user_id, plan_id, provider, status, started_at, expires_at)
     VALUES ('e2e-sub-1', '${userId}', NULL, 'infinitepay', 'active', NULL, NULL);`,
  );
  execSync(`npx wrangler d1 execute italo-membership --local --file "${file}"`, { stdio: 'pipe' });
  console.log(`global-setup: seed ok (user ${userId}, admin ${adminId}).`);
}

export default setup;
