// Promoção a admin pelo painel (aba Admins): só admin promove, só conta
// existente é promovida, e a conta promovida entra com o próprio login.
// Requer a stack local com seed (global-setup) — pulado em base remota.
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { E2E_ADMIN_CREDS_FILE, IS_LOCAL } from './helpers';

test.skip(!IS_LOCAL, 'requer stack local com seed (rode sem PLAYWRIGHT_BASE_URL)');

function adminCreds(): { email: string; password: string } {
  return JSON.parse(readFileSync(E2E_ADMIN_CREDS_FILE, 'utf8')) as { email: string; password: string };
}

async function login(page: Page, email: string, password: string) {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 });
}

test('admin promove conta existente por e-mail', async ({ page }) => {
  const stamp = Date.now();
  const email = `e2e-promovido-${stamp}@italosantos.com`;
  const password = 'e2e-promovido-123456';

  const signup = await page.request.post('/api/auth/signup', {
    data: { email, password, full_name: 'E2E Promovido' },
  });
  expect(signup.ok()).toBeTruthy();

  const admin = adminCreds();
  await login(page, admin.email, admin.password);
  await page.getByRole('button', { name: 'Admins', exact: true }).click();
  await page.getByLabel('E-mail da conta').fill(email);
  await page.getByRole('button', { name: 'Promover a admin' }).click();
  await expect(page.getByText(`${email} agora é admin.`)).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/entrar/);
  await login(page, email, password);
});

test('promover e-mail sem conta mostra erro', async ({ page }) => {
  const admin = adminCreds();
  await login(page, admin.email, admin.password);
  await page.getByRole('button', { name: 'Admins', exact: true }).click();
  await page.getByLabel('E-mail da conta').fill(`nao-existe-${Date.now()}@italosantos.com`);
  await page.getByRole('button', { name: 'Promover a admin' }).click();
  await expect(page.getByText('Nenhuma conta encontrada')).toBeVisible({ timeout: 15_000 });
});

test('sem login ou sem ser admin a API nega', async ({ request }) => {
  const denied = await request.post('/api/admin-promote', { data: { email: 'alguem@italosantos.com' } });
  expect(denied.status()).toBe(401);

  const stamp = Date.now();
  const email = `e2e-comum-${stamp}@italosantos.com`;
  const signup = await request.post('/api/auth/signup', {
    data: { email, password: 'e2e-comum-123456', full_name: 'E2E Comum' },
  });
  expect(signup.ok()).toBeTruthy();
  const forbidden = await request.post('/api/admin-promote', { data: { email } });
  expect(forbidden.status()).toBe(403);
});
