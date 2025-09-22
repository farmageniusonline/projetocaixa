import { test, expect } from '@playwright/test';

test('Simple width analysis', async ({ page }) => {
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

  // Take screenshot
  await page.screenshot({
    path: 'width-analysis-full.png',
    fullPage: false
  });

  // Get main elements
  const flexContainer = page.locator('div.flex.h-\\[calc\\(100vh-8rem\\)\\]').first();
  const flexBox = await flexContainer.boundingBox();
  console.log('Flex container:', flexBox);

  const main = page.locator('main');
  const mainBox = await main.boundingBox();
  console.log('Main:', mainBox);

  const table = page.locator('table');
  const tableBox = await table.boundingBox();
  console.log('Table:', tableBox);

  // Calculate padding/margins
  const mainPadding = (mainBox?.width || 0) - (tableBox?.width || 0);
  console.log('Main padding/margin total:', mainPadding);

  console.log('✅ Simple width analysis done');
});