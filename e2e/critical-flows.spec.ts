/**
 * Critical E2E flows for Manipularium banking reconciliation system
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const TEST_TIMEOUT = 30000;
const NAVIGATION_TIMEOUT = 15000;

// Mock user credentials
const TEST_USER = {
  username: 'admin',
  password: 'admin123'
};

// Mock data for testing
const MOCK_BANK_DATA = {
  date: '25/12/2023',
  paymentType: 'PIX RECEBIDO',
  cpf: '12345678901',
  value: '150,00',
  history: 'Pagamento teste E2E'
};

// Page object for common actions
class ManipulariumPage {
  constructor(private page: Page) {}

  async login(username: string = TEST_USER.username, password: string = TEST_USER.password) {
    await this.page.goto('/');

    // Wait for login form
    await this.page.waitForSelector('[data-testid="login-form"]', { timeout: NAVIGATION_TIMEOUT });

    // Fill credentials
    await this.page.fill('[data-testid="username-input"]', username);
    await this.page.fill('[data-testid="password-input"]', password);

    // Submit form
    await this.page.click('[data-testid="login-button"]');

    // Wait for dashboard
    await this.page.waitForURL('/dashboard', { timeout: NAVIGATION_TIMEOUT });
    await this.page.waitForSelector('[data-testid="dashboard"]', { timeout: NAVIGATION_TIMEOUT });
  }

  async uploadExcelFile(filePath: string) {
    // Navigate to upload tab
    await this.page.click('[data-testid="upload-tab"]');

    // Wait for upload interface
    await this.page.waitForSelector('[data-testid="file-upload"]', { timeout: NAVIGATION_TIMEOUT });

    // Upload file
    await this.page.setInputFiles('[data-testid="file-input"]', filePath);

    // Wait for processing
    await this.page.waitForSelector('[data-testid="upload-success"]', { timeout: TEST_TIMEOUT });
  }

  async performConference(searchValue: string) {
    // Navigate to conference tab
    await this.page.click('[data-testid="conference-tab"]');

    // Wait for conference interface
    await this.page.waitForSelector('[data-testid="conference-search"]', { timeout: NAVIGATION_TIMEOUT });

    // Search for value
    await this.page.fill('[data-testid="search-input"]', searchValue);
    await this.page.press('[data-testid="search-input"]', 'Enter');

    // Wait for results
    await this.page.waitForSelector('[data-testid="search-results"]', { timeout: TEST_TIMEOUT });

    // Select first result
    await this.page.click('[data-testid="result-item"]:first-child [data-testid="select-button"]');

    // Confirm conference
    await this.page.click('[data-testid="confirm-conference"]');

    // Wait for success
    await this.page.waitForSelector('[data-testid="conference-success"]', { timeout: TEST_TIMEOUT });
  }
}

// Setup and teardown
test.beforeEach(async ({ page }) => {
  // Set longer timeouts for banking operations
  page.setDefaultTimeout(TEST_TIMEOUT);

  // Mock API responses if needed
  await page.route('**/api/auth/**', route => {
    if (route.request().method() === 'POST') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, user: { id: '1', username: 'admin' } })
      });
    } else {
      route.continue();
    }
  });
});

test.describe('Critical User Flows', () => {

  test('Complete banking reconciliation workflow', async ({ page }) => {
    const manipularium = new ManipulariumPage(page);

    test.setTimeout(60000); // Extended timeout for full workflow

    // Step 1: Login
    await test.step('User can login successfully', async () => {
      await manipularium.login();

      // Verify dashboard loaded
      await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
      await expect(page.locator('[data-testid="user-menu"]')).toContainText('admin');
    });

    // Step 2: Upload Excel file
    await test.step('User can upload Excel file', async () => {
      // Create a mock Excel file for testing
      const mockExcelContent = Buffer.from('Date,Payment Type,CPF,Value,History\n25/12/2023,PIX RECEBIDO,12345678901,150.00,Test payment');

      // Mock file upload
      await page.route('**/upload/**', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            rowsProcessed: 1,
            data: [MOCK_BANK_DATA]
          })
        });
      });

      await manipularium.uploadExcelFile('test-data.csv');

      // Verify upload success
      await expect(page.locator('[data-testid="upload-success"]')).toBeVisible();
      await expect(page.locator('[data-testid="rows-processed"]')).toContainText('1');
    });

    // Step 3: Perform conference
    await test.step('User can perform banking conference', async () => {
      await manipularium.performConference('150,00');

      // Verify conference completed
      await expect(page.locator('[data-testid="conference-success"]')).toBeVisible();
    });

    // Step 4: View results
    await test.step('User can view conference results', async () => {
      // Navigate to history
      await page.click('[data-testid="history-tab"]');

      // Verify transaction appears
      await expect(page.locator('[data-testid="transaction-history"]')).toBeVisible();
      await expect(page.locator('[data-testid="transaction-row"]').first()).toContainText('150,00');
    });
  });

  test('Error handling and recovery', async ({ page }) => {
    const manipularium = new ManipulariumPage(page);

    await test.step('Handle login errors gracefully', async () => {
      await page.goto('/');

      // Try invalid credentials
      await page.fill('[data-testid="username-input"]', 'invalid');
      await page.fill('[data-testid="password-input"]', 'wrong');
      await page.click('[data-testid="login-button"]');

      // Verify error message
      await expect(page.locator('[data-testid="login-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="login-error"]')).toContainText('Usuário ou senha incorretos');
    });

    await test.step('Handle file upload errors', async () => {
      await manipularium.login();

      // Mock upload error
      await page.route('**/upload/**', route => {
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Invalid file format'
          })
        });
      });

      await page.click('[data-testid="upload-tab"]');

      // Try to upload invalid file
      const invalidFile = Buffer.from('invalid content');
      await page.setInputFiles('[data-testid="file-input"]', [
        { name: 'invalid.txt', mimeType: 'text/plain', buffer: invalidFile }
      ]);

      // Verify error handling
      await expect(page.locator('[data-testid="upload-error"]')).toBeVisible();
    });
  });

  test('Performance and responsiveness', async ({ page }) => {
    const manipularium = new ManipulariumPage(page);

    await test.step('Page loads within performance budget', async () => {
      const startTime = Date.now();
      await manipularium.login();
      const loadTime = Date.now() - startTime;

      // Verify load time is under 3 seconds
      expect(loadTime).toBeLessThan(3000);
    });

    await test.step('Search is responsive', async () => {
      await page.click('[data-testid="conference-tab"]');

      const startTime = Date.now();
      await page.fill('[data-testid="search-input"]', '150');
      await page.waitForSelector('[data-testid="search-results"]', { timeout: 2000 });
      const searchTime = Date.now() - startTime;

      // Search should be fast
      expect(searchTime).toBeLessThan(2000);
    });
  });

  test('Mobile responsiveness', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    const manipularium = new ManipulariumPage(page);

    await test.step('Mobile login works', async () => {
      await manipularium.login();

      // Verify mobile layout
      await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
    });

    await test.step('Mobile navigation works', async () => {
      // Open mobile menu
      await page.click('[data-testid="mobile-menu-button"]');

      // Navigate to upload
      await page.click('[data-testid="mobile-upload-link"]');

      // Verify navigation
      await expect(page.locator('[data-testid="file-upload"]')).toBeVisible();
    });
  });

  test('Data persistence and sync', async ({ page }) => {
    const manipularium = new ManipulariumPage(page);

    await test.step('Data persists across page refreshes', async () => {
      await manipularium.login();

      // Upload data
      await page.route('**/upload/**', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            rowsProcessed: 1
          })
        });
      });

      await manipularium.uploadExcelFile('test-data.csv');

      // Refresh page
      await page.reload();

      // Verify data still exists
      await page.click('[data-testid="history-tab"]');
      await expect(page.locator('[data-testid="transaction-history"]')).toBeVisible();
    });
  });

  test('Security and authentication', async ({ page }) => {
    await test.step('Unauthenticated users are redirected', async () => {
      await page.goto('/dashboard');

      // Should redirect to login
      await expect(page).toHaveURL('/');
      await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    });

    await test.step('Session timeout handling', async () => {
      const manipularium = new ManipulariumPage(page);
      await manipularium.login();

      // Mock session expiry
      await page.route('**/api/**', route => {
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Session expired' })
        });
      });

      // Try to access protected resource
      await page.click('[data-testid="conference-tab"]');

      // Should redirect to login
      await expect(page).toHaveURL('/');
    });
  });

  test('Accessibility compliance', async ({ page }) => {
    const manipularium = new ManipulariumPage(page);

    await test.step('Keyboard navigation works', async () => {
      await page.goto('/');

      // Navigate with keyboard
      await page.press('body', 'Tab'); // Username field
      await page.keyboard.type(TEST_USER.username);

      await page.press('body', 'Tab'); // Password field
      await page.keyboard.type(TEST_USER.password);

      await page.press('body', 'Tab'); // Login button
      await page.press('body', 'Enter');

      // Verify login worked
      await expect(page).toHaveURL('/dashboard');
    });

    await test.step('Screen reader compatibility', async () => {
      await manipularium.login();

      // Check for ARIA labels
      await expect(page.locator('[data-testid="main-content"]')).toHaveAttribute('role', 'main');
      await expect(page.locator('[data-testid="navigation"]')).toHaveAttribute('role', 'navigation');
    });
  });
});

// Test data cleanup
test.afterEach(async ({ page }) => {
  // Clear any stored data
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

// Performance reporting
test.afterAll(async () => {
  console.log('E2E tests completed. Check playwright-report for detailed results.');
});