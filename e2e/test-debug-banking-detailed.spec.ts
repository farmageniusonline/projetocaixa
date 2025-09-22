import { test, expect } from '@playwright/test';

test('Debug Banking tab layout in detail', async ({ page }) => {
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

  console.log('=== BANKING TAB DEBUG ===');

  // Get root flex container
  const rootFlex = page.locator('div.flex.h-\\[calc\\(100vh-8rem\\)\\]').first();
  const rootFlexBox = await rootFlex.boundingBox();
  console.log('Root flex container:', rootFlexBox);

  // Get aside
  const aside = page.locator('aside');
  const asideBox = await aside.boundingBox();
  console.log('Banking aside:', asideBox);

  // Get main element
  const main = page.locator('main');
  const mainBox = await main.boundingBox();
  console.log('Banking main:', mainBox);

  // Check main's direct children
  const mainChildren = main.locator('> *');
  const mainChildrenCount = await mainChildren.count();
  console.log('Main children count:', mainChildrenCount);

  for (let i = 0; i < mainChildrenCount; i++) {
    const child = mainChildren.nth(i);
    const childBox = await child.boundingBox();
    const childClass = await child.getAttribute('class');
    console.log(`Main child ${i}:`, { box: childBox, class: childClass });
  }

  // Look for the actual content container
  const processingDiv = page.locator('main .flex-1.overflow-auto');
  if (await processingDiv.count() > 0) {
    const processingBox = await processingDiv.boundingBox();
    console.log('Processing container (.flex-1.overflow-auto):', processingBox);

    // Check its children
    const processingChildren = processingDiv.locator('> *');
    const processingChildrenCount = await processingChildren.count();
    console.log('Processing children count:', processingChildrenCount);

    for (let i = 0; i < processingChildrenCount; i++) {
      const child = processingChildren.nth(i);
      const childBox = await child.boundingBox();
      const childClass = await child.getAttribute('class');
      console.log(`Processing child ${i}:`, { box: childBox, class: childClass });
    }
  }

  // Look for the actual table container
  const tableContainer = page.locator('.bg-gray-800.border.border-gray-700.w-full');
  if (await tableContainer.count() > 0) {
    const tableBox = await tableContainer.boundingBox();
    console.log('Table container (.bg-gray-800.border.border-gray-700.w-full):', tableBox);
  }

  console.log('✅ Banking debug completed');
});