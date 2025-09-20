import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('🔧 Timeout Fix Verification', () => {
  test('should process file without timeout errors', async ({ page }) => {
    test.setTimeout(180000); // 3 minutes max for this test

    console.log('🧪 Testing timeout fix for file processing...');

    // Navigate and login
    await page.goto('http://localhost:5175');
    await page.waitForLoadState('networkidle');

    const loginForm = page.locator('form');
    if (await loginForm.isVisible()) {
      await page.fill('input[name="username"]', 'teste@manipularium.com');
      await page.fill('input[name="password"]', 'TesteSeguro123');
      await page.click('button[type="submit"]');
      await page.waitForLoadState('networkidle');
    }

    // Go to Banking Conference
    await page.click('button:has-text("Conferência Bancária")');
    await page.waitForTimeout(2000);

    // Monitor console for worker heartbeat and timeout issues
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      const message = msg.text();
      consoleLogs.push(`[${msg.type()}] ${message}`);

      // Log important messages
      if (message.includes('Worker:') ||
          message.includes('Heartbeat') ||
          message.includes('timeout') ||
          message.includes('TimeoutError') ||
          message.includes('processamento')) {
        console.log(`📋 ${message}`);
      }
    });

    // Upload file
    const fileInput = page.locator('input[type="file"]#fileInput');
    const xlsFilePath = path.join(process.cwd(), 'exemplo', 'caixa_11-09.xls');

    console.log('📁 Uploading file:', xlsFilePath);
    await fileInput.setInputFiles(xlsFilePath);

    // Click load button
    const loadButton = page.locator('button', { hasText: /carregar/i }).first();
    console.log('🔄 Clicking load button...');

    const startTime = Date.now();
    await loadButton.click();

    // Wait for processing to start
    await page.waitForTimeout(2000);

    let processingCompleted = false;
    let errorOccurred = false;
    let timeoutErrorSeen = false;

    // Monitor for up to 120 seconds (our new timeout limit)
    for (let i = 0; i < 120; i++) {
      await page.waitForTimeout(1000);

      // Check if processing dialog is still visible
      const processingButton = page.locator('button:has-text("Processando")');
      const isProcessing = await processingButton.isVisible();

      // Check for error states
      const errorElements = await page.locator('.text-red-400, .text-red-300').count();
      if (errorElements > 0) {
        errorOccurred = true;
        console.log(`❌ Error detected at ${i}s`);

        // Check specifically for timeout error
        const timeoutText = await page.locator('text=/timeout|Timeout/i').count();
        if (timeoutText > 0) {
          timeoutErrorSeen = true;
          console.log(`⏰ Timeout error detected at ${i}s`);
        }
        break;
      }

      // Check if processing completed
      if (!isProcessing && i > 5) {
        processingCompleted = true;
        console.log(`✅ Processing completed at ${i}s`);
        break;
      }

      // Progress log every 10 seconds
      if (i % 10 === 0 && i > 0) {
        console.log(`⏰ ${i}s elapsed - Still processing: ${isProcessing}`);
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(`🏁 Test completed in ${Math.round(totalTime / 1000)}s`);

    // Take final screenshot
    await page.screenshot({
      path: 'timeout-fix-test-result.png',
      fullPage: true
    });

    // Analyze console logs for insights
    const heartbeatLogs = consoleLogs.filter(log => log.includes('Heartbeat'));
    const workerLogs = consoleLogs.filter(log => log.includes('Worker:'));
    const timeoutLogs = consoleLogs.filter(log => log.toLowerCase().includes('timeout'));

    console.log('\\n📊 ANALYSIS:');
    console.log(`Heartbeat logs: ${heartbeatLogs.length}`);
    console.log(`Worker logs: ${workerLogs.length}`);
    console.log(`Timeout logs: ${timeoutLogs.length}`);
    console.log(`Processing completed: ${processingCompleted}`);
    console.log(`Error occurred: ${errorOccurred}`);
    console.log(`Timeout error seen: ${timeoutErrorSeen}`);

    if (heartbeatLogs.length > 0) {
      console.log('\\n💓 Recent heartbeat logs:');
      heartbeatLogs.slice(-3).forEach(log => console.log(`  ${log}`));
    }

    if (timeoutLogs.length > 0) {
      console.log('\\n⏰ Timeout logs:');
      timeoutLogs.forEach(log => console.log(`  ${log}`));
    }

    // Assert that no timeout error occurred
    expect(timeoutErrorSeen, 'Timeout error should not occur').toBe(false);

    // Assert that either processing completed or we can identify a specific non-timeout error
    expect(processingCompleted || (errorOccurred && !timeoutErrorSeen),
           'Processing should complete or fail with non-timeout error').toBe(true);

    console.log('🎉 Timeout fix verification passed!');
  });
});