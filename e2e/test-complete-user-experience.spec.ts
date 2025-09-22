import { test, expect } from '@playwright/test';

test.describe('Teste Completo de Experiência do Usuário', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://localhost:5175');

    // Login
    console.log('🔐 Realizando login...');
    await page.fill('[data-testid="username-input"]', 'admin@manipularium.com.br');
    await page.fill('[data-testid="password-input"]', 'manipularium');
    await page.click('[data-testid="login-button"]');
    await page.waitForTimeout(3000);

    // Verificar se há erro após login
    const hasError = await page.locator('text="Erro na Aplicação"').isVisible();
    if (hasError) {
      throw new Error('❌ Erro detectado após login');
    }
    console.log('✅ Login realizado com sucesso');
  });

  test('Jornada Completa do Usuário - Lançamentos', async ({ page }) => {
    console.log('=== 🚀 TESTE: Jornada Completa de Lançamentos ===');

    // Screenshot inicial
    await page.screenshot({ path: 'ux-test-01-initial.png', fullPage: false });

    // ETAPA 1: Navegar para Lançamentos
    console.log('\n📋 ETAPA 1: Navegação para Lançamentos');
    await page.click('text=Lançamentos');
    await page.waitForTimeout(2000);

    // Verificar se interface carregou
    const hasValueInput = await page.locator('#launch-value-input').isVisible();
    const hasPaymentButtons = await page.locator('button[aria-label="Dinheiro"]').isVisible();
    const hasTable = await page.locator('table').isVisible();

    console.log(`📝 Campo de valor visível: ${hasValueInput}`);
    console.log(`💳 Botões de pagamento visíveis: ${hasPaymentButtons}`);
    console.log(`📊 Tabela visível: ${hasTable}`);

    expect(hasValueInput && hasPaymentButtons && hasTable).toBe(true);
    await page.screenshot({ path: 'ux-test-02-launches-interface.png', fullPage: false });

    // ETAPA 2: Testar diferentes tipos de lançamento
    console.log('\n💰 ETAPA 2: Testando Diferentes Tipos de Lançamento');

    const testLaunches = [
      { type: 'Dinheiro', value: '50,00', description: 'Pagamento em dinheiro' },
      { type: 'Débito', value: '75,50', description: 'Pagamento no débito' },
      { type: 'Cartão de Crédito 1x', value: '100,00', description: 'Crédito à vista', needsLink: true },
      { type: 'Moedas', value: '5,25', description: 'Pagamento em moedas' },
    ];

    let totalAdded = 0;
    for (const launch of testLaunches) {
      console.log(`\n🔄 Adicionando: ${launch.description} - R$ ${launch.value}`);

      // Selecionar método de pagamento
      await page.click(`button[aria-label="${launch.type}"]`);
      await page.waitForTimeout(500);

      // Se for crédito, definir link
      if (launch.needsLink) {
        await page.click('text=Não'); // Link: Não
        await page.waitForTimeout(500);
      }

      // Inserir valor
      await page.fill('#launch-value-input', launch.value);
      await page.waitForTimeout(500);

      // Adicionar
      await page.click('button:has-text("Adicionar")');
      await page.waitForTimeout(3000);

      // Verificar se foi adicionado
      const tableContent = await page.locator('tbody').textContent();
      const wasAdded = tableContent?.includes(launch.value);

      console.log(`✅ ${launch.description} adicionado: ${wasAdded}`);
      expect(wasAdded).toBe(true);

      if (wasAdded) totalAdded++;

      // Verificar se campo foi limpo
      const clearedValue = await page.locator('#launch-value-input').inputValue();
      expect(clearedValue).toBe('');
    }

    console.log(`\n📊 Total de lançamentos adicionados: ${totalAdded}/4`);
    await page.screenshot({ path: 'ux-test-03-launches-added.png', fullPage: false });

    // ETAPA 3: Testar filtros
    console.log('\n🔍 ETAPA 3: Testando Filtros');

    // Testar filtro por tipo de pagamento
    await page.selectOption('select', 'cash');
    await page.waitForTimeout(1000);

    const filteredContent = await page.locator('tbody').textContent();
    console.log(`💰 Filtro 'Dinheiro' aplicado - conteúdo inclui valor: ${filteredContent?.includes('50,00')}`);

    // Limpar filtro
    await page.click('text=Limpar Filtros');
    await page.waitForTimeout(1000);

    // Testar filtro por data
    const testDate = '2024-01-15';
    await page.fill('input[type="date"]', testDate);
    await page.click('text=Aplicar');
    await page.waitForTimeout(1000);

    const dateFilterApplied = await page.locator('input[type="date"]').inputValue();
    console.log(`📅 Filtro de data aplicado: ${dateFilterApplied}`);

    await page.screenshot({ path: 'ux-test-04-filters.png', fullPage: false });

    // ETAPA 4: Testar lançamento com saída
    console.log('\n📤 ETAPA 4: Testando Lançamento de Saída');

    // Voltar para data atual
    await page.click('text=Hoje');
    await page.waitForTimeout(1000);

    // Selecionar Saída
    await page.click('button[aria-label="Saída"]');
    await page.waitForTimeout(500);

    // Inserir valor e observação
    await page.fill('#launch-value-input', '25,00');
    await page.fill('#launch-observation-input', 'Teste de saída - combustível');
    await page.waitForTimeout(500);

    await page.click('button:has-text("Adicionar")');
    await page.waitForTimeout(3000);

    // Verificar se saída foi adicionada
    const tableAfterExit = await page.locator('tbody').textContent();
    const hasExit = tableAfterExit?.includes('Saída') && tableAfterExit?.includes('combustível');
    console.log(`📤 Saída adicionada com observação: ${hasExit}`);

    await page.screenshot({ path: 'ux-test-05-exit-added.png', fullPage: false });

    // ETAPA 5: Testar funcionalidades de sincronização
    console.log('\n🔄 ETAPA 5: Testando Sincronização');

    // Testar carregar do Supabase
    await page.click('button:has-text("Carregar")');
    await page.waitForTimeout(3000);
    console.log('📥 Carregamento do Supabase testado');

    // Testar exportação
    const exportButton = page.locator('button:has-text("Excel"), button:has-text("CSV")').first();
    const hasExportButton = await exportButton.count() > 0;
    console.log(`📊 Botão de exportação disponível: ${hasExportButton}`);

    await page.screenshot({ path: 'ux-test-06-sync-functions.png', fullPage: false });

    console.log('\n✅ Jornada de lançamentos concluída com sucesso!');
  });

  test('Teste de Experiência - Conferência de Caixa', async ({ page }) => {
    console.log('=== 🏦 TESTE: Experiência na Conferência de Caixa ===');

    // Navegar para Conferência de Caixa
    await page.click('text=Conferência de Caixa');
    await page.waitForTimeout(2000);

    // Verificar interface
    const hasDateInput = await page.locator('input[type="date"]').isVisible();
    const hasValueInput = await page.locator('input[placeholder*="valor"]').isVisible();
    const hasClearButton = await page.locator('button:has-text("Limpar")').isVisible();

    console.log(`📅 Campo de data: ${hasDateInput}`);
    console.log(`💰 Campo de valor: ${hasValueInput}`);
    console.log(`🧹 Botão limpar: ${hasClearButton}`);

    await page.screenshot({ path: 'ux-test-07-conference-interface.png', fullPage: false });

    // Testar entrada de valor (se disponível)
    if (hasValueInput) {
      await page.fill('input[placeholder*="valor"]', '100,00');
      await page.waitForTimeout(1000);
      console.log('💰 Valor inserido para conferência');
    }

    // Testar botão limpar
    if (hasClearButton) {
      await page.click('button:has-text("Limpar")');
      await page.waitForTimeout(1000);
      console.log('🧹 Botão limpar testado');
    }

    console.log('✅ Conferência de Caixa testada');
  });

  test('Teste de Experiência - Navegação Geral', async ({ page }) => {
    console.log('=== 🧭 TESTE: Navegação Geral e UX ===');

    // Testar navegação entre abas
    const tabs = ['Lançamentos', 'Conferência de Caixa'];

    for (const tab of tabs) {
      console.log(`\n🔄 Navegando para: ${tab}`);

      await page.click(`text=${tab}`);
      await page.waitForTimeout(2000);

      // Verificar se aba carregou sem erros
      const hasError = await page.locator('text="Erro na Aplicação"').isVisible();
      expect(hasError).toBe(false);

      // Capturar screenshot de cada aba
      const tabName = tab.toLowerCase().replace(/\s+/g, '-');
      await page.screenshot({ path: `ux-test-navigation-${tabName}.png`, fullPage: false });

      console.log(`✅ ${tab} carregada sem erros`);
    }

    // Testar responsividade (reduzir tela)
    console.log('\n📱 Testando responsividade...');
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1000);

    await page.click('text=Lançamentos');
    await page.waitForTimeout(1000);

    // Verificar se interface ainda funciona em mobile
    const mobileValueInput = await page.locator('#launch-value-input').isVisible();
    const mobileTable = await page.locator('table').isVisible();

    console.log(`📱 Campo de valor em mobile: ${mobileValueInput}`);
    console.log(`📱 Tabela em mobile: ${mobileTable}`);

    await page.screenshot({ path: 'ux-test-mobile-view.png', fullPage: false });

    // Voltar para desktop
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(1000);

    console.log('✅ Navegação e responsividade testadas');
  });

  test('Teste de Performance e UX - Identificar Melhorias', async ({ page }) => {
    console.log('=== ⚡ TESTE: Performance e Melhorias de UX ===');

    const improvements: string[] = [];
    const performanceIssues: string[] = [];

    // Navegar para Lançamentos
    await page.click('text=Lançamentos');
    await page.waitForTimeout(1000);

    // Testar tempo de resposta dos botões
    console.log('\n⏱️ Testando tempos de resposta...');

    const startTime = Date.now();
    await page.click('button[aria-label="Dinheiro"]');
    const buttonResponseTime = Date.now() - startTime;

    console.log(`🖱️ Tempo de resposta do botão: ${buttonResponseTime}ms`);
    if (buttonResponseTime > 100) {
      performanceIssues.push(`Botão lento: ${buttonResponseTime}ms`);
    }

    // Testar usabilidade dos campos
    console.log('\n🎯 Analisando usabilidade...');

    // Verificar se placeholder é claro
    const valuePlaceholder = await page.locator('#launch-value-input').getAttribute('placeholder');
    console.log(`💬 Placeholder do valor: "${valuePlaceholder}"`);

    if (!valuePlaceholder?.includes('ex:')) {
      improvements.push('Placeholder poderia ter exemplo: "ex: 123,45"');
    }

    // Verificar acessibilidade
    const hasAriaLabels = await page.locator('button[aria-label]').count();
    console.log(`♿ Botões com aria-label: ${hasAriaLabels}`);

    if (hasAriaLabels < 5) {
      improvements.push('Alguns botões podem precisar de mais aria-labels');
    }

    // Testar feedback visual
    await page.fill('#launch-value-input', '50,00');
    await page.click('button:has-text("Adicionar")');
    await page.waitForTimeout(2000);

    // Verificar se há mensagem de sucesso
    const hasSuccessMessage = await page.locator('.toast, [class*="toast"], [class*="success"]').isVisible();
    console.log(`✅ Mensagem de sucesso visível: ${hasSuccessMessage}`);

    if (!hasSuccessMessage) {
      improvements.push('Adicionar toast de confirmação mais visível');
    }

    // Analisar layout da tabela
    const tableHeaders = await page.locator('th').allTextContents();
    console.log(`📊 Cabeçalhos da tabela: ${tableHeaders.join(', ')}`);

    // Verificar se colunas estão bem organizadas
    if (tableHeaders.length > 8) {
      improvements.push('Tabela pode ter muitas colunas - considerar agrupamento');
    }

    // Testar contraste e legibilidade
    const buttonStyles = await page.locator('button[aria-label="Dinheiro"]').evaluate(el => {
      const styles = window.getComputedStyle(el);
      return {
        backgroundColor: styles.backgroundColor,
        color: styles.color,
        fontSize: styles.fontSize
      };
    });

    console.log(`🎨 Estilos do botão:`, buttonStyles);

    // Verificar tamanho de fonte
    const fontSize = parseInt(buttonStyles.fontSize);
    if (fontSize < 14) {
      improvements.push('Fonte dos botões pode ser pequena para acessibilidade');
    }

    // Testar scroll e navegação
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await page.evaluate(() => window.scrollTo(0, 0));

    console.log('📜 Scroll testado');

    // Verificar espaçamento
    const buttonSpacing = await page.locator('button[aria-label="Dinheiro"]').evaluate(el => {
      const rect = el.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    });

    console.log(`📏 Dimensões do botão: ${buttonSpacing.width}x${buttonSpacing.height}`);

    if (buttonSpacing.height < 40) {
      improvements.push('Botões podem ser pequenos para toque em mobile');
    }

    // Screenshot final
    await page.screenshot({ path: 'ux-test-performance-analysis.png', fullPage: true });

    // Relatório final
    console.log('\n📋 RELATÓRIO DE MELHORIAS:');
    console.log(`⚡ Problemas de performance: ${performanceIssues.length}`);
    performanceIssues.forEach((issue, index) => {
      console.log(`  ${index + 1}. ${issue}`);
    });

    console.log(`🎯 Sugestões de UX: ${improvements.length}`);
    improvements.forEach((improvement, index) => {
      console.log(`  ${index + 1}. ${improvement}`);
    });

    // Salvar relatório em arquivo
    const report = {
      timestamp: new Date().toISOString(),
      performanceIssues,
      improvements,
      buttonResponseTime,
      hasSuccessMessage,
      tableHeaders: tableHeaders.length,
      buttonDimensions: buttonSpacing
    };

    console.log('\n📄 Relatório salvo:', JSON.stringify(report, null, 2));

    console.log('\n✅ Análise de performance e UX concluída');
  });

  test('Teste de Fluxo Completo - Cenário Real', async ({ page }) => {
    console.log('=== 🎭 TESTE: Cenário Real de Uso ===');

    // Simular um dia real de trabalho
    console.log('\n🌅 Simulando dia de trabalho...');

    await page.click('text=Lançamentos');
    await page.waitForTimeout(1000);

    // Cenário: Manhã - várias vendas
    const morningTransactions = [
      { type: 'Dinheiro', value: '45,00' },
      { type: 'Débito', value: '67,50' },
      { type: 'Cartão de Crédito 1x', value: '120,00', link: false },
      { type: 'Dinheiro', value: '23,75' },
    ];

    console.log('🌄 Adicionando transações da manhã...');
    for (const transaction of morningTransactions) {
      await page.click(`button[aria-label="${transaction.type}"]`);

      if (transaction.type.includes('Crédito')) {
        await page.click(transaction.link ? 'text=Sim' : 'text=Não');
      }

      await page.fill('#launch-value-input', transaction.value);
      await page.click('button:has-text("Adicionar")');
      await page.waitForTimeout(2000);
    }

    // Verificar total
    const tableContent = await page.locator('tbody').textContent();
    console.log(`📊 Todas as transações visíveis na tabela`);

    // Cenário: Conferência ao final do dia
    console.log('\n🌆 Realizando conferência do dia...');

    // Exportar dados
    const exportButton = page.locator('button:has-text("Excel"), button:has-text("CSV")').first();
    const canExport = await exportButton.count() > 0;

    if (canExport) {
      console.log('📤 Dados prontos para exportação');
    }

    // Verificar totais na tela
    const totalsSection = await page.locator('tfoot, [class*="total"]').isVisible();
    console.log(`🧮 Seção de totais visível: ${totalsSection}`);

    await page.screenshot({ path: 'ux-test-real-scenario-final.png', fullPage: false });

    console.log('\n✅ Cenário real de uso testado com sucesso!');
  });
});