import { test, expect } from '@playwright/test';

test('Debug banking tab layout', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:5175');

  // Login
  await page.fill('[data-testid="username-input"]', 'admin@manipularium.com.br');
  await page.fill('[data-testid="password-input"]', 'manipularium');
  await page.click('[data-testid="login-button"]');
  await page.waitForTimeout(2000);

  // Go to Banking tab
  await page.click('text=Conferência Bancária');
  await page.waitForTimeout(1000);

  // Take detailed screenshot
  await page.screenshot({
    path: 'debug-banking-layout.png',
    fullPage: true
  });

  // Get container elements
  const flexContainer = page.locator('div.flex.h-\\[calc\\(100vh-8rem\\)\\]').first();
  const flexBox = await flexContainer.boundingBox();
  console.log('Banking flex container:', flexBox);

  const aside = page.locator('aside');
  const asideBox = await aside.boundingBox();
  console.log('Banking aside:', asideBox);

  const main = page.locator('main');
  const mainBox = await main.boundingBox();
  console.log('Banking main:', mainBox);

  // Check what's inside main
  const mainContent = page.locator('main > *');
  const count = await mainContent.count();
  console.log('Main content elements count:', count);

  for (let i = 0; i < count; i++) {
    const element = mainContent.nth(i);
    const box = await element.boundingBox();
    const classes = await element.getAttribute('class');
    console.log(`Element ${i}:`, { box, classes });
  }

  console.log('✅ Banking debug completed');
});