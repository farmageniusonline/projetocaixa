import { test, expect } from '@playwright/test';

test.describe('Debug Test', () => {
  test('check what is actually rendered', async ({ page }) => {
    // Capture console logs
    page.on('console', msg => console.log('Browser console:', msg.text()));
    page.on('pageerror', error => console.log('Page error:', error.message));

    await page.goto('/');

    // Wait for page to load
    await page.waitForTimeout(3000);

    // Take a screenshot
    await page.screenshot({ path: 'debug-screenshot.png' });

    // Check if page has loaded at all
    const hasReactRoot = await page.locator('#root').count();
    console.log('React root elements:', hasReactRoot);

    // Check root content
    const rootContent = await page.locator('#root').innerHTML();
    console.log('Root innerHTML:', rootContent);

    // Get all text content
    const bodyText = await page.locator('body').textContent();
    console.log('Body text:', bodyText);

    // Wait longer and check again
    await page.waitForTimeout(5000);
    const bodyTextAfterWait = await page.locator('body').textContent();
    console.log('Body text after wait:', bodyTextAfterWait);

    const rootContentAfterWait = await page.locator('#root').innerHTML();
    console.log('Root innerHTML after wait:', rootContentAfterWait);
  });
});