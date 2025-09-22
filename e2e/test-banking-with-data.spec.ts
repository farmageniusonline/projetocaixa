import { test, expect } from '@playwright/test';

test('Test Banking tab width with actual data loaded', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:5175');

  // Login
  await page.fill('[data-testid="username-input"]', 'admin@manipularium.com.br');
  await page.fill('[data-testid="password-input"]', 'manipularium');
  await page.click('[data-testid="login-button"]');
  await page.waitForTimeout(2000);

  // Go to Banking tab
  await page.click('text=Conferência Bancária');
  await page.waitForTimeout(1000);

  console.log('=== BANKING TAB WITH DATA TEST ===');

  // Check if we have a "no data" state
  const noDataDiv = page.locator('text=Carregue uma planilha para começar a conferir valores');
  const hasNoData = await noDataDiv.count() > 0;
  console.log('Has no data state:', hasNoData);

  if (hasNoData) {
    console.log('Banking tab is in "no data" state - this explains the narrow width');

    // Check the empty state container dimensions
    const emptyStateContainer = page.locator('.bg-gray-800.shadow-2xl.border.border-gray-700.h-full');
    const emptyStateBox = await emptyStateContainer.boundingBox();
    console.log('Empty state container:', emptyStateBox);

    // Check if this container has different width constraints
    const emptyStateStyle = await emptyStateContainer.getAttribute('style');
    const emptyStateClass = await emptyStateContainer.getAttribute('class');
    console.log('Empty state style:', emptyStateStyle);
    console.log('Empty state class:', emptyStateClass);
  }

  // Test the main container dimensions
  const main = page.locator('main');
  const mainBox = await main.boundingBox();
  console.log('Banking main:', mainBox);

  // Expected behavior: main should be 1152px width (1440 - 288 sidebar)
  const expectedWidth = 1440 - 288; // 1152px
  const actualWidth = mainBox?.width || 0;
  const widthDifference = Math.abs(expectedWidth - actualWidth);

  console.log('Expected main width:', expectedWidth);
  console.log('Actual main width:', actualWidth);
  console.log('Width difference:', widthDifference);

  if (widthDifference > 10) {
    console.log('❌ Banking main is not using full width available');
  } else {
    console.log('✅ Banking main is using full width correctly');
  }

  console.log('✅ Banking with data test completed');
});