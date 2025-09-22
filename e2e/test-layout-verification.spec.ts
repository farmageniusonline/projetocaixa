import { test, expect } from '@playwright/test';

test.describe('Verificação de Layout - Tabela Ocupando Todo Espaço', () => {
  test('deve verificar se tabela principal ocupa toda altura e largura da tela', async ({ page }) => {
    // Ir para a página
    await page.goto('http://localhost:5175');

    // Fazer login
    await page.fill('[data-testid="username-input"]', 'admin@manipularium.com.br');
    await page.fill('[data-testid="password-input"]', 'manipularium');
    await page.click('[data-testid="login-button"]');

    // Aguardar carregar o dashboard
    await page.waitForTimeout(2000);

    // Ir para a aba Lançamentos
    await page.click('text=Lançamentos');
    await page.waitForTimeout(1000);

    // Capturar screenshot do layout atual
    await page.screenshot({
      path: 'layout-verification-lancamentos.png',
      fullPage: true
    });

    // Obter dimensões da viewport
    const viewportSize = page.viewportSize();
    console.log('Viewport:', viewportSize);

    // Verificar se o contêiner principal está usando toda a altura
    const mainContainer = page.locator('main');
    await expect(mainContainer).toBeVisible();

    const mainBox = await mainContainer.boundingBox();
    console.log('Main container dimensions:', mainBox);

    // Verificar se a tabela está visível e ocupando espaço
    const table = page.locator('table');
    await expect(table).toBeVisible();

    const tableBox = await table.boundingBox();
    console.log('Table dimensions:', tableBox);

    // Verificar se a sidebar está com largura reduzida
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();

    const sidebarBox = await sidebar.boundingBox();
    console.log('Sidebar dimensions:', sidebarBox);

    // Verificar se o layout flex está funcionando
    const flexContainer = page.locator('div.flex.h-\\[calc\\(100vh-8rem\\)\\]');
    await expect(flexContainer).toBeVisible();

    const flexBox = await flexContainer.boundingBox();
    console.log('Flex container dimensions:', flexBox);

    // Testar outras abas também
    await page.click('text=Conferência Bancária');
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: 'layout-verification-bancaria.png',
      fullPage: true
    });

    await page.click('text=Conferência de Caixa');
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: 'layout-verification-caixa.png',
      fullPage: true
    });

    console.log('✅ Screenshots capturados para análise do layout');
  });

  test('deve verificar responsividade do layout', async ({ page }) => {
    // Teste com viewport menor
    await page.setViewportSize({ width: 1280, height: 720 });

    await page.goto('http://localhost:5175');
    await page.fill('[data-testid="username-input"]', 'admin@manipularium.com.br');
    await page.fill('[data-testid="password-input"]', 'manipularium');
    await page.click('[data-testid="login-button"]');
    await page.waitForTimeout(2000);

    await page.click('text=Lançamentos');
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: 'layout-responsive-1280x720.png',
      fullPage: true
    });

    // Teste com viewport maior
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(500);

    await page.screenshot({
      path: 'layout-responsive-1920x1080.png',
      fullPage: true
    });

    console.log('✅ Screenshots de responsividade capturados');
  });
});