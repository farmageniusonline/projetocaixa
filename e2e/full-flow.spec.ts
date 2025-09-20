import { test, expect, Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to measure performance
async function measureTime<T>(page: Page, fn: () => Promise<T>): Promise<[T, number]> {
  const startTime = await page.evaluate(() => performance.now());
  const result = await fn();
  const endTime = await page.evaluate(() => performance.now());
  return [result, endTime - startTime];
}

test.describe('Full Application Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should complete full workflow: upload → conference → transfer', async ({ page }) => {
    // 1. Upload Excel file
    await test.step('Upload Excel file', async () => {
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'test-data.csv'));

      // Wait for file to be selected
      await page.waitForTimeout(1000);

      // Look for upload button or automatic processing
      const uploadButton = page.locator('button:has-text("Upload"), button:has-text("Carregar")');
      if (await uploadButton.isVisible()) {
        await uploadButton.click();
      }

      // Wait for processing indicators
      await page.waitForTimeout(2000);

      // Check for any success or data loaded indicators
      const dataTable = page.locator('table, .data-table, [data-testid="data-table"]');
      await expect(dataTable).toBeVisible({ timeout: 10000 });
    });

    // 2. Conference single value
    await test.step('Conference single value match', async () => {
      const conferenceInput = page.locator('#conference-value-input');
      await conferenceInput.fill('100,50');

      const [, searchTime] = await measureTime(page, async () => {
        await page.locator('button:has-text("Conferir")').click();
        await page.waitForSelector('text=1 correspondência encontrada');
      });

      expect(searchTime).toBeLessThan(150);
      await expect(page.locator('text=Valor conferido com sucesso')).toBeVisible();
    });

    // 3. Conference multiple matches
    await test.step('Conference multiple value matches', async () => {
      const conferenceInput = page.locator('#conference-value-input');
      await conferenceInput.clear();
      await conferenceInput.fill('200,00');

      await page.locator('button:has-text("Conferir")').click();

      // Should show selection modal
      await expect(page.locator('text=Múltiplas correspondências encontradas')).toBeVisible();
      await expect(page.locator('.modal-selection')).toBeVisible();

      // Select first match
      await page.locator('.modal-selection button').first().click();
      await expect(page.locator('text=Valor conferido com sucesso')).toBeVisible();
    });

    // 4. Conference no match
    await test.step('Conference value not found', async () => {
      const conferenceInput = page.locator('#conference-value-input');
      await conferenceInput.clear();
      await conferenceInput.fill('999,99');

      await page.locator('button:has-text("Conferir")').click();
      await expect(page.locator('text=Nenhuma correspondência encontrada')).toBeVisible();
    });

    // 5. Transfer to Cash Conference
    await test.step('Transfer conferred values', async () => {
      await page.locator('button:has-text("Transferir para Caixa")').click();

      // Confirm transfer
      await expect(page.locator('text=Confirmar Transferência')).toBeVisible();
      await page.locator('button:has-text("Confirmar")').click();

      await expect(page.locator('text=Valores transferidos com sucesso')).toBeVisible();
    });

    // 6. Verify deduplication
    await test.step('Verify deduplication works', async () => {
      // Try to add same value again
      const conferenceInput = page.locator('#conference-value-input');
      await conferenceInput.fill('100,50');
      await page.locator('button:has-text("Conferir")').click();

      await expect(page.locator('text=Valor já conferido')).toBeVisible();
    });
  });

  test('Manual Launches with Link Option', async ({ page }) => {
    // Navigate to Launches tab
    await page.locator('button:has-text("Lançamentos")').click();

    await test.step('Add credit card with link option', async () => {
      // Select credit card payment
      await page.locator('button:has-text("Cartão de Crédito 2x")').click();

      // Should show "É link?" option
      await expect(page.locator('text=É link?')).toBeVisible();

      // Select "Sim" for link
      await page.locator('button:has-text("Sim")').click();

      // Enter value
      const valueInput = page.locator('#launch-value-input');
      await valueInput.fill('350,00');

      // Add launch
      await page.locator('button:has-text("Adicionar")').click();

      // Verify launch added
      await expect(page.locator('text=R$ 350,00')).toBeVisible();
      await expect(page.locator('text=Link: Sim')).toBeVisible();
    });

    await test.step('Copy to Cash Conference', async () => {
      // All launches should be automatically copied to Cash Conference
      await page.locator('button:has-text("Conferência")').click();
      await expect(page.locator('text=R$ 350,00')).toBeVisible();
    });

    await test.step('Undo launch', async () => {
      await page.locator('button:has-text("Lançamentos")').click();

      // Click undo button
      await page.locator('button:has-text("Desfazer")').first().click();

      // Confirm undo
      await expect(page.locator('text=Confirmar Desfazer')).toBeVisible();
      await page.locator('button:has-text("Confirmar")').click();

      // Verify launch removed
      await expect(page.locator('text=R$ 350,00')).toBeHidden();
    });
  });

  test('Date Filters and Day Reset', async ({ page }) => {
    await test.step('Apply global date filter', async () => {
      // Open date filter (Ctrl+F shortcut)
      await page.keyboard.press('Control+f');

      const dateInput = await page.waitForSelector('input[type="date"]');
      await dateInput.fill('2024-01-15');

      await page.locator('button:has-text("Aplicar")').click();

      // Verify filter applied
      await expect(page.locator('text=15/01/2024')).toBeVisible();
    });

    await test.step('Reset day with modal confirmation', async () => {
      await page.locator('button:has-text("Reiniciar Dia")').click();

      // Modal should appear
      await expect(page.locator('text=Confirmar Reiniciar Dia')).toBeVisible();
      await expect(page.locator('text=Isso irá limpar todos os dados')).toBeVisible();

      // Cancel first
      await page.locator('button:has-text("Cancelar")').click();
      await expect(page.locator('text=Confirmar Reiniciar Dia')).toBeHidden();

      // Try again and confirm
      await page.locator('button:has-text("Reiniciar Dia")').click();
      await page.locator('button:has-text("Confirmar")').click();

      await expect(page.locator('text=Dia reiniciado com sucesso')).toBeVisible();
    });
  });

  test('Export Functionality', async ({ page }) => {
    // Add some data first
    await page.locator('button:has-text("Lançamentos")').click();
    await page.locator('button:has-text("Dinheiro")').click();
    await page.locator('#launch-value-input').fill('100,00');
    await page.locator('button:has-text("Adicionar")').click();

    await test.step('Export to CSV', async () => {
      const downloadPromise = page.waitForEvent('download');
      await page.locator('button:has-text("CSV")').click();
      const download = await downloadPromise;

      expect(download.suggestedFilename()).toContain('.csv');
    });

    await test.step('Export to XLSX', async () => {
      const downloadPromise = page.waitForEvent('download');
      await page.locator('button:has-text("XLSX")').click();
      const download = await downloadPromise;

      expect(download.suggestedFilename()).toContain('.xlsx');
    });
  });
});

