import { test, expect } from '@playwright/test';

test('should verify useRef fix', async ({ page }) => {
  let useRefErrors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error' && msg.text().includes('useRef')) {
      useRefErrors.push(msg.text());
    }
  });

  page.on('pageerror', (error) => {
    if (error.message.includes('useRef')) {
      useRefErrors.push(error.message);
    }
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Try to login to trigger Dashboard component
  const hasLoginForm = await page.locator('input[type="password"]').count() > 0;
  if (hasLoginForm) {
    await page.fill('input[type="text"]', 'TEST_USER');
    await page.fill('input[type="password"]', 'TEST_PASSWORD');
    await page.click('button:has-text("Entrar")');
    await page.waitForTimeout(3000);
  }

  console.log('useRef errors found:', useRefErrors.length);
  useRefErrors.forEach(error => console.log('- ', error));

  expect(useRefErrors.length).toBe(0);
});