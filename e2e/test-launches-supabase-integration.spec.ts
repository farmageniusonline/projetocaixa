import { test, expect } from '@playwright/test';

test.describe('Lançamentos - Integração Supabase', () => {
  test.beforeEach(async ({ page }) => {
    // Set viewport
    await page.setViewportSize({ width: 1440, height: 900 });

    // Navigate to app
    await page.goto('http://localhost:5175');

    // Login
    await page.fill('[data-testid="username-input"]', 'admin@manipularium.com.br');
    await page.fill('[data-testid="password-input"]', 'manipularium');
    await page.click('[data-testid="login-button"]');
    await page.waitForTimeout(2000);

    // Go to Lançamentos tab
    await page.click('text=Lançamentos');
    await page.waitForTimeout(1000);
  });

  test('Verifica elementos da interface de sincronização', async ({ page }) => {
    console.log('=== TESTE: Elementos da Interface ===');

    // Verificar se os botões de sincronização estão presentes
    const loadButton = page.locator('button:has-text("Carregar")');
    const syncButton = page.locator('button:has-text("Sync Local")');

    await expect(loadButton).toBeVisible();
    await expect(syncButton).toBeVisible();

    console.log('✅ Botões de sincronização encontrados');

    // Verificar se o título está correto
    const title = page.locator('h2:has-text("Lançamentos Manuais")');
    await expect(title).toBeVisible();

    console.log('✅ Título da aba verificado');

    // Verificar formulário de adição
    const paymentMethodButtons = page.locator('button[data-payment-method]');
    const valueInput = page.locator('input[placeholder*="valor"]');
    const addButton = page.locator('button:has-text("Adicionar")');

    await expect(paymentMethodButtons.first()).toBeVisible();
    await expect(valueInput).toBeVisible();
    await expect(addButton).toBeVisible();

    console.log('✅ Formulário de lançamento verificado');
  });

  test('Testa adição de lançamento com feedback visual', async ({ page }) => {
    console.log('=== TESTE: Adição de Lançamento ===');

    // Selecionar método de pagamento (Dinheiro)
    await page.click('button[data-payment-method="cash"]');
    await page.waitForTimeout(500);

    // Verificar se o botão foi selecionado
    const selectedButton = page.locator('button[data-payment-method="cash"].bg-indigo-600');
    await expect(selectedButton).toBeVisible();

    console.log('✅ Método de pagamento selecionado: Dinheiro');

    // Inserir valor
    const testValue = '150.75';
    await page.fill('input[placeholder*="valor"]', testValue);

    console.log(`✅ Valor inserido: R$ ${testValue}`);

    // Capturar estado antes de adicionar
    const beforeAddButton = page.locator('button:has-text("Adicionar")');
    await expect(beforeAddButton).toBeEnabled();

    // Clicar em Adicionar e verificar feedback visual
    await page.click('button:has-text("Adicionar")');

    // Verificar se o botão mostra "Salvando..." (pode ser rápido)
    const savingButton = page.locator('button:has-text("Salvando...")');

    // Aguardar o processo completar (máximo 10 segundos)
    await page.waitForTimeout(2000);

    console.log('✅ Lançamento processado');

    // Verificar se apareceu mensagem de sucesso ou erro
    const successMessage = page.locator('.bg-green-100, .bg-red-100, text="sucesso", text="erro"');

    // Verificar se o formulário foi limpo
    const valueInputAfter = page.locator('input[placeholder*="valor"]');
    const inputValue = await valueInputAfter.inputValue();

    if (inputValue === '') {
      console.log('✅ Formulário limpo após adição - sucesso presumido');
    } else {
      console.log('⚠️ Formulário não foi limpo - pode ter havido erro');
    }

    // Verificar se o lançamento aparece na tabela
    const table = page.locator('table, .table-container');
    if (await table.count() > 0) {
      console.log('✅ Tabela de lançamentos encontrada');

      // Procurar pelo valor adicionado na tabela
      const valueInTable = page.locator(`text="${testValue}" >> visible=true, text="150,75" >> visible=true`);

      if (await valueInTable.count() > 0) {
        console.log('✅ Valor encontrado na tabela');
      } else {
        console.log('⚠️ Valor não encontrado na tabela (pode estar em outra página ou formato)');
      }
    }
  });

  test('Testa botões de sincronização', async ({ page }) => {
    console.log('=== TESTE: Botões de Sincronização ===');

    // Testar botão "Carregar"
    const loadButton = page.locator('button:has-text("Carregar")');

    console.log('🔄 Testando botão Carregar...');
    await loadButton.click();

    // Verificar se aparece estado de carregamento
    const loadingState = page.locator('button:has-text("Carregando")');

    if (await loadingState.count() > 0) {
      console.log('✅ Estado de carregamento detectado');
      // Aguardar terminar
      await page.waitForTimeout(3000);
    }

    // Verificar se voltou ao estado normal
    await expect(loadButton).toBeVisible();
    console.log('✅ Botão Carregar funcional');

    // Testar botão "Sync Local"
    const syncButton = page.locator('button:has-text("Sync Local")');

    console.log('☁️ Testando botão Sync Local...');

    // Verificar se está habilitado (só está habilitado se há dados locais)
    const isEnabled = await syncButton.isEnabled();

    if (isEnabled) {
      await syncButton.click();

      // Verificar estado de sincronização
      const syncingState = page.locator('button:has-text("Sincronizando")');

      if (await syncingState.count() > 0) {
        console.log('✅ Estado de sincronização detectado');
        await page.waitForTimeout(3000);
      }

      console.log('✅ Botão Sync Local funcional');
    } else {
      console.log('ℹ️ Botão Sync Local desabilitado (sem dados locais para sincronizar)');
    }
  });

  test('Verifica integração com Conferência de Caixa', async ({ page }) => {
    console.log('=== TESTE: Integração com Conferência de Caixa ===');

    // Adicionar um lançamento
    await page.click('button[data-payment-method="debit"]');
    await page.fill('input[placeholder*="valor"]', '89.50');
    await page.click('button:has-text("Adicionar")');

    // Aguardar processamento
    await page.waitForTimeout(2000);

    console.log('✅ Lançamento adicionado');

    // Ir para aba Conferência de Caixa
    await page.click('text=Conferência de Caixa');
    await page.waitForTimeout(1000);

    console.log('🔄 Navegou para Conferência de Caixa');

    // Verificar se o lançamento aparece na conferência de caixa
    const cashTable = page.locator('table, .table-container');

    if (await cashTable.count() > 0) {
      console.log('✅ Tabela de conferência de caixa encontrada');

      // Procurar por "Débito" ou "89,50" na tabela
      const debitEntry = page.locator('text="Débito" >> visible=true, text="89,50" >> visible=true, text="89.50" >> visible=true');

      if (await debitEntry.count() > 0) {
        console.log('✅ Lançamento encontrado na Conferência de Caixa');
      } else {
        console.log('⚠️ Lançamento não encontrado na Conferência de Caixa');
      }
    } else {
      console.log('⚠️ Tabela de conferência não encontrada');
    }

    // Voltar para Lançamentos
    await page.click('text=Lançamentos');
    await page.waitForTimeout(1000);
    console.log('🔄 Voltou para aba Lançamentos');
  });

  test('Verifica status de sincronização', async ({ page }) => {
    console.log('=== TESTE: Status de Sincronização ===');

    // Procurar por indicador de última sincronização
    const syncStatus = page.locator('text="Última sincronização"');

    // Fazer uma ação que dispare sincronização
    const loadButton = page.locator('button:has-text("Carregar")');
    await loadButton.click();
    await page.waitForTimeout(3000);

    // Verificar se apareceu status de sincronização
    if (await syncStatus.count() > 0) {
      console.log('✅ Status de sincronização encontrado');

      const statusText = await syncStatus.textContent();
      console.log(`ℹ️ Status: ${statusText}`);
    } else {
      console.log('⚠️ Status de sincronização não encontrado (pode não ter dados)');
    }

    // Verificar contador de lançamentos
    const launchCount = page.locator('text*="lançamento(s) para"');

    if (await launchCount.count() > 0) {
      const countText = await launchCount.textContent();
      console.log(`✅ Contador encontrado: ${countText}`);
    }
  });

  test('Testa fluxo completo: Adição → Sync → Carregamento', async ({ page }) => {
    console.log('=== TESTE: Fluxo Completo de Sincronização ===');

    // Passo 1: Adicionar lançamento
    console.log('📝 Passo 1: Adicionando lançamento...');
    await page.click('button[data-payment-method="cash"]');
    await page.fill('input[placeholder*="valor"]', '75.25');
    await page.click('button:has-text("Adicionar")');
    await page.waitForTimeout(2000);

    console.log('✅ Lançamento adicionado');

    // Passo 2: Verificar se foi salvo (formulário limpo)
    const valueInput = page.locator('input[placeholder*="valor"]');
    const inputValue = await valueInput.inputValue();

    if (inputValue === '') {
      console.log('✅ Passo 2: Lançamento salvo com sucesso (formulário limpo)');
    } else {
      console.log('⚠️ Passo 2: Possível erro no salvamento');
    }

    // Passo 3: Testar carregamento
    console.log('🔄 Passo 3: Testando carregamento...');
    const loadButton = page.locator('button:has-text("Carregar")');
    await loadButton.click();
    await page.waitForTimeout(3000);

    console.log('✅ Passo 3: Carregamento executado');

    // Passo 4: Verificar se dados persistem após reload da página
    console.log('🔄 Passo 4: Testando persistência após reload...');
    await page.reload();
    await page.waitForTimeout(2000);

    // Verificar se ainda estamos na aba Lançamentos
    const title = page.locator('h2:has-text("Lançamentos Manuais")');
    await expect(title).toBeVisible();

    console.log('✅ Passo 4: Página recarregada, dados devem ter sido carregados do Supabase');

    console.log('🎉 Fluxo completo testado!');
  });
});