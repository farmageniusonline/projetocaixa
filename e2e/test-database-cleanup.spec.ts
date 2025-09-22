import { test, expect } from '@playwright/test';

test.describe('Teste de Limpeza do Banco de Dados', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://localhost:5175');

    // Login
    await page.fill('[data-testid="username-input"]', 'admin@manipularium.com.br');
    await page.fill('[data-testid="password-input"]', 'manipularium');
    await page.click('[data-testid="login-button"]');
    await page.waitForTimeout(3000);

    // Verificar se há erro após login
    const hasError = await page.locator('text="Erro na Aplicação"').isVisible();
    if (hasError) {
      throw new Error('Erro detectado após login');
    }
  });

  test('Verificar Botões de Limpeza na Interface', async ({ page }) => {
    console.log('=== TESTE: Verificar Botões de Limpeza ===');

    // Navegar para aba Lançamentos
    await page.click('text=Lançamentos');
    await page.waitForTimeout(2000);

    // Verificar se os novos botões existem
    const clearDateButton = page.locator('button:has-text("Limpar Data")');
    const clearAllButton = page.locator('button:has-text("Limpar Tudo")');

    const hasClearDateButton = await clearDateButton.count() > 0;
    const hasClearAllButton = await clearAllButton.count() > 0;

    console.log(`🧹 Botão "Limpar Data" encontrado: ${hasClearDateButton}`);
    console.log(`🗑️ Botão "Limpar Tudo" encontrado: ${hasClearAllButton}`);

    expect(hasClearDateButton).toBe(true);
    expect(hasClearAllButton).toBe(true);

    // Verificar tooltips
    const clearDateTitle = await clearDateButton.getAttribute('title');
    const clearAllTitle = await clearAllButton.getAttribute('title');

    console.log(`📝 Tooltip "Limpar Data": ${clearDateTitle}`);
    console.log(`📝 Tooltip "Limpar Tudo": ${clearAllTitle}`);

    expect(clearDateTitle).toContain('data atual');
    expect(clearAllTitle).toContain('TODOS');

    console.log('✅ Botões de limpeza encontrados e configurados corretamente');
  });

  test('Testar Modal de Confirmação - Limpar Data', async ({ page }) => {
    console.log('=== TESTE: Modal de Confirmação para Limpar Data ===');

    await page.click('text=Lançamentos');
    await page.waitForTimeout(2000);

    // Contar lançamentos atuais
    const currentRows = await page.locator('tbody tr').count();
    console.log(`📊 Lançamentos atuais na tabela: ${currentRows}`);

    if (currentRows > 1) { // Mais que a linha "Nenhum lançamento"
      // Clicar no botão "Limpar Data"
      await page.click('button:has-text("Limpar Data")');
      await page.waitForTimeout(1000);

      // Verificar se modal apareceu
      const modal = page.locator('text="Confirmar Exclusão"');
      const hasModal = await modal.isVisible();

      console.log(`📱 Modal de confirmação apareceu: ${hasModal}`);
      expect(hasModal).toBe(true);

      // Verificar conteúdo do modal
      const modalContent = await page.locator('[class*="modal"], .fixed').textContent();
      console.log(`📄 Conteúdo do modal:`, modalContent?.substring(0, 200));

      // Verificar se contém informações da data
      expect(modalContent).toContain('data');
      expect(modalContent).toContain('Esta ação não pode ser desfeita');

      // Cancelar para não excluir
      await page.click('text=Cancelar');
      await page.waitForTimeout(1000);

      // Verificar se modal fechou
      const modalAfterCancel = await modal.isVisible();
      console.log(`📱 Modal fechou após cancelar: ${!modalAfterCancel}`);
      expect(modalAfterCancel).toBe(false);

      console.log('✅ Modal de confirmação para data funcionando corretamente');
    } else {
      console.log('⚠️ Não há lançamentos para testar a limpeza');
    }
  });

  test('Testar Modal de Confirmação - Limpar Tudo', async ({ page }) => {
    console.log('=== TESTE: Modal de Confirmação para Limpar Tudo ===');

    await page.click('text=Lançamentos');
    await page.waitForTimeout(2000);

    // Contar lançamentos atuais
    const currentRows = await page.locator('tbody tr').count();
    console.log(`📊 Lançamentos atuais na tabela: ${currentRows}`);

    if (currentRows > 1) { // Mais que a linha "Nenhum lançamento"
      // Clicar no botão "Limpar Tudo"
      await page.click('button:has-text("Limpar Tudo")');
      await page.waitForTimeout(1000);

      // Verificar se modal apareceu
      const modal = page.locator('text="Confirmar Exclusão"');
      const hasModal = await modal.isVisible();

      console.log(`📱 Modal de confirmação apareceu: ${hasModal}`);
      expect(hasModal).toBe(true);

      // Verificar conteúdo do modal
      const modalContent = await page.locator('[class*="modal"], .fixed').textContent();
      console.log(`📄 Conteúdo do modal:`, modalContent?.substring(0, 300));

      // Verificar se contém informações gerais
      expect(modalContent).toContain('TODOS');
      expect(modalContent).toContain('banco de dados');
      expect(modalContent).toContain('Total de lançamentos');

      // Cancelar para não excluir
      await page.click('text=Cancelar');
      await page.waitForTimeout(1000);

      // Verificar se modal fechou
      const modalAfterCancel = await modal.isVisible();
      console.log(`📱 Modal fechou após cancelar: ${!modalAfterCancel}`);
      expect(modalAfterCancel).toBe(false);

      console.log('✅ Modal de confirmação geral funcionando corretamente');
    } else {
      console.log('⚠️ Não há lançamentos para testar a limpeza');
    }
  });

  test('Verificar Estados dos Botões', async ({ page }) => {
    console.log('=== TESTE: Estados dos Botões de Limpeza ===');

    await page.click('text=Lançamentos');
    await page.waitForTimeout(2000);

    // Verificar se botões estão habilitados/desabilitados conforme esperado
    const clearDateButton = page.locator('button:has-text("Limpar Data")');
    const clearAllButton = page.locator('button:has-text("Limpar Tudo")');

    const clearDateDisabled = await clearDateButton.getAttribute('disabled');
    const clearAllDisabled = await clearAllButton.getAttribute('disabled');

    console.log(`🔒 Botão "Limpar Data" desabilitado: ${clearDateDisabled !== null}`);
    console.log(`🔒 Botão "Limpar Tudo" desabilitado: ${clearAllDisabled !== null}`);

    // Se há lançamentos, botões devem estar habilitados
    const currentRows = await page.locator('tbody tr').count();
    if (currentRows > 1) {
      expect(clearDateDisabled).toBeNull(); // Não deve estar desabilitado
      expect(clearAllDisabled).toBeNull(); // Não deve estar desabilitado
      console.log('✅ Botões habilitados quando há lançamentos');
    } else {
      // Se não há lançamentos, botões podem estar desabilitados
      console.log('⚠️ Não há lançamentos - botões podem estar desabilitados');
    }

    // Verificar classes CSS
    const clearDateClasses = await clearDateButton.getAttribute('class');
    const clearAllClasses = await clearAllButton.getAttribute('class');

    console.log(`🎨 Classes do botão "Limpar Data": ${clearDateClasses}`);
    console.log(`🎨 Classes do botão "Limpar Tudo": ${clearAllClasses}`);

    // Verificar cores apropriadas
    expect(clearDateClasses).toContain('bg-orange-600'); // Laranja para data
    expect(clearAllClasses).toContain('bg-red-600'); // Vermelho para tudo

    console.log('✅ Estados e cores dos botões corretos');
  });

  test('Testar Adição de Lançamento e Verificar Botões', async ({ page }) => {
    console.log('=== TESTE: Adicionar Lançamento e Verificar Botões ===');

    await page.click('text=Lançamentos');
    await page.waitForTimeout(2000);

    // Adicionar um lançamento para garantir que há dados
    await page.click('button[aria-label="Dinheiro"]');
    await page.fill('#launch-value-input', '99,99');
    await page.click('button:has-text("Adicionar")');
    await page.waitForTimeout(3000);

    // Verificar se lançamento foi adicionado
    const tableContent = await page.locator('tbody').textContent();
    const hasNewLaunch = tableContent?.includes('99,99');

    console.log(`💰 Lançamento de R$ 99,99 adicionado: ${hasNewLaunch}`);

    if (hasNewLaunch) {
      // Verificar se botões agora estão habilitados
      const clearDateButton = page.locator('button:has-text("Limpar Data")');
      const clearAllButton = page.locator('button:has-text("Limpar Tudo")');

      const clearDateDisabled = await clearDateButton.getAttribute('disabled');
      const clearAllDisabled = await clearAllButton.getAttribute('disabled');

      console.log(`🔓 Botão "Limpar Data" habilitado: ${clearDateDisabled === null}`);
      console.log(`🔓 Botão "Limpar Tudo" habilitado: ${clearAllDisabled === null}`);

      expect(clearDateDisabled).toBeNull();
      expect(clearAllDisabled).toBeNull();

      console.log('✅ Botões habilitados após adição de lançamento');
    }

    // Screenshot para documentação
    await page.screenshot({
      path: 'database-cleanup-buttons.png',
      fullPage: false
    });

    console.log('🏁 Teste de funcionalidade básica concluído');
  });
});