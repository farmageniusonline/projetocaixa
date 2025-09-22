import { test, expect } from '@playwright/test';

test('Quick layout check', async ({ page }) => {
  await page.goto('http://localhost:5175');

  // Login
  await page.fill('[data-testid="username-input"]', 'admin@manipularium.com.br');
  await page.fill('[data-testid="password-input"]', 'manipularium');
  await page.click('[data-testid="login-button"]');
  await page.waitForTimeout(2000);

  // Go to Lançamentos
  await page.click('text=Lançamentos');
  await page.waitForTimeout(1000);

  // Take screenshot
  await page.screenshot({
    path: 'quick-layout-check.png',
    fullPage: true
  });

  // Check table dimensions
  const table = page.locator('table');
  const tableBox = await table.boundingBox();
  console.log('NEW Table dimensions:', tableBox);

  // Check tbody dimensions
  const tbody = page.locator('tbody');
  const tbodyBox = await tbody.boundingBox();
  console.log('Tbody dimensions:', tbodyBox);

  console.log('✅ Quick layout check completed');
});