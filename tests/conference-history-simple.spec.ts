import { test, expect } from '@playwright/test';

test.describe('Sistema de Histórico - Teste Simplificado', () => {
  test('deve carregar a página principal', async ({ page }) => {
    await page.goto('http://localhost:5176/', { timeout: 10000 });

    // Verifica se está na página de login ou dashboard
    const isLoginPage = await page.locator('text=/Login|Entrar/i').isVisible().catch(() => false);
    const isDashboard = await page.locator('text=/Dashboard|Conferência/i').isVisible().catch(() => false);

    expect(isLoginPage || isDashboard).toBeTruthy();
  });

  test('deve ter o componente DateSelector visível após login', async ({ page }) => {
    await page.goto('http://localhost:5176/', { timeout: 10000 });

    // Faz login se necessário
    const needsLogin = await page.locator('input[type="password"]').isVisible().catch(() => false);
    if (needsLogin) {
      await page.fill('input[name="username"], input[type="email"]', 'admin');
      await page.fill('input[type="password"]', 'admin123');
      await page.locator('button[type="submit"]').click();
      await page.waitForTimeout(2000);
    }

    // Verifica componente DateSelector
    const dateSelector = await page.locator('text=Selecionar Dia').isVisible().catch(() => false);
    expect(dateSelector).toBeTruthy();
  });

  test('deve ter o componente HistoryByDate visível', async ({ page }) => {
    await page.goto('http://localhost:5176/', { timeout: 10000 });

    // Faz login se necessário
    const needsLogin = await page.locator('input[type="password"]').isVisible().catch(() => false);
    if (needsLogin) {
      await page.fill('input[name="username"], input[type="email"]', 'admin');
      await page.fill('input[type="password"]', 'admin123');
      await page.locator('button[type="submit"]').click();
      await page.waitForTimeout(2000);
    }

    // Verifica componente HistoryByDate
    const historyByDate = await page.locator('text=Histórico por Data').isVisible().catch(() => false);
    expect(historyByDate).toBeTruthy();
  });

  test('deve alternar entre modo automático e manual de data', async ({ page }) => {
    await page.goto('http://localhost:5176/', { timeout: 10000 });

    // Faz login se necessário
    const needsLogin = await page.locator('input[type="password"]').isVisible().catch(() => false);
    if (needsLogin) {
      await page.fill('input[name="username"], input[type="email"]', 'admin');
      await page.fill('input[type="password"]', 'admin123');
      await page.locator('button[type="submit"]').click();
      await page.waitForTimeout(2000);
    }

    // Tenta clicar no radio de modo manual
    const manualRadio = page.locator('text=Selecionar Manualmente');
    if (await manualRadio.isVisible()) {
      await manualRadio.click();

      // Verifica se o input de data aparece
      const dateInput = await page.locator('input[type="date"]').first().isVisible();
      expect(dateInput).toBeTruthy();
    }
  });

  test('deve ter botão de carregar histórico', async ({ page }) => {
    await page.goto('http://localhost:5176/', { timeout: 10000 });

    // Faz login se necessário
    const needsLogin = await page.locator('input[type="password"]').isVisible().catch(() => false);
    if (needsLogin) {
      await page.fill('input[name="username"], input[type="email"]', 'admin');
      await page.fill('input[type="password"]', 'admin123');
      await page.locator('button[type="submit"]').click();
      await page.waitForTimeout(2000);
    }

    // Verifica botão de carregar histórico
    const loadButton = await page.locator('button:has-text("Carregar Histórico")').isVisible().catch(() => false);
    expect(loadButton).toBeTruthy();
  });
});