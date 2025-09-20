import { test, expect } from '@playwright/test';

test('should show "Senha ou Usuario Incorretos" for wrong credentials', async ({ page }) => {
  // Navigate to login page
  await page.goto('/');

  // Fill in wrong credentials
  await page.fill('input[name="username"]', 'wrong_user');
  await page.fill('input[name="password"]', 'wrong_pass');

  // Submit the form
  await page.click('button[type="submit"]');

  // Wait for and verify the error message appears
  await expect(page.locator('text=Senha ou Usuario Incorretos')).toBeVisible({ timeout: 15000 });

  console.log('✅ Error message "Senha ou Usuario Incorretos" is displayed correctly');
});