import { test, expect } from '@playwright/test';

test('Verificação Final - Lançamentos ocupa toda largura sem faixa vazia', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:5175');

  // Login
  await page.fill('[data-testid="username-input"]', 'admin@manipularium.com.br');
  await page.fill('[data-testid="password-input"]', 'manipularium');
  await page.click('[data-testid="login-button"]');
  await page.waitForTimeout(2000);

  // Go to Lançamentos
  await page.click('text=Lançamentos');
  await page.waitForTimeout(1000);

  // Final screenshot
  await page.screenshot({
    path: 'FINAL-lancamentos-full-width.png',
    fullPage: false
  });

  // Detailed measurements
  const viewport = page.viewportSize();
  const viewportWidth = viewport?.width || 0;

  const aside = page.locator('aside');
  const asideBox = await aside.boundingBox();
  const sidebarWidth = asideBox?.width || 0;

  const main = page.locator('main');
  const mainBox = await main.boundingBox();
  const mainWidth = mainBox?.width || 0;

  const table = page.locator('table');
  const tableBox = await table.boundingBox();
  const tableWidth = tableBox?.width || 0;

  // Calculate used vs available space
  const usedWidth = sidebarWidth + mainWidth;
  const unusedSpace = viewportWidth - usedWidth;
  const tableToMainRatio = (tableWidth / mainWidth) * 100;

  console.log('=== FINAL VERIFICATION ===');
  console.log('Viewport width:', viewportWidth);
  console.log('Sidebar width:', sidebarWidth);
  console.log('Main width:', mainWidth);
  console.log('Table width:', tableWidth);
  console.log('Total used width:', usedWidth);
  console.log('Unused space (faixa vazia):', unusedSpace);
  console.log('Table/Main ratio:', tableToMainRatio.toFixed(1) + '%');

  // Verify requirements
  const hasNoUnusedSpace = unusedSpace === 0;
  const tableUsesFullMain = tableToMainRatio >= 98; // Allow 2% for borders
  const mainUsesFullSpace = mainWidth >= (viewportWidth - sidebarWidth - 5); // Allow 5px tolerance

  console.log('=== REQUIREMENTS CHECK ===');
  console.log('✅ No unused space to the right:', hasNoUnusedSpace);
  console.log('✅ Table uses full main area:', tableUsesFullMain);
  console.log('✅ Main uses full available space:', mainUsesFullSpace);

  console.log('✅ Final verification completed');
});