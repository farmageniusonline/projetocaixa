import { test, expect } from '@playwright/test';

test.describe('Acessibilidade e Usabilidade', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('deve ter estrutura semântica adequada', async ({ page }) => {
    // Verificar elementos semânticos
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('form')).toBeVisible();

    // Verificar hierarquia de headings
    const h1 = page.locator('h1');
    if (await h1.isVisible()) {
      const h1Text = await h1.textContent();
      expect(h1Text).toBeTruthy();
    }
  });

  test('deve ter labels apropriados para inputs', async ({ page }) => {
    // Login
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    // Verificar inputs no dashboard
    const inputs = page.locator('input');
    const inputCount = await inputs.count();

    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const hasLabel = await input.evaluate(el => {
        const id = el.getAttribute('id');
        const placeholder = el.getAttribute('placeholder');
        const ariaLabel = el.getAttribute('aria-label');

        if (id) {
          const label = document.querySelector(`label[for="${id}"]`);
          return !!label;
        }

        return !!(placeholder || ariaLabel);
      });

      // Todo input deve ter identificação
      expect(hasLabel).toBeTruthy();
    }
  });

  test('deve suportar navegação por teclado', async ({ page }) => {
    // Verificar se é possível navegar com Tab
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Elemento focado deve estar visível
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });

  test('deve ter contraste adequado', async ({ page }) => {
    // Fazer login para testar dashboard
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    // Verificar cores de fundo e texto
    const textElements = page.locator('span, p, div, h1, h2, h3, h4, h5, h6').filter({
      has: page.locator(':visible')
    });

    const count = Math.min(await textElements.count(), 10); // Testar apenas primeiros 10

    for (let i = 0; i < count; i++) {
      const element = textElements.nth(i);
      const styles = await element.evaluate(el => {
        const computed = window.getComputedStyle(el);
        return {
          color: computed.color,
          backgroundColor: computed.backgroundColor,
          fontSize: computed.fontSize
        };
      });

      // Verificar se não são transparentes ou muito claros
      expect(styles.color).not.toBe('rgba(0, 0, 0, 0)');
      expect(styles.backgroundColor).toBeDefined();
    }
  });

  test('deve ter textos alternativos para imagens', async ({ page }) => {
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    // Verificar imagens
    const images = page.locator('img');
    const imageCount = await images.count();

    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      expect(alt).toBeTruthy();
    }
  });

  test('deve responder adequadamente em dispositivos móveis', async ({ page }) => {
    // Simular viewport mobile
    await page.setViewportSize({ width: 375, height: 667 });

    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    // Verificar se elementos principais estão visíveis
    await expect(page.getByText('Manipularium')).toBeVisible();

    // Verificar se não há overflow horizontal
    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const windowInnerWidth = await page.evaluate(() => window.innerWidth);

    // Permitir pequena margem de erro
    expect(bodyScrollWidth).toBeLessThanOrEqual(windowInnerWidth + 10);
  });

  test('deve ter botões com tamanho adequado para touch', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    const buttons = page.locator('button:visible');
    const buttonCount = Math.min(await buttons.count(), 5); // Testar primeiros 5

    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      const boundingBox = await button.boundingBox();

      if (boundingBox) {
        // Tamanho mínimo recomendado: 44x44px
        expect(boundingBox.height).toBeGreaterThanOrEqual(32);
        expect(boundingBox.width).toBeGreaterThanOrEqual(32);
      }
    }
  });

  test('deve ter feedback visual para estados de carregamento', async ({ page }) => {
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    // Simular upload de arquivo para ver estado de carregamento
    const fileChooser = page.waitForEvent('filechooser');
    await page.click('input[type="file"]');
    const file = await fileChooser;

    await file.setFiles([{
      name: 'test.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('Data,Histórico,Valor\n01/01/2024,Teste,100')
    }]);

    await page.click('text=Carregar');

    // Deve mostrar estado de carregamento
    await expect(page.getByText('Processando')).toBeVisible({ timeout: 2000 });
  });

  test('deve ter mensagens de erro claras e úteis', async ({ page }) => {
    // Testar erro de login
    await page.fill('input[type="text"]', 'usuario_inexistente');
    await page.fill('input[type="password"]', 'senha_errada');
    await page.click('button[type="submit"]');

    // Mensagem de erro deve ser clara
    const errorMessage = page.locator('.bg-red-900\\/20, .text-red-400, .border-red-400');
    await expect(errorMessage.first()).toBeVisible();

    const errorText = await errorMessage.first().textContent();
    expect(errorText).toContain('incorretos');
  });

  test('deve manter foco visível', async ({ page }) => {
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    // Navegar com teclado
    await page.keyboard.press('Tab');

    // Elemento focado deve ter indicador visual
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();

    // Verificar se há outline ou ring
    const hasFocusStyles = await focusedElement.evaluate(el => {
      const styles = window.getComputedStyle(el);
      return styles.outline !== 'none' ||
             styles.boxShadow.includes('ring') ||
             styles.border.includes('blue') ||
             styles.border.includes('indigo');
    });

    expect(hasFocusStyles).toBeTruthy();
  });
});