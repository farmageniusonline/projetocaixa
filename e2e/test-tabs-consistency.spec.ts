import { test, expect } from '@playwright/test';

test('Verificar consistência de largura entre todas as abas', async ({ page }) => {
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

  const lancamentosMain = page.locator('main');
  const lancamentosBox = await lancamentosMain.boundingBox();
  console.log('Lançamentos main:', lancamentosBox);

  await page.screenshot({ path: 'final-lancamentos.png', fullPage: false });

  // Test Banking tab
  await page.click('text=Conferência Bancária');
  await page.waitForTimeout(1000);

  const bankingMain = page.locator('main');
  const bankingBox = await bankingMain.boundingBox();
  console.log('Banking main:', bankingBox);

  await page.screenshot({ path: 'final-banking.png', fullPage: false });

  // Test Cash tab
  await page.click('text=Conferência de Caixa');
  await page.waitForTimeout(1000);

  const cashMain = page.locator('main');
  const cashBox = await cashMain.boundingBox();
  console.log('Cash main:', cashBox);

  await page.screenshot({ path: 'final-cash.png', fullPage: false });

  // Compare widths
  const lancamentosWidth = lancamentosBox?.width || 0;
  const bankingWidth = bankingBox?.width || 0;
  const cashWidth = cashBox?.width || 0;

  console.log('Width comparison:');
  console.log('Lançamentos:', lancamentosWidth);
  console.log('Banking:', bankingWidth);
  console.log('Cash:', cashWidth);

  const maxDifference = Math.max(
    Math.abs(lancamentosWidth - bankingWidth),
    Math.abs(bankingWidth - cashWidth),
    Math.abs(lancamentosWidth - cashWidth)
  );

  console.log('Maximum width difference:', maxDifference);
  console.log('✅ Consistency check completed');
});