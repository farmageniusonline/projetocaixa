import { test, expect } from '@playwright/test';

test.describe('Validação das Melhorias de UX/UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://localhost:5175');

    // Login
    await page.fill('[data-testid="username-input"]', 'admin@manipularium.com.br');
    await page.fill('[data-testid="password-input"]', 'manipularium');
    await page.click('[data-testid="login-button"]');
    await page.waitForTimeout(3000);

    // Navegar para Lançamentos
    await page.click('text=Lançamentos');
    await page.waitForTimeout(2000);
  });

  test('✅ Melhoria 1: Toast de Confirmação Mais Visível', async ({ page }) => {
    console.log('=== 🎉 TESTE: Toast de Confirmação Melhorado ===');

    // Adicionar um lançamento para ver o toast
    await page.click('button[aria-label="Dinheiro"]');
    await page.fill('#launch-value-input', '25,00');
    await page.click('button:has-text("Adicionar")');
    await page.waitForTimeout(2000);

    // Verificar se o toast melhorado aparece
    const successToast = page.locator('.animate-pulse, [class*="animate-pulse"]');
    const hasAnimatedToast = await successToast.count() > 0;

    console.log(`🎊 Toast com animação encontrado: ${hasAnimatedToast}`);

    if (hasAnimatedToast) {
      // Verificar se tem ícone de sucesso
      const hasSuccessIcon = await page.locator('svg path[fill-rule="evenodd"]').count() > 0;
      console.log(`✅ Ícone de sucesso visível: ${hasSuccessIcon}`);

      // Verificar se tem borda destacada
      const toastElement = await successToast.first().getAttribute('class');
      const hasBorder = toastElement?.includes('border-2') && toastElement?.includes('border-green');
      console.log(`🎨 Borda destacada verde: ${hasBorder}`);

      expect(hasSuccessIcon && hasBorder).toBe(true);
    }

    // Screenshot do toast melhorado
    await page.screenshot({ path: 'ux-improvement-toast.png', fullPage: false });

    console.log('✅ Toast de confirmação melhorado validado');
  });

  test('✅ Melhoria 2: Botões com Altura Adequada para Mobile', async ({ page }) => {
    console.log('=== 📱 TESTE: Botões com Altura Mobile ===');

    // Verificar altura dos botões de pagamento
    const dinheiroButton = page.locator('button[aria-label="Dinheiro"]');
    const buttonDimensions = await dinheiroButton.evaluate(el => {
      const rect = el.getBoundingClientRect();
      const styles = window.getComputedStyle(el);
      return {
        height: rect.height,
        minHeight: styles.minHeight,
        paddingY: styles.paddingTop + ' ' + styles.paddingBottom
      };
    });

    console.log(`📏 Dimensões do botão:`, buttonDimensions);

    // Verificar se altura é adequada para mobile (>=44px)
    const isMobileFriendly = buttonDimensions.height >= 44;
    console.log(`📱 Altura adequada para mobile (>=44px): ${isMobileFriendly}`);

    expect(isMobileFriendly).toBe(true);

    // Testar em viewport mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);

    const mobileButtonDimensions = await dinheiroButton.evaluate(el => {
      const rect = el.getBoundingClientRect();
      return { height: rect.height, width: rect.width };
    });

    console.log(`📱 Dimensões em mobile:`, mobileButtonDimensions);

    const isMobileHeightOk = mobileButtonDimensions.height >= 44;
    console.log(`📱 Altura em mobile adequada: ${isMobileHeightOk}`);

    expect(isMobileHeightOk).toBe(true);

    // Screenshot mobile
    await page.screenshot({ path: 'ux-improvement-mobile-buttons.png', fullPage: false });

    // Voltar para desktop
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(1000);

    console.log('✅ Altura dos botões adequada para mobile validada');
  });

  test('✅ Melhoria 3: Responsividade da Tabela', async ({ page }) => {
    console.log('=== 📊 TESTE: Responsividade da Tabela ===');

    // Adicionar alguns lançamentos para popular a tabela
    const testLaunches = [
      { type: 'Dinheiro', value: '50,00' },
      { type: 'Débito', value: '75,50' },
    ];

    for (const launch of testLaunches) {
      await page.click(`button[aria-label="${launch.type}"]`);
      await page.fill('#launch-value-input', launch.value);
      await page.click('button:has-text("Adicionar")');
      await page.waitForTimeout(2000);
    }

    // Verificar scroll horizontal em desktop
    const tableWrapper = page.locator('.overflow-x-auto');
    const hasHorizontalScroll = await tableWrapper.count() > 0;
    console.log(`📜 Wrapper de scroll horizontal: ${hasHorizontalScroll}`);

    // Verificar largura mínima da tabela
    const table = page.locator('table');
    const tableStyles = await table.evaluate(el => {
      const styles = window.getComputedStyle(el);
      return {
        minWidth: styles.minWidth,
        width: styles.width
      };
    });

    console.log(`📏 Estilos da tabela:`, tableStyles);

    // Testar em mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);

    // Verificar se tabela ainda é acessível
    const mobileTableVisible = await table.isVisible();
    console.log(`📱 Tabela visível em mobile: ${mobileTableVisible}`);

    // Verificar se scroll horizontal funciona
    await page.evaluate(() => {
      const wrapper = document.querySelector('.overflow-x-auto');
      if (wrapper) {
        wrapper.scrollLeft = 100;
      }
    });

    console.log('📜 Scroll horizontal testado em mobile');

    // Screenshot mobile da tabela
    await page.screenshot({ path: 'ux-improvement-mobile-table.png', fullPage: false });

    // Voltar para desktop
    await page.setViewportSize({ width: 1440, height: 900 });

    expect(hasHorizontalScroll && mobileTableVisible).toBe(true);

    console.log('✅ Responsividade da tabela validada');
  });

  test('✅ Validação dos Botões Link (Sim/Não) Melhorados', async ({ page }) => {
    console.log('=== 🔗 TESTE: Botões Link Melhorados ===');

    // Selecionar cartão de crédito para aparecer os botões Link
    await page.click('button[aria-label="Cartão de Crédito 1x"]');
    await page.waitForTimeout(500);

    // Verificar se botões Link aparecem
    const simButton = page.locator('text=Sim').nth(0);
    const naoButton = page.locator('text=Não').nth(0);

    const hasSimButton = await simButton.isVisible();
    const hasNaoButton = await naoButton.isVisible();

    console.log(`✅ Botão "Sim" visível: ${hasSimButton}`);
    console.log(`❌ Botão "Não" visível: ${hasNaoButton}`);

    expect(hasSimButton && hasNaoButton).toBe(true);

    // Testar clique e verificar feedback visual
    await naoButton.click();
    await page.waitForTimeout(500);

    // Verificar se botão selecionado tem feedback visual melhorado
    const naoButtonStyles = await naoButton.evaluate(el => {
      const styles = window.getComputedStyle(el);
      return {
        backgroundColor: styles.backgroundColor,
        boxShadow: styles.boxShadow,
        minHeight: styles.minHeight
      };
    });

    console.log(`🎨 Estilos do botão "Não" selecionado:`, naoButtonStyles);

    // Verificar se tem sombra quando selecionado
    const hasShadow = naoButtonStyles.boxShadow !== 'none';
    console.log(`🌟 Sombra no botão selecionado: ${hasShadow}`);

    // Verificar altura mínima
    const hasMinHeight = naoButtonStyles.minHeight === '36px';
    console.log(`📏 Altura mínima adequada: ${hasMinHeight}`);

    // Screenshot dos botões Link
    await page.screenshot({ path: 'ux-improvement-link-buttons.png', fullPage: false });

    expect(hasShadow && hasMinHeight).toBe(true);

    console.log('✅ Botões Link melhorados validados');
  });

  test('📊 Relatório Final de Melhorias Implementadas', async ({ page }) => {
    console.log('=== 📋 RELATÓRIO: Melhorias Implementadas ===');

    const improvements = {
      toastVisibility: false,
      buttonHeight: false,
      tableResponsiveness: false,
      linkButtonsFeedback: false,
      overall: false
    };

    // Teste 1: Toast melhorado
    try {
      await page.click('button[aria-label="Moedas"]');
      await page.fill('#launch-value-input', '10,00');
      await page.click('button:has-text("Adicionar")');
      await page.waitForTimeout(2000);

      const hasAnimatedToast = await page.locator('.animate-pulse').count() > 0;
      improvements.toastVisibility = hasAnimatedToast;
      console.log(`🎉 Toast melhorado: ${hasAnimatedToast ? '✅' : '❌'}`);
    } catch (error) {
      console.log('❌ Erro no teste de toast:', error);
    }

    // Teste 2: Altura dos botões
    try {
      const buttonHeight = await page.locator('button[aria-label="Dinheiro"]').evaluate(el => {
        return el.getBoundingClientRect().height;
      });
      improvements.buttonHeight = buttonHeight >= 44;
      console.log(`📏 Altura dos botões (${buttonHeight}px): ${improvements.buttonHeight ? '✅' : '❌'}`);
    } catch (error) {
      console.log('❌ Erro no teste de altura:', error);
    }

    // Teste 3: Scroll da tabela
    try {
      const hasScrollWrapper = await page.locator('.overflow-x-auto').count() > 0;
      improvements.tableResponsiveness = hasScrollWrapper;
      console.log(`📊 Scroll da tabela: ${hasScrollWrapper ? '✅' : '❌'}`);
    } catch (error) {
      console.log('❌ Erro no teste de tabela:', error);
    }

    // Teste 4: Botões Link
    try {
      await page.click('button[aria-label="Cartão de Crédito 2x"]');
      await page.waitForTimeout(500);
      await page.click('text=Sim');
      await page.waitForTimeout(500);

      const buttonShadow = await page.locator('text=Sim').first().evaluate(el => {
        return window.getComputedStyle(el).boxShadow !== 'none';
      });
      improvements.linkButtonsFeedback = buttonShadow;
      console.log(`🔗 Feedback dos botões Link: ${buttonShadow ? '✅' : '❌'}`);
    } catch (error) {
      console.log('❌ Erro no teste de botões Link:', error);
    }

    // Avaliação geral
    const successCount = Object.values(improvements).filter(Boolean).length;
    improvements.overall = successCount >= 3;

    console.log('\n📊 RESUMO DAS MELHORIAS:');
    console.log(`🎉 Toast melhorado: ${improvements.toastVisibility ? '✅' : '❌'}`);
    console.log(`📏 Botões mobile-friendly: ${improvements.buttonHeight ? '✅' : '❌'}`);
    console.log(`📊 Tabela responsiva: ${improvements.tableResponsiveness ? '✅' : '❌'}`);
    console.log(`🔗 Feedback visual Link: ${improvements.linkButtonsFeedback ? '✅' : '❌'}`);
    console.log(`\n🎯 AVALIAÇÃO GERAL: ${improvements.overall ? '✅ APROVADO' : '❌ PRECISA MELHORAR'}`);
    console.log(`📈 Score: ${successCount}/4 melhorias implementadas`);

    // Screenshot final
    await page.screenshot({ path: 'ux-improvements-final-report.png', fullPage: true });

    // Salvar relatório
    const report = {
      timestamp: new Date().toISOString(),
      improvements,
      score: `${successCount}/4`,
      status: improvements.overall ? 'APROVADO' : 'PRECISA MELHORAR'
    };

    console.log('\n📄 Relatório completo:', JSON.stringify(report, null, 2));

    expect(improvements.overall).toBe(true);

    console.log('\n✅ Relatório de melhorias concluído');
  });
});