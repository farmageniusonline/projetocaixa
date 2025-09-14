import { test, expect } from '@playwright/test';

test.describe('Autenticação', () => {
  test.beforeEach(async ({ page }) => {
    // Ir para a página inicial
    await page.goto('/');
  });

  test('deve exibir formulário de login', async ({ page }) => {
    // Verificar se o formulário de login está presente
    await expect(page.locator('form')).toBeVisible();
    await expect(page.locator('input[type="text"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Verificar textos
    await expect(page.getByText('Manipularium')).toBeVisible();
    await expect(page.getByText('Sistema de Conferência Bancária')).toBeVisible();
  });

  test('deve mostrar erro com credenciais inválidas', async ({ page }) => {
    await page.fill('input[type="text"]', 'usuario_invalido');
    await page.fill('input[type="password"]', 'senha_invalida');
    await page.click('button[type="submit"]');

    // Aguardar mensagem de erro
    await expect(page.getByText('Usuário ou senha incorretos')).toBeVisible();
  });

  test('deve fazer login com credenciais válidas', async ({ page }) => {
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');

    // Aguardar redirecionamento para dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByText('Manipularium - Sistema de Conferência')).toBeVisible();
  });

  test('deve manter sessão após reload', async ({ page }) => {
    // Fazer login
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');

    // Aguardar dashboard
    await page.waitForURL('/dashboard');

    // Recarregar página
    await page.reload();

    // Deve continuar no dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByText('admin')).toBeVisible();
  });

  test('deve fazer logout corretamente', async ({ page }) => {
    // Fazer login
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');

    await page.waitForURL('/dashboard');

    // Fazer logout
    await page.click('text=Sair');

    // Deve voltar para tela de login
    await expect(page).toHaveURL('/');
    await expect(page.locator('form')).toBeVisible();
  });
});