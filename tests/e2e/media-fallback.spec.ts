// Fallback da grade do X: com o feed controlado e as mídias quebradas
// (pbs/video.twimg abortados), os cards NÃO podem sumir.
import { expect, test } from '@playwright/test';
import { twitterFeedFixture } from './helpers';

test('mídia quebrada mantém os cards com fallback', async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));

  // Feed controlado + mídias quebradas, antes da navegação.
  await page.route('**/api/twitter-feed', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(twitterFeedFixture()),
    }),
  );
  await page.route(/pbs\.twimg\.com/, (route) => route.abort());
  await page.route(/video\.twimg\.com/, (route) => route.abort());

  await page.goto('/');
  const catalog = page.locator('#catalog');
  await catalog.scrollIntoViewIfNeeded();

  // Os 2 cards continuam na grade, com link para o X.
  await expect(catalog.locator('article')).toHaveCount(2, { timeout: 15_000 });
  await expect(catalog.getByRole('link', { name: /Ver no X/ })).toHaveCount(2);

  // Foto quebrada vira placeholder, sem sumir.
  await expect(catalog.getByText('Foto indisponível no momento')).toBeVisible();

  // Vídeo quebrado: toca, falha e volta ao card com aviso + retry.
  await catalog.getByRole('button', { name: /Reproduzir vídeo/ }).click();
  await expect(catalog.getByText(/Vídeo indisponível no momento/)).toBeVisible({ timeout: 15_000 });
  await expect(catalog.locator('article')).toHaveCount(2);

  expect(pageErrors).toEqual([]);
});
