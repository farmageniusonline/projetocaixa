import { test, expect } from '@playwright/test';

test.describe('Basic Login Test', () => {
  test('should successfully login with correct credentials', async ({ page }) => {
    // 1. Navigate to the app
    await page.goto('/');

    // 2. Verify login page loads
    await expect(page.getByRole('heading', { name: 'Manipularium' })).toBeVisible();
    await expect(page.getByText('Conferência Bancária - Acesso Restrito')).toBeVisible();

    // 3. Fill in login credentials
    await page.fill('#username', 'admin');
    await page.fill('#password', 'manipularium');

    // 4. Submit login form
    await page.click('button[type="submit"]');

    // 5. Verify successful login - should redirect to dashboard
    await page.waitForURL('/dashboard');

    // 6. Verify dashboard elements are present
    await expect(page.locator('body')).toContainText('Manipularium', { timeout: 10000 });

    console.log('✅ Login test passed successfully!');
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/');

    // Fill in invalid credentials
    await page.fill('#username', 'invalid_user');
    await page.fill('#password', 'invalid_password');

    await page.click('button[type="submit"]');

    // Should show error message
    await expect(page.getByText('Credenciais inválidas')).toBeVisible({ timeout: 5000 });

    // Should still be on login page
    await expect(page).toHaveURL('/');

    console.log('✅ Invalid login test passed!');
  });
});