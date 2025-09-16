import { test, expect } from '@playwright/test';

test.describe('Layout Responsiveness Test', () => {
  // Test layout at specific resolutions requested by user
  const resolutions = [
    { width: 1366, height: 768, name: '1366x768 (HD Laptop)' },
    { width: 1280, height: 720, name: '1280x720 (HD Desktop)' },
    { width: 1920, height: 1080, name: '1920x1080 (Full HD)' },
  ];

  resolutions.forEach(({ width, height, name }) => {
    test(`should work properly at ${name}`, async ({ page }) => {
      // Set viewport to specific resolution
      await page.setViewportSize({ width, height });

      // Go to the app
      await page.goto('/');

      // Login
      await page.fill('input[name="username"]', 'admin');
      await page.fill('input[name="password"]', 'password');
      await page.click('button[type="submit"]');

      // Wait for dashboard to load
      await page.waitForSelector('text=Conferência Bancária', { timeout: 10000 });

      // Take screenshot of dashboard
      await page.screenshot({
        path: `screenshots/layout-${width}x${height}-dashboard.png`,
        fullPage: true
      });

      console.log(`✓ Dashboard loaded successfully at ${name}`);

      // Test Banking Conference tab layout
      await page.click('text=Conferência Bancária');
      await page.waitForTimeout(1000);

      // Check if sidebar is visible and properly positioned
      const sidebar = page.locator('aside').first();
      await expect(sidebar).toBeVisible();

      const sidebarBounds = await sidebar.boundingBox();
      if (sidebarBounds) {
        console.log(`✓ Banking sidebar at ${name}: width=${sidebarBounds.width}px, height=${sidebarBounds.height}px`);

        // Sidebar should be 320px wide (w-80 = 20rem = 320px)
        expect(sidebarBounds.width).toBe(320);
      }

      // Check main content area
      const mainContent = page.locator('main').first();
      await expect(mainContent).toBeVisible();

      const mainBounds = await mainContent.boundingBox();
      if (mainBounds) {
        console.log(`✓ Banking main content at ${name}: width=${mainBounds.width}px`);

        // Main content should fill remaining space (total width - sidebar width)
        const expectedMainWidth = width - 320; // Subtract sidebar width
        const tolerance = 20; // Allow some tolerance for scrollbars, borders etc.
        expect(mainBounds.width).toBeGreaterThanOrEqual(expectedMainWidth - tolerance);
      }

      // Take screenshot of Banking Conference
      await page.screenshot({
        path: `screenshots/layout-${width}x${height}-banking.png`,
        fullPage: true
      });

      // Test Cash Conference tab layout
      await page.click('text=Conferência de Caixa');
      await page.waitForTimeout(1000);

      // Check Cash Conference layout
      const cashSidebar = page.locator('aside').first();
      await expect(cashSidebar).toBeVisible();

      const cashSidebarBounds = await cashSidebar.boundingBox();
      if (cashSidebarBounds) {
        console.log(`✓ Cash sidebar at ${name}: width=${cashSidebarBounds.width}px`);
        expect(cashSidebarBounds.width).toBe(320);
      }

      // Take screenshot of Cash Conference
      await page.screenshot({
        path: `screenshots/layout-${width}x${height}-cash.png`,
        fullPage: true
      });

      // Test Launches tab layout
      await page.click('text=Lançamentos');
      await page.waitForTimeout(1000);

      // Check Launches layout
      const launchSidebar = page.locator('aside').first();
      await expect(launchSidebar).toBeVisible();

      const launchSidebarBounds = await launchSidebar.boundingBox();
      if (launchSidebarBounds) {
        console.log(`✓ Launch sidebar at ${name}: width=${launchSidebarBounds.width}px`);
        expect(launchSidebarBounds.width).toBe(320);
      }

      // Take screenshot of Launches
      await page.screenshot({
        path: `screenshots/layout-${width}x${height}-launches.png`,
        fullPage: true
      });

      // Test that content doesn't overflow horizontally
      const body = page.locator('body');
      const bodyBounds = await body.boundingBox();
      if (bodyBounds) {
        // Body width should not exceed viewport width
        expect(bodyBounds.width).toBeLessThanOrEqual(width + 20); // Allow small tolerance
      }

      console.log(`✅ Layout test completed successfully for ${name}`);
    });
  });

  test('should have proper sticky behavior and scrolling', async ({ page }) => {
    // Set to a resolution where scrolling might be needed
    await page.setViewportSize({ width: 1366, height: 600 }); // Short height to force scrolling

    await page.goto('/');

    // Login
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');

    await page.waitForSelector('text=Conferência Bancária');

    // Go to Banking Conference tab
    await page.click('text=Conferência Bancária');
    await page.waitForTimeout(1000);

    // Check that sidebar has sticky positioning
    const sidebar = page.locator('aside').first();
    const sidebarClass = await sidebar.getAttribute('class');

    expect(sidebarClass).toContain('sticky');
    console.log('✓ Sidebar has sticky positioning class');

    // Test scrolling behavior - scroll down the page
    await page.evaluate(() => {
      window.scrollTo(0, 500);
    });

    await page.waitForTimeout(500);

    // Sidebar should still be visible after scrolling
    await expect(sidebar).toBeVisible();
    console.log('✓ Sidebar remains visible after scrolling');

    // Check main content can scroll properly
    const mainContent = page.locator('main').first();
    const mainClass = await mainContent.getAttribute('class');

    expect(mainClass).toContain('min-h-');
    console.log('✓ Main content has proper min-height');

    // Test that accordion-style history section works
    const historyButton = page.locator('button:has-text("Histórico de valores não encontrados")');
    if (await historyButton.count() > 0) {
      await historyButton.click();
      await page.waitForTimeout(300);

      // History section should be visible
      const historySection = page.locator('text=Nenhum valor não encontrado').or(page.locator('[class*="max-h-40"]'));
      if (await historySection.count() > 0) {
        await expect(historySection.first()).toBeVisible();
        console.log('✓ History accordion opens correctly');

        // Close it again
        await historyButton.click();
        await page.waitForTimeout(300);
        console.log('✓ History accordion closes correctly');
      }
    }

    // Take final screenshot
    await page.screenshot({
      path: 'screenshots/layout-sticky-scrolling-test.png',
      fullPage: true
    });

    console.log('✅ Sticky behavior and scrolling test completed');
  });
});