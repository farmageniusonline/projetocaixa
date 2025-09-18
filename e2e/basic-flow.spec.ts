import { test, expect } from '@playwright/test';

test.describe('Basic Application Flow', () => {
  test('should login and access main interface', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check if we're on login page
    await expect(page.locator('text=Acesso Restrito')).toBeVisible();

    // Fill login form with demo credentials
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'manipularium');

    // Submit login
    await page.click('button:has-text("Entrar")');

    // Wait for navigation to main page
    await page.waitForLoadState('networkidle');

    // Look for file input after login
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeVisible({ timeout: 10000 });

    // Take screenshot of successful login
    await page.screenshot({ path: 'test-results/login-success.png' });
  });

  test('should show upload interface', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Login
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'manipularium');
    await page.click('button:has-text("Entrar")');
    await page.waitForLoadState('networkidle');

    // Look for upload components
    const uploadSection = page.locator('text=Carregar Arquivo, text=Upload, text=Selecionar Arquivo').first();
    await expect(uploadSection).toBeVisible({ timeout: 5000 });
  });
});