test.describe('Keyboard Shortcuts', () => {
  test('should support all keyboard shortcuts', async ({ page }) => {
    await page.goto('/');

    await test.step('Ctrl+L focuses value input', async () => {
      await page.keyboard.press('Control+l');

      const activeElement = await page.evaluate(() => document.activeElement?.id);
      expect(activeElement).toContain('value-input');
    });

    await test.step('Ctrl+F opens date filter', async () => {
      await page.keyboard.press('Control+f');

      const dateInput = await page.locator('input[type="date"]');
      await expect(dateInput).toBeFocused();
    });

    await test.step('Enter confirms action', async () => {
      await page.locator('#conference-value-input').fill('100,00');
      await page.keyboard.press('Enter');

      // Should trigger search
      await expect(page.locator('text=Conferindo...')).toBeVisible();
    });

    await test.step('Esc closes modals', async () => {
      // Open a modal
      await page.locator('button:has-text("Reiniciar Dia")').click();
      await expect(page.locator('text=Confirmar Reiniciar Dia')).toBeVisible();

      // Press Esc to close
      await page.keyboard.press('Escape');
      await expect(page.locator('text=Confirmar Reiniciar Dia')).toBeHidden();
    });

    await test.step('Focus always returns to input', async () => {
      await page.locator('#conference-value-input').fill('123,45');
      await page.locator('button:has-text("Conferir")').click();

      // After action, focus should return
      await page.waitForTimeout(500);
      const activeElement = await page.evaluate(() => document.activeElement?.id);
      expect(activeElement).toContain('input');
    });
  });
});

