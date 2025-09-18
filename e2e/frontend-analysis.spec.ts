import { test, expect } from '@playwright/test';

test.describe('Frontend Analysis', () => {
  let consoleErrors: string[] = [];
  let networkErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    // Capture console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
        console.log('🔴 Console error:', msg.text());
      }
      if (msg.type() === 'warning') {
        console.log('🟡 Console warning:', msg.text());
      }
    });

    // Capture network errors
    page.on('response', (response) => {
      if (response.status() >= 400) {
        networkErrors.push(`${response.status()} ${response.url()}`);
        console.log('🌐 Network error:', response.status(), response.url());
      }
    });

    // Capture page errors
    page.on('pageerror', (error) => {
      console.log('💥 Page error:', error.message);
      consoleErrors.push(error.message);
    });
  });

  test('should load homepage without critical errors', async ({ page }) => {
    console.log('🚀 Starting frontend analysis...');

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // Wait for all async operations

    // Check if React root has content
    const rootContent = await page.locator('#root').textContent();
    console.log('📄 Root content length:', rootContent?.length || 0);

    // Verify basic page structure
    await expect(page.locator('#root')).toBeVisible();

    // Check if main navigation/content is present
    const hasContent = rootContent && rootContent.length > 50;
    expect(hasContent).toBe(true);

    // Take screenshot for visual inspection
    await page.screenshot({
      path: 'test-results/frontend-homepage.png',
      fullPage: true
    });

    console.log('✅ Homepage loaded successfully');
  });

  test('should test login functionality', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check if login form is present
    const hasLoginForm = await page.locator('input[type="text"], input[type="password"]').count() > 0;

    if (hasLoginForm) {
      console.log('🔐 Login form detected');

      // Try to fill login form
      const usernameInput = page.locator('input[type="text"]').first();
      const passwordInput = page.locator('input[type="password"]').first();

      if (await usernameInput.isVisible()) {
        await usernameInput.fill('admin');
        console.log('👤 Username filled');
      }

      if (await passwordInput.isVisible()) {
        await passwordInput.fill('manipularium');
        console.log('🔑 Password filled');
      }

      // Look for submit button
      const submitButton = page.locator('button:has-text("Entrar"), button[type="submit"]').first();
      if (await submitButton.isVisible()) {
        await submitButton.click();
        console.log('🚪 Login button clicked');

        // Wait for potential navigation
        await page.waitForTimeout(3000);

        // Take screenshot after login attempt
        await page.screenshot({
          path: 'test-results/frontend-after-login.png',
          fullPage: true
        });
      }
    } else {
      console.log('ℹ️ No login form detected - might be already authenticated');
    }
  });

  test('should check for main application components', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Login if needed
    const hasLoginForm = await page.locator('input[type="password"]').count() > 0;
    if (hasLoginForm) {
      await page.fill('input[type="text"]', 'admin');
      await page.fill('input[type="password"]', 'manipularium');
      await page.click('button:has-text("Entrar")');
      await page.waitForTimeout(3000);
    }

    // Check for file upload component
    const fileInput = page.locator('input[type="file"]');
    const hasFileInput = await fileInput.count() > 0;
    console.log('📁 File input present:', hasFileInput);

    // Check for data table components
    const dataTable = page.locator('table, [data-testid*="table"], .data-table');
    const hasDataTable = await dataTable.count() > 0;
    console.log('📊 Data table present:', hasDataTable);

    // Check for navigation/tabs
    const navigation = page.locator('nav, [role="navigation"], .nav-tabs, .tabs');
    const hasNavigation = await navigation.count() > 0;
    console.log('🧭 Navigation present:', hasNavigation);

    // Check for buttons/controls
    const buttons = await page.locator('button').count();
    console.log('🔘 Buttons count:', buttons);

    // Check for forms
    const forms = await page.locator('form, input, textarea').count();
    console.log('📝 Form elements count:', forms);

    // Take screenshot of main interface
    await page.screenshot({
      path: 'test-results/frontend-main-interface.png',
      fullPage: true
    });
  });

  test('should test responsive design', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Test different viewport sizes
    const viewports = [
      { width: 375, height: 667, name: 'mobile' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 1920, height: 1080, name: 'desktop' }
    ];

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(1000);

      // Check if content is still visible
      const rootContent = await page.locator('#root').textContent();
      const hasContent = rootContent && rootContent.length > 50;

      console.log(`📱 ${viewport.name} (${viewport.width}x${viewport.height}): Content visible:`, hasContent);

      await page.screenshot({
        path: `test-results/frontend-${viewport.name}.png`,
        fullPage: true
      });
    }
  });

  test.afterEach(async () => {
    // Report errors found
    if (consoleErrors.length > 0) {
      console.log('🔴 Console errors found:', consoleErrors.length);
      consoleErrors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

    if (networkErrors.length > 0) {
      console.log('🌐 Network errors found:', networkErrors.length);
      networkErrors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

    // Reset arrays for next test
    consoleErrors = [];
    networkErrors = [];
  });
});