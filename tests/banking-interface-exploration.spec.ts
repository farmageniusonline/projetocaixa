import { test, expect } from '@playwright/test';

test.describe('Banking Interface Real Exploration', () => {
  test('should properly login and explore banking conference', async ({ page }) => {
    console.log('🚀 Starting real Banking Conference exploration...');

    // Go to the app
    await page.goto('/');
    await page.screenshot({ path: 'banking-screenshots/01-login-page.png', fullPage: true });

    // Login with correct credentials
    console.log('🔐 Attempting login...');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');

    // Wait for dashboard to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'banking-screenshots/02-dashboard-loaded.png', fullPage: true });

    // Check if we're logged in by looking for dashboard elements
    const dashboardElements = await page.locator('text=Lançamentos, text=Conferência, text=Sistema').count();
    console.log(`📊 Dashboard elements found: ${dashboardElements}`);

    if (dashboardElements === 0) {
      // Try to wait for specific dashboard content
      try {
        await page.waitForSelector('button:has-text("Lançamentos")', { timeout: 5000 });
        console.log('✅ Found Lançamentos tab');
      } catch {
        await page.waitForSelector('text=Conferência', { timeout: 5000 });
        console.log('✅ Found Conferência text');
      }
    }

    await page.screenshot({ path: 'banking-screenshots/03-after-login-wait.png', fullPage: true });

    // Look for Banking Conference tab and click it
    console.log('🏦 Looking for Banking Conference tab...');

    const bankingTabs = [
      'button:has-text("Conferência Bancária")',
      'text=Conferência Bancária',
      '[data-testid*="banking"]',
      'button:contains("Bancária")'
    ];

    let tabFound = false;
    for (const selector of bankingTabs) {
      try {
        const element = page.locator(selector);
        if (await element.count() > 0) {
          await element.first().click();
          console.log(`✅ Clicked Banking Conference tab with selector: ${selector}`);
          tabFound = true;
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!tabFound) {
      console.log('⚠️ Banking Conference tab not found, exploring current interface...');
    }

    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'banking-screenshots/04-banking-interface.png', fullPage: true });

    // Analyze the current interface
    console.log('🔍 Analyzing current interface structure...');

    // Get page title
    const title = await page.title();
    console.log(`📄 Page title: ${title}`);

    // Check for main navigation/tabs
    const tabs = await page.locator('button[role="tab"], .tab, [class*="tab"]').count();
    const navButtons = await page.locator('nav button, button[aria-selected]').count();
    console.log(`📑 Navigation tabs: ${tabs}, Nav buttons: ${navButtons}`);

    // Check for main content areas
    const mainContent = await page.locator('main, .main-content, [role="main"]').count();
    const sidebars = await page.locator('aside, .sidebar, [class*="sidebar"]').count();
    console.log(`🏗️ Main content areas: ${mainContent}, Sidebars: ${sidebars}`);

    // Look for banking-specific elements anywhere on the page
    const bankingElements = {
      fileInputs: await page.locator('input[type="file"]').count(),
      loadButtons: await page.locator('button:has-text("Carregar"), button:has-text("Load")').count(),
      clearButtons: await page.locator('button:has-text("Limpar"), button:has-text("Clear")').count(),
      dateInputs: await page.locator('input[type="date"]').count(),
      valueInputs: await page.locator('input[placeholder*="valor"], input[placeholder*="value"]').count(),
      stepIndicators: await page.locator('.bg-indigo-600:has-text("1"), .bg-indigo-600:has-text("2"), .bg-indigo-600:has-text("3")').count()
    };

    console.log('🏦 Banking-specific elements found:');
    Object.entries(bankingElements).forEach(([key, count]) => {
      console.log(`   ${key}: ${count}`);
    });

    // Look for specific text content
    const textContent = await page.content();
    const bankingKeywords = [
      'Carregar Planilha',
      'Selecionar Dia',
      'Conferir Valor',
      'Histórico',
      'Conferência Bancária',
      'Lançamentos',
      'Planilha'
    ];

    console.log('📝 Banking keywords found on page:');
    bankingKeywords.forEach(keyword => {
      const found = textContent.includes(keyword);
      console.log(`   "${keyword}": ${found ? '✅' : '❌'}`);
    });

    // Test interactions with available elements
    console.log('🎮 Testing interactions...');

    // Try clicking on different tabs if they exist
    const allButtons = page.locator('button:visible');
    const buttonCount = await allButtons.count();
    console.log(`🔘 Found ${buttonCount} visible buttons`);

    if (buttonCount > 0) {
      for (let i = 0; i < Math.min(buttonCount, 10); i++) {
        const button = allButtons.nth(i);
        const text = await button.textContent();
        const isEnabled = await button.isEnabled();

        if (text && text.length > 0) {
          console.log(`   Button ${i + 1}: "${text.trim()}" (${isEnabled ? 'enabled' : 'disabled'})`);

          // If it's a tab button, try clicking it
          if (text.includes('Conferência') || text.includes('Bancária') || text.includes('Lançamentos')) {
            try {
              await button.click();
              console.log(`     ✅ Clicked "${text.trim()}"`);
              await page.waitForTimeout(1000);
              await page.screenshot({ path: `banking-screenshots/05-clicked-${text.trim().replace(/\s+/g, '-').toLowerCase()}.png`, fullPage: true });
            } catch (e) {
              console.log(`     ❌ Failed to click "${text.trim()}"`);
            }
          }
        }
      }
    }

    // Final comprehensive screenshot
    await page.screenshot({ path: 'banking-screenshots/06-final-exploration.png', fullPage: true });

    // Test mobile responsiveness
    console.log('📱 Testing mobile responsiveness...');
    await page.setViewportSize({ width: 375, height: 667 });
    await page.screenshot({ path: 'banking-screenshots/07-mobile-responsive.png', fullPage: true });

    // Back to desktop
    await page.setViewportSize({ width: 1920, height: 1080 });

    console.log('✨ Banking Conference exploration complete!');
    console.log('📸 All screenshots saved to banking-screenshots/ directory');

    // Summary report
    console.log('\n📊 EXPLORATION SUMMARY:');
    console.log('═══════════════════════════════════════════');
    console.log(`🔐 Login successful: ${dashboardElements > 0 || tabs > 0 ? 'Yes' : 'Maybe'}`);
    console.log(`📑 Navigation tabs: ${tabs + navButtons}`);
    console.log(`🏗️ Layout structure: ${mainContent} main areas, ${sidebars} sidebars`);
    console.log(`🏦 Banking elements: ${Object.values(bankingElements).reduce((a, b) => a + b, 0)} total`);
    console.log(`📝 Banking keywords: ${bankingKeywords.filter(kw => textContent.includes(kw)).length}/${bankingKeywords.length} found`);
    console.log(`🔘 Interactive buttons: ${buttonCount}`);
  });
});