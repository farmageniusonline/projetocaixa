import { test, expect } from '@playwright/test';

test.describe('Verificação de Largura - Eliminando Faixa Vazia', () => {
  test('deve verificar se tabela ocupa toda largura sem faixa vazia à direita', async ({ page }) => {
    // Set viewport size
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto('http://localhost:5175');

    // Login
    await page.fill('[data-testid="username-input"]', 'admin@manipularium.com.br');
    await page.fill('[data-testid="password-input"]', 'manipularium');
    await page.click('[data-testid="login-button"]');
    await page.waitForTimeout(2000);

    // Test Lançamentos tab
    await page.click('text=Lançamentos');
    await page.waitForTimeout(1000);

    const viewport = page.viewportSize();
    console.log('Viewport:', viewport);

    // Measure main container
    const main = page.locator('main');
    const mainBox = await main.boundingBox();
    console.log('Main container:', mainBox);

    // Measure sidebar
    const sidebar = page.locator('aside');
    const sidebarBox = await sidebar.boundingBox();
    console.log('Sidebar:', sidebarBox);

    // Measure table container
    const tableContainer = page.locator('main .bg-gray-800');
    const tableContainerBox = await tableContainer.boundingBox();
    console.log('Table container:', tableContainerBox);

    // Check if main reaches the edge
    const rightEdge = (sidebarBox?.x || 0) + (sidebarBox?.width || 0) + (mainBox?.width || 0);
    const viewportWidth = viewport?.width || 0;
    const unusedSpace = viewportWidth - rightEdge;

    console.log('Right edge:', rightEdge);
    console.log('Viewport width:', viewportWidth);
    console.log('Unused space on right:', unusedSpace);

    await page.screenshot({
      path: 'lancamentos-width-analysis.png',
      fullPage: false
    });

    // Test other tabs for comparison
    await page.click('text=Conferência Bancária');
    await page.waitForTimeout(1000);

    const bankingMain = page.locator('main');
    const bankingMainBox = await bankingMain.boundingBox();
    console.log('Banking main container:', bankingMainBox);

    await page.screenshot({
      path: 'banking-width-comparison.png',
      fullPage: false
    });

    await page.click('text=Conferência de Caixa');
    await page.waitForTimeout(1000);

    const cashMain = page.locator('main');
    const cashMainBox = await cashMain.boundingBox();
    console.log('Cash main container:', cashMainBox);

    await page.screenshot({
      path: 'cash-width-comparison.png',
      fullPage: false
    });

    console.log('✅ Width analysis completed');
  });
});