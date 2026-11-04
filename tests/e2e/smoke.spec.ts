// Smoke das rotas públicas e da guarda de autenticação. Roda em qualquer base.
import { expect, test } from '@playwright/test';

test('home carrega e mostra o catálogo', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Italo Santos/);
  await expect(page.getByRole('heading', { name: 'Vídeos e fotos publicados' })).toBeVisible();
});

test('entrar mostra o formulário de login', async ({ page }) => {
  await page.goto('/entrar');
  await expect(page.getByRole('heading', { name: 'Entre na sua conta' })).toBeVisible();
  await expect(page.getByLabel('E-mail')).toBeVisible();
  await expect(page.getByLabel('Senha')).toBeVisible();
});

test('membros sem sessão volta para o entrar', async ({ page }) => {
  await page.goto('/membros');
  await expect(page).toHaveURL(/\/entrar/);
});
