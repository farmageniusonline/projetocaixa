import { test, expect } from '@playwright/test';

test.describe('Simple Application Test', () => {
  test('Application loads without white screen', async ({ page }) => {
    // Habilitar logs do console
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

    // Navegar para aplicação
    await page.goto('http://localhost:5175');

    // Aguardar um tempo para carregamento
    await page.waitForTimeout(3000);

    // Verificar se há qualquer elemento na página
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Verificar se não está com tela branca - deve ter algum texto
    const hasContent = await page.evaluate(() => {
      return document.body.innerText.trim().length > 0;
    });

    console.log('Has content:', hasContent);
    console.log('Body HTML:', await page.locator('body').innerHTML());

    expect(hasContent).toBeTruthy();

    // Se chegou até aqui, tentar encontrar elementos específicos
    await page.waitForSelector('*', { timeout: 5000 });

    // Screenshot para debug
    await page.screenshot({ path: 'test-results/simple-test-debug.png' });
  });
});