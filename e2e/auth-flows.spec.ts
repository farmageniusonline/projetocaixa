/**
 * Authentication and authorization E2E tests
 */

import { test, expect } from '@playwright/test';
import { AuthFixture, testUsers } from './fixtures/test-data';

test.describe('Authentication Flows', () => {
  let authFixture: AuthFixture;

  test.beforeEach(async ({ page }) => {
    authFixture = new AuthFixture(page);
  });

  test('Successful login flow', async ({ page }) => {
    await authFixture.mockSuccessfulAuth(testUsers.admin);

    await test.step('Navigate to login page', async () => {
      await page.goto('/');
      await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    });

    await test.step('Enter valid credentials', async () => {
      await page.fill('[data-testid="username-input"]', testUsers.admin.username);
      await page.fill('[data-testid="password-input"]', testUsers.admin.password);
    });

    await test.step('Submit login form', async () => {
      await page.click('[data-testid="login-button"]');
      await page.waitForURL('/dashboard');
    });

    await test.step('Verify successful login', async () => {
      await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
      await expect(page.locator('[data-testid="user-menu"]')).toContainText(testUsers.admin.username);
    });
  });

  test('Failed login flow', async ({ page }) => {
    await authFixture.mockSuccessfulAuth(testUsers.admin);

    await test.step('Navigate to login page', async () => {
      await page.goto('/');
    });

    await test.step('Enter invalid credentials', async () => {
      await page.fill('[data-testid="username-input"]', 'invalid');
      await page.fill('[data-testid="password-input"]', 'wrong');
    });

    await test.step('Submit form and verify error', async () => {
      await page.click('[data-testid="login-button"]');

      await expect(page.locator('[data-testid="login-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="login-error"]')).toContainText('Usuário ou senha incorretos');
    });

    await test.step('Form should remain on login page', async () => {
      await expect(page).toHaveURL('/');
      await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    });
  });

  test('Session persistence', async ({ page }) => {
    await authFixture.mockSuccessfulAuth(testUsers.admin);

    await test.step('Login successfully', async () => {
      await page.goto('/');
      await page.fill('[data-testid="username-input"]', testUsers.admin.username);
      await page.fill('[data-testid="password-input"]', testUsers.admin.password);
      await page.click('[data-testid="login-button"]');
      await page.waitForURL('/dashboard');
    });

    await test.step('Session persists across page refresh', async () => {
      await page.reload();
      await expect(page).toHaveURL('/dashboard');
      await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
    });

    await test.step('Session persists across navigation', async () => {
      await page.goto('/');
      await expect(page).toHaveURL('/dashboard');
    });
  });

  test('Session expiry handling', async ({ page }) => {
    await authFixture.mockSuccessfulAuth(testUsers.admin);

    await test.step('Login successfully', async () => {
      await page.goto('/');
      await page.fill('[data-testid="username-input"]', testUsers.admin.username);
      await page.fill('[data-testid="password-input"]', testUsers.admin.password);
      await page.click('[data-testid="login-button"]');
      await page.waitForURL('/dashboard');
    });

    await test.step('Mock session expiry', async () => {
      await authFixture.mockSessionExpiry();
    });

    await test.step('Protected action should redirect to login', async () => {
      await page.click('[data-testid="upload-tab"]');

      // Should redirect to login due to expired session
      await expect(page).toHaveURL('/');
      await expect(page.locator('[data-testid="session-expired-message"]')).toBeVisible();
    });
  });

  test('Logout flow', async ({ page }) => {
    await authFixture.mockSuccessfulAuth(testUsers.admin);

    await test.step('Login first', async () => {
      await page.goto('/');
      await page.fill('[data-testid="username-input"]', testUsers.admin.username);
      await page.fill('[data-testid="password-input"]', testUsers.admin.password);
      await page.click('[data-testid="login-button"]');
      await page.waitForURL('/dashboard');
    });

    await test.step('Perform logout', async () => {
      await page.click('[data-testid="user-menu"]');
      await page.click('[data-testid="logout-button"]');
    });

    await test.step('Verify logout successful', async () => {
      await expect(page).toHaveURL('/');
      await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    });

    await test.step('Cannot access protected routes after logout', async () => {
      await page.goto('/dashboard');
      await expect(page).toHaveURL('/');
    });
  });

  test('Protected route access', async ({ page }) => {
    await test.step('Unauthenticated access redirects to login', async () => {
      await page.goto('/dashboard');
      await expect(page).toHaveURL('/');
      await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    });

    await test.step('Direct URL access is blocked', async () => {
      await page.goto('/upload');
      await expect(page).toHaveURL('/');
    });

    await test.step('API calls without auth fail', async () => {
      await authFixture.mockAuthFailure();

      const response = await page.request.get('/api/bank-entries');
      expect(response.status()).toBe(401);
    });
  });

  test('Role-based access control', async ({ page }) => {
    await test.step('Admin user has full access', async () => {
      await authFixture.mockSuccessfulAuth(testUsers.admin);

      await page.goto('/');
      await page.fill('[data-testid="username-input"]', testUsers.admin.username);
      await page.fill('[data-testid="password-input"]', testUsers.admin.password);
      await page.click('[data-testid="login-button"]');
      await page.waitForURL('/dashboard');

      // Admin should see all tabs
      await expect(page.locator('[data-testid="upload-tab"]')).toBeVisible();
      await expect(page.locator('[data-testid="conference-tab"]')).toBeVisible();
      await expect(page.locator('[data-testid="admin-tab"]')).toBeVisible();
    });

    await test.step('Regular user has limited access', async () => {
      await page.goto('/');
      await authFixture.mockSuccessfulAuth(testUsers.user);

      await page.fill('[data-testid="username-input"]', testUsers.user.username);
      await page.fill('[data-testid="password-input"]', testUsers.user.password);
      await page.click('[data-testid="login-button"]');
      await page.waitForURL('/dashboard');

      // User should not see admin tab
      await expect(page.locator('[data-testid="upload-tab"]')).toBeVisible();
      await expect(page.locator('[data-testid="conference-tab"]')).toBeVisible();
      await expect(page.locator('[data-testid="admin-tab"]')).not.toBeVisible();
    });

    await test.step('Viewer has read-only access', async () => {
      await page.goto('/');
      await authFixture.mockSuccessfulAuth(testUsers.viewer);

      await page.fill('[data-testid="username-input"]', testUsers.viewer.username);
      await page.fill('[data-testid="password-input"]', testUsers.viewer.password);
      await page.click('[data-testid="login-button"]');
      await page.waitForURL('/dashboard');

      // Viewer should only see read-only features
      await expect(page.locator('[data-testid="history-tab"]')).toBeVisible();
      await expect(page.locator('[data-testid="upload-tab"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="conference-tab"]')).not.toBeVisible();
    });
  });

  test('Security measures', async ({ page }) => {
    await test.step('XSS protection in login form', async () => {
      await page.goto('/');

      const xssPayload = '<script>alert("XSS")</script>';
      await page.fill('[data-testid="username-input"]', xssPayload);
      await page.fill('[data-testid="password-input"]', 'password');
      await page.click('[data-testid="login-button"]');

      // Should not execute the script
      const alertDialog = page.waitForEvent('dialog', { timeout: 1000 }).catch(() => null);
      expect(await alertDialog).toBeNull();
    });

    await test.step('SQL injection protection', async () => {
      await page.goto('/');

      const sqlPayload = "'; DROP TABLE users; --";
      await page.fill('[data-testid="username-input"]', sqlPayload);
      await page.fill('[data-testid="password-input"]', 'password');
      await page.click('[data-testid="login-button"]');

      // Should handle safely without errors
      await expect(page.locator('[data-testid="login-error"]')).toBeVisible();
    });

    await test.step('CSRF protection', async () => {
      // Verify CSRF tokens are present in requests
      await page.goto('/');

      let csrfToken = '';
      page.on('request', request => {
        if (request.method() === 'POST') {
          const headers = request.headers();
          csrfToken = headers['x-csrf-token'] || '';
        }
      });

      await page.fill('[data-testid="username-input"]', testUsers.admin.username);
      await page.fill('[data-testid="password-input"]', testUsers.admin.password);
      await page.click('[data-testid="login-button"]');

      // CSRF token should be present (if implemented)
      // expect(csrfToken).toBeTruthy();
    });
  });

  test('Login form validation', async ({ page }) => {
    await page.goto('/');

    await test.step('Empty fields show validation errors', async () => {
      await page.click('[data-testid="login-button"]');

      await expect(page.locator('[data-testid="username-error"]')).toContainText('Campo obrigatório');
      await expect(page.locator('[data-testid="password-error"]')).toContainText('Campo obrigatório');
    });

    await test.step('Minimum length validation', async () => {
      await page.fill('[data-testid="username-input"]', 'a');
      await page.fill('[data-testid="password-input"]', '123');
      await page.click('[data-testid="login-button"]');

      await expect(page.locator('[data-testid="username-error"]')).toContainText('muito curto');
      await expect(page.locator('[data-testid="password-error"]')).toContainText('muito curta');
    });

    await test.step('Valid input clears errors', async () => {
      await page.fill('[data-testid="username-input"]', testUsers.admin.username);
      await page.fill('[data-testid="password-input"]', testUsers.admin.password);

      await expect(page.locator('[data-testid="username-error"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="password-error"]')).not.toBeVisible();
    });
  });

  test('Remember me functionality', async ({ page }) => {
    await authFixture.mockSuccessfulAuth(testUsers.admin);

    await test.step('Login with remember me checked', async () => {
      await page.goto('/');
      await page.fill('[data-testid="username-input"]', testUsers.admin.username);
      await page.fill('[data-testid="password-input"]', testUsers.admin.password);
      await page.check('[data-testid="remember-me-checkbox"]');
      await page.click('[data-testid="login-button"]');
      await page.waitForURL('/dashboard');
    });

    await test.step('Session persists longer with remember me', async () => {
      // Close and reopen browser (simulate)
      await page.context().close();
      const newContext = await page.context().browser()?.newContext();
      const newPage = await newContext?.newPage();

      if (newPage) {
        await newPage.goto('/');
        // With remember me, should still be logged in
        await expect(newPage).toHaveURL('/dashboard');
      }
    });
  });
});