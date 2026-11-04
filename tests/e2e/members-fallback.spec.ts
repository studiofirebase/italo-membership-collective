// Fallback do player em /membros: vídeo com link quebrado mantém o card,
// com capa/título e botão de retry, inclusive após reload.
// Player permanente (embed) renderiza iframe em vez do fallback.
// Requer a stack local com seed (global-setup) — pulado em base remota.
import { expect, type Page, test } from '@playwright/test';
import { E2E_EMAIL, E2E_EMBED_TITLE, E2E_EMBED_URL, E2E_PASSWORD, E2E_VIDEO_TITLE, IS_LOCAL } from './helpers';

test.skip(!IS_LOCAL, 'requer stack local com seed (rode sem PLAYWRIGHT_BASE_URL)');

async function loginAsE2E(page: Page) {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(E2E_EMAIL);
  await page.getByLabel('Senha').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/membros/, { timeout: 15_000 });
}

test('link quebrado mantém o card do vídeo com retry', async ({ page }) => {
  await page.route(/127\.0\.0\.1:9/, (route) => route.abort());
  await loginAsE2E(page);

  const card = page.locator('div.grid > div', { hasText: E2E_VIDEO_TITLE });
  await expect(card).toBeVisible({ timeout: 15_000 });
  await expect(card.getByRole('alert')).toBeVisible({ timeout: 15_000 });
  await expect(card.getByRole('button', { name: 'Tentar novamente' })).toBeVisible();

  // Recarrega: o card continua lá, não some.
  await page.reload();
  const cardAfter = page.locator('div.grid > div', { hasText: E2E_VIDEO_TITLE });
  await expect(cardAfter).toBeVisible({ timeout: 15_000 });
  await expect(cardAfter.getByRole('button', { name: 'Tentar novamente' })).toBeVisible();
});

test('url de player (embed) renderiza iframe em vez do fallback', async ({ page }) => {
  await loginAsE2E(page);

  const card = page.locator('div.grid > div', { hasText: E2E_EMBED_TITLE });
  await expect(card).toBeVisible({ timeout: 15_000 });
  await expect(card.locator('iframe')).toHaveAttribute('src', E2E_EMBED_URL);
  await expect(card.getByRole('alert')).toHaveCount(0);
});
