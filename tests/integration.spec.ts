import { test, expect } from '@playwright/test';

test.describe('Integration Tests - Launch Tab to Cash Conference', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    // Login
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');

    // Wait for dashboard
    await page.waitForSelector('text=Lançamentos');
  });

  test('should create launch and sync with cash conference tab', async ({ page }) => {
    // Start on Launch tab
    await page.click('text=Lançamentos');

    // Add a launch
    await page.click('text=Cartão de Crédito 3x');
    await page.click('button:has-text("Não")'); // Not a link
    await page.fill('input[placeholder*="Digite o valor"]', '199,90');
    await page.click('button:has-text("Adicionar")');

    // Check success message
    await expect(page.locator('text=Lançamento criado e enviado para Conferência de Caixa')).toBeVisible();

    // Switch to Cash Conference tab
    await page.click('text=Conferência de Caixa');

    // Should see the launch in cash conference table
    await expect(page.locator('table')).toContainText('Cartão de Crédito 3x / Link: Não');
    await expect(page.locator('table')).toContainText('R$ 199,90');
  });

  test('should remove launch from both tabs when undoing', async ({ page }) => {
    // Add launch in Launch tab
    await page.click('text=Lançamentos');
    await page.click('text=Dinheiro');
    await page.fill('input[placeholder*="Digite o valor"]', '85,50');
    await page.click('button:has-text("Adicionar")');

    // Verify it's in Cash Conference
    await page.click('text=Conferência de Caixa');
    await expect(page.locator('table')).toContainText('Dinheiro');

    // Go back to Launch tab and undo
    await page.click('text=Lançamentos');
    await page.click('button:has-text("Desfazer")');
    await page.click('button:has-text("Confirmar")');

    // Check it's removed from Launch tab
    await expect(page.locator('text=Lançamento desfeito com sucesso')).toBeVisible();
    await expect(page.locator('text=Nenhum lançamento registrado')).toBeVisible();

    // Check it's also removed from Cash Conference tab
    await page.click('text=Conferência de Caixa');
    await expect(page.locator('table')).not.toContainText('Dinheiro');
  });

  test('should sync global date filter across tabs', async ({ page }) => {
    // Add launch on current date
    await page.click('text=Lançamentos');
    await page.click('text=Débito');
    await page.fill('input[placeholder*="Digite o valor"]', '120,00');
    await page.click('button:has-text("Adicionar")');

    // Get tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // Change date filter in Launch tab
    await page.fill('input[type="date"]', tomorrowStr);
    await page.click('button:has-text("Aplicar")');

    // Should show no launches for tomorrow in Launch tab
    await expect(page.locator('text=Nenhum lançamento encontrado')).toBeVisible();

    // Switch to Cash Conference tab - should also respect the date filter
    await page.click('text=Conferência de Caixa');

    // Cash Conference should also be empty (filtered by tomorrow's date)
    // This tests that the global date filter is working across tabs
    await expect(page.locator('text=0 registro(s)')).toBeVisible();
  });

  test('should handle concurrent operations across tabs', async ({ page }) => {
    // Add multiple launches
    await page.click('text=Lançamentos');

    // Add first launch
    await page.click('text=Cartão de Crédito 1x');
    await page.click('button:has-text("Sim")'); // Is a link
    await page.fill('input[placeholder*="Digite o valor"]', '50,00');
    await page.click('button:has-text("Adicionar")');
    await page.waitForTimeout(500);

    // Add second launch
    await page.click('text=Cartão de Crédito 2x');
    await page.click('button:has-text("Não")'); // Not a link
    await page.fill('input[placeholder*="Digite o valor"]', '75,00');
    await page.click('button:has-text("Adicionar")');
    await page.waitForTimeout(500);

    // Check Launch tab has both
    await expect(page.locator('table')).toContainText('R$ 50,00');
    await expect(page.locator('table')).toContainText('R$ 75,00');

    // Check Cash Conference has both
    await page.click('text=Conferência de Caixa');
    await expect(page.locator('table')).toContainText('Cartão de Crédito 1x / Link: Sim');
    await expect(page.locator('table')).toContainText('Cartão de Crédito 2x / Link: Não');

    // Check totals are correct
    await expect(page.locator('text=Total de itens:')).toBeVisible();
    await expect(page.locator('text=R$ 125,00')).toBeVisible(); // Total value
  });

  test('should prevent duplicate entries', async ({ page }) => {
    // This test ensures the system prevents duplicate IDs
    await page.click('text=Lançamentos');

    // Add same launch multiple times quickly
    for (let i = 0; i < 3; i++) {
      await page.click('text=Moedas');
      await page.fill('input[placeholder*="Digite o valor"]', '10,00');
      await page.click('button:has-text("Adicionar")');
      await page.waitForTimeout(200);
    }

    // Should have 3 entries in Launch tab (each with unique ID)
    const rows = await page.locator('table tbody tr').count();
    expect(rows).toBe(3);

    // Should also have 3 entries in Cash Conference
    await page.click('text=Conferência de Caixa');
    const cashRows = await page.locator('table tbody tr').count();
    expect(cashRows).toBe(3);
  });

  test('should maintain data persistence across page refresh', async ({ page }) => {
    // Add a launch
    await page.click('text=Lançamentos');
    await page.click('text=Depósito');
    await page.fill('input[placeholder*="Digite o valor"]', '300,00');
    await page.click('button:has-text("Adicionar")');

    // Refresh the page
    await page.reload();

    // Login again
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');

    // Check data is still there in Launch tab
    await page.click('text=Lançamentos');
    await expect(page.locator('table')).toContainText('Depósito');
    await expect(page.locator('table')).toContainText('R$ 300,00');

    // Check data is still there in Cash Conference
    await page.click('text=Conferência de Caixa');
    await expect(page.locator('table')).toContainText('Depósito');
  });
});