import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('🧪 Basic Worker Test', () => {
  test('should test basic worker functionality without complex processing', async ({ page }) => {
    test.setTimeout(60000); // 1 minute max

    console.log('🧪 Testing basic worker functionality...');

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

    // Inject test worker code
    await page.addInitScript(() => {
      // Create a simple test to verify workers work at all
      (window as any).testWorker = async () => {
        try {
          console.log('🧪 Page: Criando test worker...');

          // Simple worker that just returns a message
          const workerCode = `
            self.onmessage = function(e) {
              console.log('🧪 Simple Worker: Recebido:', e.data);
              setTimeout(() => {
                self.postMessage({ success: true, message: 'Worker funcionando!' });
              }, 1000);
            };
          `;

          const blob = new Blob([workerCode], { type: 'application/javascript' });
          const worker = new Worker(URL.createObjectURL(blob));

          return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Worker timeout'));
            }, 5000);

            worker.onmessage = (e) => {
              clearTimeout(timeout);
              resolve(e.data);
            };

            worker.onerror = (error) => {
              clearTimeout(timeout);
              reject(error);
            };

            worker.postMessage({ test: true });
          });
        } catch (error) {
          return { success: false, error: error.message };
        }
      };
    });

    // Monitor console
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      const message = msg.text();
      consoleLogs.push(`[${msg.type()}] ${message}`);
      if (message.includes('🧪')) {
        console.log(message);
      }
    });

    // Test basic worker functionality
    const workerResult = await page.evaluate(async () => {
      return await (window as any).testWorker();
    });

    console.log('🧪 Worker result:', workerResult);

    // Assert worker works
    expect(workerResult.success).toBe(true);

    // Now test file reading without worker
    await page.evaluate(() => {
      console.log('🧪 Page: Testando leitura de arquivo...');
    });

    // Go to Banking Conference
    await page.click('button:has-text("Conferência Bancária")');
    await page.waitForTimeout(2000);

    // Upload file but intercept before worker processing
    const fileInput = page.locator('input[type="file"]#fileInput');
    const xlsFilePath = path.join(process.cwd(), 'exemplo', 'caixa_11-09.xls');

    await fileInput.setInputFiles(xlsFilePath);

    // Verify file was selected
    const fileSelected = await page.evaluate(() => {
      const input = document.querySelector('#fileInput') as HTMLInputElement;
      return input?.files?.[0]?.name || 'No file';
    });

    console.log('🧪 File selected:', fileSelected);
    expect(fileSelected).toBe('caixa_11-09.xls');

    console.log('🧪 Basic worker test passed!');
  });
});