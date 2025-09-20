import { test, expect } from '@playwright/test';

test.describe('Simple Tests', () => {
  test('should load homepage', async ({ page }) => {
    // Listen for console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log('Console error:', msg.text());
      }
    });

    // Listen for page errors
    page.on('pageerror', (error) => {
      console.log('Page error:', error.message);
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for React to load
    await page.waitForTimeout(5000);

    // Check if page title is correct
    await expect(page).toHaveTitle(/Manipularium/i);

    // Look for React root content
    const reactRoot = page.locator('#root');
    await expect(reactRoot).toBeVisible();

    // Check if there's any content in the root
    const rootContent = await reactRoot.textContent();
    console.log('Root content length:', rootContent?.length || 0);

    // Take a screenshot for debugging
    await page.screenshot({ path: 'test-results/homepage.png' });
  });

  test('should have file input', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait a bit more for JavaScript to load
    await page.waitForTimeout(3000);

    // Look for file input with different selectors
    const fileInputs = [
      'input[type="file"]',
      'input[accept*="excel"]',
      'input[accept*=".xlsx"]',
      'input[accept*=".csv"]',
      '[data-testid="file-input"]',
      '.file-input'
    ];

    let foundInput = false;
    for (const selector of fileInputs) {
      const input = page.locator(selector);
      if (await input.count() > 0) {
        console.log(`Found file input with selector: ${selector}`);
        foundInput = true;
        break;
      }
    }

    // Take a screenshot to see the current state
    await page.screenshot({ path: 'test-results/file-input-search.png' });

    // Log page content for debugging
    const bodyText = await page.locator('body').textContent();
    console.log('Page content preview:', bodyText?.substring(0, 500));

    expect(foundInput).toBe(true);
  });
});