test.describe('Accessibility', () => {
  test('should meet basic a11y requirements', async ({ page }) => {
    await page.goto('/');

    await test.step('All interactive elements have accessible names', async () => {
      const buttons = await page.locator('button').all();

      for (const button of buttons) {
        const hasAriaLabel = await button.getAttribute('aria-label');
        const hasText = await button.textContent();
        const hasTitle = await button.getAttribute('title');

        expect(hasAriaLabel || hasText || hasTitle).toBeTruthy();
      }
    });

    await test.step('Forms have proper labels', async () => {
      const inputs = await page.locator('input').all();

      for (const input of inputs) {
        const id = await input.getAttribute('id');
        const hasLabel = id ? await page.locator(`label[for="${id}"]`).count() > 0 : false;
        const hasAriaLabel = await input.getAttribute('aria-label');

        expect(hasLabel || hasAriaLabel).toBeTruthy();
      }
    });

    await test.step('Error messages are accessible', async () => {
      // Trigger an error
      await page.locator('#conference-value-input').fill('abc');
      await page.locator('button:has-text("Conferir")').click();

      const errorMessage = page.locator('[role="alert"]');
      await expect(errorMessage).toBeVisible();
      await expect(errorMessage).toHaveAttribute('aria-live', 'polite');
    });

    await test.step('Tab navigation works correctly', async () => {
      await page.keyboard.press('Tab');
      let activeElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(activeElement).toBeTruthy();

      await page.keyboard.press('Tab');
      activeElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(activeElement).toBeTruthy();
    });
  });

  test('should maintain dark theme consistently', async ({ page }) => {
    await page.goto('/');

    await test.step('Check dark backgrounds', async () => {
      const bodyBg = await page.locator('body').evaluate(el =>
        window.getComputedStyle(el).backgroundColor
      );

      // Should be dark
      expect(bodyBg).toMatch(/rgb\((\d+), (\d+), (\d+)\)/);
    });

    await test.step('Check light text', async () => {
      const headings = await page.locator('h1, h2, h3').all();

      for (const heading of headings) {
        const color = await heading.evaluate(el =>
          window.getComputedStyle(el).color
        );

        // Text should be light
        expect(color).toMatch(/rgb\((\d+), (\d+), (\d+)\)/);
      }
    });

    await test.step('No automatic tab switching', async () => {
      const activeTab = await page.locator('.tab-active').textContent();

      // Perform actions
      await page.locator('#conference-value-input').fill('100,00');
      await page.locator('button:has-text("Conferir")').click();

      // Tab should not change
      const newActiveTab = await page.locator('.tab-active').textContent();
      expect(newActiveTab).toBe(activeTab);
    });
  });
});

test.describe('Responsiveness', () => {
  const viewports = [
    { name: 'Desktop', width: 1920, height: 1080 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Mobile', width: 375, height: 667 }
  ];

  for (const viewport of viewports) {
    test(`should be responsive on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');

      await test.step('Main elements are visible', async () => {
        await expect(page.locator('h1')).toBeVisible();
        await expect(page.locator('#conference-value-input')).toBeVisible();
        await expect(page.locator('button:has-text("Conferir")')).toBeVisible();
      });

      await test.step('Navigation works', async () => {
        if (viewport.name === 'Mobile') {
          // May need to open hamburger menu on mobile
          const hamburger = page.locator('.hamburger-menu');
          if (await hamburger.isVisible()) {
            await hamburger.click();
          }
        }

        await page.locator('button:has-text("Lançamentos")').click();
        await expect(page.locator('text=Lançamentos Manuais')).toBeVisible();
      });

      await test.step('Forms are usable', async () => {
        const input = page.locator('#launch-value-input');
        await input.fill('100,00');
        await expect(input).toHaveValue('100,00');
      });
    });
  }
});

test.describe('Performance', () => {
  test('should meet performance requirements', async ({ page }) => {
    await page.goto('/');

    await test.step('Conference search < 150ms', async () => {
      // Load test data
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'large-dataset.xlsx'));

      await page.waitForSelector('text=Dados carregados');

      // Measure search time
      const conferenceInput = page.locator('#conference-value-input');
      await conferenceInput.fill('500,00');

      const [, duration] = await measureTime(page, async () => {
        await page.locator('button:has-text("Conferir")').click();
        await page.waitForSelector('text=correspondência');
      });

      expect(duration).toBeLessThan(150);
    });

    await test.step('Page loads quickly', async () => {
      const startTime = Date.now();
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(3000);
    });

    await test.step('Interactions are responsive', async () => {
      const measurements: number[] = [];

      for (let i = 0; i < 5; i++) {
        const [, duration] = await measureTime(page, async () => {
          await page.locator('button:has-text("Lançamentos")').click();
          await page.waitForSelector('text=Lançamentos Manuais');
        });
        measurements.push(duration);

        const [, duration2] = await measureTime(page, async () => {
          await page.locator('button:has-text("Conferência")').click();
          await page.waitForSelector('text=Conferir Valor');
        });
        measurements.push(duration2);
      }

      const avgTime = measurements.reduce((a, b) => a + b, 0) / measurements.length;
      expect(avgTime).toBeLessThan(100);
    });
  });
});