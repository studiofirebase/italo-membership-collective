// Fluxo admin de saúde dos links: detectar quebrado e trocar em massa.
// Requer a stack local com seed (global-setup) — pulado em base remota.
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { E2E_ADMIN_CREDS_FILE, E2E_ADMIN_VIDEO_TITLE, IS_LOCAL } from './helpers';

test.skip(!IS_LOCAL, 'requer stack local com seed (rode sem PLAYWRIGHT_BASE_URL)');

function adminCreds(): { email: string; password: string } {
  return JSON.parse(readFileSync(E2E_ADMIN_CREDS_FILE, 'utf8')) as { email: string; password: string };
}

test('verificar links detecta quebrado e troca em massa corrige', async ({ page }) => {
  const { email, password } = adminCreds();
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 });

  await page.getByRole('button', { name: 'Vídeos', exact: true }).click();
  await page.getByRole('button', { name: 'Verificar links' }).click();
  const row = page.locator('section[aria-label="Saúde dos links"] [data-video-id="e2e-admin-video"]');
  await expect(row.getByText('Quebrado', { exact: false })).toBeVisible({ timeout: 30_000 });

  await page.getByLabel('URLs em massa (id + URL por linha)').fill('e2e-admin-video http://127.0.0.1:8799/');
  await page.getByRole('button', { name: 'Atualizar URLs' }).click();
  await expect(page.getByText('1 link(s) atualizado(s).')).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: 'Verificar links' }).click();
  await expect(row.getByText('OK', { exact: true })).toBeVisible({ timeout: 30_000 });
});
